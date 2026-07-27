# Red-Team Attack Catalog — Session #1

15 concrete attacks against jarvis's engine, from three adversary
personas, each with a specific defense mapped to what's built (Sprint 5's
hype/corroboration/negation logic) or planned (Sprint 9's sonar guard,
Sprint 14's echo-vs-novelty). Every attack is mechanistic — it names the
exact code path it exploits, not a vague "what if someone lies." Three
attacks (#7, #11, #14) are honestly documented as **currently unsolved**
rather than papered over, because pretending a rule-based, no-AI-API
system catches everything would be a worse outcome than admitting its
real limits.

---

## Persona A: Pump-and-Dump Operator
*Goal: inflate false bullish conviction on a small-cap they've accumulated.*

### Attack 1 — Coordinated burst across low-tier lookalikes
Plant a near-identical "multibagger" story across 5–10 low-tier blogs
within a 2-hour window, all naming the same small-cap + a vague large
number. Exploits: Sprint 5's `confirmed = sources.length >= 2` counts
DISTINCT SOURCE NAMES, and 5 different blog domains satisfy that even
though they're one operator's network.

**Defense**: confirmation should require **source-tier diversity**, not
just source-count diversity. A group where 100% of sources fail
`JDATA.TIERED_SOURCES_RX` should NOT earn the same "+15 impact confirmed"
boost as a group with even one official/wire source. Concrete rule: gate
the confirmation bonus on `sources.some(s => tiered(s))`, not just
`sources.length >= 2`. **This is the exact justification for Sprint 9's
coordination heuristic (e)** — flag when a group's source set is 100%
untiered.

### Attack 2 — Reverse-shingle laundering
Same false claim, each of 5 planted articles individually reworded
(synonym-swapped, reordered) to keep 3-word-shingle Jaccard below 0.55 —
so Sprint 5's dedup does NOT merge them, and each is counted as an
*independent* confirmation instead of 5 copies of one claim, inflating
apparent source diversity further than attack #1.

**Defense**: the entity+amount fallback match (same sector + same company
+ amount ±10% within 72h, already in `buildGroups()`) should catch
reworded duplicates that dodge shingle matching — but only if the amount
stays fixed. If the operator ALSO varies the amount (₹10,000cr vs
₹9,500cr) to dodge both dedup paths, neither catches it. **Real defense**:
track per-company mention-VELOCITY (mentions/hour for one small-cap
ticker) as an independent anomaly signal, separate from dedup entirely —
this is Sprint 9's sonar territory, and this attack is the concrete case
proving coordination detection needs a velocity trigger, not just a
grouping trigger.

### Attack 3 — Superlative-free hype
Operator reads the client-side-visible `JDATA.SUPERLATIVE_WORDS` list
(fully inspectable in devtools — there's no obfuscating it) and swaps
"multibagger"/"moon"/"game-changer" for unlisted synonyms ("structural
re-rating candidate," "exceptional value creation").

**Defense**: don't rely on any single hype-score component crossing
threshold alone — Sprint 5's score already sums hedge+superlative+
unnamed+untiered, so dodging superlatives alone doesn't zero the total if
unnamed-sourcing and untiered-outlet still fire. **Honest limitation**:
any keyword list running fully client-side is permanently gameable by an
adversary who can read source — the goal is raising evasion cost via
periodic lexicon rotation (the Sprint 16 dictionary-teaching flow), not
claiming an unbeatable defense. Document this as accepted, not solved.

### Attack 4 — Legit-sounding newswire injection
Pay for placement on a pay-to-publish PR newswire whose NAME pattern
happens to superficially match `JDATA.TIERED_SOURCES_RX` (e.g., a service
calling itself "XYZ Financial Express"), so a name-pattern regex
misclassifies it as tiered/trustworthy.

**Defense**: name-pattern tiering is inherently gameable by a lookalike
name — no regex fix closes this fully. **Real long-term fix** (stretch,
needs Sprint 12 infra): a per-source reputation score based on historical
behavior — does content attributed to this exact source name tend to get
independently corroborated later, or stay a lone, never-confirmed claim?
Feed this from the grading methodology's outcome data once it exists.
Flag for Sprint 12, not Sprint 9.

### Attack 5 — Timing the calibration gap
Launch specifically within 3 weeks of a new company being added to
`JDATA.COMPANIES` (ORD-303's living-mandate expansions), exploiting that
Sprint 9's sonar needs 21 days of baseline — a brand-new entity has zero
baseline, so mention-volume reads as "insufficient data," not "anomalous."

**Defense**: new entities should inherit a **conservative borrowed
baseline** (median baseline across existing same-sector companies) rather
than "no baseline = no alert." Cold-start protection, not cold-start
blindness — flag explicitly for Sprint 9's calibration-gate design.

---

## Persona B: PR Agency
*Goal: sustained favorable positioning, longer horizon, more "legitimate"-looking than outright pump-and-dump.*

### Attack 6 — Drip-feed sub-threshold momentum
Release a steady stream of small positive items (routine renewals, minor
awards) every few days — each individually too small to cross hype/impact
thresholds, but always keeping a recent item in the window so the
momentum formula's time-decay (`Math.max(.35, 1 - i.h/96)`) never lets the
cluster cool off.

**Defense**: not necessarily false content — but a sustained *attention*
campaign, not organic flow. Detect via mention-frequency relative to the
company's OWN historical baseline (same velocity concept as attack #2,
applied to legitimate-seeming drip content rather than bursts) — flag as
"attention surge" independent of whether any single item crosses a
threshold. Sprint 9/14 territory.

### Attack 7 — Analyst-quote laundering [UNSOLVED — documented, not fixed]
Arrange a friendly sell-side analyst's bullish target to be carried by a
real wire service. Named attribution evades unnamed-sourcing detection;
wire-service carriage evades outlet-tier detection. **This attack does not
fail the current heuristics because it genuinely isn't hype by Sprint 5's
own definitions** — it's a legitimate, if possibly biased, opinion, tiered
and named exactly as real financial journalism looks.

**Defense**: not detection — **disclosure**. Track analyst/source
target-hit-rate over time using the Sprint 12 grading methodology,
extended from the engine's own ideas to human-attributed opinions,
surfacing a calibration/reputation flag on repeat-offender analysts.
Explicitly flag in Sprint 9 that the pump-and-dump guard does **not**
claim to catch this — it's a different, harder problem (biased-but-real
opinion vs fabricated hype) that needs Sprint 12 infrastructure at
earliest, and may never be fully solvable within the no-AI-API constraint.

### Attack 8 — Sentiment-lexicon stuffing
Every release about the company reliably uses one of `JDATA.BULL`'s exact
trigger words ("wins," "expands," "record") regardless of whether the
underlying news is substantive, reverse-engineering the client-visible
lexicon to guarantee a "bull" classification.

**Defense**: sentiment classification is presence/absence, not
magnitude-of-substance — this is a real gap. Mitigation: a bull-classified
item with `amountCr == 0` and few entity matches is a genuinely weaker
signal than one with real numbers attached; the evidence-grade display
(Session #12) should reflect this by not letting sentiment alone carry an
item to grade A/B — grade should also weight amount/entity richness, not
just corroboration count. Add an explicit golden-corpus test: a
content-thin, trigger-word-stuffed release should score measurably lower
than a substantive one using the same trigger words.

---

## Persona C: Sensationalist Outlet
*Goal: clickbait/ad revenue, not coordinated manipulation — still corrupts the corpus.*

### Attack 9 — Question-headline bear-baiting
Publish many "Is X Sector About to Crash?" headlines about one sector in
a short window — each individually dampened by Sprint 5's "?"-halving,
but never zeroed, so enough of them cumulatively could still tip a
cluster into caution territory despite zero concrete assertions anywhere
in the corpus.

**Defense**: needs an explicit stress-test (add to test.html's golden
corpus): a cluster built ENTIRELY from question-headlines should not, on
its own, cross the caution-idea threshold. If it currently can, either
strengthen the dampening (0.5x → 0.3x) or exclude question-headlines from
the bull/bear COUNT entirely (not just the impact-weight) — repeated
"is X doomed?" baiting is arguably closer to hype than genuine bearish
signal and could reasonably route through the hype filter instead.

### Attack 10 — Old-news recycling with a fresh date
Re-publish a real, months-old story with a reworded headline and today's
date, no new information. Shingle-Jaccard dedup compares wording, not
underlying event date, so a sufficiently reworded re-publish sails through
as "new," contributing fresh momentum for a story that isn't news anymore.

**Defense**: this is exactly the "echo vs novelty" / "narrative age" /
"re-announcement detection" idea from earlier sessions (Sprint 14 scope,
also flagged in the round-6 follow-up). The archive already stores
(company, sector, amount) triples with first-seen dates from Sprint 4
onward — a new headline whose triple was already archived within ~6
months should be flagged "previously reported" and excluded from fresh
momentum. Add a golden-corpus test: seed a re-announcement case (same
company+amount seen 4 months ago, reworded today) and assert it does NOT
contribute full fresh momentum.

### Attack 11 — Fabricated or misattributed quote [UNSOLVED — documented, not fixed]
Invent or distort a quote attributed to a real official ("Minister says X
is doomed") published by a genuinely tiered outlet running an unverified
wire pickup.

**Defense**: this is a **fact-checking problem**, and a rule-based,
no-AI-API system by design has no ground-truth verification layer. **This
attack succeeds against jarvis as currently designed, and there is no
clean fix within the stated constraints.** The only honest mitigation is
corroboration-based, after the fact: does the quote/claim get
independently confirmed — or officially denied — within 24–48h by
additional coverage? Sprint 9's guard must not claim to catch fabricated
primary reporting; it only catches coordinated amplification of
low-credibility claims. State this explicitly in the guard's own
documentation so nobody mistakes "guard passed" for "claim verified."

---

## Cross-Cutting Attacks (persona-agnostic — structural gaps, not just adversarial)

### Attack 12 — Quiet-day percentile inflation
Launch (any persona) specifically on a genuinely quiet news day. Sprint
5's percentile-based impact display means ANY item on a thin day gets
pushed toward high percentiles relative to that day's small corpus, even
with a mediocre raw score — a mediocre hype item on a slow Tuesday can
rank 90th percentile purely from lack of competition.

**Defense**: extend Session #7's honesty-panel caveat ("insufficient
volume today — ratios unreliable") to the percentile display itself, not
just the honesty-panel's own ratios. Concrete fix: below a corpus-size
floor (~15–20 items), show a "low-volume day — percentile less
meaningful" caveat badge rather than a bare high-percentile number at the
same visual weight as a busy-day equivalent. Ties directly into Session
#12's UX language — a new use for the calibrating-state visual treatment.

### Attack 13 — Cross-sector tag stuffing [real gap, not just adversarial]
Write a headline that matches multiple sector regexes at once
("defence," "semiconductor," AND "renewable energy" in one loosely-related
release) to get one item counted toward three clusters' momentum
simultaneously, inflating apparent breadth across all three from a single
story.

**Defense**: this is a real, currently-unguarded arithmetic gap that
doesn't even need malicious intent — a genuine multi-sector story (a
defence-cum-infra project) would ALSO over-count today. Fix: divide an
item's momentum contribution by its sector count
(`contribution = impact * decay / sectors.length`) so a multi-tagged item
still counts everywhere it's relevant, but at fractional weight, not full
weight N times over. **Recommend fixing this regardless of adversarial
framing** — it's a correctness bug independent of whether anyone ever
exploits it deliberately.

### Attack 14 — Closed-loop citation rings [UNSOLVED — documented, accepted-until-taught]
Register several cheap, superficially-distinct blog domains that cite each
other ("per reports from Domain B..."), creating a closed citation loop
that looks like independent corroboration (2+ distinct source names) but
is one operator wearing several hats.

**Defense**: distinct source NAMES is a weak proxy for source
INDEPENDENCE, and there's no automatic way to detect co-ownership or
serial cross-citation from the text alone. **Real mitigation** (stretch,
needs manual input): a user-taught "known affiliated domains" list —
similar in spirit to the Sprint 16 dictionary-teaching flow — letting the
user manually flag domain clusters they've noticed behaving this way, so
future confirmation-counting excludes them. Until the list has entries,
this attack succeeds. Document as accepted-until-taught, not solved
outright — this is an honest limitation of any purely textual
corroboration check.

### Attack 15 — Volume-based compute DoS
Flood RSS ingestion with thousands of near-duplicate items in a short
window (deliberate attack, or simply an unusually chatty real news day) —
aiming to degrade the O(n²) pairwise shingle-dedup pass to the point where
analysis times out, silently truncates, or the UI hangs — not to inject
false conviction, but to make truth-layer checks skip or crash under load.

**Defense**: already flagged in the amended sprint plan (Sprint 16:
compute budget cap ~300 items/pass, LSH bucketing as the escape hatch).
**This red-team session confirms that cap is an adversarial-robustness
requirement, not just a performance nicety** — a flood is a real, low-effort
way to force silent truncation. Concrete addition: if truncation ever
triggers, it must be **visible** ("analysis capped at 300 most-recent
items; 40 items this cycle were not analyzed") — silent truncation during
a flood is exactly when integrity matters most and is least likely to be
manually noticed.

---

## Summary — Punch List for Sprint 9's Guard Suite

| # | Attack | Fix scope | Priority |
|---|---|---|---|
| 1 | Coordinated low-tier burst | Sprint 9 — gate confirmation bonus on source-tier diversity | **Must-fix, Sprint 9** |
| 2 | Reverse-shingle laundering | Sprint 9 — velocity-based coordination trigger | **Must-fix, Sprint 9** |
| 5 | Calibration-gap timing | Sprint 9 — borrowed baseline for new entities | **Must-fix, Sprint 9** |
| 9 | Question-headline bear-baiting | Sprint 9 — golden-corpus stress test, tune dampening if needed | **Must-fix, Sprint 9** |
| 13 | Cross-sector tag stuffing | Sprint 6/9 — divide momentum contribution by sector count | **Must-fix, next touch of buildClusters()** (real bug, not just adversarial) |
| 15 | Compute DoS via flood | Sprint 16 — already scheduled; add visible-truncation requirement | **Confirmed in scope, Sprint 16** |
| 10 | Old-news recycling | Sprint 14 — echo-vs-novelty / re-announcement detection | Scheduled, Sprint 14 |
| 6 | Drip-feed sub-threshold | Sprint 9/14 — mention-velocity-vs-own-baseline | Scheduled, Sprint 9/14 |
| 12 | Quiet-day percentile inflation | Sprint 6 — extend honesty-panel caveat to percentile display | Should add to Sprint 6 scope |
| 8 | Sentiment-lexicon stuffing | Sprint 12 — evidence grade should weight amount/entity richness, not just corroboration | Add golden-corpus test now, full fix at Sprint 12 |
| 3 | Superlative-free hype | Sprint 16 — lexicon rotation via dictionary-teaching | Accepted limitation, mitigated over time |
| 4 | Legit-sounding newswire injection | Sprint 12 — source reputation scoring (needs grading infra) | Stretch, Sprint 12+ |
| 7 | Analyst-quote laundering | **Unsolved** — disclosure via Sprint 12 reputation tracking, not detection | Document as accepted limitation |
| 11 | Fabricated/misattributed quote | **Unsolved** — no fix within no-AI-API constraint | Document as accepted limitation |
| 14 | Closed-loop citation rings | **Unsolved** — needs user-taught affiliated-domains list | Document as accepted-until-taught |

**Five attacks (1, 2, 5, 9, 13) should become concrete test.html
assertions in Sprint 9** — they're mechanistic, testable, and fixable
within that sprint's existing scope (the pump-and-dump guard + buildClusters
tuning). **Three attacks (7, 11, 14) must be written into the guard's own
documentation as explicit non-goals** — the single most important output
of this whole session is refusing to let "the pump-and-dump guard passed
its tests" be read as "this system can't be fooled." It can, in specific,
named ways, and Sprint 9 should say so in the UI or docs rather than
implying blanket protection it doesn't have.
