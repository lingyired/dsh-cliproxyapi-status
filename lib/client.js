/**
 * dsh-cliproxyapi-status — Client half.
 *
 * Ships as the loader's lazy-CJS factory artifact (hand-written: this package is
 * outside the dsh repository and has no toolchain). Registers one settings
 * section that polls the Host's `/api/cliproxyapi/status` projection, plus a
 * small sidebar-foot indicator for the credits that are about to expire.
 *
 * Only `react` is required from the module table; no other plugin's values are
 * imported, which the client bundle-purity gate requires.
 */
window.__ModuleLoader__.load({
  id: "dsh-cliproxyapi-status",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const h = react.createElement;

    /** Nav position: directly after the usage statistics section. */
    const SECTION_ORDER = 152;
    const SECTION_ID = "cliproxyapi";
    /** Sidebar-foot seat, next to Settings. */
    const FOOTER_ORDER = 40;
    const FOOTER_ID = "cliproxyapi-expiry";
    const STATUS_PATH = "api/cliproxyapi/status";
    const POLL_MS = 20000;
    const FETCH_TIMEOUT_MS = 15000;

    const zh = {
      "section.title": "CLIProxyAPI · 状态",
      "action.refresh": "刷新",
      "action.refreshing": "刷新中…",
      "meta.fetched": "更新于 {time}",
      "meta.never": "尚未获取",
      "urgent.title": "{window}内即将失效 · 优先烧这些",
      "urgent.titleEmpty": "即将失效的积分包",
      "urgent.none": "未来 7 天内没有积分包到期，暂时没有需要抢着烧的额度。",
      "urgent.unknown": "还没有拿到可比较的积分包到期数据，暂时无法判断哪些包即将失效。",
      "urgent.expired": "已过期",
      "urgent.window24h": "24 小时",
      "urgent.window3d": "3 天",
      "urgent.window7d": "7 天",
      "urgent.windowDays": "{days} 天",
      "urgent.windowHours": "{hours} 小时",
      "urgent.note": "窗口按 24 小时 → 3 天 → 7 天逐级放宽，取第一个有内容的档位，当前为 {window}；上方倒计时是相对现在的真实剩余时间。{warn}本表只用于查看，故意把各平台按到期时间混排。调度器不读它：它仍只在自己平台内排序账号，跨平台既不相加积分，也不比较到期日。",
      "urgent.widened": "注意：24 小时内没有包到期，所以已放宽到 {window}，今天不必抢着烧。",
      "footer.action": "即将失效的积分包",
      "footer.title": "{provider} 最近到期的积分包：还剩 {time}",
      "footer.listTitle": "即将失效 · {window}",
      "footer.amountHeader": "剩余 / 总量",
      "footer.note": "仅查看；调度器不读此表。",
      "route.title": "账号路由",
      "route.strategy": "策略",
      "route.providers": "参与路由的 provider",
      "route.group": "{provider} 池余 {remain} · 临期 {atRisk}",
      "route.separate": "平台之间不合并：每个 provider 只统计并排序自己的账号；同一平台内的账号互相竞争（最早到期的包先烧），跨平台既不相加也不比较到期日。",
      "route.stale": "快照过期",
      "route.fresh": "快照新鲜",
      "route.age": "快照 {age} 前（上限 {maxAge}）",
      "account.rank": "#",
      "account.name": "账号",
      "account.soonest": "最早到期",
      "account.quota": "临期 / 可用",
      "account.flags": "状态",
      "flag.exhausted": "已耗尽",
      "flag.disabled": "已禁用",
      "flag.ok": "可用",
      "credentials.title": "OAuth 凭据",
      "credentials.codex": "Codex 订阅",
      "credentials.plan": "套餐 {plan}",
      "credentials.until": "有效期至 {until}",
      "credentials.counts": "凭据：{counts}",
      "models.title": "模型清单",
      "models.mode": "模式 {mode}",
      "models.kept": "已下发 {count} 个",
      "models.dropped": "未选中 {count} 个",
      "models.applied": "应用时间 {time}",
      "models.patch": "写入 {path}",
      "models.error": "上次应用失败：{error}",
      "packages.title": "积分包到期",
      "packages.groupCount": "{provider}：{count} 个包 · 本平台剩余合计 {remain}",
      "packages.end": "到期日",
      "packages.account": "账号",
      "packages.name": "包名",
      "packages.remain": "剩余 / 总量",
      "packages.rank": "优先级",
      "packages.soonest": "该账号最先到期",
      "packages.more": "展开全部 {count} 行",
      "packages.less": "收起",
      "state.loading": "读取中…",
      "state.error": "读取失败：{error}",
      "state.empty": "暂无数据",
      "state.unreachable": "无法连接 CLIProxyAPI（{baseUrl}）：{error}",
    };
    const en = {
      "section.title": "CLIProxyAPI · Status",
      "action.refresh": "Refresh",
      "action.refreshing": "Refreshing…",
      "meta.fetched": "Updated {time}",
      "meta.never": "Not fetched yet",
      "urgent.title": "Expiring within {window} · burn these first",
      "urgent.titleEmpty": "Expiring credit packages",
      "urgent.none": "No credit package expires in the next 7 days — nothing to race the clock for right now.",
      "urgent.unknown": "No comparable credit-package expiry data yet, so it is not possible to tell which packages are about to lapse.",
      "urgent.expired": "expired",
      "urgent.window24h": "24 hours",
      "urgent.window3d": "3 days",
      "urgent.window7d": "7 days",
      "urgent.windowDays": "{days} days",
      "urgent.windowHours": "{hours} hours",
      "urgent.note": "The window widens 24 hours → 3 days → 7 days and stops at the first step with content; it is currently {window}, and the countdowns are real time remaining. {warn}Read-only view; it interleaves the platforms by deadline on purpose. The scheduler never reads it — it still ranks each platform's own accounts and neither sums credits nor compares deadlines across platforms.",
      "urgent.widened": "Note: nothing expires within 24 hours, so this has widened to {window} — no rush today.",
      "footer.action": "Expiring credit packages",
      "footer.title": "{provider}'s next package to lapse: {time} left",
      "footer.listTitle": "Expiring · {window}",
      "footer.amountHeader": "Left / total",
      "footer.note": "View only; the scheduler never reads it.",
      "route.title": "Account routing",
      "route.strategy": "Strategy",
      "route.providers": "Routed providers",
      "route.group": "{provider} pool {remain} · at risk {atRisk}",
      "route.separate": "Platforms are never merged: each provider ranks and totals only its own accounts. Accounts inside one platform compete (its soonest-expiring packages burn first); nothing is summed or compared across platforms.",
      "route.stale": "Stale snapshot",
      "route.fresh": "Fresh snapshot",
      "route.age": "Snapshot {age} old (max {maxAge})",
      "account.rank": "#",
      "account.name": "Account",
      "account.soonest": "Soonest expiry",
      "account.quota": "At risk / available",
      "account.flags": "State",
      "flag.exhausted": "exhausted",
      "flag.disabled": "disabled",
      "flag.ok": "usable",
      "credentials.title": "OAuth credentials",
      "credentials.codex": "Codex subscription",
      "credentials.plan": "plan {plan}",
      "credentials.until": "active until {until}",
      "credentials.counts": "Credentials: {counts}",
      "models.title": "Model list",
      "models.mode": "mode {mode}",
      "models.kept": "{count} applied",
      "models.dropped": "{count} dropped",
      "models.applied": "applied {time}",
      "models.patch": "written to {path}",
      "models.error": "Last apply failed: {error}",
      "packages.title": "Credit package expiry",
      "packages.groupCount": "{provider}: {count} packages · {remain} left in this platform",
      "packages.end": "Expires",
      "packages.account": "Account",
      "packages.name": "Package",
      "packages.remain": "Left / total",
      "packages.rank": "Rank",
      "packages.soonest": "Soonest for this account",
      "packages.more": "Show all {count} rows",
      "packages.less": "Collapse",
      "state.loading": "Loading…",
      "state.error": "Failed: {error}",
      "state.empty": "No data",
      "state.unreachable": "Cannot reach CLIProxyAPI ({baseUrl}): {error}",
    };

    /** Copy follows the document language, the way a section outside the locale package must. */
    function t(key, params) {
      const lang = typeof document === "undefined" ? "zh" : document.documentElement.lang;
      const table = String(lang).toLowerCase().startsWith("en") ? en : zh;
      let text = table[key] ?? key;
      if (params !== undefined) {
        for (const name of Object.keys(params)) text = text.split("{" + name + "}").join(String(params[name]));
      }
      return text;
    }

    /** Short local clock for timestamps the Host sends as ISO strings. */
    function clock(value) {
      if (typeof value !== "string" || value === "") return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (n) => String(n).padStart(2, "0");
      return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    /**
     * How long is left before a credit package dies, e.g. "5h12m".
     *
     * Package deadlines arrive as local wall-clock strings ("2026-09-30
     * 23:59:59"), not ISO instants, so the space has to become a "T" before
     * Date can parse it. An unparseable or past deadline still renders, so a
     * row never silently vanishes from the list.
     */
    function countdown(value) {
      if (typeof value !== "string" || value === "") return "—";
      const end = new Date(value.replace(" ", "T"));
      if (Number.isNaN(end.getTime())) return value;
      let left = end.getTime() - Date.now();
      if (left <= 0) return t("urgent.expired");
      const minutes = Math.round(left / 60000);
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      if (days > 0) return days + "d" + hours + "h";
      if (hours > 0) return hours + "h" + (minutes % 60) + "m";
      return (minutes % 60) + "m";
    }

    /**
     * The window label in the CURRENT locale, from the Host's window length in
     * seconds.
     *
     * The Host also sends a ready-made `urgentLabel`, but it is written in
     * Chinese; the client has to render English when the page is English, so it
     * re-derives the label from `urgentSeconds` and only falls back to the
     * Host string (or, failing that, to what the rows imply) when the length is
     * missing.
     *
     * @param seconds - the window length the Host used.
     * @param hostLabel - the Host's own label, used only as a last resort.
     * @param rows - the urgent rows, used to infer the step when nothing else
     *   identifies it.
     */
    function windowLabel(seconds, hostLabel, rows) {
      if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
        if (seconds === 86400) return t("urgent.window24h");
        if (seconds === 259200) return t("urgent.window3d");
        if (seconds === 604800) return t("urgent.window7d");
        if (seconds % 86400 === 0) return t("urgent.windowDays", { days: seconds / 86400 });
        return t("urgent.windowHours", { hours: Math.round(seconds / 3600) });
      }
      return hostLabel !== "" ? hostLabel : inferUrgentLabel(rows);
    }

    /**
     * Rebuild the urgent list locally, using the same 24h -> 3d -> 7d ladder as
     * the plugin. Needed only when the Host predates the ladder, so a stale
     * Host cannot leave the card asserting "nothing is expiring" while a
     * package is in fact due tomorrow.
     *
     * @param packages - the flat, provider-tagged package rows.
     * @returns `{ rows, windowSeconds, exhausted }`.
     */
    function deriveUrgent(packages) {
      const dated = (Array.isArray(packages) ? packages : [])
        .filter((row) => typeof row.end === "string" && row.end !== "")
        .map((row) => ({ row, end: new Date(row.end.replace(" ", "T")).getTime() }))
        .filter((entry) => !Number.isNaN(entry.end))
        .sort((a, b) => a.end - b.end);
      const now = Date.now();
      const ladder = [86400, 259200, 604800];
      const widest = ladder[ladder.length - 1];
      // No dated packages at all means "cannot tell", NOT "nothing expires":
      // an empty snapshot is not evidence of absence, and claiming otherwise is
      // exactly the bug this card used to have.
      if (dated.length === 0) return { rows: [], windowSeconds: widest, exhausted: false };
      for (const seconds of ladder) {
        const limit = now + seconds * 1000;
        const hit = dated.filter((entry) => entry.end <= limit);
        if (hit.length > 0) return { rows: hit.map((entry) => entry.row), windowSeconds: seconds, exhausted: false };
      }
      return { rows: [], windowSeconds: widest, exhausted: true };
    }

    /**
     * Which ladder step the rows themselves imply, in the current locale.
     * Mirrors the Host ladder (24h -> 3d -> 7d) so the heading never claims a
     * shorter window than the list actually covers. An empty list implies the
     * widest step, because nothing shorter could have produced it.
     */
    function inferUrgentLabel(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return t("urgent.window7d");
      const day = 86400000;
      const furthest = rows.reduce((max, row) => {
        const end = new Date(String(row.end ?? "").replace(" ", "T")).getTime();
        return Number.isNaN(end) ? max : Math.max(max, end - Date.now());
      }, 0);
      if (furthest > 3 * day) return t("urgent.window7d");
      if (furthest > day) return t("urgent.window3d");
      return t("urgent.window24h");
    }

    const muted = { opacity: 0.65 };
    const styles = {
      section: { display: "flex", flexDirection: "column", gap: "16px", color: "inherit" },
      header: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" },
      title: { fontSize: "15px", fontWeight: 600, margin: 0 },
      meta: { fontSize: "12px", opacity: 0.65, display: "flex", gap: "10px", flexWrap: "wrap" },
      button: {
        appearance: "none", color: "inherit", font: "inherit", cursor: "pointer", fontSize: "12px",
        background: "transparent", border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
        borderRadius: "8px", padding: "4px 12px",
      },
      card: {
        border: "1px solid color-mix(in srgb, currentColor 14%, transparent)", borderRadius: "12px",
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
      },
      cardTitle: { fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.6 },
      row: { display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "13px" },
      kv: { display: "flex", gap: "6px", alignItems: "baseline" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
      th: { textAlign: "left", fontWeight: 600, fontSize: "11px", opacity: 0.6, padding: "4px 6px", borderBottom: "1px solid color-mix(in srgb, currentColor 14%, transparent)" },
      td: { padding: "5px 6px", borderBottom: "1px solid color-mix(in srgb, currentColor 8%, transparent)", verticalAlign: "top" },
      num: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
      badge: {
        display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "999px",
        border: "1px solid color-mix(in srgb, currentColor 30%, transparent)", opacity: 0.85,
      },
      warnBadge: {
        display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "999px",
        border: "1px solid color-mix(in srgb, #d97706 60%, transparent)", color: "#d97706",
      },
      chips: { display: "flex", gap: "6px", flexWrap: "wrap" },
      // The urgent card is the one element that shouts: it holds credits about
      // to become worthless, so it gets a warm border instead of blending into
      // the summary cards below it.
      urgentCard: {
        border: "1px solid color-mix(in srgb, #d97706 55%, transparent)", borderRadius: "12px",
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
        background: "color-mix(in srgb, #d97706 8%, transparent)",
      },
      urgentChip: {
        display: "inline-flex", gap: "2px", alignItems: "baseline", fontSize: "12px", padding: "2px 9px",
        borderRadius: "999px", border: "1px solid color-mix(in srgb, #d97706 45%, transparent)",
        background: "color-mix(in srgb, #d97706 12%, transparent)", whiteSpace: "nowrap",
      },
      // Sidebar-foot indicator. Minimalist/Swiss: the row is mostly typography
      // and alignment, with a single small semantic accent (the urgency dot)
      // rather than a filled, bordered box. A heavy amber box at this size
      // out-shouts the sidebar's own controls — including the usage card right
      // below it — which is the opposite of what a quiet status row should do.
      //
      // It adopts the host's tokens where they exist and falls back to neutral
      // grays, so it tracks the active theme instead of hardcoding a palette.
      footWide: {
        appearance: "none", font: "inherit", cursor: "pointer", textAlign: "left",
        // Four tracks for four cells: dot | time | platform | amount, the same
        // widths the popover rows use, so opening the list drops more rows into
        // the grid the eye already found. Declaring one track short wraps the
        // final cell onto a second line.
        display: "grid", gridTemplateColumns: "6px 44px 70px minmax(0,1fr)",
        alignItems: "center", gap: "10px", width: "100%", minWidth: 0,
        padding: "6px 8px", borderRadius: "6px", fontSize: "12px", lineHeight: "16px",
        color: "var(--dsw-alias-label-primary, inherit)",
        background: "transparent", border: "1px solid transparent",
      },
      footRail: {
        appearance: "none", font: "inherit", cursor: "pointer", textAlign: "center",
        // A single tight column: the dot rides directly above the platform
        // initial as one glyph pair, so the 36px seat reads as one mark rather
        // than two loose lines.
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "2px", width: "auto", padding: "2px 4px", borderRadius: "6px",
        fontSize: "10px", lineHeight: "11px", fontWeight: 600,
        color: "var(--dsw-alias-label-primary, inherit)",
        background: "transparent", border: "1px solid transparent",
      },
      // The urgency marker: a 6px dot whose colour carries the only colour in
      // the row. Replaces a filled bordered box — same signal, a fraction of the
      // visual weight, and it works at rail size too.
      footDot: { width: "6px", height: "6px", borderRadius: "50%", flex: "none" },
      // The rail's platform initial. Bare type, not a chip: at 10px a bordered
      // square reads as a button, and this seat already has one job.
      footTag: {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "14px", height: "14px", fontSize: "10px", fontWeight: 700, flex: "none",
        opacity: 0.75,
      },
      // A fixed column, not a min-width: "5d5h" and "3d19h" have to start at the
      // same x, and tabular digits keep the numbers themselves in a grid.
      footTime: {
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600,
        width: "44px", flex: "none",
      },
      // The platform column: a real name in the popover, the initial in the
      // rail. Fixed width so names line up instead of ragging.
      footRowProvider: {
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        // Wide enough for the longest platform key we actually hold
        // ("workbuddy"): a truncated platform name is worse than useless, since
        // this is the column that says WHERE the credit lives.
        opacity: 0.7, width: "70px", flex: "none",
      },
      // Tabular digits, right-aligned inside the flexible column, so "66 / 200"
      // and "150 / 150" end on the same edge and can be compared down the list.
      footAmount: {
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textAlign: "right",
        opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis",
      },
      footWrap: { position: "relative", width: "100%", minWidth: 0 },
      // The popover lifts out of the 56px rail, so it is anchored to the right
      // of the trigger rather than inside the column that cannot hold it.
      footPopover: {
        position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0, zIndex: 40,
        display: "flex", flexDirection: "column", padding: "6px 8px 8px",
        borderRadius: "10px", fontSize: "12px",
        border: "1px solid var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 16%, transparent))",
        background: "var(--dsw-alias-bg-elevated, #1f1f1f)",
        boxShadow: "0 8px 28px rgba(0,0,0,.4)",
      },
      footPopoverRail: {
        position: "absolute", bottom: 0, left: "calc(100% + 10px)", zIndex: 40,
        display: "flex", flexDirection: "column", padding: "6px 8px 8px",
        borderRadius: "10px", fontSize: "12px", minWidth: "236px",
        border: "1px solid var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 16%, transparent))",
        background: "var(--dsw-alias-bg-elevated, #1f1f1f)",
        boxShadow: "0 8px 28px rgba(0,0,0,.4)",
      },
      // A quiet caption line, not a second heading: the window is context, and
      // context should not compete with the data.
      footPopoverTitle: {
        display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px",
        fontSize: "10px", fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase",
        opacity: 0.5, padding: "2px 0 6px",
      },
      // One grid for the trigger and every row, so opening the list adds rows
      // rather than shifting columns. A hairline separates them — cheaper than
      // boxes and it keeps a long list scannable.
      footRow: {
        display: "grid", gridTemplateColumns: "6px 44px 70px minmax(0,1fr)",
        alignItems: "center", gap: "10px", whiteSpace: "nowrap", padding: "5px 0",
        borderTop: "1px solid color-mix(in srgb, currentColor 8%, transparent)",
      },
      // The provenance note is the least important thing in the popover, so it
      // is demoted to a single short line. It used to wrap to two lines and
      // outweigh the data above it.
      footNote: { opacity: 0.45, fontSize: "10px", lineHeight: "13px", marginTop: "7px" },
      tableWrap: { maxHeight: "300px", overflowY: "auto" },
      linkBtn: {
        appearance: "none", background: "transparent", border: "none", color: "inherit", cursor: "pointer",
        font: "inherit", fontSize: "11px", opacity: 0.75, padding: 0, textAlign: "left", textDecoration: "underline",
      },
      chip: {
        fontSize: "11px", padding: "2px 8px", borderRadius: "999px",
        background: "color-mix(in srgb, currentColor 8%, transparent)",
      },
      banner: {
        borderRadius: "8px", padding: "8px 12px", fontSize: "12px",
        background: "color-mix(in srgb, #dc2626 16%, transparent)",
      },
      empty: { fontSize: "13px", opacity: 0.6 },
    };

    /** One fetch of the Host projection. */
    async function fetchStatus() {
      const response = await fetch(STATUS_PATH, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(STATUS_PATH + " answered " + response.status);
      return await response.json();
    }

    /** Accounts table: one row per credential the router ranked. */
    function AccountTable(props) {
      const accounts = props.accounts;
      if (accounts.length === 0) return h("div", { style: styles.empty }, t("state.empty"));
      const head = h("tr", null,
        h("th", { style: styles.th }, t("account.rank")),
        h("th", { style: styles.th }, t("account.name")),
        h("th", { style: styles.th }, t("account.soonest")),
        h("th", { style: styles.th }, t("account.quota")),
        h("th", { style: styles.th }, t("account.flags")),
      );
      const rows = accounts.map((account, index) => {
        const flags = []
        if (account.exhausted) flags.push({ key: "flag.exhausted", warn: true })
        if (account.disabled) flags.push({ key: "flag.disabled", warn: true })
        if (flags.length === 0) flags.push({ key: "flag.ok", warn: false })
        return h("tr", { key: account.provider + "/" + (account.nickname ?? index) + "/" + index },
          h("td", { style: { ...styles.td, ...styles.num } }, account.rank ?? index + 1),
          h("td", { style: styles.td },
            h("div", null, account.nickname ?? "—"),
            h("div", { style: { ...muted, fontSize: "11px" } }, account.provider ?? ""),
          ),
          h("td", { style: { ...styles.td, ...styles.num } }, account.soonest ?? "—"),
          h("td", { style: { ...styles.td, ...styles.num } }, (account.atRisk ?? "—") + " / " + (account.total ?? "—")),
          h("td", { style: styles.td }, flags.map((flag, i) =>
            h("span", { key: flag.key, style: { ...(flag.warn ? styles.warnBadge : styles.badge), marginRight: i === flags.length - 1 ? 0 : "4px" } }, t(flag.key)),
          )),
        )
      })
      return h("table", { style: styles.table }, h("thead", null, head), h("tbody", null, rows))
    }

    /** Credit packages, soonest expiry first — the list CPA's own panel leads with. */
    function PackagesTable(props) {
      const packages = props.packages
      const [expanded, setExpanded] = react.useState(false)
      if (packages.length === 0) return h("div", { style: styles.empty }, t("state.empty"))
      const collapsed = 12
      const shown = expanded ? packages : packages.slice(0, collapsed)
      const head = h("tr", null,
        h("th", { style: styles.th }, t("packages.end")),
        h("th", { style: styles.th }, t("packages.account")),
        h("th", { style: styles.th }, t("packages.name")),
        h("th", { style: styles.th }, t("packages.remain")),
        h("th", { style: styles.th }, t("packages.rank")),
      )
      const rows = shown.map((pkg, index) => h("tr", { key: pkg.provider + "|" + pkg.account + "|" + pkg.name + "|" + pkg.end + "|" + index },
        h("td", { style: { ...styles.td, ...styles.num } },
          pkg.end ?? "—",
          pkg.soonest === true ? h("span", { style: { ...styles.badge, marginLeft: "6px" }, title: t("packages.soonest") }, "★") : null,
        ),
        h("td", { style: styles.td },
          h("div", null, pkg.account ?? "—"),
          h("div", { style: { ...muted, fontSize: "11px" } }, pkg.provider ?? ""),
        ),
        h("td", { style: styles.td }, pkg.name ?? "—"),
        h("td", { style: { ...styles.td, ...styles.num } }, (pkg.remain ?? "—") + " / " + (pkg.size ?? "—")),
        h("td", { style: { ...styles.td, ...styles.num } }, pkg.rank ?? "—"),
      ))
      return h(react.Fragment, null,
        h("div", { style: styles.tableWrap }, h("table", { style: styles.table }, h("thead", null, head), h("tbody", null, rows))),
        packages.length <= collapsed ? null : h("button", { type: "button", style: styles.linkBtn, onClick: () => setExpanded(!expanded) },
          expanded ? t("packages.less") : t("packages.more", { count: packages.length })),
      )
    }

    /** The whole settings section. */
    /**
     * Poll the Host projection on an interval.
     *
     * Shared by the settings section and the sidebar-foot indicator so the two
     * never double-poll: whichever mounts first starts the interval, and each
     * consumer keeps its own copy of the document (they read different fields).
     *
     * @returns `[document, error, reload]` — the latest document (undefined
     *   until the first answer), the last transport error, and a manual reload.
     */
    function useStatusPoll() {
      const [document_, setDocument] = react.useState(undefined);
      const [error, setError] = react.useState(undefined);

      const load = react.useCallback(async () => {
        try {
          setDocument(await fetchStatus())
          setError(undefined)
        } catch (failure) {
          setError(String(failure && failure.message ? failure.message : failure))
        }
      }, []);

      react.useEffect(() => {
        let live = true
        const tick = () => { if (live) void load() }
        tick()
        const timer = setInterval(tick, POLL_MS)
        return () => { live = false; clearInterval(timer) }
      }, [load]);

      return [document_, error, load]
    }

    /**
     * The soonest-expiring credit package, or undefined when there is none.
     * @param route - the projection's `route` object.
     * @returns the first urgent row, which the Host already sorted soonest-first.
     */
    function soonestExpiring(route) {
      const urgent = Array.isArray(route?.urgent) ? route.urgent : []
      return urgent.length > 0 ? urgent[0] : undefined
    }

    /**
     * Sidebar-foot indicator: how long until the next credit package lapses.
     *
     * Deliberately terse — "3d20h trae" collapsed, and the full list on click —
     * because this sits beside Settings and is read at a glance. The user name
     * is never shown; only the platform, which is what decides where the work
     * should go.
     *
     * Collapsed (the 56px rail) has ~36px of usable width, so it can hold the
     * platform initial + time but not full words. `props.wide` tells us which
     * state the sidebar is in; the host collapses it to the rail and re-renders
     * with wide=false.
     */
    function ExpiryFooterIndicator(props) {
      const [document_] = useStatusPoll()
      const [open, setOpen] = react.useState(false)

      // The sidebar collapsing to the rail must not leave a popover anchored to
      // a control that no longer has room for it.
      const wide = props?.wide === true
      react.useEffect(() => {
        if (!wide) setOpen(false)
      }, [wide])

      const route = document_?.route ?? {}
      const urgent = Array.isArray(route.urgent) ? route.urgent : []
      if (document_?.ok !== true || urgent.length === 0) return null

      const soonest = soonestExpiring(route)
      const label = platformTag(soonest.provider)
      const time = countdown(soonest.end)
      const dot = urgencyStyle(soonest.end)

      // Rail (56px): the urgency dot above the platform initial; the countdown
      // lives in the tooltip, because a second line does not fit the 36px seat.
      // Wide (~256px): dot, time, platform, amount — the same columns as the
      // popover rows, so opening the list adds rows instead of shifting columns.
      const trigger = h("button", {
        type: "button",
        onClick: () => setOpen((value) => !value),
        title: t("footer.title", { provider: soonest.provider ?? "?", time }),
        "aria-expanded": open,
        style: wide ? styles.footWide : styles.footRail,
      },
        // The dot is the row's only colour, and it is what replaces the filled
        // bordered box: the same urgency signal at a fraction of the weight.
        h("span", { style: { ...styles.footDot, ...dot, marginBottom: wide ? 0 : "2px" } }),
        wide ? h("span", { style: styles.footTime }, time) : null,
        wide
          ? h("span", { style: styles.footRowProvider }, soonest.provider ?? "?")
          : h("span", { style: styles.footTag }, label),
        wide ? h("span", { style: styles.footAmount }, amountText(soonest)) : null,
      )

      if (!wide || !open) return trigger

      // Expanded: every package that is about to lapse, soonest first. This is
      // the same cross-platform list the settings card leads with, so it is
      // labelled as a view rather than as scheduler input.
      return h("div", { style: styles.footWrap },
        trigger,
        h("div", { style: wide ? styles.footPopover : styles.footPopoverRail },
          h("div", { style: styles.footPopoverTitle },
            h("span", null, t("footer.listTitle", { window: route.urgentLabel ?? "" })),
            h("span", null, t("footer.amountHeader")),
          ),
          urgent.map((pkg, index) => h("div", { key: "row/" + index, style: styles.footRow },
            // Dot, time, platform, amount — the same four cells as the trigger,
            // in the same order, so opening the list changes the row count but
            // not the layout. The package name is dropped for the same reason it
            // is dropped from the trigger: it is the least actionable of the
            // four and it was costing the other three their width.
            h("span", { style: { ...styles.footDot, ...urgencyStyle(pkg.end) } }),
            h("span", { style: styles.footTime }, countdown(pkg.end)),
            h("span", { style: styles.footRowProvider }, pkg.provider ?? "?"),
            h("span", { style: styles.footAmount }, amountText(pkg)),
          )),
          h("div", { style: styles.footNote }, t("footer.note")),
        ),
      )
    }

    /**
     * "145 / 500" when the package has a known size, else just the remainder.
     * Showing the size as well is what makes the number interpretable: "7" alone
     * cannot say whether it is nearly spent or barely touched.
     */
    function amountText(pkg) {
      const remain = pkg?.remain ?? 0
      const size = pkg?.size ?? 0
      return size > 0 ? remain + " / " + size : String(remain)
    }

    /** A platform's short tag for the rail: its first letter, uppercased. */
    function platformTag(provider) {
      const text = typeof provider === "string" ? provider.trim() : ""
      return text === "" ? "?" : text[0].toUpperCase()
    }

    /**
     * The urgency marker's colour, escalating with proximity to expiry.
     *
     * This is the row's ONLY colour, and it replaces what used to be a filled
     * amber box: the same signal at a fraction of the visual weight, so the seat
     * can warn without out-shouting the host's own controls.
     *
     * Green is deliberately NOT used for "a while away": a green dot reads as
     * "all good", and this seat only renders when a package IS about to lapse,
     * so appearing at all is the news. Every step is therefore warm and the
     * escalation is about degree, not about presence.
     *
     * Thresholds are relative to the moment of render, so a package crossing a
     * boundary simply re-colours on the next poll.
     *
     * @param end - the package's expiry as a local wall-clock string.
     * @returns a style object with `background` set.
     */
    function urgencyStyle(end) {
      const ms = new Date(String(end ?? "").replace(" ", "T")).getTime()
      if (Number.isNaN(ms)) return { background: "currentColor", opacity: 0.4 }
      const left = ms - Date.now()
      if (left <= 24 * 3600000) return { background: "#ef4444" } // within a day
      if (left <= 3 * 86400000) return { background: "#f59e0b" } // within 3 days
      return { background: "#eab308" }                          // further out
    }

    function StatusSection() {
      const [document_, setDocument] = react.useState(undefined);
      const [error, setError] = react.useState(undefined);
      const [busy, setBusy] = react.useState(false);

      const load = react.useCallback(async () => {
        setBusy(true)
        try {
          setDocument(await fetchStatus())
          setError(undefined)
        } catch (failure) {
          setError(String(failure && failure.message ? failure.message : failure))
        } finally {
          setBusy(false)
        }
      }, []);

      react.useEffect(() => {
        let live = true
        const tick = () => { if (live) void load() }
        tick()
        const timer = setInterval(tick, POLL_MS)
        return () => { live = false; clearInterval(timer) }
      }, [load]);

      const header = h("div", { style: styles.header },
        h("h3", { style: styles.title }, t("section.title")),
        h("button", { type: "button", style: styles.button, onClick: () => void load(), disabled: busy },
          busy ? t("action.refreshing") : t("action.refresh")),
      );

      if (document_ === undefined) {
        return h("section", { style: styles.section }, header,
          h("div", { style: styles.empty }, error === undefined ? t("state.loading") : t("state.error", { error })),
        )
      }

      const blocks = []
      blocks.push(h("div", { key: "meta", style: styles.meta },
        h("span", null, document_.baseUrl ?? ""),
        h("span", null, document_.fetchedAt === undefined ? t("meta.never") : t("meta.fetched", { time: clock(document_.fetchedAt) })),
      ))

      if (document_.ok !== true) {
        blocks.push(h("div", { key: "unreachable", style: styles.banner },
          t("state.unreachable", { baseUrl: document_.baseUrl ?? "?", error: document_.error ?? t("state.error", { error: "?" }) })))
        return h("section", { style: styles.section }, header, blocks)
      }

      const route = document_.route ?? {}
      const models = document_.models ?? {}
      const credentials = document_.credentials ?? {}
      // Packages dying soon, from every platform, soonest first. The one list
      // here that intentionally mixes platforms: it answers "what should I burn
      // first?", and it is read-only — the scheduler still ranks inside each
      // platform and never compares a Trae deadline with a WorkBuddy one.
      //
      // The window widens 24h -> 3d -> 7d until it finds something, so this
      // card is never empty while credits are still dying.
      //
      // The Host normally does the widening and sends the rows plus the step it
      // used. When it sends NEITHER (a Host build older than the ladder), derive
      // both here from the flat package rows — otherwise a stale Host would
      // leave the card permanently claiming an absence it never checked.
      const hostUrgent = Array.isArray(route.urgent) ? route.urgent : undefined
      const derived = hostUrgent === undefined && typeof route.urgentSeconds !== "number"
        ? deriveUrgent(route.packages)
        : undefined
      const urgent = hostUrgent ?? derived?.rows ?? []
      const urgentSeconds = typeof route.urgentSeconds === "number" ? route.urgentSeconds : derived?.windowSeconds
      const urgentExhausted = typeof route.urgentExhausted === "boolean"
        ? route.urgentExhausted
        : (derived?.exhausted ?? false)
      const urgentLabel = windowLabel(urgentSeconds, route.urgentLabel ?? "", urgent)
      // The Host already grouped the pools per platform. Fall back to grouping
      // the flat rows here so an older Host build still renders separate pools
      // rather than one cross-platform total.
      const groups = Array.isArray(route.groups) && route.groups.length > 0
        ? route.groups
        : [...new Set((Array.isArray(route.accounts) ? route.accounts : []).map((account) => account.provider))]
            .filter((provider) => typeof provider === "string")
            .map((provider) => {
              const accounts = (route.accounts ?? []).filter((account) => account.provider === provider)
              const packages = (route.packages ?? []).filter((pkg) => pkg.provider === provider)
              const sum = (rows, field) => rows.reduce((total, row) => total + (typeof row[field] === "number" ? row[field] : 0), 0)
              return { provider, accounts, packages, remain: sum(accounts, "total"), atRisk: sum(accounts, "atRisk") }
            })

      // Rendered first so it is the first thing an operator sees on opening the
      // page: the credits about to expire, not last month's summary.
      //
      // The empty message distinguishes two very different situations. Only
      // when the widest ladder step was really tried does "nothing expires
      // within 7 days" tell the truth; otherwise the card says it is still
      // looking rather than asserting an absence it has not established.
      blocks.push(h("div", { key: "urgent", style: urgent.length > 0 ? styles.urgentCard : styles.card },
        h("div", { style: styles.cardTitle }, urgent.length > 0
          ? t("urgent.title", { window: urgentLabel })
          : t("urgent.titleEmpty")),
        urgent.length === 0
          ? h("div", { style: styles.empty }, urgentExhausted ? t("urgent.none") : t("urgent.unknown"))
          : [
              h("div", { style: styles.row }, urgent.map((pkg, index) =>
                h("span", { key: "chip/" + index, style: styles.urgentChip },
                  h("b", null, countdown(pkg.end)),
                  h("span", null, " " + (pkg.provider ?? "?") + " · " + (pkg.account ?? "?")),
                  h("span", { style: muted }, " · " + (pkg.name ?? "?") + " · " + (pkg.remain ?? 0)),
                ),
              )),
              h("div", { style: { ...muted, fontSize: "11px", marginTop: "6px" } },
                t("urgent.note", {
                  window: urgentLabel,
                  // Say out loud that the window was widened, so a 3-day or
                  // 7-day list is never misread as "something dies today".
                  // Compared against the localised narrowest label rather than
                  // a literal, so this holds in either locale.
                  warn: urgentLabel === t("urgent.window24h")
                    ? ""
                    : t("urgent.widened", { window: urgentLabel }) + " ",
                })),
            ],
      ))

      blocks.push(h("div", { key: "route", style: styles.card },
        h("div", { style: styles.cardTitle }, t("route.title")),
        h("div", { style: styles.row },
          h("span", { style: styles.kv }, h("span", { style: muted }, t("route.strategy")), h("span", null, route.strategy ?? "—")),
          h("span", { style: styles.kv }, h("span", { style: muted }, t("route.providers")), h("span", null, (route.providers ?? []).join(", ") || "—")),
          h("span", { style: route.stale === true ? styles.warnBadge : styles.badge }, route.stale === true ? t("route.stale") : t("route.fresh")),
          h("span", { style: muted }, t("route.age", { age: route.age ?? "—", maxAge: route.maxAge ?? "—" })),
        ),
        // One pool per platform, never a cross-platform sum: the scheduler
        // ranks a platform's accounts against each other and never spends one
        // platform's credits on the other platform's traffic.
        h("div", { style: styles.row }, groups.map((group) =>
          h("span", { key: "pool/" + group.provider, style: styles.kv },
            h("span", null, t("route.group", { provider: group.provider, remain: group.remain, atRisk: group.atRisk }))),
        )),
        h("div", { style: { ...muted, fontSize: "11px", marginTop: "4px" } }, t("route.separate")),
        groups.length === 0
          ? h(AccountTable, { accounts: Array.isArray(route.accounts) ? route.accounts : [] })
          : groups.map((group) => h("div", { key: "accounts/" + group.provider, style: { marginTop: "10px" } },
              h("div", { style: { ...muted, fontSize: "11px" } }, group.provider),
              h(AccountTable, { accounts: group.accounts }),
            )),
      ))

      blocks.push(h("div", { key: "packages", style: styles.card },
        h("div", { style: styles.cardTitle }, t("packages.title")),
        groups.length === 0
          ? h(PackagesTable, { packages: Array.isArray(route.packages) ? route.packages : [] })
          : groups.map((group) => h("div", { key: "packages/" + group.provider, style: { marginTop: "10px" } },
              h("div", { style: { ...muted, fontSize: "11px" } },
                t("packages.groupCount", { provider: group.provider, count: group.packages.length, remain: group.remain })),
              h(PackagesTable, { packages: group.packages }),
            )),
      ))

      const codex = Array.isArray(credentials.codex) ? credentials.codex : []
      const counts = Object.keys(credentials.counts ?? {}).map((key) => key + " " + credentials.counts[key]).join(" · ")
      blocks.push(h("div", { key: "credentials", style: styles.card },
        h("div", { style: styles.cardTitle }, t("credentials.title")),
        codex.length === 0
          ? h("div", { style: styles.empty }, t("state.empty"))
          : codex.map((entry) => h("div", { key: entry.label, style: styles.row },
              h("span", { style: { fontWeight: 600 } }, entry.label),
              entry.plan === undefined ? null : h("span", { style: muted }, t("credentials.plan", { plan: entry.plan })),
              entry.activeUntil === undefined ? null : h("span", { style: muted }, t("credentials.until", { until: String(entry.activeUntil).slice(0, 10) })),
              h("span", { style: entry.disabled ? styles.warnBadge : styles.badge }, entry.status ?? "—"),
              entry.success === undefined ? null : h("span", { style: muted }, "ok " + entry.success + " / fail " + (entry.failed ?? 0)),
            )),
        counts === "" ? null : h("div", { style: { ...muted, fontSize: "11px" } }, t("credentials.counts", { counts })),
      ))

      const kept = Array.isArray(models.kept) ? models.kept : []
      blocks.push(h("div", { key: "models", style: styles.card },
        h("div", { style: styles.cardTitle }, t("models.title")),
        h("div", { style: styles.row },
          h("span", { style: styles.kv }, h("span", null, t("models.mode", { mode: models.mode ?? "—" }))),
          h("span", { style: styles.kv }, h("span", null, t("models.kept", { count: kept.length }))),
          h("span", { style: muted }, t("models.dropped", { count: models.droppedCount ?? 0 })),
          h("span", { style: muted }, t("models.applied", { time: clock(models.appliedAt) })),
        ),
        h("div", { style: styles.chips }, kept.map((model) =>
          h("span", { key: model.id, style: styles.chip, title: model.name }, model.name ?? model.id),
        )),
        models.patchPath === undefined ? null : h("div", { style: { ...muted, fontSize: "11px", wordBreak: "break-all" } }, t("models.patch", { path: models.patchPath })),
        models.lastError === undefined ? null : h("div", { style: { ...styles.banner, fontSize: "11px" } }, t("models.error", { error: models.lastError })),
      ))

      return h("section", { style: styles.section }, header, blocks)
    }

    /** Required client services. */
    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: SECTION_ID,
        order: SECTION_ORDER,
        label: () => t("section.title"),
      }, StatusSection));

      // Sidebar foot, beside Settings. The slot is a `list`, so our own id adds
      // a seat instead of replacing a shipped one. The owner passes `wide`, and
      // we render a compact rail form when the sidebar is collapsed.
      //
      // `label` is re-read on every projection, so a thunk keeps it localized.
      // The live countdown belongs in the rendered control, not here: the label
      // is for addressability (nav rows, tabs), not for a running clock.
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: FOOTER_ID,
        order: FOOTER_ORDER,
        label: () => t("footer.action"),
      }, ExpiryFooterIndicator));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
