# dsh-cliproxyapi-status

A dsh profile bundle that puts the local **CLIProxyAPI** install's state on the
Web settings page, as its own section (`CLIProxyAPI · 状态` / `CLIProxyAPI · Status`,
order 152 — directly below the usage statistics section), plus a compact
**sidebar-foot indicator** for the credit packages that are about to expire.

## What it shows

| Block | Source | Fields |
|---|---|---|
| Sidebar foot | expiry-router `/plugins/expiry-router/preview` → `urgent` | the soonest-expiring package as an urgency marker + time + platform + amount (`● 7h59m  trae  145 / 200`; just the marker over `T` in the 56px rail); clicking expands the full list, clicking again collapses back to the first row |
| Expiring soon | expiry-router `/plugins/expiry-router/preview` → `urgent`, `urgent_label` | the packages that die within the chosen window (24 hours, widened to 3 days then 7 days when nothing is due sooner) across **all** platforms, soonest first, each with time left, platform, account, name and remaining credits |
| Account routing | expiry-router `/plugins/expiry-router/preview` | strategy, routed providers, snapshot freshness, and **one group per platform** — each group shows its own pooled remaining / at-risk credits and its own account rows (rank, nickname, soonest expiry, at-risk / available credits, exhausted or disabled flags) |
| OAuth credentials | CPA `/auth-files` | the Codex subscription (label, plan, active-until, status, ok/fail counters) plus a per-provider credential count |
| Model list | expiry-router `/plugins/expiry-router/models/state` | mode, applied models as chips, dropped count, apply time, the patch path it writes, and the last apply error when one exists |

### Sidebar-foot indicator

Registered on `sidebar.footer.action` (the list seat beside Settings) under its
own id, so it adds a seat rather than replacing a shipped one. The slot owner
passes `wide`, and that is the only thing deciding the shape:

| Sidebar state | Rendered |
|---|---|
| collapsed (56px rail, ~36px usable) | the urgency dot above the platform initial `T`; the countdown rides in the tooltip |
| expanded | `● 7h59m  trae  145 / 200` — marker, time, platform, amount |

Three facts, in that order: **how long is left, on which platform, and how much
is at stake.** The account nickname is never shown — the question this seat
answers is "which platform should this work go to", and a nickname would add
width without answering it. The package name is shown only in the popover: at
~256px it truncated to "签...", which told nobody anything.

**Visual weight is the point.** An earlier revision drew this as a filled,
bordered amber box spanning the sidebar. At footer size that out-shouted the
host's own controls — including the usage card directly beneath it — for
information that is ambient, not urgent. The row is now mostly typography and
alignment on a transparent background, with all of its colour spent on one 6px
marker. It also inherits the host's tokens (`--dsw-alias-label-primary`,
`--dsw-alias-bg-elevated`, …) so it tracks the active theme instead of pinning a
palette.

The marker escalates with proximity, and every step is warm:

| Time left | Marker |
|---|---|
| ≤ 24 hours | red |
| ≤ 3 days | amber |
| further out | yellow |

Green is deliberately absent: the seat only renders when a package really is
about to lapse, so a green "all good" dot would contradict the reason the row
exists. Escalation describes degree, never presence.

The trigger and the popover rows share one grid
(`6px 44px 70px minmax(0,1fr)`), so opening the list drops more rows into the
columns the eye already found rather than shifting them. The platform column is
wide enough for the longest key actually in use (`workbuddy`) — a truncated
platform name would defeat the one column that says where the credit lives.

When nothing is expiring the seat renders **nothing at all**, so it never
occupies space with a placeholder.

Clicking toggles the full list of everything due within the current window
(soonest first); clicking again collapses back to the single soonest row. It
reuses the same `urgent` rows as the settings card, so the two never disagree.
Collapsing the sidebar closes the popover, since the rail has no room to anchor
it.

### Platforms are never merged

Credit packages are **not** pooled across platforms. WorkBuddy and Trae each
rank their own accounts against each other, so a platform's soonest-expiring
packages burn first — but neither platform can spend the other's credits, and no
number in this card adds them together. Concretely:

