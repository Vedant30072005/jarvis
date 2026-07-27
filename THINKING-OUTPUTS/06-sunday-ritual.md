# Sunday Review Ritual — Session #6

A 20-minute weekly ritual, screen by screen, grounded in what actually
changes trader behavior — not generic "reflect on your week" journaling.
Three research anchors shape every design choice below:

- **Implementation intentions** (Gollwitzer): specific if-then plans
  outperform vague goals by a wide margin in behavior-change research.
  The ritual ends with exactly one, never a list.
- **Cold-state review** (Lo & Repin's work on trader physiology): Sunday,
  markets closed, no open positions demanding attention — this is the one
  moment in the week the user is NOT in an aroused, loss-chasing state.
  The ritual must happen here, not reconstructed from memory on a stressful
  Tuesday.
- **Deliberate practice requires specific, immediate feedback tied to a
  concrete instance** (Ericsson): "how did I do this week" is too vague to
  drive improvement. "This specific trade, this specific thesis" is not.

Composes entirely from data already built by prior sprints — this ritual
adds zero new computation, only a fixed sequence and framing over existing
panels (ledger reconciliation from Sprint 15, predictions from Sprint 11,
calibration from Session #5/#9, alert tracking and attention-distribution
from the earlier thinking rounds).

---

## Framing rule, stated once, applies to the whole ritual

**This is a calibration check, not a performance review.** The opening
screen states this explicitly, every time, because loss-aversion framing
research (Kahneman/Tversky) shows people react very differently to
"let's see what you got wrong" than to "let's see where your model of
yourself needs updating." Same data, opposite psychological framing,
opposite behavioral outcome — get this line wrong and the whole ritual
becomes something the user starts avoiding.

**Total runtime: ~20 minutes.** Two screens are **blocking** (cannot be
closed without action) — everything else can be skimmed in under a minute
if the week was uneventful. The ritual should never feel like homework;
an uneventful week should take 8 minutes, not 20.

---

## Screen 0 — Opening (30 seconds, non-blocking)

```
┌─────────────────────────────────────────────┐
│  SUNDAY REVIEW · Week of [date range]        │
│                                                │
│  This is a calibration check, not a           │
│  performance review. The goal is a more       │
│  accurate model of yourself, not a score.     │
│                                                │
│                          [ Begin → ]          │
└─────────────────────────────────────────────┘
```
No data yet — pure framing. Markets are closed; this is the cold-state
entry point, deliberately quiet before anything is shown.

---

## Screen 1 — The Week in Numbers (2 min, non-blocking, passive)

Pure orientation before any behavioral judgment — numbers first, meaning
later, so the user isn't primed by a verdict before seeing the facts.

```
┌─────────────────────────────────────────────┐
│  THIS WEEK                                    │
│                                                │
│  Trades: 4 (3 buy, 1 sell)                    │
│  Portfolio: ₹12.4L → ₹12.6L  (+1.6%)          │
│  Nifty this week: +1.1%                       │
│  Turnover: 8% of portfolio value              │
│                                                │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
No judgment language ("good week"/"bad week") — just facts. The
interpretation happens in the screens that follow, each with its own
specific lens, rather than a single upfront verdict that colors everything
after it.

---

## Screen 2 — Reconciliation: Did You Follow Your Own Rules? (3 min, non-blocking, but visually weighted if flagged)

This is the "witness, not gate" mechanism from Sprint 15 — it doesn't
prevent anything in the moment, it makes the fact undeniable after the
fact, which is where witnessing actually has teeth.

```
┌─────────────────────────────────────────────┐
│  RULE-FOLLOWING CHECK                         │
│                                                │
│  4 trades this week.                          │
│  ✓ 3 had a thesis logged beforehand            │
│  ⚠ 1 did not — HDFC Bank buy, Thu 2:15pm       │
│                                                │
│  [ See the trade → ]                          │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
If zero flags: this screen shrinks to a single green line ("All trades
had a thesis logged. ✓") and the user moves on in five seconds — the
ritual doesn't manufacture drama on a clean week. If there IS a flag, it's
shown plainly, without a lecture — the fact itself is the intervention;
piling on moralizing language undermines the "calibration, not judgment"
framing from Screen 0.

---

## Screen 3 — Predictions Due This Week [BLOCKING] (3–5 min)

**This is the first non-skippable screen.** Any prediction whose
resolution date has passed must be marked resolved (with the real outcome)
before the ritual can proceed. This is deliberately the one place the
ritual has actual teeth — a prediction book that lets resolution slide
becomes worthless data (Session #5's whole point), and "I'll resolve it
later" is exactly how calibration data quietly dies.

```
┌─────────────────────────────────────────────┐
│  PREDICTIONS DUE  (2 unresolved, past due)    │
│                                                │
│  1. "Defence beats index by 12% by EOY"       │
│     Stated: 72% probability · Due: last Tue   │
│     Actual outcome: [ YES ]  [ NO ]  ← required│
│                                                │
│  2. "Banking NIM compression through Q3"      │
│     Stated: 60% probability · Due: last Fri   │
│     Actual outcome: [ YES ]  [ NO ]  ← required│
│                                                │
│         [ Continue → ]  (disabled until both  │
│                           are resolved)         │
└─────────────────────────────────────────────┘
```
If zero predictions are due: this screen is skipped entirely (not shown
as an empty state — no reason to interrupt a clean week with a screen that
has nothing to say). The blocking only activates when there's real,
overdue resolution work — never as friction for its own sake.

---

## Screen 4 — What You Didn't Look At (2 min, non-blocking)

The echo-chamber countermeasure from the earlier thinking rounds, made
concrete. Confirmation bias in a single-user tool is a real risk — the
system might become a mirror of what the user already believes rather
than a telescope. This screen actively resists that.

```
┌─────────────────────────────────────────────┐
│  BLIND SPOTS THIS WEEK                        │
│                                                │
│  Sectors with signal activity you didn't       │
│  open once:                                   │
│                                                │
│  • Semiconductors — 6 signals, 0 views        │
│  • Metals & Mining — 4 signals, 0 views       │
│                                                │
│  Your attention this week: 68% Defence,       │
│  22% Banking, 10% everything else.            │
│                                                │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
No recommendation to "go check them out" — the screen states the fact of
what was ignored and lets the user draw their own conclusion. Nudging
toward specific action here would reintroduce the exact engagement-bait
dynamic the anti-gamification doctrine (round 4) exists to prevent.

---

## Screen 5 — Alerts: Fired vs Acted (2 min, non-blocking)

Surfaces the self-demotion candidates from the alert-outcome-tracking
mechanism (Session #2's premortem, cause #5) — but as a confirmation step
for the user, not a silent automatic change, since demoting an alert type
is itself a decision worth being aware of even though the system proposes
it automatically.

```
┌─────────────────────────────────────────────┐
│  ALERT HEALTH                                 │
│                                                │
│  Threat Board alerts: 3 fired, 3 seen,        │
│  1 acted on (33% action rate)                 │
│                                                │
│  Sonar alerts: 8 fired, 8 seen, 0 acted on     │
│  (0% action rate — 4th week running)          │
│  → Proposed: demote Sonar alerts to log-only  │
│    [ Confirm ]  [ Keep as-is ]                │
│                                                │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
If no alert type crosses the demotion threshold: this screen shows a
one-line summary and moves on. The demotion proposal only appears when
warranted, and always requires one click either way, keeping the user in
the loop on a change to how the tool behaves toward them.

---

## Screen 6 — Calibration Trend (2 min, non-blocking, gated by N)

```
┌─────────────────────────────────────────────┐
│  CALIBRATION                                  │
│                                                │
│  Brier score: 0.19 (N=24, trailing 90 days)   │
│  Trend: 0.24 → 0.19 over the last 8 weeks     │
│         (improving — lower is better)         │
│                                                │
│  Your 80–90% confidence predictions hit 65%   │
│  of the time — you may be overconfident in    │
│  that band. [ See calibration curve → ]       │
│                                                │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
Below N=15 resolved predictions (Session #5's gate): this screen shows
"3 predictions resolved so far — not enough yet to show a trend" and
nothing more, exactly matching the honesty rule from the grading
methodology session rather than a fake early trend line.

---

## Screen 7 — One Question [effectively blocking via friction, not a hard gate] (3 min)

The deliberate-practice core of the whole ritual. Not a journaling prompt
("how do you feel about this week") — a **specific, concrete question tied
to one identifiable decision**, because vague reflection doesn't build
skill and specific reflection does.

```
┌─────────────────────────────────────────────┐
│  ONE QUESTION                                 │
│                                                │
│  Pick the one decision this week you're       │
│  least sure about — a trade, a thesis, an     │
│  idea you dismissed. Write one sentence on    │
│  what would change your mind about it.        │
│                                                │
│  [ referencing: HDFC Bank buy, Thu ▼ ]         │
│  ┌──────────────────────────────────────┐    │
│  │                                        │    │
│  └──────────────────────────────────────┘    │
│                                                │
│                          [ Continue → ]        │
└─────────────────────────────────────────────┘
```
This is not blocking in the technical sense (no hard gate — a genuinely
uneventful week might have nothing worth flagging), but the UI defaults
to this screen being open and waiting, not easily dismissed with a single
tap, so it takes real intent to skip rather than being an accidental
skim-through.

---

## Screen 8 — Closing: One Commitment [BLOCKING] (2 min)

**The second non-skippable screen**, and the most important one
structurally. This is where Gollwitzer's implementation-intention research
gets applied directly: a specific if-then plan for the coming week, not a
vague resolution. "Trade less" is not an implementation intention. "If I
want to buy something within 2 hours of reading a headline about it, I
will wait until the next day" is.

```
┌─────────────────────────────────────────────┐
│  ONE COMMITMENT FOR NEXT WEEK                 │
│                                                │
│  Complete this: "If ___, I will ___."         │
│                                                │
│  ┌──────────────────────────────────────┐    │
│  │ If [                                ] │    │
│  │ I will [                            ] │    │
│  └──────────────────────────────────────┘    │
│                                                │
│  (Shown again next Sunday, before this one     │
│   is written, so you can see if you kept it.) │
│                                                │
│         [ Save & Finish ]  (required to close) │
└─────────────────────────────────────────────┘
```
**Exactly one commitment, never a list** — Gollwitzer's research is
specific that implementation intentions lose effectiveness when someone
tries to hold several at once. This is also the screen the RITUAL cannot
be closed without completing (the "if ___, I will ___" template must be
non-empty), because a Sunday review that ends without a forward commitment
is just a retrospective, not a ritual with teeth.

**The callback mechanic**: next Sunday's Screen 0 shows last week's
commitment before anything else, with a simple "did you keep this?"
yes/no — closing the loop on the previous week's implementation intention
before generating a new one. This is the single mechanism most likely to
actually change behavior over months, more than any of the analytical
screens before it.

---

## Auto-Generated Sunday Memo

At the end, the ritual assembles a plain markdown document from everything
above — deterministic template-filling with real numbers, not generated
prose, per the earlier thinking rounds' emphasis on this being a durable,
exportable artifact rather than a UI-only experience:

```markdown
# Sunday Review — Week of [date range]

**Numbers**: Portfolio +1.6% (Nifty +1.1%). 4 trades, 8% turnover.

**Rule-following**: 3/4 trades had a logged thesis. Flagged: HDFC Bank buy (Thu).

**Predictions resolved**: 2 (Defence-vs-index: YES; Banking NIM: NO).

**Blind spots**: Semiconductors (6 signals, 0 views), Metals & Mining (4 signals, 0 views).

**Alerts**: Sonar alerts proposed for demotion (0% action rate, 4 weeks running) — confirmed.

**Calibration**: Brier 0.19 (N=24), improving from 0.24 eight weeks ago.

**Reflection**: [user's one-sentence answer, tied to HDFC Bank buy]

**Last week's commitment**: "If I felt FOMO on a headline, I'd wait a day." — Kept: Yes.

**This week's commitment**: "If I want to buy within 2 hours of reading
about it, I will wait until the next trading day."
```

This markdown file is what the **accountability export** (round 4's idea)
strips amounts from and shares with a mentor if the user chooses —
percentages and behavior stats only, never absolute rupee figures.

---

## Design rules this ritual follows throughout

1. **Never manufacture drama on a clean week.** Every screen has a
   "nothing to report" state that's brief and moves on fast — the ritual
   should feel proportional to what actually happened, not padded to fill
   20 minutes regardless.
2. **Exactly two blocking screens** (predictions due, one commitment) —
   everywhere else, friction only appears when something is actually
   flagged, never as a default state.
3. **No streaks, no badges, no completion percentage.** Per the
   anti-gamification doctrine — this ritual is measured in the review
   itself (did you keep last week's commitment?), never rewarded with
   engagement mechanics.
4. **One commitment, never a list** — this is the single most
   evidence-backed design choice in the whole ritual and the one most
   tempting to violate ("why not let them set 3 goals?") — resist it.
5. **The framing line from Screen 0 is load-bearing.** "Calibration check,
   not performance review" isn't decoration — it's the difference between
   a ritual the user keeps doing and one they start dreading and avoiding.

---

## What this unblocks

- **Sprint 15**: builds this ritual directly from the screen-by-screen
  spec above — no additional design work needed, only wiring existing
  panels' data into this fixed sequence.
- **Sprint 15's reconciliation engine**: Screen 2 is its primary UI surface.
- **Session #5's grading methodology**: Screen 3's blocking resolution
  step is what keeps the prediction book's N growing — without this
  forcing function, resolved-prediction counts stall indefinitely.
- **The accountability export** (mentioned in earlier rounds): generates
  directly from the auto-memo template above, stripped of amounts.
