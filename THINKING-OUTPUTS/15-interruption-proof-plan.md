# Interruption-Proof Sprint Plan — Session #15

Every remaining sprint split into a 90-minute **core slice** (ships
standalone, unblocks next sprint) + **optional extensions** (nice-to-have,
skippable if life interrupts). This is the single thing that determines
whether this project survives a placement season, exam crunch, or sudden
unavailability — the ability to ship *something* every sprint regardless
of whether you had a full week or a lunch break.

Grounded in the principle: **done beats perfect**. A core slice shipped is
a checkpoint; an unfinished sprint dumped because you ran out of time is a
reset.

---

## Sprint 5.5 — Structural (schema + guards)

**Core slice (90 min):**
- Schema versioning: add `v` field to every localStorage blob + a simple
  replay-one-migration function. (Not fancy — just enough to migrate if a
  schema ever changes; doesn't need to handle N levels of backwards
  compat.)
- BroadcastChannel single-writer guard: rough sketch in app.js so two
  tabs can't both write to the same day's rollup. (Doesn't need to be
  perfect; just needs to prevent obvious double-writes.)
- Commit to DECISIONS.md.

**Optional extensions:**
- Full app.js view-module split (the parallelism unlock for money-track
  vs engine-track). Deferrable because it's structural cleanup, not a
  blocker on any feature.
- Comprehensive migration registry (handle N-level chains). Deferrable
  until a real schema breaking change happens.

---

## Sprint 6 — Honesty Panel

**Core slice (90 min):**
- Render the five core metrics from Session #7's panel spec (effective
  source count, parser health, corroboration rate, hype rate, engine
  version) in a simple table with green/amber/red banding.
- Wire up the quota meter (localStorage %).
- Ship it as a read-only panel; no drill-downs, no explanatory popovers.

**Optional extensions:**
- Interactive drill-down popovers on each metric ("why is this red?").
- The live noise-floor scramble test.
- The calibration-status 21-day countdown.

---

## Sprint 6 Continued — Alert Spine + Threat Board

**Core slice (90 min):**
- Unified alert contract on the bus: `alert:raised {severity, source,
  dedupeKey, expiresAt}`.
- Threat board as a static list of bearish clusters (no interactive
  state, no filters — just render Engine.ideas filtered kind=='caution').
- Emit 3 hard-coded example threats for demo purposes.

**Optional extensions:**
- Alert-outcome tracking (fired/seen/acted).
- Alert-type demotion rules.
- Interactive threat board (dismiss, expand, collapse).

---

## Sprint 6 Continued — Cross-Currents + Mirror Skeletons

**Core slice (90 min):**
- Cross-currents panel: render one sector as the split-fill contested bar
  from Session #12, no interaction, just the visual.
- Skeleton prediction book form (just "new prediction" button → "title,
  probability, resolution date" modal — data goes to localStorage, no
  listing/editing UI yet).
- Skeleton journal form (same: "new entry" → modal → save to localStorage).

**Optional extensions:**
- Full cross-currents panel for all sectors.
- Prediction list view + history.
- Journal list view + full-text search.

---

## Sprint 7 — Ledger + XIRR

