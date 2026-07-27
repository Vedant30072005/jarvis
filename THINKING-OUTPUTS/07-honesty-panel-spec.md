# Honesty Panel — Full Spec (Session #7)

Grounded in what Sprint 5 already computes (`impact`/`impactRaw`, `hype`/`hypeScore`,
`confirmed`/`groupSize`, `JDATA.ENGINE_VERSION`, `flowBySector`/`flowBySource` netting,
`totalTracked()`) and what later sprints need to consume (Sprint 9's calibration
gate, Sprint 12's hit-rate tables, Sprint 16's maintenance budget). Every metric
below is buildable today from data that already exists — nothing here waits on
a future sprint except the two explicitly marked "stub now."

## Design principle

The honesty panel's job is singular: **answer "can I trust what I'm looking at
right now?" without making the user read a single word.** Every metric gets a
health band (green/amber/red) and a one-line "why this matters" — no metric
ships without both.

---

## Layout — 5 sections, top to bottom, most-actionable first

### Section A — Signal Health

| Metric | Formula | Green | Amber | Red | Why it matters |
|---|---|---|---|---|---|
| **Raw signal count** | `Engine.items.length` | — (context only) | | | Baseline for every other ratio below |
| **Effective source count** | `exp(-Σ pᵢ·ln(pᵢ))` where `pᵢ = countᵢ/total` per source | ≥ 8 | 4–7 | < 4 | "64 signals" is theater if 80% trace to 2 wires re-syndicated — this is the corpus's real width |
| **Parser health per source** | rolling 7-day avg items/fetch per source; flag if today = 0 and 7-day avg > 3 | all sources ≥ 50% of avg | any source 10–50% | any source at 0 | A silently broken RSS parser reads as "quiet day," not "broken" |

### Section B — Classification Health

| Metric | Formula | Green | Amber | Red | Why it matters |
|---|---|---|---|---|---|
| **Unclassified residue %** | `items.filter(i => !i.sectors.length && !i.entities.length).length / total` | < 15% | 15–30% | > 30% | Rising residue is dictionary rot — the engine silently going blind to new vocabulary |
| **Amount-parse coverage** | of items whose raw text matches `/₹|\$|crore|billion|lakh/i`, % where `amountCr > 0` | > 85% | 70–85% | < 70% | Catches a silent regression in `parseAmount`'s regexes (e.g. a new format media adopts) |
| **Entity ambiguity rate** *(stub until Sprint 5.5's `ambiguousWith` list ships)* | % of company matches flagged ambiguous | — | — | — | Reliance Industries vs Reliance Power vs Reliance Capital mis-tag sectors |

### Section C — Truth Layer (Sprint 5's own math, exposed)

| Metric | Formula | Green | Amber | Red | Why it matters |
|---|---|---|---|---|---|
| **Corroboration rate** | `groups.filter(g => g.confirmed).length / groups.length` | > 25% | 10–25% | < 10% | Also the exact number the conviction v1/v2 kill criterion (DECISIONS.md, Sprint 5) reads from |
| **Hype rate** | `items.filter(i => i.hype).length / total` | < 10% | 10–20% | > 20% | A spike is either a slow news day (hedge language everywhere) or an active astroturf wave — either way, worth a glance |
| **Dedup compression ratio** | `1 - (groups.length / items.length)` | context only | | | "64 signals, 41 groups" tells you how much is re-reporting vs new information |

### Section D — Engine Self-Check

| Metric | Formula | Green | Amber | Red | Why it matters |
|---|---|---|---|---|---|
| **Live noise floor** | shuffle today's corpus (same algorithm as `test.html`'s ORD-1704a), run `Engine.run()`, record `clusters.length` and top conviction; compare to real run | real conviction ≥ 1.3× noise conviction | 1.0–1.3× | real ≤ noise | "Engine found 6 clusters today; finds 2 in shuffled noise" — the most epistemically honest sentence a signal engine can utter |
| **Engine version + last change** | `JDATA.ENGINE_VERSION`, diffed against the version tag on the oldest item still in the 30-day rolling comparison window | same version throughout window | version changed mid-window | | Prevents comparing conviction scores computed by different formulas as if they were the same measurement |
| **Calibration status** *(stub — real data starts arriving Sprint 9)* | days of rollup history with `termCounts` present | ≥ 21 days | 7–20 days | < 7 days | Sonar thresholds fit to < 3 weeks of baseline are noise dressed as signal — this stat is what makes the sonar's own "calibrating" state honest |

### Section E — System Health

| Metric | Formula | Green | Amber | Red | Why it matters |
|---|---|---|---|---|---|
| **localStorage quota** | `JSON.stringify({...localStorage}).length / (5 * 1024 * 1024)` | < 60% | 60–85% | > 85% | The one error class that can silently eat a ledger write (`QuotaExceededError`) |
| **IndexedDB archive health** | last successful `upsertSignals` write vs now | < 1h old | 1–24h old | > 24h old or never succeeded | Archive is "best-effort, degrades silently" by design (Sprint 4) — this is the only place that silence becomes visible |

---

## Interaction rules

- Every red metric gets a one-click "why" popover showing the formula and the
  actual numbers that produced the verdict — no black-box scoring, matching
  the project's "every pixel auditable" thesis.
- The panel never sends a notification/alert on its own — it's pulled, not
  pushed, checked when the user chooses to look. (Consistent with the
  anti-engagement doctrine from the thinking rounds — a panel that pings you
  to check on honesty is the exact wrong instinct.)
- On a genuinely quiet news day, Section A/C metrics may all read amber/red
  simply because there's little corpus to compute ratios from — the panel
  should say "insufficient volume today (N<20 items) — ratios unreliable"
  rather than false-alarm.

## What this unlocks downstream

- Sprint 9's sonar reads **Calibration status** directly instead of building
  its own day-counter.
- The Sprint 5 conviction v1/v2 kill criterion reads **Corroboration rate**
  and **Hype rate** directly — this panel IS the instrument that decides
  which formula wins.
- Sprint 16's maintenance budget audit starts from **System Health** — a red
  quota meter or dead archive is the first thing worth fixing in that sprint.
