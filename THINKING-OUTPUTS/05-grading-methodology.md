# Grading Methodology — Session #5

How to grade the engine's own conviction/impact scores against real
subsequent price action, without fooling ourselves. This is the single
easiest place in the whole project to lie with statistics — a hit-rate
number is trivial to compute and dangerously easy to overstate. Every rule
below exists to prevent one specific way that could happen.

Grounded in what's actually built: `Engine.clusters` (sector-level,
conviction score), `Engine.ideas` (kind: long/caution, attached to one
sector), `Engine.items` (individual signals, `impact`, `senti`, `h`),
`JDATA.ENGINE_VERSION` stamped into every archived signal and rollup
(Sprint 5), and the bulk EOD price backfill planned for Sprint 12.

---

## 0. The bootstrapping problem, stated honestly

**Grading cannot start until Sprint 12 ships**, because it needs historical
EOD prices, and quotes/bulk-EOD backfill don't exist before then. But the
DATA needed to grade — which idea existed, what sector, what conviction,
what date it first appeared — must be collected starting **now**, in
Sprint 6, via the archive and daily rollups that already exist. This
methodology defines the collection schema now so grading isn't blocked
later on missing history. Do not wait for Sprint 12 to start recording.

---

## 1. What gets graded — the "idea instance," not the daily score

**The trap**: `Engine.ideas` and `Engine.clusters` recompute on every
ingest. The same defence-cluster narrative might get a fresh conviction
score every single day for two weeks as new headlines arrive. If each of
those 14 daily snapshots is treated as a separate graded prediction, the
sample size is inflated 14x by re-observing the *same* underlying claim —
and because the 14 snapshots are correlated (same narrative, same market
regime, same week), they don't add 14 independent data points. They add
roughly one.

**The rule**: grade **idea instances**, anchored at first-crossing —
the first day a cluster/idea appeared with conviction ≥ some actionable
threshold (start with ≥ 60, matching the rough "worth a look" cutoff
already implicit in the UI). Once an idea instance is created:
- its score, sector, kind (long/caution), conviction, engineVersion, and
  first-crossing date are frozen — never overwritten by later re-scoring
- if the same narrative persists and re-crosses threshold after having
  dropped below it and returned (a genuinely new resurgence, not
  continuous presence), it becomes a *new* instance, dated at its new
  first-crossing
- continuous day-over-day presence above threshold does **not** spawn new
  instances — one narrative, one instance, one grade

This is the single most important rule in this document. Every other
statistical safeguard below is secondary to getting the unit of analysis
right.

---

## 2. What "correct" means — regime-adjusted, direction-only

**The trap**: "defence conviction 82 → defence sector +6% in 20 days"
sounds like a hit. But if the whole market rallied 5% in that window, the
engine gets credit for beta it didn't call. Conversely, a real bearish
call getting "wrong" during a broad rally it correctly diagnosed at the
sector level but couldn't out-run at the index level shouldn't be scored
as a clean miss either.

**The rule**: compute two numbers for every graded instance, always shown
side by side, never one without the other:

- **Raw return**: equal-weight basket of `JDATA.COMPANIES` tagged to that
  sector, EOD-close to EOD-close, over the horizon window
- **Regime-adjusted return**: raw return − Nifty 50 return over the
  identical window (same start/end trading days)

