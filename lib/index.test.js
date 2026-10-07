/**
 * Ladder regression tests for the "expiring soon" card.
 *
 * Run with:  node --test lib/
 *
 * These drive the REAL route handler that the browser calls, rather than
 * poking at helpers, because the bug this file exists to prevent was a wiring
 * bug: the card claimed "nothing expires within 7 days" while a package was due
 * in 36 hours. That happened because the empty-state message did not
 * distinguish "the widest step was searched and came up empty" from "no usable
 * expiry data at all". A helper-level test would have missed it.
 *
 * No test framework is added: node's built-in test runner is enough for a
 * package that deliberately ships without a toolchain.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from './index.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** An ISO-ish local timestamp, the format the provider plugins actually emit. */
function at(offsetMs) {
  const d = new Date(Date.now() + offsetMs)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Build a `/preview` payload with the given package deadlines. */
function preview(packages) {
  const accounts = [
    { provider: 'trae', auth_id: 'tr-1', nickname: 'lingyirEd', total: 100, at_risk: 10 },
    { provider: 'workbuddy', auth_id: 'wb-1', nickname: '18617097898', total: 100, at_risk: 10 },
  ]
  return {
    plugin: 'expiry-router',
    version: 'test',
    strategy: 'order',
    providers: ['trae', 'workbuddy'],
    generated_at: new Date().toISOString(),
    age: '1s',
    stale: false,
    providers_seen: 2,
    accounts,
    packages,
    by_provider: {
      trae: { accounts: [accounts[0]], packages: packages.filter((p) => p.provider === 'trae'), totals: { at_risk: 10, remain: 100 } },
      workbuddy: { accounts: [accounts[1]], packages: packages.filter((p) => p.provider === 'workbuddy'), totals: { at_risk: 10, remain: 100 } },
    },
  }
}

function pkg(provider, end, remain = 50) {
  return { provider, account: provider === 'trae' ? 'lingyirEd' : '18617097898', name: '包', remain, size: 100, end, rank: 1 }
}

/**
 * Drive the route with a stubbed management API.
 * @param previewBody - what `/plugins/expiry-router/preview` answers.
 * @param pluginSendsUrgent - when false, the preview is stripped of the
 *   `urgent*` fields, simulating a plugin build older than the ladder.
 * @returns the route's JSON document.
 */
async function fetchRoute(previewBody, pluginSendsUrgent) {
  const body = JSON.parse(JSON.stringify(previewBody))
  if (!pluginSendsUrgent) {
    delete body.urgent
    delete body.urgent_window
    delete body.urgent_label
  } else {
    // Mimic what the current plugin build computes server-side.
    const ladder = [DAY, 3 * DAY, 7 * DAY]
    const dated = body.packages
      .filter((p) => typeof p.end === 'string' && p.end !== '')
      .map((p) => ({ p, t: Date.parse(p.end.replace(' ', 'T')) }))
      .filter((e) => Number.isFinite(e.t))
      .sort((a, b) => a.t - b.t)
    let picked = null
    for (const step of ladder) {
      const hit = dated.filter((e) => e.t <= Date.now() + step)
      if (hit.length > 0) { picked = { step, rows: hit.map((e) => e.p) }; break }
    }
    body.urgent = picked ? picked.rows : []
    body.urgent_window = `${(picked ? picked.step : 7 * DAY) / HOUR}h0m0s`
    body.urgent_label = picked ? (picked.step === DAY ? '24 小时' : picked.step === 3 * DAY ? '3 天' : '7 天') : '7 天'
  }

  const keyFile = join(mkdtempSync(join(tmpdir(), 'cpa-status-')), 'keys.env')
  writeFileSync(keyFile, 'CPA_MGMT_KEY=test-key\n')

  let handler
  apply(
    { webServer: { register: (route) => { handler = route.handler; return () => {} } }, effect: () => {} },
    { keysPath: keyFile },
  )

  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const path = String(url).replace('http://127.0.0.1:8317/v0/management', '')
    const payloads = {
      '/plugins/expiry-router/preview': body,
      '/plugins/expiry-router/models/state': { kept: [] },
      '/auth-files': { files: [] },
    }
    if (!(path in payloads)) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => payloads[path] }
  }
  try {
    let captured
    await handler(
      { socket: { remoteAddress: '127.0.0.1' }, url: '/api/cliproxyapi/status' },
      { writeHead: () => {}, end: (text) => { captured = JSON.parse(text) } },
    )
    return captured.route
  } finally {
    globalThis.fetch = original
  }
}

test('nothing within 24h widens to 3 days and reports that step', async () => {
  const route = await fetchRoute(preview([pkg('workbuddy', at(36 * HOUR), 7), pkg('trae', at(30 * DAY))]), true)
  assert.equal(route.urgentSeconds, 259200, 'should land on the 3-day step')
  assert.equal(route.urgentLabel, '3 天')
  assert.equal(route.urgent.length, 1)
  assert.equal(route.urgent[0].provider, 'workbuddy')
  assert.equal(route.urgentExhausted, false)
})

test('nothing within 3 days widens to 7 days', async () => {
  const route = await fetchRoute(preview([pkg('trae', at(6 * DAY)), pkg('workbuddy', at(30 * DAY))]), true)
  assert.equal(route.urgentSeconds, 604800, 'should land on the 7-day step')
  assert.equal(route.urgentLabel, '7 天')
  assert.equal(route.urgent.length, 1)
})

