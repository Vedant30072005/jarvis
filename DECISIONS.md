# J.A.R.V.I.S — Decisions Log (ADR-lite)

Append-only. One entry per meaningful choice: date, session/sprint, what,
why, alternatives rejected. Ten lines max each. Read before re-litigating
an old choice.

---

**2026-07-11 · v1 build** — Vanilla HTML/CSS/JS, no build step, no
framework.
Why: personal single-user tool; zero-dependency rot risk; instant load;
matches the "no AI API" constraint's spirit of minimal external surface.
Rejected: React/Vite (build tooling overhead disproportionate to a
single-user dashboard).

**2026-07-11 · v1 build** — Chart data marks fixed to the validated
6-color categorical palette (`#0096b8 #bd8a16 #8a63f0 #e0489a #3b82f6
#0da271`), CVD-checked via the dataviz skill's validator for the dark
surface.
Why: colorblind-safe, contrast-checked; UI accent colors (cyan/gold) stay
separate from data-identity colors so re-theming never breaks a chart.
Rejected: ad hoc per-chart hex values.

**2026-07-11 · v1 build** — Keyword-dictionary + rule-based engine
(JDATA.KEYWORDS, sentiment lexicons) instead of any ML/LLM classification.
Why: explicit user constraint (no AI APIs); also more explainable —
every tag traces to a regex, every score to a visible formula.
Rejected: sentiment via an API call (violates the constraint outright).

**2026-07-11 · v1 build** — Portfolio/watchlist/budget persist in
`localStorage` only; no backend, no accounts.
Why: personal financial data must not leave the machine (Constitution
Art. 7); the shop site's Node backend is a separate, unrelated app.
Rejected: reusing `backend/` — different concern, would blur the
boundary the user asked for.

**2026-07-12 · roadmap** — Five-part planning series
(`UPGRADE-ORDERS.txt` + PART2–5) written before implementation, covering
features, integrity/self-critique, doctrine/math/contracts, causal
knowledge/governance, and adversarial/endgame layers.
Why: user asked for pure thinking with no implementation across four
consecutive turns; front-loading doctrine (Constitution, data contracts,
exact math, threat model) before code reduces drift across the many
future sessions that will build this incrementally.
Rejected: a sixth planning pass — diminishing returns judged to have
been reached (Part V §10).

**2026-07-12 · implementation kickoff** — Executing sprint-by-sprint in
the dependency order from Part II §J as amended by Part III §10, Part IV
§8, and Part V §8 (governance docs → stability → bus/types → relay →
archive → engine integrity → … see task list). One session, continuing
autonomously per the user's explicit "implement everything, sprint by
sprint" instruction.
Why: later sprints depend on earlier plumbing (event bus before more
render call-sites accumulate; relay before quotes; transactions before
goals/tax; archive before anomaly sonar). Building out of order would
mean rework.
Rejected: building the flashiest features first (map, sound, themes) —
Constitution Art. 1 ranks truth/calm/discipline above delight; the same
ranking governs build order, not just runtime behavior.

**2026-07-12 · Sprint 1 complete** — Stability + safety shipped: backup/
restore (export scans all `jarvis.*` localStorage keys to a timestamped
JSON, import validates + confirms + reloads), ticker rewritten for in-place
DOM updates instead of full re-render, debounced resize re-render via a
shared `App.renderView()`, chat history persisted (`jarvis.chat.v1`, capped
80) and restored without the typewriter effect, native `confirm()` replaced
everywhere with `App.confirm()` (styled, Promise-based, cleans up its own
Escape listener), canvas-loop rAF callbacks re-check the active view before
starting (ORD-902a) and a shared visibilitychange handler stops/restarts
loops, CSP meta tag added, network-graph labels clamped to canvas bounds.
Verified live: export→import round-tripped through an actual page reload
with settings and chat both surviving correctly.
Why: this sprint has no feature dependencies and fixes real risk (data
loss without backup, memory leaks in confirm dialogs) before anything else
is layered on top.
Rejected: skipping the browser round-trip test and trusting code review
alone — backup/restore is exactly the kind of feature where "looks right"
and "works right" diverge (see Part III doctrine on trust being lost in
one incident).

**2026-07-12 · Sprint 2 complete** — Event bus (`js/bus.js`, loaded first)
with a documented contract in ARCHITECTURE.md; wired at the natural
source-of-truth points (`Engine.ingest` → `data:updated`, `Portfolio.save`
→ `portfolio:changed`, `App.saveSettings` → `settings:changed`,
`App.gotoView` → `view:changed`) rather than a full rip-and-replace of
every existing render call — `fetchLive()` is the one call site actually
migrated to subscribe instead of calling `renderAll()` by hand, since it's
the one place more independent future features will need to react to the
same event. Also: `// @ts-check` + `jsconfig.json` + `types.d.ts` (ambient
global interfaces) added to every JS file including `relay.js`; caught one
real latent bug (`Portfolio.insights()` checked `a.type === 'Cash'` on
allocation rows that only ever have `.label`, dead code silently rescued
by the `a.label === 'Cash'` fallback) and fixed two `number`→`textContent`
sloppy assignments. ~59 remaining errors are DOM-element-narrowing noise
in `app.js`/`fx.js` (`.value`/`.dataset`/`.closest` on generic
`Element`/`EventTarget`) — documented as accepted debt in ARCHITECTURE.md
rather than retrofitting ~70 casts across already-tested code.
Why: the bus and types both reduce bugs in every sprint after this one;
building them before the archive/relay/transactions land (which multiply
the number of things reacting to the same data) is cheaper than migrating
later.
Rejected: a full migration of every render call-site to the bus in one
pass — high risk, no current feature actually needs it yet.

**2026-07-12 · Sprint 3 complete** — `jarvis/relay.js`: zero-dependency
Node proxy (binds 127.0.0.1 only, exact-hostname whitelist, GET-only, 2MB
cap, never forwards upstream headers, stdout-only logging) with `/rss`,
`/quote`, `/health`; stale-while-revalidate caching (5 min fresh / 15 min
stale-tolerable). `live.js` now probes the relay and prefers it, falling
back to the public proxies, then simulation. Added ORD-202's direct wires
(PIB, RBI, Moneycontrol, ET Markets, Mint) and `JDATA.SOURCE_WEIGHTS`
(official/wire sources get a 1.15–1.3× impact multiplier). Added ORD-205
(USD/INR as an editable setting, shown on the Flows-view footer).
Verified live end-to-end: relay's `/health`, a real Google News RSS fetch
through it, whitelist correctly rejecting both an arbitrary host and the
specific `news.google.com.attacker.io` substring-bypass shape, and real
NIFTY/Reliance quotes via `/quote` — then FETCH LIVE in the actual app
detected the relay, pulled 64 real live signals through it, and the mode
chip correctly reported "Live via local relay."
Why: the CORS-origin reflection (not one hardcoded origin) is a deliberate,
documented deviation from ORD-1509's literal wording — the dev server's
port floats (autoPort in launch.json), so a single hardcoded origin would
break on any port reassignment; reflecting only exact `localhost`/
`127.0.0.1` origins keeps the same security property (never `*`, never a
non-local origin) while tolerating that reality.
Rejected: making relay.js's dev-server port auto-assign (`autoPort`) —
predictability matters more here than convenience, since `live.js` needs a
fixed URL to probe.