**Core slice (90 min):**
- Parse a Zerodha CSV export via a file-upload input.
- Store the raw events in an append-only array in localStorage.
- Compute XIRR on the event array (using bisection fallback per Session
  #4; no fancy convergence checks).
- Display: one summary line (holdings total, portfolio XIRR, unrealized
  P&L).

**Optional extensions:**
- Relay-to-disk persistence (the file-write side of the relay).
- Relay write-token auth (Session #8, Boundary 2b).
- Ledger UI (drill-down view, edit corrections, void entries).
- Net-worth history chart.

---

## Sprint 8 — Goals + Tax

**Core slice (90 min):**
- Goals form: "name, current value, target value, target date" → stored
  in localStorage, displayed as a simple list.
- Tax module: a data table of current rates (AY 2026-27) + a flat
  compute-tax-on-gain function. No fancy rebalancing or scenario
  analysis.

**Optional extensions:**
- Goal progress tracking over time (weekly snapshots).
- Tax wizard (guided entry).
- Tax-by-scenario (what-if different exit timing).
- Rebalancing module (not scoped here; bump to a later sprint if it's
  essential).

---

## Sprint 9 — Sonar + Pump-Dump Guard

**Core slice (90 min):**
- Sonar baseline: compute mean/stddev over termCounts history (ignore
  MAD upgrade for now).
- Alert rule: today's termCounts > baseline+2σ → spike flag.
- Pump-dump guard: attack #1 + #2 only from Session #1 (source-tier
  diversity check + velocity threshold). Hard-code the threshold.
- Render: one "anomalies this session" panel, not integrating into alert
  spine yet.

**Optional extensions:**
- Median/MAD instead of mean/stddev.
- Full 7-attack guard suite (attacks 1, 2, 5, 9, 13 from Session #1).
- Calendar suppression (known-event days don't trigger alerts).
- Calibration gate ("15/21 days" countdown).
- Integration into the unified alert contract from Sprint 6.

---

## Sprint 10 — Brain

**Core slice (90 min):**
- Pattern matcher: map 5 of the most common intents from Session #9's
  80/20 set (e.g., "what's hot", "what am I worried about", "how am I
  doing vs index").
- Hardcoded responses: "showing Defence cluster, conviction 78" → link to
  panel.
- No NLP, no fanciness. Just `if (query.includes('hot'))` style matching.

**Optional extensions:**
- Full 18-intent core set.
- Intent learning (user corrects mismatches → refines patterns).
- Morning briefing ritual (composed linear flow).

---

## Sprint 11 — Mirror Full Build (Prediction Book + Journal)

**Core slice (90 min):**
- Prediction book: list view (show open predictions + resolution UI when
  due).
- Journal: list view + new-entry form.
- Brier score (if N >= 15 resolved predictions; otherwise "too few yet").
- No calibration curve, no advanced stats.

**Optional extensions:**
- Full calibration curve + trend analysis.
- Thesis kanban (board view of active theses).
- Advanced prediction analytics.
- Journal full-text search.

---

## Sprint 12 — Quotes + Counterfactual

**Core slice (90 min):**
- Bulk EOD fetch: NSE bhavcopy once at market close, parse, store in
  localStorage.
- Portfolio current value (using latest EOD prices).
- Three-lane horse race: real trades vs index vs paper ideas (simple
  numbers only, no fancy charting).

**Optional extensions:**
- Regime variable (NIFTY vs 50-day + VIX).
- Narrative age (first-seen date on clusters).
- Hit-rate tables (requires Sprint 5's grading math; deferrable if
  infrastructure isn't ready).
- Advanced charting (Recharts, sparklines).

---

## Sprint 13 — Demo Assets

**Core slice (90 min):**
- Staged demo dataset (frozen JSON: fake portfolio, fake ledger,
  representative news). Load via a URL param (?demo=true).
- Privacy-blur toggle (hides amounts on-screen, shows percentages only).
- No new features, no UX changes — just infrastructure.

**Optional extensions:**
- Capital flight map (visually, it's a nice demo; build if time allows).
- Themes (light/dark toggle).

---

## Sprint 14 — Causal Graph + Threads

**Core slice (90 min):**
- Causal edges data structure loaded (from Session #3's 43-edge list as a
  static JSON object in data.js).
- Echo-vs-novelty: a new field on items: `novel = shingles not seen
  yesterday` (rough, not perfect).
- Evidence grades A/B/C/D: display the badge (from Session #12's UX
  language) next to every item, wired to confirmation status.

**Optional extensions:**
- Scenario stress cards (propagate shocks through the causal graph).
- Full threads/value-chain analysis.
- Time-decay half-lives per signal type.

---

## Sprint 15 — Guardrails + Sunday Review

**Core slice (90 min):**
- Sunday review screens 0–6 (opening, numbers, rule-check, predictions
  due, blind spots, alerts, calibration). Blocking screens (predictions
  due, commitment) only.
- Reconciliation ("did you follow your own rules") via Session #15's
  Screen 2, pulling from the ledger's thesis-logging.
- Export the auto-memo markdown.

**Optional extensions:**
- Behavioral insights (alert-outcome tracking, attention-distribution
  drift).
- Advanced reconciliation analytics.
- Iterable commitment tracking (next-Sunday callback).

---

## Sprint 16 — Hardening

**Core slice (90 min):**
- Restore drill: export a full backup, then clear localStorage, then
  re-import it, confirm everything came back.
- Threat-model doc (Session #8 content).
- A11y audit (just keyboard nav for the main six views; no full WCAG).

**Optional extensions:**
- Full WCAG a11y compliance.
- Perf budgets (Lighthouse).
- Dictionary teach-flow.

---

## Sprint 17 — Presentation

**Core slice (90 min):**
- Provenance drill-down UI: click a number → show its formula one line
  → show inputs → show raw data.
- Tour mode: hardcoded script that clicks through key features (replay
  the demo from Sprint 13).
- Docs: a one-page "how to use this" guide in markdown.

**Optional extensions:**
- Full replay mode (pick a past date, dashboard shows that day).
- Interactive tour (not scripted; user-paced).
- Video/recording of the demo.

---

## The Core-Slice Guarantee

Each 90-minute slice is **not a demo** — it's shippable, incomplete-but-useful
production code. A prediction book list view without the calibration curve
is still useful. A single hostile-scenario test in the sonar is still
valuable. An Export-then-reimport restore drill is still proof of
durability.

**If exams land after Sprint 10:**
- Sprints 1–10 are done (that's 80% of the heavy-lift engine work)
- Sprints 11–17 are deferrable — the tool works, the user can keep
  trading with a functional intel engine, honesty panel, and basic
  ledger, even without the mirror features (predictions/journal) or the
  hardening/presentation layers.

**If placement season hits mid-Sprint 8:**
- Sprints 1–7 core slices are done (all of the input layer + basic UI is
  shipped)
- Sprint 8's extended features (rebalancing, tax scenario, etc.) are cut,
  which is fine — the core (goals form + basic tax module) is enough.

**The math**: 17 sprints × 90 minutes = 25.5 hours of guaranteed
committable work. If life only allows one sprint per month due to
interruptions, the project still moves, and every sprint has a real
checkpoint.

---

## Usage notes

- **Don't interpret "core slice" as lower quality.** The core is held to
  the same testing standard (test.html, real data verification) as any
  other ship. It's just smaller in scope, not more reckless.
- **Extensions are genuinely deferrable.** If a sprint finishes its core
  and you have 2 hours left, pick ONE extension, not all of them. In
  another session with fresh time, you can pick a different extension.
- **Before starting a sprint, decide which extensions will be deferrable
  in the next one.** This prevents surprise over-commitment.
- **If an extension becomes critical later** (e.g., "we need the full
  calibration curve now"), it can be pulled into the next sprint's core,
  and that's fine — the plan is a guide, not a straitjacket.

---

## Checkpoint: Are you shipping here?

Before you assume "I can finish the rest this weekend," sanity-check:
- **Core slice:** Did you run test.html? Did you export-and-reimport the
  data? Did you test on actual data from another session, not fresh mock
  data?
- **Optional extensions:** If you didn't build them, did you explicitly
  document what you skipped and why? This becomes the note for the next
  session that touches that sprint.

If you hit these checks, the core is shipped and the plan survived your
interruption.