**"Correct" for a long idea** = regime-adjusted return > 0 (sector beat
the market, which is what "ride this sector" actually claims — not "the
market went up," which the idea didn't call).

**"Correct" for a caution idea** = regime-adjusted return < 0 (sector
underperformed, validating the defensive call). Symmetric direction-only
scoring — no partial credit for "avoided a crash," no bonus weighting for
magnitude. Asymmetric behavioral framing (a correct caution call feels
more valuable than an incorrect one costs) belongs in the journal/mirror
features (Sprint 11, 15), not in this grading math. Keep the statistic
clean; let the narrative UI carry the nuance.

**Benchmark choice is fixed, not tunable per-report**: Nifty 50, always.
Changing the benchmark per analysis to whichever one makes the engine
look best is exactly the kind of self-serving statistics this document
exists to prevent.

---

## 3. Horizons — leading indicators now, real horizons eventually

**The trap**: idea horizons are literally labeled `'6–18 MO'` /
`'1–3 YRS'` / `'2–4 YRS'` in the engine today. Waiting 2-4 years for a
single grade is not a usable feedback loop for a project under active
development.

**The rule**: grade at **three fixed leading-indicator windows** — 5, 20,
and 60 trading days from first-crossing — explicitly labeled as *early
signal of whether the market is starting to price this in*, not as
validation of the full multi-year thesis. Separately and much more slowly,
also grade at the idea's own stated horizon once enough time has actually
passed; report this as its own low-N, clearly-dated statistic, never
blended with the 5/20/60-day numbers. An idea with only 3 instances at its
full 2-year horizon should say "N=3, too small to mean anything yet," not
be silently omitted or silently combined with the faster stats.

---

## 4. Sample size — the confidence interval is the headline, not the hit rate

**The trap**: "62% hit rate" with N=8 is indistinguishable from a coin
flip and will be read by a tired brain as "the engine works." This is
the exact same failure mode Session #7's honesty panel exists to prevent
elsewhere in the tool — applied here to the engine's own self-grading.

**The rule**:
- Below **N=20** independent idea instances for a given slice: show the
  raw count only ("7 long ideas graded so far, too few to compute a
  hit-rate"), never a percentage.
- At N≥20: report the **Wilson score interval** (more reliable than the
  normal approximation at small-to-moderate N) at 95% confidence, not
  just the point estimate. "Hit rate: 58% [38%–76%]" is honest; "58%
  hit rate" alone is not.
- The claim "the engine has edge" requires the **lower bound** of that
  interval to sit above the **true null**, which is *not* 50% — see next
  point.

---

## 5. The null hypothesis is not a coin flip

**The trap**: Indian equities have a long-run positive drift. "Sector went
up" is not a 50/50 event on its own — most sectors are up more often than
down over almost any multi-year sample, simply because markets trend
upward over time. Comparing hit rate against literal 50% overstates the
engine's edge for long ideas and understates it for caution ideas.

**The rule**: the null baseline is **the same sector's own regime-adjusted
return, sampled from random unconditioned dates** (i.e., "if I'd picked
this sector on an arbitrary day instead of the day the engine flagged it,
how often would it have beaten Nifty over the same horizon anyway?").
Because regime-adjustment already nets out the market-wide drift (step 2),
this random-date baseline should sit close to 50% *in practice* — but
compute it explicitly per sector rather than assuming it, since some
sectors are structurally noisier or more market-correlated than others
(banks vs gold, for instance). This is the honest null, and the engine's
hit rate must clear *this* number's confidence interval, not an assumed
50%.

---

## 6. Multiple comparisons — pre-register one primary metric

**The trap**: slicing by 12 sectors × 3 horizons × {long, caution} ×
{v1, v2 conviction} produces dozens of combinations. Some slice will show
an eye-catching hit rate by chance alone, and it's tempting to headline
whichever one looks best.

**The rule**: one metric is pre-registered as **primary** before any
grading happens, and it's the only one allowed to appear in a "does the
engine work" headline: **long ideas, pooled across all sectors, 20-trading-day
regime-adjusted horizon.** Every other slice (per-sector breakdowns,
5-day vs 60-day, caution ideas, v1-vs-v2) is explicitly labeled
**exploratory** in the UI — interesting, worth showing, never allowed to
be the number that gets touted as proof the tool works. This single
pre-registration rule is what stops the honest self-grading system from
degrading into after-the-fact cherry-picking of whichever slice flatters
the engine that week.

---

## 7. Segmentation by engine version is mandatory, not optional

Scores computed by different scoring math are not the same measurement.
Every graded instance carries the `engineVersion` it was scored under
(already stamped per Sprint 5). Hit-rate tables **always** segment by
version — never pool a v5-scored idea with a v7-scored idea in the same
statistic, even after the underlying formula changes turn out to be minor.
If a version has fewer than 20 instances, it shows its raw count, per
rule 4, rather than being silently merged into a bigger, misleading pool.

This is also the exact mechanism the Sprint 5 conviction v1/v2 kill
criterion depends on: v2 only "wins" if ITS instances (not a blend with
v1's) clear the bar.

---

## 8. Survivorship — freeze the universe at scoring time

**The trap**: `JDATA.COMPANIES` grows over sprints (Sprint 5 shipped ~64
names; later sprints may add more, per ORD-303's living mandate). If a
2026 idea about the "semis" sector is graded in 2028 using the 2028
company list — which might include five more semiconductor names added
since — the basket wasn't the one the engine was actually pointing at
when it made the call.

**The rule**: every graded idea instance freezes **the exact sector
basket (list of symbols) as it existed at first-crossing**, stored
alongside the instance, not recomputed from today's `JDATA.COMPANIES` at
grading time. If a company in that frozen basket gets delisted mid-window,
its return uses last-available price before delisting (never silently
dropped from the basket average — a bankruptcy silently excluded from a
sector average is the textbook survivorship-bias mistake).

---

## 9. Pending vs failed vs graded — never conflate

**The trap**: an idea instance whose horizon hasn't elapsed yet is neither
a hit nor a miss. Silently excluding it from the denominator is fine
statistically but easy to get wrong in code (e.g., counting only
`graded.filter(pass)` without also tracking `stillPending` separately
leads to a denominator that quietly shrinks over time in a way nobody
notices).

**The rule**: every idea instance is in exactly one of three states —
`pending` (horizon not yet reached), `graded-pass`, `graded-fail`. The UI
always shows all three counts. "Hit rate" is only computed over
`graded-pass + graded-fail`, and the pending count is always visible next
to it so nobody mistakes "12 graded, 8 pending" for "20 graded."

---

## 10. Prediction book (Sprint 11) — simpler, different math, same honesty rules

The auto-generated idea grading above is the hard case because the
"prediction" (a cluster's conviction) and its target (a sector basket) are
both fuzzy and implicit. The user-authored prediction book is easier: the
user states an explicit forecast with a probability and a pre-committed
resolution date/criterion (already required at entry per the amended
Sprint 11 scope — no save without both fields). Once resolved:

- **Brier score** = mean of `(forecast_probability − outcome)²` across all
  resolved predictions, outcome ∈ {0, 1}. Lower is better; 0.25 is the
  score of someone who always says "50/50" — that's the baseline to beat,
  not zero.
- Same small-N caution applies: don't display a Brier score with fewer
  than ~15 resolved predictions; show the raw resolved count instead.
- Same segmentation instinct applies loosely here too: if the user's
  predictions cluster heavily in one sector or one kind of call, say so
  ("your predictions are 80% about defence — this Brier score reflects
  skill in one narrow area, not general calibration") rather than
  presenting one undifferentiated number.
- A **calibration curve** (bucket predictions by stated probability decile,
  plot actual hit rate per bucket) is the more informative visual than
  Brier score alone — it shows *where* miscalibration happens (e.g.,
  "things you call 90% likely only happen 60% of the time" — classic
  overconfidence) rather than just *that* it happens.

---

## Honesty rules — the checklist every grading display must pass

1. Never show a hit-rate percentage with N < 20 independent instances —
   show the raw count instead.
2. Always show the confidence interval, never the point estimate alone.
3. The null is the sector's own regime-adjusted random-date baseline, not
   50%, and not literal zero.
4. Exactly one metric (long ideas, pooled, 20-day, regime-adjusted) is
   ever allowed to headline "does this work" — everything else is
   labeled exploratory, permanently.
5. Never pool across engine versions.
6. Never recompute a historical sector basket using today's expanded
   company universe — freeze it at first-crossing.
7. Always show raw return AND regime-adjusted return together — never
   regime-adjusted alone (it can hide "the engine just called a rally,"
   which the raw number would reveal) and never raw alone (it hides beta).
8. Pending instances are always visible and never silently folded into
   either the pass or fail bucket.
9. One idea instance = one first-crossing event. Continuous re-scoring of
   the same live narrative never spawns additional instances.
10. Prediction-book Brier scores need their own N≥15 gate and should
    always be accompanied by the calibration curve, not shown alone.

---

## What this unblocks

- **Sprint 6**: the archive/rollup schema for idea instances (sector,
  conviction, kind, engineVersion, frozen basket, first-crossing date)
  needs to start recording now, even though nothing can grade it until
  Sprint 12's price backfill lands. This is a data-collection dependency,
  not a feature dependency — miss the window and there's no
  retroactively-collected data to backfill.
- **Sprint 12**: implements the actual grading computation (regime-adjusted
  returns via bulk EOD, Wilson intervals, the pre-registered primary metric)
  directly from this spec, and the hit-rate tables that inform the
  self-tuning weight-proposal mechanism from the earlier thinking rounds.
- **Sprint 11**: implements Brier scoring and the calibration curve for
  the user-authored prediction book using section 10 above.
- **Sprint 5's conviction v1/v2 kill criterion**: already decided on
  corroboration-rate and hype-rate (from the honesty panel), not on this
  grading methodology, because outcome-based grading isn't available yet
  at Sprint 5/6 — this document's real payoff arrives at Sprint 12, and
  a SECOND, outcome-based comparison of v1 vs v2 (if v1 hasn't already
  been deleted) becomes possible then as a confirmation of the earlier
  proxy-based decision.