test('content inside 24h keeps the narrowest step', async () => {
  const route = await fetchRoute(preview([pkg('trae', at(5 * HOUR)), pkg('workbuddy', at(40 * DAY))]), true)
  assert.equal(route.urgentSeconds, 86400, 'should stay on the 24-hour step')
  assert.equal(route.urgentLabel, '24 小时')
})

test('an empty list only claims "nothing expires" when 7 days was really searched', async () => {
  const route = await fetchRoute(preview([pkg('trae', at(30 * DAY)), pkg('workbuddy', at(40 * DAY))]), true)
  assert.equal(route.urgent.length, 0)
  assert.equal(route.urgentExhausted, true, 'a genuinely empty 7-day search may say so')
})

test('no usable expiry data reports "cannot tell", never "nothing expires"', async () => {
  // The regression: an empty snapshot (no comparable deadlines anywhere) must
  // not be presented as proof that nothing is expiring. Here the plugin build
  // predates the ladder, so the Host has to decide — and with no dated packages
  // at all it can only say "cannot tell".
  const route = await fetchRoute(preview([]), false)
  assert.equal(route.urgent.length, 0)
  assert.equal(route.urgentExhausted, false, 'an empty snapshot is not evidence of absence')
})

test('a plugin that searched 7 days and found nothing may say so', async () => {
  // The mirror case: the plugin DID send a window, so an empty list is a real
  // result and the card is allowed to state it.
  const route = await fetchRoute(preview([]), true)
  assert.equal(route.urgent.length, 0)
  assert.equal(route.urgentExhausted, true, 'a plugin-confirmed empty search may say so')
})

test('an older plugin build still gets the ladder, computed in the Host', async () => {
  // The plugin sends no urgent* fields at all; the Host must widen on its own
  // rather than leaving the card permanently empty.
  const route = await fetchRoute(preview([pkg('workbuddy', at(36 * HOUR), 7), pkg('trae', at(30 * DAY))]), false)
  assert.equal(route.urgentSeconds, 259200, 'Host should land on the 3-day step by itself')
  assert.equal(route.urgent.length, 1)
  assert.equal(route.urgent[0].provider, 'workbuddy')
})

test('the ladder never reports a cross-platform total', async () => {
  const route = await fetchRoute(preview([pkg('trae', at(2 * HOUR)), pkg('workbuddy', at(3 * HOUR))]), true)
  assert.equal(route.totals, undefined, 'no pooled credit total may reappear')
  assert.equal(route.groups.length, 2, 'pools stay per platform')
  // The urgent list itself is allowed to mix platforms, soonest first.
  assert.deepEqual(route.urgent.map((p) => p.provider), ['trae', 'workbuddy'])
})

// ---------------------------------------------------------------------------
// Model-list projection
//
// The router omits `applied_at` until its first successful apply, and leaves
// `last_error` empty on success. Both used to reach the card raw, so a never-
// applied list rendered a "0001-01-01" clock and a clean run could render
// "Last apply failed: undefined".
// ---------------------------------------------------------------------------

/** Drive the route with a stubbed `/plugins/expiry-router/models/state`. */
async function fetchModels(modelsState) {
  const keyFile = join(mkdtempSync(join(tmpdir(), 'cpa-status-')), 'keys.env')
  writeFileSync(keyFile, 'CPA_MGMT_KEY=test-key\n')

  let handler
  apply(
    { webServer: { register: (route) => { handler = route.handler; return () => {} } }, effect: () => {} },
    { keysPath: keyFile },
  )

  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const path = String(url).replace('http://127.0.0.1:8317/v0/management', '')
    const payloads = {
      '/plugins/expiry-router/preview': preview([]),
      '/plugins/expiry-router/models/state': modelsState,
      '/auth-files': { files: [] },
    }
    if (!(path in payloads)) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => payloads[path] }
  }
  try {
    let captured
    await handler(
      { socket: { remoteAddress: '127.0.0.1' }, url: '/api/cliproxyapi/status' },
      { writeHead: () => {}, end: (text) => { captured = JSON.parse(text) } },
    )
    return captured.models
  } finally {
    globalThis.fetch = original
  }
}

test('a never-applied model list carries no bogus timestamp', async () => {
  // Exactly what the router answers before its first successful apply.
  const models = await fetchModels({ mode: 'auto', applied_at: '', kept: [], dropped: [] })
  assert.equal(models.appliedAt, undefined, 'an absent apply time must stay absent, not become the zero time')
})

test('a real apply time survives the projection', async () => {
  const models = await fetchModels({
    mode: 'manual',
    applied_at: '2026-09-29T12:58:37+08:00',
    last_apply: 'wrote 3 models',
    last_error: '',
    kept: [{ id: 'hy3', name: 'Hy3', credits: 0 }],
    dropped: [],
  })
  assert.equal(models.appliedAt, '2026-09-29T12:58:37+08:00')
  assert.equal(models.lastError, undefined, 'an empty last_error means success, so no banner')
  assert.equal(models.kept.length, 1)
  assert.equal(models.droppedCount, 0)
})

test('a missing last_error never renders as undefined', async () => {
  // A router build that omits the key entirely must also read as "no error".
  const models = await fetchModels({ mode: 'auto', kept: [], dropped: [{ id: 'x' }] })
  assert.equal(models.lastError, undefined)
  assert.equal(models.droppedCount, 1)
})