**2026-07-12 · Sprint 4 complete** — `js/store.js`: IndexedDB signal
archive (best-effort, degrades silently if unavailable) plus a
localStorage daily rollup (`jarvis.history.v1`) that now includes
`termCounts`/`termSources` per Part III's correction (required for the
Sprint-9 anomaly sonar, built now so history has time to accumulate before
that sprint needs a baseline). `U.todayKey()` centralizes "what day is it"
(ORD-905). Shipped: real "NEW" badges on Intel cards (session-start
snapshot of archive keys, not a per-render async check), momentum deltas
on pattern cards ("▲ +38% vs yesterday", silently absent — not zero —
until there's a yesterday to compare against), and KPI sparklines now
chart real 14-day history instead of decorative random noise (padded flat,
honestly, when history is sparse).
Verified live: archive persisted 96 real signal keys across an actual
page reload, with every previously-seen item correctly flipping from NEW
to known; sparse-history sparkline and pattern-delta both degrade to
their documented empty/flat states without throwing.
Why: capturing `termCounts` now (even though nothing consumes them until
Sprint 9) means the anomaly baseline has real accumulated days by the time
it's needed — retrofitting this later would mean waiting from scratch.
Rejected: computing NEW-status per-render with an async IndexedDB lookup
per card — a single session-start snapshot is simpler and avoids a
render-blocking async fan-out for every Intel card on every render.

**2026-07-12 · Sprint 5 complete** — Truth layer: negation-aware sentiment
(JDATA.NEGATIONS neutralises lexicon hits within ~3 words), "?"-headline
dampening (half verb weight), signed outflows (OUTFLOW_RX; sector/source
aggregations NET signed values, while totalTracked stays a magnitude sum —
it measures volume of disclosed activity, and an inflow plus an equal
outflow are two real events, not zero), corroboration groups (3-word
shingle Jaccard ≥ .55, or same sector+company+amount ±10% within 72h;
2+ distinct sources ⇒ CONFIRMED, +15 impact; per the ORD-901 amendment a
group's amount is the MAX across members, never the SUM), impact displayed
as tie-averaged corpus percentile in [1,99] with `impactRaw` retained for
archive/tooltips, hype heuristics ORD-1701(a–d) quarantining items (score
≥ 55) from flows and ideas while keeping them visible with a badge,
ORD-303 universe (64 companies with symbols + new macro tags + COMPANY_RX),
and conviction v2 (0.40·cluster + 0.20·sources + 0.20·log-flows +
0.20·sentiment) behind `Engine.FLAGS.convictionV2` beside v1.
Kill criterion, pre-committed so the comparison can't drift into vibes:
after a week side-by-side, v2 wins iff its top-decile clusters show a
higher corroboration rate AND a lower hype-flag rate than v1's; the loser
is deleted in Sprint 6.
Amendments folded in during the build: amount parsing normalizes ALL media
formats to crore INR (₹/Rs/Rs. and $/US$/USD forms; "trillion" now respects
the USD_INR setting instead of a hardcoded 85.5 conversion); bare "5 crore"
without a currency marker deliberately does NOT parse (more often people
than rupees — a false amount poisons flows worse than a missed one);
JDATA.ENGINE_VERSION=5 is stamped into every archived signal and daily
rollup so future calibration segments by engine version instead of
comparing scores produced by different math; test.html gained a 12-case
units golden block and NaN/undefined render smoke tests on both full and
empty corpora.
Verified: 20/20 assertions in a node run of the exact test.html logic
(units, negation + control, Rs-format 4-source MAX-merge dedup, percentile
bounds, version stamp, full/empty-corpus smoke).
Rejected: displaying raw impact scores (not comparable across quiet vs
busy days); SUM when merging duplicate amounts (counts the same money N
times); parsing currency-markerless crore figures (false-positive risk).

**2026-07-13 · Sprint 5.5 core slice complete** — `js/schema.js`: every
persisted localStorage blob (`jarvis.history.v1`, `jarvis.portfolio.v1`,
`jarvis.chat.v1`, `jarvis.settings.v1`) now wraps its payload in a
`{v, data}` envelope via `Schema.load()`/`Schema.save()`, with migrations
registered per-key, keyed by the FROM version. Pre-Sprint-5.5 data (no
envelope) is read as v0 and migrated forward identically — no key
renaming needed for future schema changes, just a version bump plus a
registered migration function. `js/tabguard.js`: rough BroadcastChannel
leader election (`TabGuard`) so two open tabs don't both write today's
rollup — every tab announces its birth timestamp on load and every 4s;
the oldest live tab is the writer; a closed tab is pruned after 10s of
silence and leadership passes to the next-oldest automatically, no
explicit handover message needed. Fails open (always writer) if
BroadcastChannel is unsupported. `App.archiveTouch()` now gates
`Store.snapshotToday()` behind `TabGuard.isWriter()`.
Verified live: two real browser tabs opened against the same origin —
the older tab correctly read `isWriter() === true`, the newer tab
`false`, each saw the other in its peer map. test.html gained 5 Schema
assertions (missing-key fallback, v0→v1 identity migration on
unversioned legacy data, same-version round-trip skips migrations,
multi-hop v0→v1→v2 chaining, graceful stall on an unregistered hop) —
39/39 total assertions pass.
Why: schema versioning now (before Sprint 7's ledger and Sprint 11's
journal/predictions add more persisted shapes) means every future
breaking change is a registered migration function, not a new key name
and a manual copy-over; the multi-tab guard closes a real race
(Session #15's plan flagged this explicitly) before more shared,
once-per-tick writes accumulate in later sprints.
Rejected: full app.js view-module split and a comprehensive N-level
migration registry — both explicitly deferred as optional extensions
per the Session #15 core-slice plan; neither blocks Sprint 6.

**2026-07-13 · Sprint 6 core slice complete** — Three new Command Center
panels/features, per the Article-8 mapping from Session #14: `js/
honesty.js` (Honesty Panel) computes five self-graded metrics each
render — effective source count, parser health, corroboration rate,
hype rate, engine version — banded green/amber/red against real
`Engine.items` data, plus a localStorage quota gauge; below 15 signals
today it renders an explicit "less reliable" caveat rather than a bare
ratio at full visual weight (red-team Session #1, attack #12). `js/
alerts.js`: a shared `Alerts.raise({severity, source, dedupeKey,
message, ttlMs})` contract emitting `alert:raised` on the Bus and
deduping by key — the spine Sprint 9's sonar will emit through later,
proven end-to-end now via three real (not fabricated) seed alerts:
low-volume day, high hype rate, and an active bearish cluster. Threat
Board renders `Engine.ideas.filter(kind==='caution')` directly, no
separate data path. Cross-Currents panel (Patterns view) renders the
single sector with the strongest genuine bull/bear split as a
three-segment bar (reusing the `.senti-mix` visual language) — picks
the most *contested* sector, not just the busiest one, so disagreement
is surfaced rather than diluted into the KPI average. `js/mirror.js`:
schema-versioned skeleton persistence for the prediction book and
journal (`jarvis.predictions.v1`, `jarvis.journal.v1`) — add-only modal
forms in Ideas Lab with a bare count readout; deliberately no listing/
resolve UI yet, that's Sprint 11's job.
Verified live: Honesty Panel and Threat Board render real banded values
and a real derived alert on the actual feed; Cross-Currents correctly
picked Infrastructure (7 bull/5 neut/3 bear) as the contested sector on
the demo corpus; both mirror modals round-tripped a real entry through
to localStorage in the `{v,data}` envelope with no console errors;
test.html still 39/39 after the change.
Why: doing all three Sprint 6 core slices together (honesty + alert
spine + threat board, cross-currents, mirror skeletons) rather than
splitting across three separate sessions was reasonable here since they
share almost no code paths and each is small — no reason to interrupt
mid-sprint when nothing blocked finishing it in one pass.
Rejected: interactive drill-down popovers on honesty metrics, the live
noise-floor scramble test, alert-outcome tracking, a full cross-
currents panel for every sector, and any listing/editing UI for
predictions or journal — all explicitly deferred as optional
extensions or later-sprint scope per the Session #15 core-slice plan.

**2026-07-13 · Sprint 7 core slice complete** — `js/ledger.js`: event-
sourced trade ledger per Session #4's schema, scoped to the two event
types a Zerodha tradebook CSV actually contains (`buy`/`sell`); split,
bonus, dividend, buyback, delisting, fund-merger, correction, and void
are explicitly out of scope for this slice. CSV import matches
symbol/trade_date/trade_type/quantity/price columns by regex
(order-independent, tolerates Zerodha's real export header), normalises
DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD dates, and is idempotent — re-
importing the same file skips rows whose `trade_id`-derived id is
already in the ledger rather than duplicating them. Storage is Schema-
versioned (`jarvis.ledger.v1`, Sprint 5.5's envelope) from day one.
`Ledger.replay()` computes per-symbol quantity/cost-basis/last-traded-
price by date order. `Ledger.xirr()` solves via bisection over
[-99.99%, +1000%] — deliberately no Newton-Raphson step, per Session
#4 Test 10's finding that multi-sign-change cash flows can make it fail
to converge; bisection always converges given a bracketing sign
change, and the function bails to `null` rather than guessing when no
sign change exists to bracket. My Money view gained a "TRADE LEDGER"
panel (CSV import button + one summary line: trade count, holdings
value, unrealised P&L, XIRR).
Bug caught before shipping: the first cut of `xirr()` marked every open
position at its own `lastPrice`, which for a symbol with exactly one
trade is just that trade's own cost — silently producing a fake ~0%
return instead of honestly reporting "not enough data to value this."
Fixed by tracking `tradeCount` per symbol in `replay()` and only
contributing a terminal-value cash flow when a symbol has more than one
recorded trade (i.e., a later, separate trade has actually re-priced
it) — caught by a test asserting a lone open buy returns `null`, not a
number.
Verified live: imported a 4-row CSV through the real UI code path
(`Ledger.importZerodhaCsv` → `App.renderPortfolio()`), summary line
rendered real holdings value/P&L/XIRR with the "marked at last traded
price" caveat visible; re-importing the identical CSV correctly
reported 0 imported / 2 duplicates; raw localStorage confirmed the
`{v,data}` envelope; zero console errors. test.html gained 12 new
assertions (CSV parse, date normalisation ×3, replay, closed-form XIRR
match, multi-sign-change convergence, null-on-unsolvable ×2, terminal-
value marking) — 51/51 total assertions pass.
Why: scoping the core slice to buy/sell only (not all 12 event types)
matches what a real Zerodha tradebook export actually contains — the
other event types have no CSV source to import from yet, so building
them now would be speculative scope with no real data path to
exercise them.
Rejected: relay-to-disk persistence, relay write-token auth, a full
ledger drill-down/edit UI, and net-worth history charting — all
explicitly deferred as optional extensions per the Session #15
core-slice plan; none block Sprint 8.

**2026-07-13 · Sprint 8 core slice complete** — `js/goals.js`: bare
CRUD for savings/investment goals (name, current value, target value,
target date), Schema-versioned, rendered as a simple progress-bar list
in My Money; no editing or historical progress snapshots yet (Sprint
15's reconciliation work may want those later). `js/tax.js`: a plain
data table of capital-gains rates for AY 2026-27 (post the July 2024
Budget changes) across four asset classes — equity, debt MF, gold,
international equity funds — plus one flat `computeGain()` function.
Deliberately returns a slab-taxed note instead of a guessed percentage
wherever the real rate depends on the user's income bracket (debt MF
always; gold/international funds when short-term) — guessing a slab
would be the same false-precision failure mode the engine's hype
filter exists to catch elsewhere, just relocated to tax math. My Money
gained a "GOALS" panel and a "TAX ESTIMATOR" panel (asset class, gain,
holding period → estimated tax), both with an explicit "not tax
advice" disclaimer.
Bug caught before shipping: the first cut gated BOTH the STCG and LTCG
branches on a single per-asset `slabTaxed` flag, so gold and
international funds — which are slab-taxed short-term but a flat 12.5%
long-term — incorrectly reported every holding period as slab-taxed.
Fixed by gating each bucket independently on whether that bucket's own
rate is null, and removed the now-redundant `slabTaxed` field from the
data table entirely rather than leaving unused, misleading data behind.
Caught by a test asserting gold held ≥24 months returns a flat-rate
result, not a slab note.
Verified live: added a real goal through the actual modal, watched the
progress bar and months-remaining compute correctly, removed it through
the same confirm-dialog path used elsewhere in the app; ran the tax
estimator through the real UI (equity, 18 months, ₹300,000 gain →
₹21,875 at 12.5% on the post-exemption amount, matching hand
calculation); zero console errors throughout. test.html gained 12 new
assertions (6 tax-bucket cases including the caught bug, 5 goals
progress/date cases) — 63/63 total assertions pass.
Why: rebalancing, expenses tracking, and a SIP registry (all named in
the original Sprint 8 scope) were left out of this core slice entirely,
not just deferred as extensions — per Session #15's plan these need
their own 90-minute slices with real design attention (rebalancing
especially has real judgment calls about thresholds and tax-drag that
don't fit a "core slice" treatment), rather than being rushed in
alongside goals and tax to hit an arbitrary sprint-number deadline.
Rejected: goal progress-over-time snapshots, a tax wizard, tax-by-
scenario (what-if exit timing), and the rebalancing module — all
explicitly deferred, the last three to a later sprint entirely rather
than treated as this sprint's optional extensions, since none of them
have a design spec yet the way Session #4 gave the ledger one.

**2026-07-13 · Sprint 9 core slice complete** — `js/sonar.js`: two
independent, read-only anomaly signals, neither wired into the Sprint
6 alert spine yet. (1) Term-frequency spikes — today's `Store.
computeTermCounts()` output vs a mean+2σ baseline over prior daily
rollups; requires `BASELINE_MIN_DAYS=3` of history before trusting any
baseline (fewer honestly reports "insufficient history," not a noisy
guess), and a `SPIKE_MIN_COUNT=3` floor so a lone 1-vs-0 day can never
read as a "spike" against a thin baseline. Mean/stddev only — the
median/MAD robustness upgrade is deferred. (2) Pump-dump guard,
narrowly scoped to Session #1's attacks #1 and #2 only: a "confirmed"
corroboration group (`Engine.groups`, 2+ distinct source names) where
NOT ONE source is tiered (`JDATA.sourceWeight(s) > 1`) is flagged as a
coordinated low-tier burst; same-entity mention velocity (≥4 mentions
within a hard-coded 2-hour window) is checked independently of dedup
grouping, since attack #2 is specifically about reworded duplicates
that dodge shingle matching. Attacks #5 (calibration-gap timing), #9
(question-headline bear-baiting), and #13 (cross-sector tag stuffing)
are separate, later-sprint work — this slice does not claim to catch
them. Patterns view gained an "ANOMALIES THIS SESSION" panel, labelled
"read-only, not yet alerting" so its scope isn't mistaken for more than
it is.
Both `termSpikes()` and `pumpDumpGuard()` accept an optional history/
groups override specifically so test.html can exercise them with
synthetic data without needing a real multi-day archive or a full
Engine run — production call sites still just pass `Engine.items`.
Verified live: on the real demo corpus, the pump-dump guard correctly
flagged an actual confirmed cluster backed by only 2 untiered sources
("Semiconductor Mission 2.0…") with zero synthetic setup — a genuine
finding, not a fixture; term spikes correctly showed "needs 3 days of
history — 0 so far" on a fresh install, then correctly flagged terms
once 3 days of zero-baseline history were present (confirming the
known, accepted cold-start limitation from Session #1's attack #5,
which the deferred calibration gate exists to fix later); zero console
errors. test.html gained 13 new assertions (mean/stddev correctness,
insufficient-history bail-out, spike detection against zero and stable
baselines, the SPIKE_MIN_COUNT floor, both pump-dump attacks and their
negative cases) — 76/76 total assertions pass.
Why: scoping the guard to exactly 2 of the 5 must-fix attacks (not all
5) matches the core-slice discipline — attacks #5/#9/#13 each need
their own design attention (a borrowed-baseline scheme, a golden-corpus
stress test, a buildClusters() arithmetic fix) that don't fit a single
90-minute slice alongside the sonar's own baseline math.
Rejected: median/MAD, the full 7-attack guard suite, calendar
suppression, the calibration-gate countdown, and alert-spine
integration — all explicitly deferred as optional extensions per the
Session #15 core-slice plan; none block Sprint 10.

**2026-07-13 · Sprint 10 core slice complete** — `js/brain.js`: 5 of
Session #9's 18-intent 80/20 core set (what's hot, what's contested,
what should I worry about, what predictions are open, how much of my
portfolio is in bullish calls), each a fixed regex → a direct lookup
against data already computed by earlier sprints → one cited sentence
with a panel link. Substituted "how much of my portfolio is in bullish
calls" for the plan's illustrative "how am I doing vs index" example —
the index-comparison intent needs Sprint 12's quote history, which
doesn't exist yet; every intent actually shipped is backed by real,
already-computed data today, not a stub that always says "not
available." "Fenced, cite-or-silent" contract: `Brain.ask()` returns
`undefined` only when no intent recognises the query at all (falls
through to the existing chat intent table unchanged); once an intent
matches, it always returns a grounded answer — either real numbers
with a link, or an explicit "nothing to report" — never a fabricated
middle ground. Hooked into `Jarvis.handle()` ahead of the existing
regex intent table, which is untouched and still handles everything
Brain doesn't recognise (jokes, glossary, SIP math, portfolio
commands, etc.).
Real bug caught while wiring: `Brain.ask()` for the bullish-capital
intent calls `U.fmtCompact()`, which lives in `charts.js`, not
`engine.js` — this worked correctly in the real app (charts.js loads
before brain.js in `index.html`) but crashed silently in test.html,
which was missing that script tag; the whole test run's render step
silently failed (results computed, but the page never displayed them)
because the uncaught exception happened between the last assertion and
the render call. Fixed by adding charts.js to test.html's load order,
which is the correct fix — brain.js's dependency on a real, already-
used formatting helper is legitimate, the test harness was just
incomplete. Worth remembering: a silently-blank test page is not the
same as a passing one — always check the assertion COUNT, not just the
absence of visible FAILs.
Verified live: drove real chat queries through the actual `Jarvis.
handle()` path — "what should i be worried about" correctly cited the
real active caution cluster (Banking & Finance, conviction 20) with a
panel link and navigated to Command Center; "brief me" still falls
through correctly to the existing chat intent table, confirming the
two systems coexist without regression; zero console errors. test.html
gained 13 new assertions (1 unmatched-query case + 2 each for the 5
intents' data-present/data-absent paths) — 87/87 total assertions pass
(one pre-existing assertion, the randomized ORD-1704a scramble test,
is independently flaky and unrelated to this sprint — confirmed by
rerunning).
Why: choosing 5 intents with zero free-text slot-filling (no "for
[sector] X" parameter extraction) kept every intent a pure global-
state lookup, matching the plan's "no NLP, no fanciness" instruction
literally — slot-filling intents (bull case for a named sector, bear
signals for a named sector) are deferred, not because they're hard,
but because they'd need a second layer of pattern-matching (extracting
an entity from the query) that the core slice explicitly rules out.
Rejected: the remaining 13 of the 18-intent core set, intent-learning
from user corrections, and the composed morning-briefing ritual — all
explicitly deferred as optional extensions per the Session #15
core-slice plan; none block Sprint 11.

**2026-07-14 · Sprint 11 core slice complete** — `js/mirror.js` gains
`resolvePrediction(id, outcomeYes)` (event-sourced: once resolved, a
prediction is never edited again — resolving twice is a no-op that
returns false, matching the ledger's own "no edit-in-place" doctrine)
and `brierScore(predictions)` (mean of `(probability/100 − outcome)²`
over resolved predictions, gated at `BRIER_MIN_N=15` per Session #5's
grading methodology — below that, reports the raw resolved count
instead of a number that would be noise at that N). Ideas Lab's bare
add-only buttons from Sprint 6 became two real panels: PREDICTION BOOK
(open predictions sorted by due date, YES/NO resolution buttons that
only appear once a prediction is actually overdue, and the Brier
summary line) and JOURNAL (all entries, most recent first, in a
scrollable list). No calibration curve, no thesis kanban, no advanced
analytics, no journal search — all explicitly later-sprint scope.
Verified live: logged a real prediction with a deliberately past due
date, confirmed the OVERDUE badge and resolution buttons appeared
exactly as designed (not for non-overdue predictions), resolved it via
the real button click, watched it disappear from the open list and the
Brier line correctly read "1 resolved — need 15"; added a real journal
entry and watched it render with a formatted date; zero console
errors throughout. test.html gained 8 new assertions (resolve-once
semantics, resolving a nonexistent id, the N<15 gate, the exact 0.25
"always-50/50" baseline, a well-calibrated low score, a badly-
calibrated high score, and unresolved predictions correctly excluded
from N) — 95/95 total assertions pass.
Bug caught before shipping (test-harness, not app code): the first
Sprint 11 test run rendered a blank results page again, same failure
shape as Sprint 10's — `results` populated but `#out`/`#summary` never
updated. Root cause this time: `Mirror.resolvePrediction()` calls
`Bus.emit()`, and test.html has never loaded `bus.js` (index.html
loads it first; test.html was assembled sprint-by-sprint and never
needed it until a test actually exercised a Bus-emitting code path).
Fixed by adding `bus.js` to test.html's load order. Both this and
Sprint 10's `U.fmtCompact` gap were caught by the SAME symptom — a
results count that doesn't match zero visible content — reinforcing
that this is now a known failure shape worth checking for by habit,
not re-diagnosing from scratch each time.
Why: gating the resolve UI on "actually overdue" rather than always-
visible YES/NO buttons matches the plan's literal "resolution UI when
due" instruction and previews the Sunday ritual's future blocking
behavior (Session #6) without building that ritual now — a prediction
can still be resolved early by nobody, since there's no UI for it yet,
which is an intentional, honest scope boundary, not an oversight.
Rejected: the calibration curve, thesis kanban, advanced prediction
analytics, and journal full-text search — all explicitly deferred as
optional extensions per the Session #15 core-slice plan; none block
Sprint 12.

**2026-07-14 · Sprint 12 core slice complete, adapted** — `js/
quotes.js`: NSE bhavcopy import (CSV, not a live scrape — this project
has no verified relay/network path to fetch it automatically, so this
mirrors Sprint 7's already-proven Zerodha-CSV pattern instead of
building untestable live-fetch scaffolding). Parses SYMBOL/SERIES/
CLOSE, keeps only `SERIES==='EQ'` rows, snapshots by date (idempotent
re-import replaces, never duplicates, capped to 30 days), and marks
Portfolio holdings at the latest close via loose name↔symbol matching
("HDFC Bank" → "HDFCBANK") — unmatched holdings are reported by name,
never silently left looking synced. `js/counterfactual.js`: 2 of the
plan's 3 horse-race lanes — real trades (`Ledger.xirr()`, untouched)
vs a synthetic "bought Nifty instead" lane built from the EXACT SAME
dates and rupee amounts as the real ledger, marked against a user-
logged Nifty level history (nearest-at-or-before each trade date).
The third lane (paper ideas — what if every drafted thesis had been
bought) is scoped out entirely, not just deferred as an extension: it
needs idea-formation-date price tracking, which is literally Sprint
14's own "narrative age" work and doesn't exist yet — same "drop
cleanly rather than force it" precedent as Sprint 8's rebalancing/
expenses/SIP registry. My Money gained "EOD QUOTES" (bhavcopy import)
and "COUNTERFACTUAL — VS NIFTY" (log-a-level + comparison) panels.
Real bug caught by test data modeling actual NSE format: NSE bhavcopy
TIMESTAMP columns are "DD-MON-YYYY" (e.g. "15-JAN-2024", month as a
3-letter name), which `Ledger._normalizeDate()` doesn't parse (it only
handles numeric-month broker-tradebook formats) — the date silently
fell back to today's date instead of the file's actual date. Fixed
with a dedicated `Quotes._normalizeDate()` that handles the MON-name
format and falls back to Ledger's parser for anything else. Caught
because the test CSV used a real NSE-shaped date rather than a
convenient placeholder — worth remembering as a pattern: model fixture
data on the real external format being integrated with, not on
whatever's easiest to type.
Also caught (test hygiene, not app behavior): the `applyToPortfolio`
test set `Portfolio.state` to a fixture object, but `applyToPortfolio()`
calls `Portfolio.save()` internally whenever it matches ≥1 holding —
which writes straight to real localStorage regardless of the in-memory
variable. Restoring `Portfolio.state` afterward didn't undo that write,
and the fixture ("Totally Unmatched Co") leaked into a live manual
verification pass on the same origin/port. Fixed by also clearing
`localStorage[Portfolio.KEY]` in the test's cleanup. General lesson for
this codebase's test-writing pattern: any test that touches a module
whose methods call `.save()` needs to clean up real storage, not just
restore the in-memory object — restoring the variable is necessary but
not sufficient.
Verified live: imported a real bhavcopy CSV and a real ledger CSV
through the actual UI-adjacent call path, watched a holding's price
update from the EOD close and an unmatched holding get reported by
name; logged two Nifty levels and watched the counterfactual line
render "Real trades: X% vs synthetic Nifty: Y%" with the exact levels-
logged/trades-priced counts; zero console errors throughout. test.html
gained 17 new assertions (bhavcopy parsing incl. the DD-MON-YYYY date
bug, idempotent snapshot replace, symbol matching incl. the honest
null case, portfolio marking incl. the unmatched-holding report,
Nifty log idempotency, nearest-level lookup incl. its before-everything
fallback, the not-ready gate, and an exact-equality proof that the
counterfactual math is genuinely apples-to-apples when the index and
stock move by the identical %) — 112/112 total assertions pass.
Why: choosing CSV import over a live NSE fetch, and 2 lanes over 3,
were both driven by the same principle — build what can actually be
verified end-to-end in this environment, and say plainly what's
substituted and why, rather than shipping code that looks complete but
was never really exercised against the real thing it claims to
integrate with.
Rejected: regime variable (Nifty vs 50-day MA + VIX), narrative age
(first-seen date on clusters), hit-rate tables, and advanced charting
— all explicitly deferred as optional extensions per the Session #15
core-slice plan; none block Sprint 13.

**2026-07-14 · Sprint 13 core slice complete** — Staged demo data:
`JDATA.DEMO_LEDGER` (7 buy/sell events spanning Nov 2023–Nov 2024,
covering the same names as the existing `JDATA.DEMO_BOOK`, including a
dollar-cost-averaged HAL add and a full RVNL round-trip so `Ledger.
xirr()` has real, non-degenerate cash flows to demo) joins the
already-existing demo portfolio; the news feed needed no new asset
since `JDATA.FEED` is already the default simulated corpus. `App.
loadDemoData()` loads both together (used by both the existing "LOAD
DEMO BOOK" button and the new `?demo=true` URL param); `App.
maybeLoadDemoFromUrl()` gates the URL-triggered path behind a
confirmation whenever real portfolio/ledger data already exists —
a query param must never silently overwrite a user's actual data.
Privacy blur: a `.privacy-blur` body class + `.money` marker class on
the highest-visibility personal-money elements (net worth hero,
unrealised P&L, holdings table qty/buy/cur/value columns, allocation
donut center, ledger summary, goal progress values) — blurred via CSS
`filter:blur(7px)`, revealed on hover. Percentages (P&L%, XIRR%, tax
rate, conviction, Brier score) are deliberately never blurred — the
plan's "shows percentages only" framing, not an oversight. Command
Center's aggregate "CAPITAL TRACKED" KPI was deliberately NOT tagged
`.money` — it's public, market-wide disclosed-flow data aggregated
from news, not the user's own holdings, so blurring it wouldn't serve
the actual privacy purpose (hiding personal numbers from a screen-
share), just make the dashboard read worse for no reason.
Verified live: `?demo=true` on a fresh install loaded 8 holdings + 7
ledger events with no prompt (nothing to lose); reloading with real
data present correctly triggered the confirm dialog and respected
Cancel; the privacy-blur toggle in Settings correctly set `filter:
blur(7px)` on tagged elements and `none` when off, confirmed via
computed style in a clean tab (an earlier tab's renderer had gotten
stuck — visible as `computer` tool screenshot/zoom timeouts — which
briefly looked like a CSS bug until cross-checked in a fresh tab; noted
here so a future session recognizes the same false-alarm shape instead
of re-debugging a real cascade issue that wasn't one). test.html
gained 5 new assertions validating `DEMO_BOOK`/`DEMO_LEDGER` structural
integrity via already-tested `Ledger.replay()`/`xirr()` (DOM-level
demo-loading and CSS-blur behavior aren't unit-testable the way
test.html's other pure-logic modules are, so those were verified live
in-browser instead, consistent with how prior sprints handled
render-only features) — 117/117 total assertions pass.
Why: reusing the existing DEMO_BOOK/button rather than inventing a
separate demo-data mechanism kept this additive instead of parallel;
tagging only the highest-visibility money elements (not literally
every number in the app) matches "no new features, no UX changes —
just infrastructure" without turning this into a full markup audit.
Rejected: the capital flight map and light/dark theme toggle — both
explicitly deferred as optional extensions per the Session #15
core-slice plan; neither blocks Sprint 14.

**2026-07-14 · Sprint 14 core slice complete** — `JDATA.CAUSAL_EDGES`
(data.js): Session #3's full signed/lagged edge list transcribed as
static data — 73 edges (from/to/sign/lagDays/why/category) across 8
categories (monetary policy, oil & commodities, currency, geopolitics,
fiscal, environmental, cross-sector, sentiment). Loaded and rendered in
a new "CAUSAL GRAPH" panel (Patterns view) — not yet propagated into
scenario stress cards, which stays the explicitly-deferred extension
it always was. `Engine.evidenceGrade(item)`: Session #12's A/B/C/D
badge, derived entirely from state the engine already computes — D
(hype-flagged, overrides everything else since sourcing can't redeem
hype content), A (confirmed with ≥1 tiered/official source), B
(confirmed but zero tiered sources — reuses the exact source-tier
check from Sprint 9's pump-dump guard attack #1), C (single-source,
non-hype). Rendered as a top-right corner badge on every Intel card
per the session's own placement rule. `Engine.computeNovelty()` +
`Store.loadYesterdayShingles()`: echo-vs-novelty, deliberately rough —
an item is "novel" unless its shingles clear the same 0.55 Jaccard bar
used for same-day dedup against anything archived in a loose ~20–48h
window; with no yesterday-shingle history loaded (cold start or
IndexedDB unavailable), everything defaults to novel rather than
guessing echo status from nothing. Rendered as a subtle "↺ ECHO" chip,
present only on echoes — absence of the chip is the novel-by-default
signal, matching Session #12's existing "don't clutter the majority
case" rule for confirmation chips.
Verified live: grade badges rendered on the real demo corpus with a
plausible distribution (28 C / 2 B / 2 A, zero D since hype items are
quarantined out of the main list already); all 73 causal edges
rendered in the new panel; novelty correctly cold-started to
novel=true for every item on a fresh install (0 yesterday-shingles
loaded), then correctly flipped to novel=false for a specific item
after writing a real matching record directly into IndexedDB (lastSeen
~30h ago) and re-running `loadYesterdayShingles()` — confirming the
full pipeline (real IndexedDB → shingle comparison → `.novel` flag →
rendered echo chip) works end to end, not just against synthetic
in-memory fixtures; zero console errors throughout. test.html gained
8 new assertions (causal-edge structural integrity, all 4 grade-badge
cases, the no-history-defaults-novel case, and both the echo and
fresh-item novelty cases) — 125/125 total assertions pass.
Why: `computeNovelty()` and `computeGrades()` were added as normal
steps inside `Engine.run()` (right after `buildGroups()`, since both
need `.confirmed`/`.hype`/`.groupSources` which buildGroups sets) rather
than as separate opt-in calls — every item gets a grade and a novelty
flag unconditionally, the same way every item already gets an impact
score, so no future render path can forget to call them and silently
show ungraded content.
Rejected: scenario stress cards (propagating shocks through the causal
graph), full threads/value-chain analysis, and time-decay half-lives
per signal type — all explicitly deferred as optional extensions per
the Session #15 core-slice plan; none block Sprint 15.

**2026-07-14 · Sprint 15 core slice complete** — `js/sunday.js` +
an 8-step wizard modal in `app.js` (triggered by a new topbar icon
button): the Sunday review ritual from Session #6's spec, screens
0 (opening framing) through 7 (closing commitment), skipping only
Screen 7's "One Question" reflection prompt (non-blocking, lower-
priority, not named in the core-slice plan's screen list). "Witnesses,
not gates" (Constitution Article 13) is load-bearing here, not just a
description — the two blocking screens (predictions due, closing
commitment) only block moving FORWARD within the ritual; the modal's
own close button, backdrop click, and Escape all still work on every
screen, same as anywhere else in the app.
Two screens adapted from Session #6's original design, not silently
dropped: **blind spots** substitutes real click/view-tracking (which
doesn't exist) with a genuinely computable proxy — active clusters
with zero portfolio exposure, reusing Sprint 10 Brain's exact sector-
matching heuristic. **Alert health** shows currently-active alerts only
(fired-vs-acted outcome history is the explicitly-deferred "behavioral
insights" extension). **Reconciliation** is presence-only, no NLP: a
journal entry within `RECONCILE_WINDOW_DAYS=3` before a trade counts
as "logged beforehand," matching the rest of this engine's "no fancy
matching" discipline — documented plainly on-screen as an approximation,
not a semantic match. **Numbers** honestly omits a portfolio-value
delta (no net-worth history snapshot store exists — that was always
Sprint 7's deferred extension) rather than fabricating one.
The closing memo is deterministic template-filling from real computed
numbers (Session #6's own emphasis — no generated prose), downloadable
as a real `.md` file via the same Blob-download pattern as the Sprint 1
backup export.
Verified live end-to-end: seeded one real untraced trade and one real
overdue prediction, then walked all 8 screens as a real user would —
Screen 2 correctly flagged the untraced trade; Screen 3 correctly
showed zero Continue button until the overdue prediction was resolved,
then correctly unblocked in place after a real YES click; Screens 4–6
showed real blind spots (Semiconductors, Railways & Logistics, Energy
Transition — genuine zero-exposure active clusters), a real active
Sonar-derived alert, and the honest Brier N-gate; Screen 7 correctly
rejected an empty submission, then saved a real commitment and
generated a memo containing the exact real numbers from every prior
screen; download triggered with no errors; zero console errors across
the entire flow. test.html gained 9 new assertions (week-trade date
filtering, reconciliation's window-based include/exclude split,
predictions-due filtering, blind-spot exposure matching, commitment
round-trip, and deterministic memo generation) — 134/134 total
assertions pass.
Why: computing all non-predictions screen data ONCE at ritual open
(numbers, reconciliation, blind spots, alerts, calibration) rather than
per-step keeps the ritual's numbers internally consistent even as the
user spends several minutes moving through it — only the predictions-
due screen re-fetches live, because it's the one screen the user
actively changes mid-ritual by resolving items.
Rejected: behavioral insights (alert-outcome tracking, attention-
distribution drift), advanced reconciliation analytics, the "One
Question" reflection screen, and next-Sunday commitment callback — all
explicitly deferred as optional extensions per the Session #15
core-slice plan; none block Sprint 16.

**2026-07-15 · Sprint 16 core slice complete** — Four hardening
deliverables. (1) **Restore drill**, performed live rather than just
described: populated all 11 current data classes (settings, chat,
portfolio, ledger, goals, predictions, journal, EOD quotes, Nifty log,
Sunday-review history, signal-archive rollups) with real data, built
the export payload via the exact `exportData()` logic, cleared
`localStorage` entirely, restored via the exact `wireImport()` logic,
reloaded, and verified every module read its data back correctly —
zero data loss, zero code changes needed. Confirms Sprint 1's original
"scan by `jarvis.*` prefix" export design (rather than a hardcoded key
list) has scaled cleanly across 15 sprints of new data classes with no
maintenance burden. (2) **`THREAT-MODEL.md`**, formalized from Session
#8's thinking output and re-verified line-by-line against actual code
rather than carried forward — three boundaries had diverged from the
original plan: relay write-token auth (Boundary 2b) was never needed
since the ledger stayed localStorage-only (Sprint 7 scope decision,
not an oversight); OneDrive sync (Boundary 4) was resolved by physical
relocation to `C:\jarvis`, a cleaner outcome than the original
Constitution-amendment recommendation; multi-tab races (Boundary 6)
were resolved as scheduled (Sprint 5.5's TabGuard). Added Boundary 8
for the `?demo=true` URL param (new since Session #8), already safely
gated at build time. (3) **Keyboard a11y pass** for the six main views:
verified Tab order through the sidebar and Enter-activation both
already worked correctly (real `<button>` elements throughout, no
custom keydown handling needed) and that `gotoView()` already moves
focus to `#views` after switching (an existing, correct ORD-implemented
behavior). Found and fixed one real, previously-undetected gap in the
process: the shared `modal()` function never moved focus INTO a newly-
opened modal, and never restored it to the triggering element on
close — fixed once in `modal()` itself (captures `document.
activeElement` as `trigger` before opening, focuses the first real
focusable child or falls back to the modal container via `tabindex=
"-1"`, restores focus to `trigger` in `close()`), which fixes every
modal in the app at once — settings, confirm dialogs, all forms, and
Sunday review — rather than patching each call site individually.
Verified live with real keyboard interaction (click-to-open, Escape-
to-close) confirming focus lands on the first real control and returns
to the exact trigger button afterward. (4) **In-app one-time notice**
for Threat Model Boundary 1 (recommend a dedicated, extension-free
browser profile) — shown once ever on first boot, marked seen the
moment it displays rather than on a specific dismiss action, since
it's informational, not a gate.
Tooling note, not an app bug: an early attempt to verify Enter-key
view-switching via the browser automation tool's synthetic "Return"
keypress showed the view NOT changing, which looked like a real bug at
first — cross-checked with `document.activeElement.click()` (a genuine
click event on the same focused button), which worked correctly
immediately. The synthetic key dispatch in this specific automation
tool doesn't reliably trigger a focused `<button>`'s native Enter-
activates-click behavior; real physical keypresses in an actual browser
do. Worth remembering as a known false-positive shape for future
keyboard-interaction testing in this environment.
Why: fixing modal focus management once in the shared `modal()`
function rather than auditing every individual `openX()` call site was
the only approach that scales — this codebase has ~10 distinct modal-
opening functions by Sprint 16, and a per-call-site fix would need to
be re-applied by hand every time a new one is added; a shared-function
fix means every future modal inherits correct behavior automatically.
Rejected: full WCAG compliance audit, Lighthouse perf budgets, and the
dictionary-teaching flow — all explicitly deferred as optional
extensions per the Session #15 core-slice plan; none block Sprint 17.

**2026-07-15 · Sprint 17 core slice complete — final sprint on the
17-sprint roadmap** — `js/provenance.js`: Constitution Article 6 ("every
conclusion is explainable as a one-line chain") made literally
clickable. A small provider registry — one function per number type,
each returning `{formula, inputs, note?}` from real state, never a
recomputed guess — wired to 5 flagship numbers: Intel Feed's impact
score, an idea's conviction score (with the full v2 weighted-sum
breakdown), My Money's ledger XIRR, the Prediction Book's Brier score
(only clickable once the N≥15 gate passes — consistent with the number
itself only existing past that gate), and the Honesty Panel's parser
health row. Deliberately 5, not every number in the app — the registry
pattern means a 6th is a ~10-line addition, not a redesign, so which
numbers get wired next is a scope choice, not an architecture one.
Tour mode: a hardcoded 6-step scripted walkthrough (`App.startTour()`)
narrating each of the six views via `Jarvis.say()`, auto-loading Sprint
13's staged demo data if the book is empty so there's always something
real to show. A persistent "STOP TOUR" bar is visible throughout —
verified live that stopping mid-sequence exits immediately and cleanly,
never trapping the user (Article 13, same principle as the Sunday
review's blocking screens). `HOW-TO-USE.md`: a one-page guide covering
the six views, how to get real data in (live news, CSV imports, demo
mode), the Sunday ritual, talking to the Brain, and pointers to the
other three project docs.
Verified live: clicked a real Intel Feed impact number and confirmed
the modal showed the item's actual impactRaw/corpus-size/confirmed/
hype values matching the displayed percentile; clicked a real idea's
conviction and confirmed the v2 component breakdown summed correctly;
clicked the real ledger XIRR and Brier gate behavior (Brier correctly
NOT clickable when below N=15, exactly as designed); ran the full tour
end-to-end and confirmed all 6 narration lines fired in order and the
tour bar/state cleaned up automatically at completion; ran it again and
hit STOP TOUR mid-sequence, confirming immediate clean exit; zero
console errors throughout. test.html gained 12 new assertions covering
all 5 provenance providers (including the honest "not solvable" and
"below gate" cases, not just the happy path) plus the unregistered-type
null case — 142/142 total assertions pass.
Why: fixing provenance and tour mode as small, additive, registry-based
systems (not touching existing render logic beyond adding a class and
a data attribute per wired number) kept this sprint's risk low despite
touching 5 different views' worth of render code — every existing
number continues rendering exactly as before; only the newly-tagged
ones gained a click affordance.
Rejected: full replay mode (pick a past date, see that day's
dashboard), an interactive/user-paced tour, and a recorded video demo —
all explicitly deferred as optional extensions per the Session #15
core-slice plan.

---

**All 17 sprints (plus Sprint 5.5) on the original roadmap are now
complete.** Every sprint shipped a working core slice, verified live in
a real browser with zero fabricated test results, logged here with
what was built, what broke and got fixed, and what was deliberately
scoped out. test.html has grown from 20 assertions at Sprint 5 to 142
at Sprint 17, entirely additive — no sprint's tests were ever removed
or weakened to make room for the next. The project's own constitution,
decisions log, threat model, and now a user guide are all real,
current documents, not aspirational ones.

**2026-07-15 · Brain v2 complete (post-roadmap, first deferred
extension picked up)** — `js/brain.js` grown from Sprint 10's 5 intents
to the full 17-intent grammar from Session #9's 80/20 core set, now
that every blocked data source exists (ledger XIRR, Brier, the Nifty
counterfactual, Sunday reconciliation). Three deterministic layers, no
AI anywhere: (1) an ordered regex intent table, specific intents before
general ones — "predictions due soon" must hit due-soon before the
broader predictions-open; (2) the slot-extraction layer Sprint 10
explicitly excluded — `matchSector()` resolves a sector from the query
via sector labels/keys/watch-names and the 64-company name/symbol
table (word-boundary matched, so "SBI" hits but "wasabi" doesn't), and
`matchPct()` pulls the shock percentage; ambiguous short tokens ("it",
"ev") only match typed uppercase, so "how does it affect..." never
reads as the IT sector; (3) grounded composition — every handler
template-fills from real module state with an honest empty-state.
New intents: sector shock (exposure × pct, market-wide when no sector
named, with an explicit "linear, no correlation effects" caveat),
bull/bear case per sector, sector/company exposure (with a bearish-
cluster warning appended when one is active on that sector), worst-case
sector (bearish clusters ranked by the user's actual rupee exposure),
biggest single-stock risk, hedged %, vs-Nifty verdict (gated on 2+
logged index levels, with a "measures history, not skill" caveat),
trade frequency/churn, rules-check (reusing SundayReview's
reconciliation), calibration read (Brier vs the 0.25 baseline, gated
at N=15), and predictions-due-soon (7-day horizon + overdue callout).
`holdingsInSector()` centralises the holdings↔sector heuristic;
bullish-capital now uses it instead of its own inline copy.
Verified live on the demo book: "how does HAL affect my portfolio"
slot-matched HAL→defence via the company table and cited the real
₹54K (12 × ₹4,485) with real P&L; Bitcoin correctly named as the 44%
concentration risk; hedged read 22% Gold/Cash; vs-index honestly
refused the comparison (no Nifty levels logged) while still citing the
real XIRR; trade-frequency honestly reported 0 recent / 7 all-time
(demo ledger is 2023–24 dated); full chat path confirmed Brain-first
routing with the personality table (jokes, briefings) falling through
untouched; zero console errors. test.html gained 23 assertions (7
slot-extraction incl. the lowercase-"it" guard, 16 intent cases incl.
every honest gate) — 165/165 total pass, all pre-existing brain tests
untouched and green, proving the ordering changes broke nothing.
Rejected (still): intent-learning from user corrections and the
composed morning-briefing ritual — the first needs a teach-UI design
pass, the second is a composition of existing answers better designed
alongside the Sunday ritual's callback mechanic.

**2026-07-15 · Brain v2.1 complete — measurement + normalization** —
The brain now has a recall METRIC instead of vibes. (1) Golden
utterance corpus: 40 fixed utterances in test.html — canonical
phrasings for all 17 intents, 14 paraphrases that only pass via the
new normalizer, and 4 negatives that must fall through to the
personality table rather than mis-route — asserted at 100%, additive
only (a failing row means real coverage broke; rows are never removed
or weakened to make a change pass). `Brain.matchIntentId()` added as
the testable seam. (2) Normalization pre-pass: 14 ordered,
case-preserving canonicalization rules applied before intent matching
("tanks/plunges/slides"→"drops", "better/worse than the
market"→"beating the nifty", "invested in"→"exposure to" with a
negative lookahead protecting the bullish-capital intent,
"protected"→"hedged", "biggest position"→"largest position",
"concentrated"→"concentration risk", etc.) — every rule has a corpus
row proving it converts a real miss into the intended intent; no
speculative rules. Case preservation matters: the uppercase-"IT"
sector guard survives normalization. (3) Miss log
(`jarvis.brainmisses.v1`, Schema-versioned, 50-entry FIFO cap):
queries that beat BOTH the brain and the personality table are
recorded and surfaced in the Sunday review's alert-health screen as
"queries I couldn't answer this week" — the data-driven answer to
which intent gets built next, and the honest precursor to
intent-learning without needing a teach-UI yet.
Verified live: "what if banking tanks 12%" routed through the
normalizer to the real shock intent with real exposure math (₹68K =
40 × ₹1,712 HDFC Bank); "should i buy a house in goa" fell through
both layers via the real Jarvis.handle path, landed in the miss log,
and appeared in the actual Sunday review screen; zero console errors.
test.html: 173/173 (8 new assertions: 5 normalizer incl. the
lookahead guard and case preservation, 2 miss-log incl. the FIFO cap,
1 corpus assertion covering all 40 utterances, plus an INFO recall
line).
Why: measurement before strengthening — every future brain change is
now judged against a fixed corpus, and every future intent is chosen
from logged real demand instead of guesses. Explicitly NOT done:
performance micro-optimization (17 regexes over a 32-item corpus is
microseconds; not the bottleneck and never was).
Rejected (still queued, in priority order): one-turn sector memory,
the compare-two-sectors intent with multi-sector slots, the composed
morning briefing, and guarded fuzzy company-name matching.

**2026-07-15 · Brain v2.2 complete — the brain-strengthening queue is
empty** — All four remaining items from the strengthening plan shipped
together. (1) One-turn sector memory: `Brain.resolveSector()` remembers
the last EXPLICITLY named sector (session-only, never persisted); a
sector-less follow-up like "and the bear case?" reuses it and SAYS so —
"(assuming you still mean Defence & Aerospace — name a sector to
switch)" — assumptions stated, never silent. Deliberately NOT applied
to the shock intent (`fallback:false`): "what if the market drops 10%"
means the whole market, not the sector last discussed — memory is never
applied where it silently changes meaning. (2) `matchSectors()` (multi-
sector, ordered by appearance in the query) replaces the single-sector
matcher as the primitive, powering the new compare-sectors intent:
side-by-side momentum, bull/bear split, and the user's real rupee
exposure for both named sectors; fewer than two sectors gets an honest
"name two sectors" clarification, and a "vs the nifty/index" phrasing
delegates to the vs-index intent rather than mis-answering. (3) The
composed morning briefing: five existing intents (hot, contested,
worry, predictions-due, rules-check) stitched in fixed order — each
already carries its own honest empty-state, so composition adds zero
new fabrication risk; deliberately does NOT match plain "brief me",
which stays with the personality-table sitrep. (4) Guarded fuzzy
company matching: edit distance ≤1, query tokens ≥5 chars, company
lexicon only (never sector labels) — "relianc" resolves to Reliance→
energy; "random"/"today" never fuzzy-match anything.
Test-assertion bug caught during the run (not an app bug): two new
assertions checked for "Banking & Finance" in answer text, but answers
correctly HTML-escape labels to "Banking &amp; Finance" — first time
this bit because every earlier brain fixture happened to use ampersand-
free labels. Assertions fixed to expect the escaped form the app
actually (correctly) produces.
Verified live on the demo book: the follow-up reused defence with the
assumption stated; compare cited real exposure for both sectors (₹68K
HDFC Bank / ₹54K HAL); "do i own relianc?" fuzzy-resolved to Energy
Transition with an honest zero-exposure answer; the briefing composed
five real grounded lines; zero console errors. test.html: 183/183 (10
new assertions + 4 new golden-corpus rows, corpus now 44 utterances;
the one adapted assertion — the bull-case clarification test — now
clears memory first, since the clarification path legitimately
requires no-sector AND no-memory; the path itself still asserted, not
weakened).
Rejected (still, unchanged): intent-learning from user corrections —
needs its own teach-UI design pass; the miss log from v2.1 is its
data-collection precursor and is already accumulating real demand.

**2026-07-16 · Brain v3 complete — the teach loop closes the brain's
last deferred item** — Intent-learning from user corrections, built as
the two-piece loop the v2.1 miss log was always the precursor to.
(1) "Did you mean" guesses: on a query that beats BOTH the brain and
the personality table, `Brain.guess()` scores every intent by exact-
token overlap between the (normalized, stopword-stripped) query and a
hand-written per-intent vocabulary (`INTENT_META` — every intent has a
chip example + vocab, enforced by a test so no future intent can ship
unteachable). Top-3 with score > 0 render as clickable chips in chat;
zero matches falls back to the old help text — no guess is better than
a fabricated one. (2) Taught phrases (`jarvis.taught.v1`, Schema-
versioned, 100-entry FIFO): clicking a chip IS the correction — it
stores the missed phrasing → intent mapping, toasts "Learned", and
immediately re-asks the phrase, which now routes through the taught
table and produces the real grounded answer. Taught routings are
checked BEFORE the regex grammar (an explicit user correction outranks
built-in rules — tested), re-teaching replaces rather than duplicates,
and `Brain.forget()` exists for reversal. Deterministic end to end:
the "learning" is a user-curated alias table, zero AI.
Verified live on the demo book: "is my downside protected" missed both
layers, produced exactly the two right chips (bearish-signals via
'downside', hedged via 'protected'); clicking the hedged chip taught
the phrase and instantly answered with the real 22% Gold/Cash
allocation; re-asking routed directly with no chips; zero console
errors. Two false starts during verification worth recording: (a) the
first demo phrase ("how risky is my book") never reached the miss
branch because the personality table's /my (book|money)/ portfolio
intent legitimately caught it — a reminder that the miss branch only
sees what BOTH layers decline; (b) chips appeared absent for ~30s
because the harness browser throttles setTimeout and FX.type runs
~110 chunked timeouts per message — the app's own reduced-motion path
(FX.reduced) renders instantly and was the right verification lever,
not an app bug. test.html: 196/196 (13 new: META completeness, guess
hit + honest-empty, teach/route/override/forget/replace/cap, and the
grounded-answer-not-placeholder check).
Why: the correction loop was gated on a "teach-UI design pass" — the
insight that unblocked it is that the chip click IS the teach UI: no
forms, no settings page, the correction happens exactly where the
failure happened, at the moment it happened, in one click.
The brain is now complete as designed: 19 intents, normalization,
slot extraction with memory and fuzzy tolerance, measured recall (44-
utterance golden corpus), a miss log feeding a one-click teach loop,
and not a single generated fact anywhere in the pipeline.

**2026-07-16 · Attack #13 fixed — cross-sector momentum over-count,
ENGINE_VERSION 5→6** — The one item red-team Session #1 marked
"must-fix at next touch of buildClusters()" and every sprint since
left untouched: an item tagged with N sectors contributed its FULL
impact to all N clusters' momentum, so a single multi-sector story
(a defence-cum-infra order win) counted as N units of evidence. Fixed
in `buildClusters()`: each item now contributes `impact / max(1,
sectors.length)` per cluster — it still counts everywhere it's
relevant, just at fractional weight, so one story is one unit of
evidence no matter how many sector regexes it trips. ENGINE_VERSION
bumped 5→6 per the established rule (any change to scoring math),
so archived rollups and future calibration segment cleanly instead of
comparing scores produced by different arithmetic.
Deliberately scoped OUT: `Store.snapshotToday()`'s per-sector
`impactSum` keeps the full-impact-per-sector convention — it's an
attention/activity measure, not an evidence measure, and BOTH sides
of `App.patternDelta()`'s vs-yesterday comparison use that same
convention, so it stays internally apples-to-apples. Changing it
would have broken comparability with every archived rollup for a
metric where double-counting isn't actually wrong.
Verified: new regression test constructs two sectors sharing one
two-sector item (impact 60) — asserts each cluster reads the shared
item as 30, with the assertion message documenting the pre-fix
double-count value it must NOT equal; 197/197 assertions pass,
including the comparative null-model test under the new math. Live on
the demo corpus: defence — whose stories heavily overlap infra tags —
correctly deflated (score 45 → 37) while single-sector clusters held,
which is exactly the shape of the bug being removed; zero console
errors.
Why now: it was the top item in the "what's left" review — shipping
further enhancements on top of known-wrong momentum math would invert
the project's own truth-first ranking (Art. 1).

**2026-07-16 · Scenario stress engine — the causal graph starts
reasoning (biggest intelligence upgrade since the engine itself)** —
`js/scenario.js` turns JDATA.CAUSAL_EDGES from an inert 73-row lookup
table into actual second-order reasoning: given a macro shock, it
propagates ONE STEP through the signed/lagged edges to every affected
sector, resolves each destination to a portfolio sector where one
exists, and attaches the user's real rupee exposure and direction of
hit. `Scenario.matchShock()` maps free-text queries to canonical
shocks via an ordered matcher table, with direction words
disambiguating the ± pairs (crude spike vs crash, rate cut vs hike,
rupee weak vs strong, FII in vs out, monsoon fail vs good).
`_familyKey()` merges the split shock strings ("USD strength (INR
weakens)" + "USD strength") so propagating one gathers both edges,
while keeping the +/- in the key so opposite crude shocks never merge.
Wired two ways: a new `scenario` brain intent (placed BEFORE
sector-shock, so "what if crude drops 20%" routes here — oil is a
macro shock, not a holdable sector — while "what if defence drops 10%",
no macro term, still falls through to sector-shock), and a Scenario
Stress Test panel in Patterns (shock dropdown + RUN → cards, with the
full edge table demoted to a collapsible details).
Every honesty caveat from Session #3 is enforced in the copy: SINGLE
STEP only (no feedback loops — the "IT strong → rupee → IT weaker"
equilibrium is explicitly out of scope), net-average DIRECTION with NO
magnitude ("▲ favours"/"▼ pressures", never "+X%"), lags labelled
typical-not-guaranteed. Pure rule-based graph traversal, zero AI, zero
invented probabilities.
Verified live on the demo book: "what happens if RBI cuts rates"
propagated correctly through real edges — IT & AI / Pharma / Real
Estate favoured (weaker rupee helps exporters), Banks pressured (the
real −1 NIM-compression edge) — and correctly attached "your ₹68K" to
the Banks hit from the HDFC Bank holding; the UI panel rendered 6 cards
with a "₹37K helped · ₹68K hurt" roll-up (Infra/L&T favoured, Banks/
HDFC pressured), each card carrying the causal `why`; crude-spike
correctly hit Aviation/Shipping/Pharma/Paints negative and Energy
positive. test.html: 211/211 (14 new — destSectorKey mapping,
familyKey split/merge, catalog, matchShock direction disambiguation +
null case, propagate signed-edge + lag-sort + exposure attach,
portfolioImpact roll-up + empty-book honesty, and 3 brain-integration
routing checks incl. the scenario-vs-sector-shock boundary; 5 new
golden-corpus rows, corpus now 49 utterances). Screenshot verification
timed out (known browser-pane flakiness this session, not an app
issue) — DOM assertions are authoritative and all passed.
Why: it was the top *intelligence* item on the "what's left" review —
the graph data had been sitting loaded-but-inert since Sprint 14, and
propagation is where a rule-based system genuinely reasons about
consequences rather than just scoring first-order sentiment.

**2026-07-16 · Durability — relay-to-disk mirror, the last place a user
could permanently lose data (Threat Model Boundary 2b, Constitution
Art. 14)** — Ledger/journal/predictions/goals/Sunday-commitments/taught-
phrases/portfolio were localStorage-only; a browser-profile wipe,
cleared site data, or eviction destroyed them unless the user had
manually exported. Article 14 ("data outlives the software") was
satisfied only by discipline. Now it's machinery.
`relay.js` gains a token-gated disk store: `GET /token` (hands the app
its per-startup random token, exposed only to exact-localhost origins
via the existing CORS reflection), `GET /store/<key>` (read a blob),
`POST /store/<key>` (write it, requires `X-Jarvis-Token`). POST is
allowed ONLY on `/store` — every other route stays GET-only. A key
allowlist + `^jarvis\.[a-z]+\.v\d+$` regex forbids path traversal and
non-durable keys; 2MB cap; body must parse as JSON. `js/persist.js` is
the client: `probe()` grabs the token at boot, `Schema.save` now
mirrors every durable-key write to disk best-effort (guarded on
`typeof Persist` so Schema stays load-order-independent and the whole
thing degrades to exactly the old localStorage-only behaviour when the
relay is absent), and `restoreMissing()` runs before first paint —
any durable key MISSING from localStorage but PRESENT on disk is
restored (the profile-wipe recovery path), with Portfolio re-loaded
since it's the one cached module.
Verified end to end with a REAL relay + REAL browser, not mocks: (1)
curl round-trip proved token gating (403 wrong token), key allowlist
(400 bad key), path-traversal rejection (400), non-JSON rejection
(400), and disk write landing correctly; (2) in-browser, demo data +
a real prediction/goal auto-mirrored to 4 disk files with zero manual
action; (3) THE decisive test — `localStorage.clear()` (0 keys), reload,
and ledger (7)/goals/predictions/portfolio (8) all came back
automatically from disk. `.gitignore` created (the repo had none) so
`data/` — real personal financial data — can never be committed
(Art. 7). test.html gained 9 Persist-client assertions with a mocked
fetch (probe success/failure, mirror durable-only + token header +
unavailable no-op, restore text/null, restoreMissing restores-missing-
only + never-overwrites, Schema↔mirror integration) — 220/220 total;
the render tally is now wrapped in an async IIFE so the one async
block completes before counting.
Why: it was #2 on the "what's left" review and the ONLY remaining item
where a user could permanently lose data. Everything else degrades
gracefully; this was a real cliff. The write-token shipped in the same
change as the write endpoint, exactly as Boundary 2b mandated —
never "add auth later."
Rejected: making the relay serve the app itself (would've simplified
the same-origin token story but re-opens Boundary 3 LAN-serving
concerns — the CORS-reflection approach keeps the app launchable any
way the user likes); auto-starting the relay (stays an explicit
`node relay.js` — durability is opt-in by running it, and the app is
fully functional without it).

**2026-07-16 · Brain v3.1 — graded confidence + intent-table integrity
test (refinement, not features)** — The brain was feature-complete, so
this is quality: it now expresses HOW sure it is instead of binary
match/dead-end. `Brain.interpret(query)` returns four tiers: 'match'
(exact grammar or taught routing — certain), 'confident' (no exact
match but ONE dominant vocab guess — score ≥2 with a clear lead over
the runner-up), 'ambiguous' (2+ close guesses), 'unknown' (nothing).
`jarvis.js` acts on the tier: an exact match answers immediately and
still jumps ahead of the personality table; a CONFIDENT guess is
answered AFTER the personality table (so explicit commands still win)
WITH the interpretation stated out loud ("Reading that as '…'") plus
one-tap chips to lock it in or correct — an honest "here's my read,
fix it if wrong", never a silent guess sold as certainty; ambiguous/
unknown fall through to the existing miss-log + did-you-mean chips.
Confidence gate deliberately strict: a single weak token (score 1) is
NEVER auto-answered, because a wrong confident answer is worse than an
honest chip prompt.
Structural: `guessScored()` (the {id,score} primitive) now backs both
`guess()` (ids-only for chips) and `interpret()`; `_resolve()` DRYs the
taught-then-grammar routing shared by `ask`/`matchIntentId`;
`intentById()` replaces the four scattered `INTENTS.find(...)` lookups.
The headline hardening: a SELF-ROUTING META-TEST — every intent's own
canonical example must route back to itself via `matchIntentId`. This
makes the previously-invisible first-wins ORDERING a tested invariant:
insert a future intent in the wrong slot and steal another's example,
and it fails loudly instead of silently mis-routing. It passed on the
first run, proving the hand-maintained order is actually correct, not
merely corpus-lucky.
Verified live on the demo book: "am I defensive and safe enough" — no
grammar match, no personality-table match, but strong hedged vocab
(defensive+safe = 2) — answered with the interpretation stated and the
real 22% Gold/Cash figure + a lock-in chip; and the ordering held ("is
my money safe" correctly went to the personality portfolio summary via
its explicit "my money" match, confirming confident guesses stay below
explicit commands). test.html: 230/230 (10 new — self-routing meta-
test, 6 interpret-tier cases incl. the score-1-is-not-confident gate
and taught-as-match, guessScored/guess/intentById). No behavior change
for any existing corpus utterance — 49/49 still route identically.
Why: the honest refinement was graded certainty (silent mis-routes →
stated interpretations) and making the intent table's ordering a
tested property rather than a maintained-by-vigilance one. Not gold-
plating: both are real robustness gains with failing-loud tests.

**2026-07-26 · Project relocated to `C:\Users\Vedan\Downloads\Jarvis`
(from `C:\jarvis`)** — User-directed move. Before moving, checked
whether `Downloads` is real local storage or OneDrive-redirected via
Known Folder Move (this machine's OneDrive HAS redirected `Documents`,
so this wasn't a safe assumption): no KFM registry override exists for
Downloads under `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\
Explorer\User Shell Folders`, and the `OneDrive` env var points at a
separate `C:\Users\Vedan\OneDrive` tree entirely — confirmed Downloads
is plain local disk. So Threat Model Boundary 4 (data must live outside
cloud sync) stays resolved at the new path; only Article 7's enforcement
location changed, not its status.
Moved via `Move-Item -Force` (includes hidden `.git`/`.gitignore`),
verified: destination has all files incl. `.git`; source directory
confirmed empty before cleanup. Git repo has zero commits (git-init'd
but never committed across any prior sprint) — so this was a plain
file relocation, not a history-preserving git operation; nothing was at
risk either way.
No `data/` directory existed yet (durability's disk mirror is created
lazily on first relay write via `fs.mkdirSync`; none had happened
outside test runs, which were cleaned up after verification) — so
nothing to carry over there.
Verified live post-move: `node relay.js` starts from the new path,
logs the correct new `data/` location, and `/health` + `/token` both
respond correctly — confirms `relay.js` has zero hardcoded absolute
paths (everything is `__dirname`-relative), so the move required no
code changes anywhere.
Updated: THREAT-MODEL.md Boundary 4 (the one place with a literal path
reference) with the new location and the verification above.
Deliberately NOT touched: this entry and Session #8/#14's original
THINKING-OUTPUTS — both are historical record of what was true when
written, not living state; the append-only/no-rewrite convention this
file has followed since Sprint 1 applies here too.

**2026-07-27 · Brain v3.2 — company-level answers (closes the flagged
real gap)** — Previously "how's HAL doing" collapsed into a SECTOR
rollup (all defence holdings summed), because the brain only resolved
company mentions down to their sector via `matchSector`. Added
`Brain.matchCompany()` — exact name/symbol match only, deliberately NO
fuzzy pass (unlike `matchSectors`' guarded fuzzy fallback): misreading
a sector just broadens an answer, but misreading WHICH company you
hold and stating its qty/P&L as fact would be a wrong number presented
as certain, which the brain's cite-or-silent rule never allows.
`sector-exposure`'s answer() now branches: a named company gets ITS
OWN qty, value, % of book, P&L, sector-momentum context, and a count
of real headline mentions (`Brain.companyMentions` — literal name/
symbol substring match on the headline text, never a fabricated
relevance score) — held or not. Not held → says so plainly, then still
offers the sector-wide color (useful, not a dead end). A sector-only
query with no company named is completely unaffected (verified: "what's
my exposure to defence" still returns the unchanged rollup).
Real gap found mid-build: "how's HAL doing" didn't trigger ANY brain
intent at all (no regex covers that phrasing) — it fell straight to
the miss/personality-table path. Fixed with two NORMALIZE_RULES entries
(`how's X doing/performing/holding up` and `how is X doing/...` → 
`exposure to X`), following the project's existing normalizer pattern.
Per that pattern's own rule, added golden-corpus rows ("how's HAL
doing", "how is defence doing") proving the conversion, not just a
speculative regex.
Verified live on the demo book: "how's HAL doing" → "HAL (HAL): 12
units, ₹54K (6% of book), P&L +15.3%. Sector (Defence & Aerospace)
momentum: 37/100. 1 signal in today's feed names it directly."; "how
is L&T performing" → its own correct numbers; "how's reliance doing"
(not held) → "You don't hold Reliance directly, Sir... Sector-wide
(Energy Transition): momentum 25/100, 0 bull / 0 bear." — exactly the
three cases (held / not-held / sector-only) designed for.
test.html: 238/238 (11 new: matchCompany resolution incl. the
no-company-found case, held-company numbers + real mention count +
sector momentum, not-held plain statement, sector-only regression
check, plus the two golden-corpus rows). Self-routing meta-test still
green — sector-exposure's own canonical example doesn't name a company,
so it's unaffected by the new branch. Caught and fixed one test bug of
my own along the way: a mock with two defence headlines where only one
literally named HAL — the code correctly counted 1, not 2, which is
the honest behavior; the test's expectation was wrong, not the code.

**2026-07-27 · Live prices — wired the dead /quote relay endpoint (Live-
data reach & resilience improvement)** — Audit found relay.js has
carried a fully working `GET /quote?symbols=...` endpoint (Yahoo
Finance chart-API proxy, cached, exact-hostname whitelisted) since
Sprint 12 with ZERO frontend caller — real infrastructure, unused.
Added `Quotes.fetchLive(symbols)` and `Quotes.syncLivePrices()`:
matches Portfolio holdings to JDATA.COMPANIES' tracked NSE symbols,
fetches real-time quotes through the relay, updates each matched
holding's `cur` price, and stamps a NEW `liveAsOf` (epoch ms) field —
kept deliberately separate from the EOD bhavcopy snapshot store so a
live intraday quote is never silently blended with a manually-imported
daily close under one ambiguous timestamp (Constitution Art. 4 —
every number answers "as of when"). Same graceful-degradation contract
as every other relay-dependent feature: relay unreachable →
`fetchLive` returns null, `syncLivePrices` reports `ready:false`,
holdings untouched, never throws.
UI: a "SYNC LIVE PRICES" button next to Import Bhavcopy in the EOD
Quotes panel, with its own status line (never merged with the EOD
bhavcopy status, same "as of when" reasoning) reporting matched count,
timestamp, and any unmatched holding names — never silently partial.
Verified live end-to-end with a REAL relay + real Yahoo Finance data
(not just mocked): demo book's HAL went from its stale ₹4,485 seed
price to the actual live quote (₹4,572) with a real `liveAsOf` stamp;
HDFC Bank and L&T also matched and updated; the 5 non-equity holdings
(2 MF, Gold, Crypto, Cash — types this feature honestly doesn't cover)
were correctly reported as unmatched, not silently skipped. Button
click handler exercised directly, not just the underlying function.
test.html: 243/243 (5 new — relay-down returns null/not-ready without
throwing, relay-up parses the real Yahoo-shaped response keyed back to
bare symbols, a matched holding gets priced + liveAsOf-stamped, an
unmapped holding is reported not silently skipped). Had to add
`js/live.js` to test.html's script list — it was never loaded there
(no prior test needed real relay-probing logic); mocks
`Live._relayUp`/`Live.fetchWithTimeout` the same way the Persist block
mocks `window.fetch`. Also had to convert the test block from an
untracked fire-and-forget async IIFE to a named `async function`
registered in the file's one `await`-before-tally wrapper (matching
`runPersistTests`'s existing convention) — the first version would
have raced the final assertion count silently.

**2026-07-27 · Widened live feed coverage + fixed a real source-
attribution bug (Live-data reach & resilience improvement)** — Added 3
new direct RSS feeds, each verified live via curl BEFORE adding (never
assumed a plausible-looking URL exists): SEBI (`sebirss.xml`, returns
real regulatory-action items), The Hindu BusinessLine markets feed, and
CNBC-TV18 markets feed. Rejected Business Standard (403, likely bot-
blocked) and Financial Express (its /feed/ redirects to a plain HTML
page, not a feed) rather than forcing either in.
Found a real, pre-existing bug while wiring this up: curled PIB's raw
RSS directly and found its items carry NO per-item `<source>` tag at
all (only `<title>`/`<link>`) — that's a Google-News-aggregator-only
convention, absent from single-publisher feeds. `Live.parseRss` was
falling back to the generic `'News Wire'` label for EVERY direct feed
item (PIB, RBI, Moneycontrol, ET, Livemint), which ALSO meant
`JDATA.SOURCE_WEIGHTS`' official-tier weight (already keyed on the
literal names "PIB"/"RBI"/"SEBI") never actually applied to the very
feeds it was written for — a silent loss of both attribution (Art. 4:
"says who") and correct evidence-tier weighting, live since Sprint 2.
Fixed by adding a `name` field to every `DIRECT_FEEDS` entry, threaded
through as a `sourceOverride` parameter (`fetch` → `fetchOne` →
`parseRss`) that wins over any per-item tag — correct, since a single-
publisher feed's items are never from someone else. The Google-News
aggregator path (no override passed) keeps its old per-item-tag /
'News Wire' fallback behavior unchanged.
`relay.js` ALLOWED_HOSTS extended with the 3 new hostnames (+
`www.pib.gov.in`, since PIB's own URL 301-redirects there — Node's
`fetch` auto-follows it, so this addition is defensive/future-proofing
rather than strictly required, but costs nothing and matches the
existing bare/www dual-entry pattern already used for rbi.org.in and
moneycontrol.com).
Verified live end-to-end (real network, real relay, no mocks): called
`Live.fetch()` in the running app — PIB: 8 items now correctly tagged
"PIB" (was silently "News Wire" before this fix), RBI: 7, SEBI: 8
(new), The Hindu BusinessLine: 8 (new), CNBC-TV18: 7 (new), Moneycontrol/
ET/Livemint: 8 each. `officialTierCount` (items where
`JDATA.sourceWeight > 1`): 24 — real confirmation the weighting chain
now actually connects end-to-end, which it silently didn't before.
test.html: 248/248 (5 new — parseRss honors sourceOverride over the
generic fallback, the override earns the real 1.3 weight via
JDATA.sourceWeight end-to-end, the no-override path is unchanged/
regression-safe, every DIRECT_FEEDS entry has a name so a future feed
can't silently regress to generic attribution, the 3 new feeds are
present).

**2026-07-27 · Sonar robustness batch — median/MAD, borrowed baseline
(Attack #5), question-headline guard (Attack #9), visible compute cap
(Attack #15)** — Closes four items the red-team catalog and sonar.js's
own comments had explicitly flagged as deferred. All four verified
against real code paths, not assumed from the doc's wording — one
(#5) turned out to need reasoning past what the doc literally said.

**Median/MAD (sonar.js's own self-flagged deferral)**: `termSpikes()`
now baselines on median/MAD instead of mean/stddev. Proved the reason
in a test: a single wild outlier day shifts a MEAN baseline 5x+ further
than a MEDIAN baseline — one crazy day two weeks ago no longer drags
today's threshold. `stddev()`/`mean()` kept (still useful for display),
but no longer gate the spike decision.

**Attack #5 (calibration-gap timing)**: investigated the doc's claim
that a new entity "has zero baseline, so mention-volume reads as
insufficient data" — traced the actual code and found the OPPOSITE
failure mode: a term with an all-zero history series produces
median=0/MAD=0, meaning ANY mention count already read as an
infinite-sigma spike (over-eager, not blind). Implemented the doc's
prescribed remedy anyway (cross-term borrowed baseline) since it fixes
the real underlying issue either direction: a term never mentioned
before today now borrows the median-of-medians/median-of-MADs across
OTHER terms mentioned today that DO have real (non-degenerate) history,
rather than baselining off its own fragile zero. Honest limit tested
explicitly: if NO other real-history term exists that day to borrow
from, it correctly falls back to its own zero baseline (flagged, not
silently dropped) — "borrowed protection" needs something to borrow
from; this is stated as a real boundary, not hidden.

**Attack #9 (question-headline bear-baiting)**: found the exact
mechanism the doc predicted. The "?"-halving (Sprint 5) is applied to
BOTH bullHits and bearHits before their comparison — halving both sides
equally is a no-op for which bucket `item.senti` lands in, so a
bear-leaning question still counts as a FULL bear vote in
`buildClusters()`'s `c.bear` tally. A cluster built entirely from "is X
doomed?" headlines could genuinely tip `c.bear > c.bull` and draft a
CAUTION idea despite zero real assertions. Fixed per the doc's own
stronger option (exclude from the COUNT, not just re-tune the
impact-dampening): `bull`/`bear` cluster tallies now exclude `qMark`
items entirely; individual items keep their own `.senti` for display.
Golden-corpus-style stress test added (as the doc explicitly asked
for): an all-question bear-baiting feed → `bear:0`, no caution idea;
the SAME wording as flat assertions (no "?") → still drafts a real
caution idea, proving the fix targets questions specifically, not
bearish content in general.

**Attack #15 (compute DoS via flood)**: confirmed `buildGroups()`'s
O(n²) pairwise shingle pass had NO cap at all — `Engine.run()` processed
`rawItems.length` unconditionally. Added `MAX_ITEMS_PER_PASS = 300`,
keeping the freshest items (lowest `.h`) when exceeded, and — per the
doc's explicit requirement that silent truncation is "exactly when
integrity matters most and is least likely to be manually noticed" —
surfaced `Engine.truncation` as a new red-banded Honesty panel metric
AND a real Alert, both showing the exact analyzed/skipped counts.
Verified live: a normal demo-data load shows no truncation metric; a
simulated 355-item flood shows `Honesty.compute()` reporting "capped at
300 — 55 not analyzed" with `band:'red'`, end-to-end in the running app.

test.html: 265/265 (17 new — median/MAD correctness + the outlier-
robustness proof, cold-start-borrows/cold-start-no-borrow-available for
attack #5, the question-cluster stress test + its flat-assertion
control for attack #9, flood-caps/freshest-kept/Honesty-surfaces-it/
no-false-alarm-under-cap for attack #15). Had to add `js/honesty.js`
to test.html (never loaded there before — no prior test needed it) and
update app.js's `renderSonar()` display string for the renamed
mean/stddev → median/MAD fields; existing sonar tests needed zero
changes (traced through manually: none of them exercise cross-term
borrowing, since each synthetic scenario only ever has one term).
Not touched (out of scope for this batch, already resolved or
tracked separately): Attack #13 (already fixed, prior session) and
Attack #12 (quiet-day percentile inflation — separate, not in this
batch's scope).

**2026-07-27 · Brain v3.3 — deeper composed reasoning within existing
restraint ("brain autonomy" axis)** — User explicitly confirmed the
scope before this was touched: raise the brain's "notices things on
its own" quality via MORE REASONING, never more ACTION — no execution
capability, no relaxed nudge cap (still Article 3's one-unsolicited-
nudge-per-session max), still cite-or-silent. This is information depth,
not agency.
Added `contested-exposure`: connects TWO real things nothing else
currently connects — Cross-Currents (Article 5: genuine bull/bear
disagreement, never averaged away) and the user's ACTUAL holdings.
`whats-contested` answers a global "what's split" question; `worst-
case-sector` answers a holdings-aware question but only for one-sided
BEARISH clusters (bear>bull). Neither answers "is any of MY money
sitting in a sector where the market genuinely can't agree" — that gap
is what this closes. Placed BEFORE `whats-contested` in the intent
table (more specific case wins) since a "my holdings" phrasing should
never fall through to the global-only answer.
Folded into the composed `briefing` intent too (replacing the plain
`whats-contested` line) — the morning briefing no longer just
concatenates five independent single-topic answers; one of its five
lines is now itself a cross-module synthesis.
Verified live on the real demo book (not just mocks): "is my portfolio
sitting in any contested sectors?" correctly surfaced L&T's real ₹37K
infrastructure exposure sitting in a genuinely contested cluster (7
bullish vs 3 bearish signals) — a connection no existing intent made
before. Self-routing meta-test confirms no ordering collision with
`whats-contested`.
test.html: 270/270 (5 new — held-in-a-contested-sector with real
exposure numbers, contested-sectors-exist-but-none-held, no-contested-
sector-at-all, empty-book honest state, self-routing correctness) +
3 golden-corpus rows (including a negative-space proof that a bare
"which sectors are contested" — no "my/holding" — still correctly
stays with the general intent, proving the two don't collide).
HOW-TO-USE.md updated with the new example phrasing.

**2026-07-27 · Finance-utility gap closed (Goals editing) + trust/
safety doc sync — final pass of the six-axis quality push** — Audited
the remaining three axes (finance utility, assistant feel, trust/
safety) for REAL gaps only, refusing to pad for a score.

**Finance utility — real gap found and fixed**: `goals.js`'s own header
comment admitted "editing... deferred" (Sprint 8 core slice), but
tracing `app.js` confirmed the UI only ever wired `Goals.add`/
`Goals.remove` — there was NO way to update a goal's progress after
creation. The entire point of a goals tracker is tracking progress
over time; without an update path, "progress" meant delete-and-re-add,
losing `createdAt` every time. Added `Goals.update(id, patch)` (in-
place field merge, returns false for an unknown id rather than
corrupting the list) and an "UPDATE GOAL" modal (edit icon next to the
existing delete icon, pre-filled with current values, reusing the
existing modal pattern from `openAddGoal`). Verified live: created a
goal, opened the edit modal (confirmed pre-filled), updated
currentValue 100000→250000, confirmed `createdAt` was preserved
(1785092923090 unchanged — proving in-place edit, not delete+recreate),
list length stayed 1, and the UI correctly re-rendered "₹2.5 L / ₹6.0 L
· 11 months left · 42%".

**Assistant/Jarvis feel — audited, no real gap found**: read
`jarvis.js`'s salutation/brief()/personality-table logic. `brief()`
already composes real grounded numbers (signals scanned, top pattern,
largest flow, top thesis, actual net worth/P&L) — not generic filler.
Considered adding more personality variety but concluded that would be
padding, not fixing something broken; Article 10 ("delete before add")
and the project's own anti-feature-creep discipline argue against
manufacturing "improvements" here without a real gap driving them.
Left untouched — an honest "nothing more to do here right now" is the
correct answer, not busywork.

**Trust/safety — audited, one doc-accuracy fix**: confirmed none of
today's changes (new RSS hosts, live-quote wiring, sonar changes,
brain reasoning, goals editing) opened any new trust boundary — the
new ALLOWED_HOSTS entries are exact-hostname whitelisted like every
existing one, and `/quote` already existed server-side since Sprint 12
(today's change was only a frontend caller, not a new reachable
surface). Updated THREAT-MODEL.md Boundary 7 to note `/quote` is now
actually exercised (was dead capability before) and that quote
responses are lower-risk than RSS text (type-checked JSON numbers,
never rendered as HTML) — a documentation-accuracy fix, not a new
mitigation, matching the doc's own "verify against real code, correct
divergences plainly" standard.

test.html: 275/275 (4 new — Goals.update in-place edit, field
preservation, immediate progress-% reflection, unknown-id returns
false without corrupting the list).

---

**Summary of this six-axis quality pass** (started from an external
rating: finance utility 84, assistant feel 82, pattern detection 79,
brain autonomy 58, trust/safety 90, live-data 70): treated "100/100" as
"close every real gap," not a literal target. Shipped, in order:
(1) live quotes — wired a dead relay endpoint to real UI; (2) widened
RSS coverage + fixed a real source-attribution bug affecting evidence
weighting since Sprint 2; (3) the sonar robustness batch — median/MAD,
borrowed baseline, question-headline guard, visible compute cap,
closing four previously-deferred red-team items; (4) brain v3.3 —
one genuine new cross-referencing capability, built within the
constitutional restraint the user explicitly confirmed (deeper
reasoning, zero execution, no relaxed nudge cap); (5) Goals editing,
the one real finance-utility gap, plus a threat-model accuracy sync.
Every item was verified live (real relay, real network calls where
applicable, real browser interaction) before being logged here, not
just test-suite-green. Declined to touch trust/safety further (already
near a sensible ceiling) or invent assistant-feel work without a real
gap — padding either would have contradicted the project's own
anti-feature-creep constitution to chase a number.

**2026-07-29 · Fix: negative-radius canvas crash, found by testing in real
Chrome** — User asked to actually run the project in a real browser
(not just the embedded test harness) — this caught a genuine bug that
275+ prior test.html assertions never exercised, because charts.js had
zero test coverage until today. Two uncaught `IndexSizeError` exceptions
fired live while scrolling the My Money view: `donut()` and `radar()`
both compute their circle radius as `Math.min(w,h)/2 - N` straight from
the canvas's live layout size, with no floor. `size()` clamps the
canvas itself to a 10x10 minimum whenever its container is mid-layout
(0 width during a view transition, before CSS settles) — but on a
10x10 canvas, `10/2 - 8 = -3`, and `ctx.arc()` throws on a negative
radius instead of clamping it. Both now floor R at 4px. A third spot
(the donut's mouse-hit-testing R) shared the same unclamped formula but
never reached `ctx.arc()` — fixed anyway for consistency between the
hover hit-test and what's actually drawn.
Added Charts to test.html's real coverage (it was loaded but had zero
assertions before this) — two regression tests construct a real canvas,
stub `getBoundingClientRect` to 0x0, and assert `donut()`/`radar()`
don't throw. Verified live in actual Chrome (not the embedded harness):
reproduced the original crash's exact trigger (rapid scroll through My
Money mid-view-transition) before the fix, confirmed zero console
errors after it, on the same real profile with real portfolio data.
test.html: 277/277 (2 new).
Why this matters beyond the fix itself: it's a concrete argument for
"run it for real" as a step separate from a green test suite — a fully
passing 275-assertion suite still shipped with a real uncaught crash
in charts.js because that module had never been exercised at all.

**2026-07-29 · market-today intent + real market tape (reported from
real use)** — User asked JARVIS "What is the reason behind today's
Nifty 50 going up 1%" and got "that term isn't in my economics
glossary yet." Three real defects behind one screenshot:

1. **Greedy glossary rx.** It was `/what is|define|explain|meaning of/`
   — matching ANY sentence opening with "what is". Now anchored on the
   SHAPE of a definition request: trigger + a short bare term at the end
   of the query (`what is FII`, `define capex`, `what does moat mean`).
   A clause-length tail no longer qualifies, so real questions fall
   through to the brain instead of being answered with a glossary miss.
2. **No intent could answer the question at all.** Added `market-today`:
   real index levels (Nifty/Sensex/Bank Nifty) + the day's highest-impact
   signals, hype-quarantined ones excluded. Placed after `scenario` (macro
   stress-tests keep priority) but BEFORE `sector-shock`, whose /down N%/
   pattern would otherwise read "why is Nifty down 1%" as a what-if. The
   two can't compete: market-today requires "why"/"the reason", which no
   hypothetical carries.
   **It explicitly refuses to claim causation** — "I can show you what
   moved and what was reported; I can't prove which caused which." That
   is the honest answer, not a hedge: no rule-based system (and no LLM
   either) can establish why an index moved, and inventing a because-
   clause is exactly the fabrication Art. 6 forbids. Correlation shown,
   causation declined.
3. **The ticker was fabricating market data.** It was a pure random walk
   — seeded values nudged by `Math.random()` every 3s — rendered
   identically to real quotes, and drift had carried the seeded Nifty
   ~2,200 points from the real index. New `js/market.js` pulls real
   quotes (^NSEI, ^BSESN, ^NSEBANK, INR=X, GC=F, BZ=F, BTC-USD, NQ=F)
   through the relay's existing Yahoo proxy; all 8 verified live. The
   badge now actually switches LIVE/SIM FEED (it was hardcoded "SIM
   FEED" and never updated in JS), live values are never touched by the
   random walk, and any cell without a real quote is dimmed with a
   "simulated" tooltip. Refresh is self-healing: it does NOT gate on
   `Live.relayAvailable()`, whose probe caches for the session and so
   would never notice a relay started after page load.
   Gold is labelled **$/oz**, not ₹/10g: the international spot price it
   maps to sits ~9-10% below the duty- and GST-inclusive Indian domestic
   price, so a rupee label would be false precision. Chose an honest
   label over a converted number.
   The brain cites `Market.indices()`, which returns LIVE values only —
   with the relay down `market-today` says so and quotes nothing, rather
   than reading the SIM tape out as fact.

Also loaded `js/jarvis.js` into test.html for the first time (it's a
bare object literal — only a guarded speechSynthesis hook runs at load),
giving the personality intent table real coverage; the glossary
regression is asserted directly against the shipping regex rather than
a copy that could drift.
Verified live in Chrome with the relay up: the exact reported query now
returns "NIFTY 50 24,230.1 ▲1.02% · SENSEX 77,587.31 ▲1.07% · BANK
NIFTY 57,158.8 ▲0.71% (live · as of 11:52 am)" plus the three
highest-impact signals and the no-causation line — and the tape badge
reads LIVE with all 8 instruments real. test.html: 290/290 (13 new,
incl. the reported query added to the golden corpus so this exact
regression is permanently guarded). Self-routing meta-test still green,
so the new intent didn't disturb table ordering.

**2026-07-29 · Staleness made visible; adaptive session-aware refresh** —
User: "I want real-time updating data, I do not want any stale data —
this is my personal assistant now." Two honest answers were needed.

**First, a measurement instead of an assumption.** I had been about to
repeat the folklore that Yahoo is "15 minutes delayed" for Indian
equities. Measured it instead, against the exchange's own
`regularMarketTime`: ^NSEI came back **11 seconds** old and RELIANCE.NS
essentially live. So the existing pipe is far fresher than assumed and
no broker API is needed for the tape to be current.

**Second, the deliverable.** No free feed is tick-live, so "no stale
data" cannot be promised — but staleness can be made impossible to miss,
which is the Art. 4 answer ("every number answers says-who, as-of-when"):
- The relay now passes through `quoteTime` (the EXCHANGE's print
  timestamp), not just our fetch time. These differ in the dangerous
  direction: a 2-second-old fetch can carry an hours-old print when an
  instrument is halted, illiquid, or its market is shut. Age is measured
  from the print, and falls back to fetch time only when upstream gives
  no timestamp — pessimistic, never claiming fresher than provable.
- `QUOTE_TTL_MS` 60s → 15s. With the tape refreshing every ~20s, a 60s
  cache would have served one print three times and called it live.
- Session clock (`Market.session()`), IST-anchored via a fixed +05:30
  offset so a laptop on the wrong timezone can't convince the app the
  market is open. Exchange HOLIDAYS are deliberately not modelled — no
  holiday list exists in this codebase — and that gap is covered by the
  staleness readout rather than hidden: an "OPEN" session whose prints
  are hours old is visibly wrong on screen.
- Refresh cadence follows the session: 20s open, 30s pre-open, 5min
  closed. Self-rescheduling rather than setInterval, so a page left open
  across the 15:30 close stops hammering upstream for a frozen number.

**A flaw of my own, caught only by running it live.** Judging freshness
across ALL instruments painted the badge amber every Indian morning,
because Brent, COMEX gold and Nasdaq futures keep their own sessions —
a 16-minute-old Brent print at 10am IST is normal, not a wedged feed.
Crying wolf daily would train the eye to ignore the one warning that
should matter. Freshness claims are now scoped to the Indian-hours
instruments (`Market.NSE_BOUND`).

That scoping immediately paid for itself: live, it surfaced that Yahoo's
**Sensex feed is genuinely ~15 minutes delayed while Nifty is 3 seconds
fresh** — a real, material difference that was completely invisible
before, since the old tape rendered both as equally "live" random-walk
numbers. The badge now names the lagging feed specifically.

test.html: 302/302 (12 new — age-from-print-not-fetch, the null-timestamp
fallback, unknown-instrument returns null rather than 0, the NSE scoping
regression, and the IST session clock built from UTC instants so it holds
on any machine timezone).

**2026-07-29 · Local model assist (ORD-1511 seam) — opt-in, route-only**
— User has qwen2.5-coder:14b running locally and asked whether to use
it. This is materially different from the hosted-API question I declined
earlier: nothing leaves the machine, so Art. 7 is untouched, and three
of my five original objections (data egress, key/rate-limit fragility,
network dependency) simply don't apply. The two that remain —
non-determinism and hallucination — are answered by architecture, not
by trust.

**The rule: the model may ROUTE and may ASK, never ANSWER.**
`route()` maps a query the deterministic matcher already MISSED onto an
existing intent id; the reply is then built by that intent's ordinary
cite-or-silent template, so every figure on screen still originates in
the engine. `critique()` returns QUESTIONS about a thesis the user
wrote — a weak question is merely weak, it cannot be a false number.
Containment is structural, not probabilistic: any token not an exact
member of the allowed id list is discarded, so there is no path by which
a hallucination becomes a displayed fact. Twelve assertions attack that
boundary directly with hostile output (invented ids, prose-wrapped ids,
a fabricated NIFTY level, empty responses) — all resolve to null.

**Benchmarked before building, not after.** ~2.7s warm, ~13s cold,
6/7 correct on hard paraphrases, and it correctly answered NONE to
"what's the weather in Mumbai" — abstention works. 2.7s is unusable on
the main path and fine on a fallback, which is exactly why it fires only
after a miss: the 100%-recall golden corpus still answers in 0ms and
never touches this module. All 313 assertions stay deterministic because
the rule-based path is untouched.

**CORS forced a design decision.** The browser cannot call Ollama
directly — its CORS rejects the app origin. The common workaround,
`OLLAMA_ORIGINS=*`, would expose the user's local model to EVERY website
they visit; declined. Added a narrow `POST /llm` passthrough on the relay
instead: exactly two upstream paths (`/api/generate`, `/api/tags`) so it
can't be walked into Ollama's model-management API, 127.0.0.1→127.0.0.1
only, reusing the exact-localhost CORS already trusted there. No write
token (unlike /store) — the worst a rogue local page achieves here is
spending GPU time, not corrupting the ledger. Verified: `/api/delete` is
rejected. One bug of my own caught in testing — Content-Length was being
set on the GET, so Ollama blocked awaiting a body that never came.

**Ships OFF.** Settings toggle, off by default, degrades silently when
Ollama or the relay is absent. Verified live end to end: "am I trading
like a maniac" (a genuine rule-based miss) routed to trade-frequency and
answered "Last 90 days: 0 trades (7 all-time on file)" — real ledger
numbers, with the UI stating plainly that the model only read the
question.

**PROPOSED CONSTITUTIONAL AMENDMENT — for the human to accept or reject
(Art. 12).** The "No AI / LLM APIs" section currently reads as an
absolute. I have NOT edited CONSTITUTION.md; a model may propose, only
Vedant amends. Proposed wording:
  *"No hosted LLM APIs. A model running entirely on this machine is
  permitted for ROUTING and QUESTION-ASKING only — never for composing
  an answer, producing a number, or touching the ledger. It ships
  disabled and every figure remains traceable to the rule-based engine."*
Until that is accepted, the feature exists but stays off, which is the
honest state: the code respects the constraint even though the setting
now allows crossing it.

test.html: 313/313 (12 new). Separately noted: the ORD-1704 scramble
null-model test is stochastically flaky (random shuffle each run; failed
once at real=84 vs scrambled=85, passed on re-run). Pre-existing and
unrelated to this change — recorded rather than "fixed" by loosening it,
since weakening an assertion to make it pass is the one thing that
convention forbids.

**2026-07-29 · Fix: local model never armed (exact-name probe); resolve
against what is actually installed** — The first cut of `local-llm.js`
hardcoded `MODEL: 'qwen2.5:14b'` and probed with an exact name match.
The machine has `qwen2.5-coder:14b`. So `probe()` returned false
permanently: no error, no log, no UI signal — the feature would simply
have done nothing forever after being switched on. I wrote that bug by
coding against the model I had *recommended* rather than the one that
was *installed*, and it survived because the test suite mocked the
probe instead of resolving a real model list.

Now `pickModel(installedNames)` resolves at probe time:
user override (if genuinely installed) → MODEL_PREFERENCE in order →
any `qwen2.5*` tag → null. Instruct is preferred over -coder because
routing and thesis critique are natural-language reasoning, not code
generation; 14B over 7B per the explicit "slower but better"
instruction. An unanticipated tag (`:32b-instruct-q8_0`) still works
rather than disabling the feature over a suffix, and an override naming
something not installed is ignored rather than obeyed into a dead end.
`installed[]` is retained so Settings can show what was actually seen —
a wrong state should be diagnosable by looking, not by guessing.

Verified live against real Ollama: armed=true, resolved
`qwen2.5-coder:14b`, saw both installed tags. Routing end-to-end:
"is all my money riding on one company" → single-stock-risk.
Latency: ~11s cold load, then **0.5–0.9s warm** (KEEP_ALIVE 30m) —
usable in chat. Containment held under a coder model: "what is the
weather in Mumbai" → null, "am i gambling too much" → null rather than
a confident wrong route. Accuracy is visibly blunter than the instruct
build would give, which is the empirical case for `qwen2.5:14b`.

test.html: 320/320 (7 new — including a direct regression for the
exact-name bug: a machine holding only the coder build must resolve it,
not disable itself).

**2026-07-29 · Anti-fraud: simulated data must announce itself** — Asked
to make sure JARVIS "is not a fraud". Audited for the precise failure
that word names: FABRICATED DATA WEARING THE COSTUME OF VERIFIED
INTELLIGENCE. Found it, and it was the default state of the app.

The demo corpus ships 32 invented headlines carrying real-sounding
attributions — "PIB Delhi", "Ministry of Finance", "RBI Bulletin",
"Exchange Filing" — with specific rupee figures. Each rendered with an
evidence-grade badge (A = "official/confirmed"), a NEW chip, and
CONFIRMED ×2. The ONLY thing distinguishing a real wire from an invented
one was that real items got a green LIVE chip and fabricated ones got
nothing. Absence of a badge is not a warning: nobody reads a missing
chip as "this was invented". A glance at the Intel Feed said HAL had
signed a $3.1bn export deal, graded A, confirmed by two sources. None of
it happened.

Fixed at every layer where the claim surfaces:
- Signal cards now carry an explicit amber SIMULATED chip, with a
  tooltip stating the headline was never published and the source name,
  figures and grade are all fabricated.
- The grade badge's own tooltip is qualified on simulated items — a
  badge reading "official/confirmed" over invented data is itself a
  false statement, so it now says the grade describes how the engine
  scored an invented item and is not evidence about the world.
- The Command Center greeting LEADS with corpus type ("SIMULATED corpus
  (no real wires fetched) — ...") instead of asserting "32 signals
  analysed across government, foreign and market wires", which describes
  reporting that never occurred. A mixed corpus reports the split.
- `Brain.corpusNote()` appends the same warning to every chat answer
  computed over signals. The momentum arithmetic is correct; the subject
  matter is invented, and quoting "momentum 100/100 across 14 sources"
  unqualified is the conversational form of the same lie. Silent when
  the corpus is fully live, so the notice means something when it shows.

Verified live: the HAL card renders CORPORATE / Exchange Filing /
SIMULATED / NEW / CONFIRMED ×2 — the warning sits beside the
authority markers rather than replacing them, which is the honest
presentation. Chat: "what's hot" → "Infrastructure — momentum 100/100,
15 signals across 14 sources ⚠ Computed over SIMULATED headlines —
invented demo data, not real reporting."

test.html: 324/324 (4 new — all-simulated flagged, mixed corpus reports
the split, fully-live stays silent, empty corpus is silent rather than
falsely reassuring).

**2026-07-29 · Anti-fraud part 2: stop animating fabricated prices** —
The tape's simulated fallback random-walked every instrument every 3s
(`(Math.random() - .485) * .1`). A guard already prevented nudging a
real quote, so the numbers were never *mixed* — but a fabricated NIFTY
level ticking up and down is read by every human as a live feed. Motion
is the strongest liveness cue a price display has, stronger than any
badge beside it, so the drift actively dressed invented numbers as a
working market connection while the badge said SIM FEED.

Simulated values now sit FROZEN at their seed and the change column
reads a truthful 0.00% rather than an invented delta. Added a per-cell
"SIM" tag next to the change figure: opacity is a style cue people stop
noticing within a day, a word is not, and reading the tape should not
require hovering to learn the number is invented.

Verified both paths live. Relay down: values identical across 7s (old
drift fired at 3s), every cell tagged SIM, badge SIM FEED. Relay up:
real prints, no SIM tag, undimmed, badge "LIVE · 2h" — and that 2h is
correct rather than a fault, which the tooltip proves by naming the
cause: IST 17:27, MARKET CLOSED (15:30 close), refresh backed off to
300s because a closed market's last print cannot move. No amber warning
fired, which is the intended behaviour: aging prints are only suspicious
while the market is open.

**2026-07-29 · Anti-fraud part 3: the stock-picking answer** — Caught
from a real screenshot of the app in use. Asked "which stocks to invest
in as per todays news?", JARVIS replied with Infrastructure 84% /
Semiconductors 70% / Defence 58% conviction and "Names to research: L&T,
KNR Constructions, NCC" — every bit of it computed over the invented
demo corpus. Its disclaimer read "these are research drafts, not orders.
Verify valuations before deploying capital."

That disclaimer guards the ADVICE while letting the EVIDENCE pass as
real. It tells you not to treat the recommendation as an order; it says
nothing about the fact that the ₹22,000 crore L&T order it rests on was
never placed. This is the single highest-stakes answer in the app —
the only one that names real, buyable tickers — so it was the worst
place for the corpus warning to be missing. `Brain.corpusNote()` now
fires there, ahead of the existing not-advice line.

Verified live on the exact question from the screenshot: the answer now
carries "⚠ Computed over SIMULATED headlines — invented demo data, not
real reporting" between the ticker names and the disclaimer.

Also worth recording: my own test for this initially aborted the whole
suite at 294 assertions because it referenced `App`, which test.html
deliberately does not load (app.js is the UI layer). Fixed by stubbing
the global. A harness that dies silently mid-run and shows an empty
summary is its own small hazard — worth remembering that "no failures
listed" is not the same as "all tests passed".

test.html: 326/326 (2 new — simulated corpus forces the warning beside
the tickers; a fully live corpus omits it).

**2026-07-29 · A live uplink retires the invented corpus** — Verifying
that the corpus warnings actually clear on FETCH LIVE exposed a deeper
flaw than the labelling fixed. `Engine.ingest` APPENDED live wires to the
demo set: 85 real items merged with 32 fabricated ones, leaving a
permanently "mixed" corpus. Labelling is necessary but not sufficient —
while a fabricated headline stays loaded it keeps voting in momentum
scores, cluster corroboration, the tracked-capital total and the ideas
engine's conviction percentages. A conviction figure part-driven by an
L&T order that was never placed is a WRONG NUMBER, and no disclaimer
repairs a wrong number. Real data now REPLACES the demo set
(`ingest(raw, {dropSimulated:true})`), guarded so an empty fetch leaves
the board alone rather than emptying it; the default additive path is
unchanged for every other caller.

Verified end-to-end against live wires: 78 signals, 78 live, 0 simulated,
0 SIMULATED chips, greeting prefix gone, `corpusNote()` silent. The
analysis genuinely moved — capital gravity from Railways & Logistics
(fabricated) to Pharma & Healthcare (real), stock picks from L&T/KNR/NCC
to HDFC Bank/ICICI/SBI — which is the point: the warnings vanish because
the fabricated inputs are gone, not because they were suppressed.

Process note, twice bitten now: a test failed and the SIMULATED chips
appeared missing in a user screenshot, both from BROWSER JS CACHING while
disk and HTTP served the new code. Verified by comparing
`Engine.ingest.toString()` in the page against the file. When a live
check disagrees with the source, suspect the cache before the code.

test.html: 329/329 (3 new — real wires replace the demo set, an empty
fetch never wipes the board, and the flagless default stays additive).

**2026-07-29 · Real data loads automatically; "no latency" corrected
honestly** — Asked to delete all fake data and replace it with
real-time, no-latency data. Two things needed saying plainly rather
than silently attempted: no free feed is latency-free (measured earlier
at ~3-15s behind the exchange, and that stands), and deleting the seed
corpus outright would leave the app blank on first boot before a
connection exists — worse than a clearly labelled demo state. What
"replace the fake data" honestly resolves to: real data should be what
appears BY DEFAULT whenever a connection exists, not something the user
has to know to request.

The gap: `Market.refresh()` (prices) already auto-loops on its own
session-clock cadence — that was done in an earlier pass. News did not;
FETCH LIVE was manual-only, so a working connection still showed 32
fabricated headlines until clicked. Boot now fires `fetchLive()`
unattended right after first paint — reusing its existing try/catch and
honest SIM fallback verbatim, so an unattended call degrades exactly as
safely as a user's own click. `dropSimulated` (added last pass) retires
the fabricated corpus the moment real wires land.

Verified live, cold boot, zero clicks: 85 signals, 85 live, 0 simulated,
`mode: 'live'`, capital gravity already showing Pharma & Healthcare
(real) rather than Railways & Logistics (fabricated) — on page load
alone. Killing the relay mid-session showed news degrading to the
public-CORS-proxy fallback and staying genuinely live (not simulated) —
that fallback path was pre-existing, not new. A ticker degradation
recheck was attempted but invalidated when the relay respawned on its
own within the test window (uptimeSec reset to 52 — something in the
environment restarts it, not this code); the SIM-fallback/freeze/tag
behaviour for prices was already proven live earlier this session and
is unchanged here, so it is not re-claimed as freshly tested.

Also added: the LIVE badge's tooltip now states the measured latency
floor directly ("No free feed is latency-free — this one measured
~3-15s behind the exchange print"), rather than let the word "LIVE"
imply zero-latency by omission.

Noted, not authored by me: `js/market.js` gained a Live Stocks Monitor
(INDIAN_STOCKS/US_STOCKS with per-item fallbackPrice) and `relay.js`/
`css/main.css` picked up supporting changes — flagged by the harness as
already-intentional. Checked its honesty properties before building on
top: each card computes `live: !!q && typeof q.price === 'number'` and
renders an explicit LIVE/SIM chip per item, following the same
convention this file's anti-fraud passes established. No fix needed
there; verified the pattern rather than assumed it.

test.html: 329/329 (unchanged — this pass is behavioural/boot-sequence,
not new pure-logic surface).

**2026-07-29 · Fabricated signals removed from the default boot; real
publication dates shown** — The human's explicit call, stated twice and
with the trade-off understood: an honest blank screen beats invented
headlines, even labelled ones. Previous passes made fabrication
*visible*; this one makes it *absent by default*.

`App.init()` booted `Engine.run(JDATA.FEED)` unconditionally — 32
fabricated headlines were the first thing every session showed. It now
boots `Engine.run(demoRequested() ? JDATA.FEED : [])`. The demo corpus
still exists but is opt-in via `?demo=true` (kept deliberately: it lets
the engine be demonstrated offline and screenshotted without a network,
which has real value — it just must never be the default). The check is
synchronous and read before any await, so there is no window in which
invented headlines reach someone who did not ask for them.

Empty is now a legitimate expected state rather than a failure, so it
gets honest copy instead of "0 signals analysed": the Intel Feed says
"No real wires loaded yet — this screen stays empty rather than showing
invented headlines", with a FETCH LIVE button. Distinguished from the
pre-existing "no signals match / clear filters" state, which is a lie
when the corpus itself is empty — it implies data exists behind a
filter.

Publication dates (requested): `Live.mkItem` was DISCARDING the wire's
own timestamp, keeping only `h` (hours-ago). Relative age is computed
against page load and silently rots as a tab stays open; a publication
date is a fact about the article that never changes — Art. 4 wants
"as of when" answerable from the source, not from how long the reader
has been sitting there. `pub` (epoch ms) is now carried through
mkItem → analyzeItem → the card, rendering as "18h ago · 31 Jul" with a
full "Published Friday, 31 July 2026 at 7:35 pm" tooltip. Items whose
feed publishes no timestamp say so rather than having one invented.

Verified live: 85 real signals on cold boot, 77 of 85 carrying genuine
publication dates (the 8 without are feeds that omit pubDate — honestly
labelled, not backfilled). Forced-empty render confirmed to produce the
new honest copy and a working fetch button.

test.html: 329/329.
