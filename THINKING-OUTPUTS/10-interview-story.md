# Interview Story — Session #10

A 5-minute demo arc, an opening line, and rehearsed-but-honest answers to
the two questions every interviewer asks about this project. The
governing rule for this whole session: **never demo a THINKING-OUTPUTS
spec as if it were shipped code.** Sprints 1–5 are built and real;
Sprints 6–17 are design documents. The single fastest way to lose
credibility in an interview is presenting a markdown spec as a live
feature and having the interviewer ask "can I see it" — so this story is
scoped to what's actually running today, with an explicit note on how to
extend the arc as more sprints ship.

---

## Opening line

Three options, ranked. Use #1 unless the room reads as very
non-technical (then use #3).

**#1 (primary — leads with the constraint, not the tech):**
> "I built a personal finance dashboard with a written constitution —
> and the rule I'm proudest of is Article 2: it can never place a trade,
> not even a 'quick buy' button. Enforcing that turned out to be a
> harder engineering problem than adding one would've been. Let me show
> you why."

**#2 (leads with the anti-pattern, more provocative):**
> "Most finance apps are built to maximize how often you open them. I
> built one with an explicit rule against that — and most of the
> interesting engineering in this project came from enforcing that rule
> against my own instincts as a developer."

**#3 (simpler, for a less technical interviewer):**
> "I built a personal trading dashboard for myself that's honest about
> what it doesn't know — it has a panel that grades its own data quality,
> and it refuses to average away disagreement in the news it reads. I
> can show you what that looks like."

All three do the same job: open with the unusual design constraint, not
"I built a stock tracker," because the constraint is the actual story —
the code is just evidence of it.

---

## The 5-minute demo arc (as of Sprint 5 — engine integrity complete)

Time-boxed. Total 5:00. If a screen isn't built yet, it is **described
from the spec doc, explicitly labeled as roadmap**, never clicked through
as if live.

**0:00–0:30 — Hook + one-sentence framing**
Say the opening line. Follow immediately with: "It's vanilla JavaScript,
no framework, no AI APIs, runs entirely on my machine — I'll get to why
in a second, but first let me show you what it actually does."

**0:30–1:45 — Live: the engine reading real text**
Open the app, paste or load a real headline/snippet into the feed. Walk
through, live, in the actual UI:
- Point at one item's **evidence-adjacent signals**: sentiment hit,
  whether it's negated ("denies plans to invest" correctly reads as
  neutral, not bullish — this is the single best "wait, that's a real
  NLP problem" beat in the whole demo, and it's solved with a 3-word
  negation-scope regex, not a model)
- Point at the **hype score** on a second, more breathless-sounding item
  — show the threshold, explain it's summing hedge-word density +
  superlative density + unnamed-sourcing + untiered-outlet, not a single
  keyword match
- Point at **corroboration** — two similarly-worded items merging into
  one group via shingle-based dedup, so the system doesn't double-count
  five rewordings of the same claim as five independent confirmations

This is the highest-density 75 seconds of the demo — three real,
nameable technical decisions (negation scoping, weighted hype
composition, shingle dedup) in one screen.

**1:45–2:30 — Live: test.html, the adversarial test suite**
Open test.html, scroll to the negation and hype-filter assertions
running green. Say: "Before I trusted this engine, I wrote a red-team
session against my own design — fifteen concrete attacks, from a
pump-and-dump operator trying to fake corroboration to a sensationalist
outlet baiting engagement with question-mark headlines. Five of them
became test assertions here." Point at one specific test name in the
file (e.g., the question-headline dampening test or the dedup test) so
it's concrete, not a claim.

**2:30–3:15 — Live: CONSTITUTION.md**
Open the file. Read Article 2 and Article 5 aloud. Say: "This isn't
decoration — it's the actual design spec. Article 5 says disagreement
gets displayed, never averaged into a neutral score. That's a concrete
constraint on the code: I can't ship a single 'sentiment: 0.6' number
for a cluster with genuinely split coverage — the UI has to show the
split." This is the moment that separates this project from a tutorial
clone — a governance document a hiring manager can read in thirty
seconds and immediately see is driving real code decisions.

