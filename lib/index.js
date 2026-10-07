/**
 * cliproxyapi-status — Host half.
 *
 * Surfaces the state an operator needs about the local CLIProxyAPI install:
 * the expiry-router account ranking (quota windows, exhaustion) **grouped per
 * platform**, the WorkBuddy model list the router currently applies, and the
 * OAuth credentials CPA holds.
 *
 * Credit packages are never pooled across platforms: a platform's accounts are
 * ranked against each other (so its soonest-expiring packages burn first), but
 * WorkBuddy and Trae totals stay apart. The projection therefore carries one
 * `groups` entry per platform instead of a single cross-platform total, and the
 * flat `accounts` / `packages` arrays are provider-tagged copies for consumers
 * that group them again.
 *
 * The one exception is `urgent`: packages dying soon, from every platform,
 * soonest first. Its window widens 24h -> 3d -> 7d until it finds something, so
 * the list is never empty while credits are still dying, and the chosen step is
 * published as `urgentLabel` so a 7-day view is never read as a 24-hour one. It
 * exists to answer "what should I burn first?", is rendered as a read-only list
 * above everything else, and is never consulted by the scheduler — so it cannot
 * merge the platforms the rules keep apart.
 *
 * The browser cannot read CPA directly: its management API is another origin
 * (no CORS) and its key is a secret that must not reach the page bundle. So the
 * Host reads CPA over loopback and republishes a secret-free projection at
 * `/api/cliproxyapi/status`, which the Client half polls from its settings
 * section.
 *
 * @module dsh-cliproxyapi-status
 */
import { readFileSync } from 'node:fs'

/** Loader row name; also the label used in effect diagnostics. */
export const name = 'cliproxyapi-status'

/** The Host serves the projection over the browser carrier. */
export const inject = ['webServer']

const ROUTE_PATH = '/api/cliproxyapi/status'
const DEFAULT_BASE_URL = 'http://127.0.0.1:8317'
const DEFAULT_KEYS_PATH = '/Users/lingsmbp/Library/Application Support/CLIProxyAPI/keys.env'
const REQUEST_TIMEOUT_MS = 8000
const CACHE_MS = 5000

/**
 * The widening ladder for the "about to expire" list, mirroring urgentWindows
 * in the expiry-router panel: start at 24 hours, widen to 3 days, then 7 days,
 * and stop at the first step that has anything.
 */
const URGENT_WINDOWS_MS = [24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000]

/** Addresses the DSH page itself uses; every other caller is refused. */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * Resolve the deployment-varying settings from the row config.
 * @param config - the row's `config` object, possibly empty.
 * @returns the resolved settings.
 */
function resolveSettings(config) {
  const raw = config !== null && typeof config === 'object' ? config : {}
  return {
    baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl !== '' ? raw.baseUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL,
    keysPath: typeof raw.keysPath === 'string' && raw.keysPath !== '' ? raw.keysPath : DEFAULT_KEYS_PATH,
    managementKey: typeof raw.managementKey === 'string' && raw.managementKey !== '' ? raw.managementKey : undefined,
  }
}

/**
 * Read CPA's management key. Config wins; otherwise the plaintext copy CPA's own
 * control helpers keep beside the config (`keys.env`) is read at request time, so
 * no secret is duplicated into a dsh configuration layer.
 * @param settings - resolved plugin settings.
 * @returns the management key.
 * @throws when neither source supplies one.
 */
function managementKey(settings) {
  if (settings.managementKey !== undefined) return settings.managementKey
  let text
  try {
    text = readFileSync(settings.keysPath, 'utf8')
  } catch (error) {
    throw new Error(`cannot read ${settings.keysPath}: ${error.message}`)
  }
  const match = /^\s*CPA_MGMT_KEY\s*=\s*"?([^"\n]+)"?/m.exec(text)
  if (match === null) throw new Error(`no CPA_MGMT_KEY in ${settings.keysPath}`)
  return match[1].trim()
}

/**
 * Read one CPA management endpoint.
 * @param baseUrl - CPA origin.
 * @param path - management path below `/v0/management`.
 * @param key - management key.
 * @returns the parsed JSON body.
 * @throws when the transport fails or answers a non-2xx status.
 */
