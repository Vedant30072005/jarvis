# J.A.R.V.I.S — Architecture

Read `CONSTITUTION.md` first. This file is the map: modules, storage keys,
bus events, and recipes for adding new things. Keep it current — every
sprint that adds a storage key or bus event updates the registries below.

## Module map (script load order — do not reorder the `<script>` tags)

```
js/bus.js         Bus — tiny pub/sub event bus (Sprint 2+)
js/data.js        JDATA — sectors, keywords, lexicons, sim feed, playbooks,
                  value chains, causal graph, tax config (grows over sprints)
js/engine.js      U (utils) + Engine — analyze/group/cluster/flows/ideas
js/charts.js      Charts — canvas renderers (donut, spark, radar, network,
                  sipArea, map…), validated categorical palette
js/fx.js          FX — particles, cursor glow, tilt, typewriter, boot,
                  confetti, sound hooks
js/store.js       Store — IndexedDB signal archive + daily rollups (Sprint 4+)
js/portfolio.js   Portfolio — transactions, FIFO lots, XIRR, SIP math,
                  budget, goals, insights
js/live.js        Live — RSS uplink (relay-first, public-proxy fallback,
                  simulation last)
js/jarvis.js      Jarvis — chat UI, TTS/STT, INTENTS table
js/app.js         App — router, renderers, ticker, modals, wiring
relay.js          (repo-root-adjacent, run with `node jarvis/relay.js`)
                  Local Node proxy: RSS + quotes + AMFI, whitelisted, cached
```

Frontend files are loaded via `<script>` tags in `index.html` in the exact
order above (skipping ones that don't exist yet). Each global (`Bus`,
`JDATA`, `U`, `Engine`, `Charts`, `FX`, `Store`, `Portfolio`, `Live`,
`Jarvis`, `App`) is attached to `window` implicitly by being declared at
top level — no module system, no bundler.

## Storage registry

Every persisted key, its owner module, and its version. Bump the version
suffix and write a one-time migration when the shape changes; never
silently reinterpret an old key.

| Key | Owner | Contents |
|---|---|---|
| `jarvis.portfolio.v1` → `v2` | Portfolio | v1: holdings snapshots. v2: transaction ledger (Sprint 7 migrates v1→v2 once, then ignores v1). |
| `jarvis.history.v1` | Store | Daily rollups: `{date, signals, trackedCr, bullPct, patterns, perSector:{sector:{count,impactSum,flowsCr}}, termCounts:{term:count}, termSources:{term:[source,...]}}`, capped to `Store.MAX_ROLLUP_DAYS` (120). Net-worth snapshots join this file in Sprint 7 (ORD-403). |
| `jarvis.chat.v1` | Jarvis | Last ~80 chat messages (role + html). |
| `jarvis.theses.v1` | App (Ideas Lab) | Thesis kanban cards. |
| `jarvis.alerts.v1` | App | Alert rules + hit log (max 50). |
| `jarvis.expenses.v1` | Portfolio | Monthly expense entries. |
| `jarvis.layout.v1` | App | Command Center panel order. |
| `jarvis.tour.v1` | App | Onboarding-tour dismissed flag. |
| `jarvis.userdict.v1` | Engine | Human-promoted anomaly terms merged into JDATA.KEYWORDS. |
| `jarvis.predictions.v1` | Jarvis/Portfolio | Prediction book entries (Sprint 11). |
| `jarvis.settings.v1` | App | `{voiceOn, fxOff, bootAlways, usdInr}` so far; sound/theme/name/tax-year config join in later sprints. |
| IndexedDB `jarvis` → store `signals` | Store | `{key, lastSeen, firstSeen, sectors, senti, impact, amountCr, title, source}`, pruned past `Store.PRUNE_DAYS` (90). `Store._priorKeys` is a session-start snapshot of every key, used for "NEW" badges without a per-render async lookup. |
| `jarvis.usage.v1` | App | Local-only usage counters for the dust/pruning report. |
| `jarvis.booted` (sessionStorage) | FX | Boot-sequence-played-this-session flag. |
| IndexedDB `jarvis` → store `groups` | Store | Corroboration groups (Sprint 5+, optional persistence). |

## Type-checking (ORD-1302, Sprint 2+)

Every `js/*.js` file starts with `// @ts-check`; `jsconfig.json` +
`types.d.ts` (ambient global interfaces — `NewsItem`, `Cluster`, `Idea`,
`Holding`, `AppSettings`, etc.) give VS Code's TS language service enough
to check them live with no build step. Verify with:

```
npx -p typescript tsc -p jarvis/jsconfig.json --pretty false
```

**Accepted, documented noise:** `checkJs` cannot narrow
`document.getElementById(...)` past `HTMLElement`, or `event.target` past
`EventTarget` — so `.value`, `.dataset`, `.style`, `.closest`,
`.classList` etc. on those raise `TS2339` throughout `app.js`/`fx.js`
(dozens of instances, all pre-existing, all runtime-correct). Retrofitting
a cast at every one of those call sites would be a large, low-value diff
across already-tested code, so they're left as known noise rather than
silently suppressed. **New code should cast at the point of use**
(`/** @type {HTMLInputElement} */ (document.getElementById('x'))`) since
that's cheap to do at write time — the goal is to keep the signal-to-noise
ratio improving sprint over sprint, not to retroactively chase zero errors
on day one. Real bugs `@ts-check` already caught and fixed on introduction:
a dead `a.type === 'Cash'` condition in `Portfolio.insights()` (the field
never existed on allocation rows — `a.label === 'Cash'` was silently doing
all the work) and a couple of `number` values assigned straight to
`.textContent` (cosmetic, but now explicit via `String(...)`).

## Bus event contract (Sprint 2+)

```js
Bus.emit('data:updated',      { reason: 'sim'|'live'|'ingest' })
Bus.emit('portfolio:changed', {})
Bus.emit('quotes:updated',    { symbols: [...] })
Bus.emit('settings:changed',  { key })
Bus.emit('alert:fired',       { hit })
Bus.emit('view:changed',      { view })
```
Renderers subscribe via `Bus.on(event, handler)` instead of being
hand-called from unrelated modules. When adding a new event, document it
here in the same PR/edit.

## Recipes

**Add a new panel to an existing view:** write its markup inside the
existing `<section id="view-X">` in `index.html`, its renderer as a method
on `App`, call it from the view's render function, subscribe to `Bus`
events if it needs to react to data changes, and register any canvas loop
in `App._stops` so it pauses correctly (see loop lifecycle rules below).

**Add a new Jarvis intent:** add an entry to `Jarvis.INTENTS` — specific
regexes ABOVE general ones (first match wins), return an HTML string (put
through `U.esc()` for any interpolated untrusted text).

**Add a new chart:** add a method to `Charts`, DPR-aware via `Charts.size()`,
use `Charts.PALETTE` in fixed order for data marks, wire hover via
`canvas.onmousemove =` (assignment, not `addEventListener`, so re-renders
replace rather than stack), return a stop function if it runs an animation
loop.

**Canvas loop lifecycle rules (ORD-902):** any `requestAnimationFrame` loop
started inside an `rAF`-scheduled callback must re-check that the owning
view is still active before starting; all loops stop on
`document.visibilitychange` (hidden) and resume/re-render on visible; all
loops stop on `beforeunload`. Follow the existing `App._stops` array
pattern.

**Add a storage key:** namespace it `jarvis.*`, version it (`.v1`, `.v2`…),
register it in the table above, and if it replaces an older key, write a
read-once migration.

## Known v1 quirks (so you don't "fix" intentional behavior)

- `App.renderCommand` / `App.renderPatterns` early-return after partial
  work when `App.view` doesn't match — intentional, avoids animating
  hidden canvases; full render happens on `gotoView`.
- `Live.mkItem` strips Google News' `" - Source"` suffix via
  `lastIndexOf(' - ')` with a `dash > 30` guard — good enough, not
  perfect; em-dash variants pass through harmlessly.
- `Jarvis.INTENTS` order is significant — `"add N X at P"` must stay above
  the generic portfolio intent.
- `speechSynthesis.cancel()` runs before every `speak()` on purpose —
  JARVIS interrupts rather than queuing monologues.

## Privacy / threat-model summary (full version: Part III §9 of the orders)

Personal data (transactions, goals, journal, predictions) never leaves
this machine except as explicit user-initiated exports. The local relay
binds `127.0.0.1` only and whitelists exact hostnames — it is not a
general proxy. Backups are the user's responsibility to keep out of
synced/cloud folders (see `.gitignore` and the export-dialog warning); an
optional passphrase-encrypted export exists for that reason. There is no
in-app lock screen — that would be theater on a machine where localStorage
is already readable; the honest boundary is the OS user account.