* the projection carries `route.groups` (one entry per provider, each with its
  own `remain` / `atRisk`) and **no cross-platform `totals`**;
* the accounts table and the credit-package table are rendered once per
  platform, each with that platform's own count and remaining total;
* when the Host is an older build that only sends the flat rows, the Client half
  regroups them by `provider` rather than summing them into one pool.

The sidebar foot and the **Expiring soon** card are the deliberate exceptions —
both interleave platforms by deadline, because "what should I burn first?" is a
question about time. Both are read-only views; the scheduler never consults
them.

The **Expiring soon** card is the single deliberate exception, and it is a
*view* rather than a policy: it interleaves both platforms by deadline so the
question "what should I burn first?" has a one-glance answer. The scheduler
never reads it — it still ranks each platform's own accounts, and the card's
caption says so.

Its window **widens 24 hours → 3 days → 7 days** and stops at the first step with
content, so the card is never blank while credits are still dying. The heading
names the step in use, and a widened list says explicitly that nothing is due
within 24 hours — a 7-day view is never presented as a 24-hour one.

The empty state has **three** distinct outcomes, and telling them apart matters
more than it looks:

| Situation | What the card says |
|---|---|
| Widest step searched, still nothing | "no package expires in the next 7 days" |
| No comparable expiry data at all | "cannot tell which packages are about to lapse" |
| Widening not yet applied | the Host or the Client applies the ladder first |

Collapsing the middle row into the first is exactly the bug this section exists
to prevent: an empty snapshot is not evidence of absence, so the card may only
claim "nothing expires" when a search actually established it. The projection
carries `urgentExhausted` for this reason — `true` only when the widest step was
really tried.

The ladder lives in **both halves**: the Host applies it, and the Client
re-applies it when the Host predates it (an empty `urgent` with no
`urgentSeconds`). That redundancy is deliberate; a stale Host must not be able
to leave the card permanently claiming an absence it never checked.

## How it is wired

The browser cannot read CPA directly — its management API is a different origin
(no CORS) and its key is a secret that must not reach the page bundle. So:

```
settings section (client.js)  --fetch-->  /api/cliproxyapi/status (host half)  --loopback-->  CPA management API
```

* **Host half** (`lib/index.js`) registers one exact route through
  `ctx.webServer.register`. It refuses any caller whose socket address is not
  loopback, reads CPA's management key at request time, and republishes a
  secret-free projection with a 5-second coalescing cache.
* **Client half** (`lib/client.js`) registers a `settings.section` entry and
  polls that route every 20 seconds. It is hand-written as the loader's
  lazy-CJS factory artifact, since a package outside the dsh repository has no
  build preset for it. Only `react` is required from the module table.

## Configuration

Both fields default to this machine's layout, so the row config is optional:

| Field | Default | Meaning |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:8317` | the CLIProxyAPI origin |
| `keysPath` | `~/Library/Application Support/CLIProxyAPI/keys.env` | file holding `CPA_MGMT_KEY`, read per request |
| `managementKey` | unset | set to bypass the file and pass a key directly |

The key is never copied into a dsh configuration layer; the plaintext copy CPA's
own control helpers keep is read instead.

## Install / re-enable

```sh
dsh plugin --profile desktop add /Users/lingsmbp/Documents/github/dsh-cliproxyapi-status
```

Or select `dsh-cliproxyapi-status` on the Web sidebar's **Plugins** page. A
profile reset rewrites the profile's `package.json` and `cordis.patch.yml`, so
after a reset the registry row is gone and this bundle has to be selected again;
the package stays installed at the path above.

## Failure behavior

* CPA unreachable → the section renders a red banner naming the origin and the
  transport error; the rest of the settings page is unaffected.
* `keys.env` missing or without `CPA_MGMT_KEY` → the same banner names the file.
* A non-loopback caller gets `403 {"ok":false,"error":"forbidden: loopback only"}`.
* One upstream endpoint failing fails the whole projection (all three are read
  together), so the card never shows a half-updated picture as if it were whole.