async function managementGet(baseUrl, path, key) {
  const response = await fetch(`${baseUrl}/v0/management${path}`, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  return await response.json()
}

/** The OAuth credentials worth naming on the card, without token material. */
function readCredentials(files) {
  const codex = []
  const counts = new Map()
  for (const file of files) {
    const provider = typeof file.provider === 'string' ? file.provider : (typeof file.type === 'string' ? file.type : 'unknown')
    counts.set(provider, (counts.get(provider) ?? 0) + 1)
    if (provider !== 'codex') continue
    const claims = file.id_token !== null && typeof file.id_token === 'object' ? file.id_token : {}
    codex.push({
      label: file.label ?? file.email ?? provider,
      plan: typeof claims.plan_type === 'string' ? claims.plan_type : undefined,
      activeUntil: typeof claims.chatgpt_subscription_active_until === 'string' ? claims.chatgpt_subscription_active_until : undefined,
      status: file.status ?? (file.disabled === true ? 'disabled' : 'unknown'),
      disabled: file.disabled === true,
      success: typeof file.success === 'number' ? file.success : undefined,
      failed: typeof file.failed === 'number' ? file.failed : undefined,
    })
  }
  return { codex, counts: Object.fromEntries([...counts].sort((a, b) => a[0].localeCompare(b[0]))) }
}

/** Project one expiry-router account into the fields the card renders. */
function readAccount(account) {
  return {
    provider: account.provider,
    nickname: account.nickname ?? account.uid ?? account.auth_id,
    rank: account.rank,
    soonest: account.soonest,
    atRisk: account.at_risk,
    total: account.total,
    packages: account.packages,
    reason: account.reason,
    disabled: account.disabled === true,
    exhausted: account.exhausted === true,
  }
}

/** Project one credit package: what expires when, and how much is left. */
function readPackage(pkg) {
  return {
    provider: pkg.provider,
    account: pkg.account ?? pkg.uid,
    name: pkg.name,
    remain: pkg.remain,
    size: pkg.size,
    end: pkg.end,
    rank: pkg.rank,
    soonest: pkg.is_soonest === true,
  }
}

/**
 * Project the per-platform pools the card renders. Platforms are never merged,
 * so every number here belongs to exactly one provider: `remain` / `atRisk` are
 * that platform's own accounts added up, which is exactly how the scheduler
 * treats them (accounts on one platform compete; the platforms do not).
 *
 * `byProvider` is the authoritative `/preview` shape. When it is missing — an
 * older expiry-router — the groups are rebuilt from the provider-tagged flat
 * rows so the card still shows per-platform pools instead of one wrong total.
 * @param byProvider - `/preview`'s `by_provider` object.
 * @param accounts - the flat, provider-tagged account rows.
 * @param packages - the flat, provider-tagged package rows.
 * @returns one entry per provider, in the order `/preview` lists them.
 */
function readGroups(byProvider, accounts, packages) {
  const source = byProvider !== null && typeof byProvider === 'object' ? byProvider : {}
  const names = Object.keys(source).length > 0
    ? Object.keys(source)
    : [...new Set(accounts.map((row) => row.provider).filter((name) => typeof name === 'string'))]
  const sum = (rows, field) => rows.reduce((total, row) => total + (typeof row[field] === 'number' ? row[field] : 0), 0)
  return names.map((provider) => {
    const entry = source[provider] ?? {}
    const groupAccounts = Array.isArray(entry.accounts)
      ? entry.accounts.map(readAccount)
      : accounts.filter((row) => row.provider === provider).map(readAccount)
    const groupPackages = Array.isArray(entry.packages)
      ? entry.packages.map(readPackage)
      : packages.filter((row) => row.provider === provider).map(readPackage)
    const totals = entry.totals ?? {}
    return {
      provider,
      accounts: groupAccounts,
      packages: groupPackages.sort((a, b) => String(a.end).localeCompare(String(b.end))),
      remain: typeof totals.remain === 'number' ? totals.remain : sum(groupAccounts, 'total'),
      atRisk: typeof totals.at_risk === 'number' ? totals.at_risk : sum(groupAccounts, 'atRisk'),
    }
  })
}

/**
 * The packages that die soon, from every platform, soonest first.
 *
 * This is the only list in the projection that intentionally mixes platforms,
 * because "what should I spend first?" is a question about time rather than
 * about which platform owns the credit. It is VIEW ONLY: the scheduler still
 * ranks each platform's accounts against each other and never compares a Trae
 * deadline with a WorkBuddy one.
 *
 * The window widens 24h -> 3d -> 7d until it finds something, so the card is
 * never empty while credits are still dying. The chosen step comes back in
 * `window`, and the Client half prints it so a 7-day view is never mistaken for
 * a 24-hour one.
 *
 * @param urgent - `/preview`'s `urgent` rows when the running plugin build has
 *   them (added together with the panel section).
 * @param windowSeconds - `/preview`'s `urgent_window` (a Go duration string),
 *   used only to label the list the plugin already chose.
 * @param packages - the flat, provider-tagged package rows, used to rebuild the
 *   list when talking to an older plugin build that does not send `urgent`.
 * @returns `{ rows, window }`, rows soonest-first.
 */
function readUrgent(urgent, windowSeconds, packages) {
  const fromPlugin = Array.isArray(urgent)
  const seconds = parseDurationSeconds(windowSeconds)
  // The Host knows it can trust the plugin only when the plugin also said WHICH
  // window it used: an empty list plus a window means the widest step really
  // was searched. An empty list with no window is indistinguishable from "this
  // plugin build predates the ladder", so it must be re-derived here.
  if (fromPlugin && seconds !== undefined) {
    return { rows: urgent.map(readPackage), windowSeconds: seconds, exhausted: urgent.length === 0 }
  }
  const derived = deriveUrgent(packages)
  return {
    rows: derived.rows,
    // Prefer the window the plugin names; otherwise the one the local ladder
    // landed on, and only as a last resort infer it from the rows themselves.
    windowSeconds: seconds ?? derived.windowSeconds ?? inferWindowSeconds(derived.rows),
    exhausted: derived.exhausted,
  }
}

/**
 * Rebuild the urgent list locally, applying the same 24h -> 3d -> 7d ladder the
 * plugin uses. Only needed against an older plugin build.
 * @param packages - the flat, provider-tagged package rows.
 * @returns `{ rows, windowSeconds, exhausted }`: the rows inside the narrowest
 *   window that has any, soonest-first; the step used; and whether even the
 *   widest step came up empty.
 */
function deriveUrgent(packages) {
  const dated = packages
    .filter((row) => typeof row.end === 'string' && row.end !== '')
    .map((row) => ({ row, end: Date.parse(row.end.replace(' ', 'T')) }))
    .filter((entry) => Number.isFinite(entry.end))
    .sort((a, b) => a.end - b.end)
  const now = Date.now()
  const widest = URGENT_WINDOWS_MS[URGENT_WINDOWS_MS.length - 1]
  // No dated packages at all means "cannot tell", NOT "nothing expires": an
  // empty snapshot is not evidence of absence, and saying otherwise is exactly
  // the bug this card used to have.
  if (dated.length === 0) return { rows: [], windowSeconds: widest / 1000, exhausted: false }
  for (const step of URGENT_WINDOWS_MS) {
    const limit = now + step
    const hit = dated.filter((entry) => entry.end <= limit)
    if (hit.length > 0) {
      return { rows: hit.map((entry) => readPackage(entry.row)), windowSeconds: step / 1000, exhausted: false }
    }
  }
  return { rows: [], windowSeconds: widest / 1000, exhausted: true }
}

/**
 * The narrowest ladder step that still covers every row, so the label matches
 * what is on screen even when the plugin did not say.
 * @param rows - the urgent rows.
 * @returns the matching step in seconds.
 */
function inferWindowSeconds(rows) {
  const now = Date.now()
  const furthest = rows.reduce((max, row) => {
    const end = Date.parse(String(row.end).replace(' ', 'T'))
    return Number.isFinite(end) ? Math.max(max, end - now) : max
  }, 0)
  for (const step of URGENT_WINDOWS_MS) {
    if (furthest <= step) return step / 1000
  }
  return URGENT_WINDOWS_MS[URGENT_WINDOWS_MS.length - 1] / 1000
}

/**
 * Parse a Go duration string ("24h0m0s", "72h0m0s") into seconds.
 * @param value - the duration string, or anything else.
 * @returns seconds, or undefined when it cannot be read.
 */
function parseDurationSeconds(value) {
  if (typeof value !== 'string' || value === '') return undefined
  const match = /^(\d+(?:\.\d+)?)h(\d+(?:\.\d+)?)m(\d+(?:\.\d+)?)s$/.exec(value.trim())
  if (match === null) return undefined
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

/**
 * Label a window in seconds the way an operator reads it: 24 hours, 3 days,
 * 7 days, or a plain hour count for anything unexpected.
 * @param seconds - the window length.
 * @returns the label.
 */
function windowLabel(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return ''
  // The ladder's steps get their own names: 86400 must read "24 小时", not
  // "1 天", because the whole point is to say which step was used.
  if (seconds === 86400) return '24 小时'
  if (seconds === 259200) return '3 天'
  if (seconds === 604800) return '7 天'
  if (seconds % 86400 === 0) return `${seconds / 86400} 天`
  if (seconds % 3600 === 0) return `${seconds / 3600} 小时`
  return `${Math.round(seconds / 3600)} 小时`
}

/**
 * Project the model list the router currently applies.
 *
 * `applied_at` is absent until the first successful apply (the router omits a
 * zero timestamp rather than publishing "0001-01-01T00:00:00Z"), and
 * `last_error` is absent or empty when the last apply succeeded. Both are
 * collapsed to `undefined` here so the card shows "—" / no banner instead of a
 * bogus timestamp or "Last apply failed: undefined".
 */
function readModels(state) {
  const kept = Array.isArray(state.kept) ? state.kept : []
  const appliedAt = typeof state.applied_at === 'string' && state.applied_at !== '' ? state.applied_at : undefined
  const lastError = typeof state.last_error === 'string' && state.last_error !== '' ? state.last_error : undefined
  return {
    mode: state.mode,
    appliedAt: appliedAt ?? (typeof state.last_apply === 'string' && state.last_apply !== '' ? state.last_apply : undefined),
    lastError,
    patchPath: state.patch_path,
    kept: kept.map((entry) => ({
      id: entry.id,
      name: entry.name ?? entry.id,
      credits: entry.credits,
      alive: entry.alive !== false,
      badges: Array.isArray(entry.badges) ? entry.badges : [],
    })),
    droppedCount: Array.isArray(state.dropped) ? state.dropped.length : 0,
  }
}

/**
 * Collect the projection. A failing upstream is reported inside an `ok: false`
 * document rather than as an HTTP error, so the card can name which part of CPA
 * is unreachable.
 * @param settings - resolved plugin settings.
 * @returns the JSON document the route answers with.
 */
async function collect(settings) {
  const fetchedAt = new Date().toISOString()
  let key
  try {
    key = managementKey(settings)
  } catch (error) {
    return { ok: false, fetchedAt, baseUrl: settings.baseUrl, error: error.message }
  }
  try {
    const [preview, state, auth] = await Promise.all([
      managementGet(settings.baseUrl, '/plugins/expiry-router/preview', key),
      managementGet(settings.baseUrl, '/plugins/expiry-router/models/state', key),
      managementGet(settings.baseUrl, '/auth-files', key),
    ])
    const accounts = Array.isArray(preview.accounts) ? preview.accounts : []
    const packages = Array.isArray(preview.packages) ? preview.packages : []
    // Read once: it both picks the rows and decides which ladder step was used.
    const urgent = readUrgent(preview.urgent, preview.urgent_window, packages)
    return {
      ok: true,
      fetchedAt,
      baseUrl: settings.baseUrl,
      route: {
        version: preview.version,
        strategy: preview.strategy,
        generatedAt: preview.generated_at,
        age: preview.age,
        maxAge: preview.max_age,
        stale: preview.stale === true,
        providers: Array.isArray(preview.providers) ? preview.providers : [],
        // One pool per platform. There is deliberately no cross-platform
        // `totals`: summing WorkBuddy and Trae credits would describe a pool
        // that does not exist, because neither platform can spend the other's.
        groups: readGroups(preview.by_provider, accounts, packages),
        accounts: accounts.map(readAccount),
        // Sorted here once so every consumer renders the same soonest-first
        // order the CPA panel documents ("越靠上越该先烧") — within a platform.
        packages: packages.map(readPackage).sort((a, b) => String(a.end).localeCompare(String(b.end))),
        // The ONE deliberately cross-platform list: packages dying soon,
        // soonest first, so the card can answer "what should I burn first?".
        // View only — the scheduler ranks inside each platform and never reads
        // this. The window widens 24h -> 3d -> 7d; the label travels with it so
        // the card can say which step it is showing.
        urgent: urgent.rows,
        urgentSeconds: urgent.windowSeconds,
        urgentLabel: windowLabel(urgent.windowSeconds),
        // True only when the widest step really was tried and found nothing.
        // The card's empty message keys on this, so it cannot claim a 7-day
        // search that never happened.
        urgentExhausted: urgent.exhausted,
      },
      models: readModels(state),
      credentials: readCredentials(Array.isArray(auth.files) ? auth.files : []),
    }
  } catch (error) {
    return {
      ok: false,
      fetchedAt,
      baseUrl: settings.baseUrl,
      error: error.name === 'TimeoutError' ? `CLIProxyAPI did not answer within ${REQUEST_TIMEOUT_MS} ms` : error.message,
    }
  }
}

/**
 * Register the loopback-guarded projection route.
 * @param ctx - the plugin context.
 * @param config - the row's `config` object.
 */
export function apply(ctx, config) {
  const settings = resolveSettings(config)
  let cache = { at: 0, document: undefined }
  const route = {
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (req, res) => {
      const address = req.socket === null || req.socket === undefined ? undefined : req.socket.remoteAddress
      if (typeof address !== 'string' || !LOOPBACK.has(address)) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'forbidden: loopback only' }))
        return
      }
      const now = Date.now()
      if (cache.document === undefined || now - cache.at > CACHE_MS) {
        cache = { at: now, document: await collect(settings) }
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(cache.document))
    },
  }
  const dispose = ctx.webServer.register(route)
  ctx.effect(() => dispose, `${name}: ${ROUTE_PATH}`)
}