**3:15–4:15 — Described, clearly labeled as roadmap: what's designed but not built**
Say explicitly: "Everything up to here is running code. What I want to
show you next is design work, not a live feature yet." Then describe —
without opening a demo, just talking, maybe showing the spec doc if
asked — one or two of: the **honesty panel** (a dashboard section that
grades its own signal health, so the tool can tell the user "today's
read is low-confidence, corpus was thin" instead of presenting every day
with equal false confidence), and the **Sunday ritual** (a weekly review
that checks whether trades this week had a thesis logged beforehand —
witnessing broken rules after the fact, since Article 2 already rules out
blocking them in the moment).

**4:15–4:45 — Honest limitations**
Say: "I also did a red-team session on my own engine and found three
attacks I can't currently defend against — for example, someone
fabricating a quote and attributing it to a real official, carried by a
legitimate wire service. I don't have a fix for that within a rule-based,
no-AI-API system, and I wrote that down explicitly in the docs rather
than pretending the guard catches everything. I'd rather the tool
under-claim what it can verify than over-claim it and have that be the
thing that costs real money." This is the single highest-leverage line
in the whole pitch — it signals engineering maturity that a working demo
alone cannot.

**4:45–5:00 — Close**
"Right now it's five sprints in — engine integrity, event bus, a local
relay for real data, IndexedDB archiving. The next few sprints add a
ledger with real XIRR math, a prediction book with a Brier score so I
can grade my own forecasting accuracy over time, and a weekly review
ritual. Happy to go deeper on any piece of this."

---

## Updating the arc as more sprints ship

- **After Sprint 6** (honesty panel, alert spine): swap the 3:15–4:15
  "described, roadmap" beat for a live honesty-panel screen — this
  becomes the new highest-density moment in the demo, replace the
  constitution-reading beat's runtime if the arc needs to stay at 5:00.
- **After Sprint 7** (ledger + XIRR): add "real money math" credibility —
  a live XIRR computation on an actual (or demo) portfolio is a strong,
  concrete number to point at.
- **After Sprint 11** (prediction book + Brier): this becomes the
  standout feature to lead the roadmap section with — no competitor
  tool (per Session #11's teardown) tracks the user's own forecasting
  accuracy over time, so once it's real and has resolved predictions,
  it deserves live demo time, not a described-roadmap mention.
- **Rule that never changes**: whatever is live gets clicked through;
  whatever is spec-only gets described and explicitly named as such. Never
  blur the two, in an interview or anywhere else.

---

## Honest answer: "Why no ML/AI?"

**The real reasons, in order of how defensible they are:**

1. **Explainability is a hard requirement, not a preference (Article 6).**
   Every conclusion has to be traceable as a one-line chain a human can
   read and argue with — "this fired because hedge-word density +
   superlative density + unnamed-sourcing crossed 55." An ML classifier's
   answer to "why did you flag this as hype" is a different kind of
   answer (attention weights, SHAP values) that's harder to argue with in
   the fifteen seconds a real trading decision allows.

2. **No AI APIs means no cloud dependency (Article 7).** A hosted LLM
   call would mean personal trading data — amounts, holdings, thesis
   text — leaving the machine to a third party. A local model would
   solve that but isn't proportionate: this is a single-user tool, not a
   product that needs to generalize across users, so the infra cost of
   running a local model doesn't buy anything a well-tuned rule set
   doesn't already deliver at this scale.

3. **The training-data problem is real and I'm naming it, not hiding it.**
   At n=1 user, n=1 portfolio, there's no meaningful corpus to train a
   personal model on without it just learning to mirror my own existing
   biases back at me — which is close to the opposite of what a
   decision-support tool should do. A rule-based system can't overfit to
   my own confirmation bias in the same way, because the rules are
   written down and I can (and did, in a whole red-team session) argue
   with them directly.

**The honest cost, said out loud, not defended away:** rule-based
detection is more brittle against adversarial phrasing than a model
would likely be — the red-team catalog names an attack (superlative-free
hype: swap "multibagger" for "structural re-rating candidate") that
purely dodges a keyword list in a way a semantic model might catch. I'm
not claiming rule-based is strictly better. It's a deliberate tradeoff
for THIS constraint set (explainability + privacy + single-user scale),
and I'd revisit it if evidence showed the tradeoff was wrong for what
I'm actually trying to do.

---

## Honest answer: "Why vanilla JS, no framework?"

**The real reasons:**

1. **No build step, for a single-user tool, is a genuine simplicity win.**
   The whole app opens from a double-clicked HTML file. There's no
   deployment pipeline to maintain for an audience of one.

2. **I wanted every abstraction in this codebase to be one I built and
   understood, not one I imported.** The event bus (Sprint 2) is a
   hand-rolled pub/sub, deliberately, so I understood what problem
   React's reconciliation model actually solves before reaching for a
   tool that solves it for me. That's a legitimate reason for a
   learning-anchored personal project.

3. **The view surface is small and fixed by design (Article 8 — six
   views, forever).** React's actual value proposition — managing
   complex, deeply nested state changes across many components, at team
   scale — doesn't pay for itself against six fixed views maintained by
   one developer.

**The honest limit, said out loud:** if this were ever a team codebase,
or if the view count and state complexity grew past what Article 8
allows, vanilla JS would become a real liability — no type safety
without a serious TypeScript investment, manual DOM-diffing risk as
complexity grows, a much steeper onboarding curve for any second
contributor. I'd use whatever framework the team already standardized
on without a fight — this choice is scoped to this project's actual
constraints (one developer, one user, fixed scope), not a general claim
that frameworks are unnecessary.

---

## Other questions worth having answers ready for

**"Why not a real backend/database?"**
Single user, no concurrent access, no need for a query engine — localStorage
+ IndexedDB for the browser-side cache, plus a local relay writing
append-only JSON to disk for anything that needs to survive a browser
profile reset (ledger, journal, predictions). A real database would be
solving a scaling problem this project doesn't have yet, and building for
a hypothetical future need is exactly the kind of premature complexity
the project's own principles (Article 10, delete-before-add) argue
against.

**"What was the hardest bug you fixed?"**
Have one specific, concrete story ready — pick whichever is freshest and
you can narrate precisely (e.g., the percentile computation's edge cases:
what "percentile" even means for a corpus of one item, or a corpus where
every item ties, and why the fallback there matters more than the happy
path). Specificity beats breadth here — one well-told bug story is worth
more than a list.

**"What's the biggest weakness in the current design?"**
Lead with the three unsolved attacks from the red-team session (analyst-
quote laundering, fabricated/misattributed quotes, closed-loop citation
rings) — say plainly these are open problems inherent to a rule-based,
no-ground-truth system, not oversights, and that the honest move was
documenting them as explicit non-goals in the guard's own scope rather
than letting "the tests pass" imply broader protection than actually
exists.

**"Why does a personal project need a written constitution?"**
Because the single most likely failure mode identified in an early
premortem session wasn't a bug — it was scope creep: "it never stopped
being under construction." A constitution is a forcing function against
that, and against quieter drift (an engagement-driving notification, a
"quick trade" shortcut) that would each individually seem reasonable in
the moment but collectively contradict why the project exists. Point to
Article 12 specifically — only a human amends it, models can only
propose — as evidence this is a real governance mechanism, not
decoration.

---

## What to have open, if asked to see code

Three files, in this order, nothing else pre-loaded:
1. `js/engine.js` — scroll to `countSentimentHits()` (negation-aware) and
   `hypeScore()` (weighted composite) — these are the two functions with
   the clearest "here's a real problem, here's the concrete fix" story.
2. `test.html` — scroll to the ORD-302 negation assertions and the
   ORD-1701 hype-filter tests — shows the adversarial-testing habit is
   real, not just claimed.
3. `CONSTITUTION.md` — Article 2 and Article 5, the two most load-bearing
   on the actual code.

Do not pre-load THINKING-OUTPUTS docs unless specifically asked "how do
you plan sprints" — they're real and thorough, but leading with planning
documents before showing running code inverts the credibility order an
interviewer actually wants (show it works, then show you thought ahead).

---

## Summary

The whole story rests on one honest distinction, repeated three times in
the arc: this is what's built (click through it), this is what's
designed (describe it, say so), and this is what's still unsolved (name
it plainly, explain why). An interviewer who's seen a hundred stock-
tracker side projects has not seen one with a written constitution, a
red-team session against its own logic, and a demo script that refuses
to blur spec and shipped code — that combination is the actual pitch,
more than any single feature is.

---

## This closes the 15-session thinking plan

All 15 sessions are now complete:
honesty panel, premortem, ledger schema, grading methodology, causal
edges, sunday ritual, threat model, brain intents, red-team catalog,
interview story, competitive teardown, ux language, data lifecycle,
constitution v2, core-slice replan. Every remaining sprint (5.5–17) now
has a full design spec to build from without further planning work —
the next natural step is starting Sprint 5.5 itself.
