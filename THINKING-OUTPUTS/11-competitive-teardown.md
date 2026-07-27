# Competitive Teardown — Session #11

jarvis against four real products a retail Indian investor already has
open in another tab: **Tickertape**, **Screener.in**, **smallcase**, and
**TradingView**. The point of this session isn't feature-matching — jarvis
will lose almost every feature-by-feature comparison against tools built
by funded teams with years of production hardening. The point is finding
the one axis where jarvis is structurally different, not just smaller,
and being honest about which gaps are permanent (business-model-driven,
can't be closed) versus which are just backlog (Sprint N will close them).

Written from general knowledge of these products' publicly known
positioning and feature sets, not a live audit — treat specific claims
about current pricing/features as directional, not verified-today facts.

---

## Per-competitor teardown

### Tickertape
**What it is**: a retail-friendly analytics + portfolio-tracking layer —
stock/mutual-fund screeners, a proprietary composite "Tickertape Score,"
broker-linked portfolio aggregation, watchlists, and a PRO subscription
tier for deeper screens and alerts.

**What it does well that jarvis doesn't**: real broker integrations (live
holdings sync, not CSV import), polished mobile-first UI, a genuinely
large fundamental + technical data surface maintained by a team, mutual
fund analysis depth jarvis has no plans to build.

**What it does that jarvis explicitly refuses to do**:
- **The Tickertape Score is exactly the averaging Article 5 forbids** —
  it compresses valuation + growth + profitability + technical momentum
  into one number. Two analysts could look at the same stock, disagree
  on why it's a buy or a sell, and both get shown the same composite
  score with no visible disagreement.
- **Notification-driven engagement**: price alerts, score-change alerts,
  "you might like" surfacing — the business model is retention via
  re-opens, which is the direct opposite of Article 3 (silence is a
  valid output) and Article 15 (calm is measured, never rewarded).
- **Account-based, cloud-stored**: holdings, watchlists, and behavior
  live on Tickertape's servers, not the user's machine — a flat
  contradiction of Article 7 if jarvis tried to copy this pattern.

**Honest gap jarvis has**: Tickertape's data pipeline is a paid,
maintained, broker-audited feed. jarvis's Sprint 12 EOD bhavcopy parse is
a rough, once-a-day, single-exchange analog. This gap does not close —
jarvis was never going to out-data a funded provider, and Session #3's
attack catalog already assumes the engine works with noisier, thinner
inputs than a commercial feed would give it.

---

### Screener.in
**What it is**: a fundamentals-first tool — ratio screens, years of
audited financial history, DIY formula-based custom screens, and a
community layer of "guide" comments on individual stock pages.

**What it does well that jarvis doesn't**: genuine data depth (a decade
of balance sheets, cash flow, peer comparison), a screening query
language power users trust, and — notably — historically the most
transparent major Indian retail tool (formulas are visible, not a black
box), which is philosophically closer to jarvis's Article 6 (every
conclusion explainable) than any of the other three.

**Where jarvis and Screener actually agree**: both refuse to hide the
formula behind a score. This is the one competitor whose core design
principle jarvis should explicitly acknowledge as *correct*, not just
tolerate — Screener proves a transparency-first tool can have real
retail traction, which is direct market evidence against the assumption
that "explainable but less flashy" can't work.

**Where they diverge**: Screener has no concept of *the user's own
behavior* — no ledger of what the user did with the information, no
memory of what thesis they held last month, no calibration tracking
against their own past calls. Screener is a research tool; it has
nothing analogous to Article 11 (the user's own words gate every
commitment) or the Sunday ritual (Session #6). It answers "what is this
company's ROCE" extremely well and has zero opinion on whether the user
who's asking has a coherent, followed thesis.

**Honest gap jarvis has**: fundamental data depth and history length.
jarvis's `JDATA.COMPANIES` lexicon (64 companies) and regex-based
extraction from news text is not a substitute for actual audited
financial statements. jarvis is not trying to become a fundamentals
database — Session #1's attack catalog already treats amount/entity
extraction from news as inherently noisier than structured filing data,
and that's an accepted, permanent gap, not a backlog item.

---

### smallcase
**What it is**: curated, theme-based stock baskets ("smallcases") built
by SEBI-registered managers, executed with one broker-linked click,
rebalanced by the manager over time.

**What it does well that jarvis doesn't**: removes almost all friction
between having an idea and acting on it, packages diversification and
professional curation into a single purchasable unit, handles execution
and rebalancing logistics jarvis has zero interest in ever building.

**What it does that jarvis is structurally opposed to, not just
behind on**:
- **It IS the buy button.** smallcase's entire value proposition is
  frictionless execution — this is the precise inverse of Article 2.
  Where jarvis stops at "here's a cross-current in defence stocks, form
  your own thesis," smallcase's entire product is "here's a basket,
  click to own it."
- **It outsources conviction to a manager**, which is the inverse of
  Article 11 — the user's own written thesis is replaced by a fund
  manager's already-decided basket. This isn't a data-quality gap
  jarvis could close by trying harder; it's a different product
  category entirely, built to solve "I don't want to think about this
  myself," while jarvis exists specifically to solve "help me think
  about this myself, honestly."

**Why this comparison matters more than the other three**: smallcase is
the sharpest test of jarvis's own constitution, because it's the
most commercially successful embodiment of exactly the pattern jarvis's
Article 2 was written to reject. If jarvis ever drifts toward "quick
action" affordances (a Sprint idea like "one-tap add to watchlist and
notify me" creeping toward "one-tap execute"), this is the name to
remember as the cautionary comparison.

---

### TradingView
**What it is**: best-in-class charting across global markets, a Pine
Script scripting layer for custom indicators, and a large social feed of
user-published "ideas" (chart annotations, technical calls, community
upvotes).

**What it does well that jarvis doesn't**: charting jarvis has no
ambition to ever match, a mature indicator ecosystem built by thousands
of contributors over a decade, genuinely useful cross-asset/cross-market
coverage.

**What it does that jarvis explicitly refuses to do**:
- **Social validation as a feature.** Published "ideas" accumulate likes,
  comments, follower counts — this is precisely the leaderboard/
  engagement-reward dynamic Article 15 (calm is measured, never
  rewarded) was written to permanently rule out. A popular TradingView
  idea can look validated by crowd size while being no more correct than
  an unpopular one; jarvis's Sunday ritual (Session #6) does the
  opposite by design — it never shows the user anyone else's track
  record, only their own, specifically to avoid this exact substitution
  of social proof for calibration.
- **Alert-driven, always-on engagement.** Price alerts and community
  activity are built to bring the user back to the terminal constantly —
  the opposite of Article 3's "at most one unsolicited nudge per
  session."
- **Technical-analysis-first framing.** Chart-pattern and indicator
  signals are presented with a confidence that Article 6 (every
  conclusion explainable as a one-line chain) would refuse — an
  indicator crossing a threshold is not the same as a stated, falsifiable
  causal claim ("China restricts rare-earth exports → domestic magnet
  makers get pricing power," Session #3's causal-edge format). TradingView
  doesn't distinguish between these; jarvis's whole engine exists to
  make that distinction load-bearing.

**Honest gap jarvis has**: pure charting utility and community-vetted
indicator breadth. jarvis has no charting story at all beyond simple
percentile/impact displays — this is not a near-term gap to close, it's
a category jarvis is opting out of entirely (see Anti-Goals below).

---

## Cross-cutting comparison matrix

| Dimension | Tickertape | Screener | smallcase | TradingView | jarvis |
|---|---|---|---|---|---|
| Buy/execute action | No (tracking only) | No | **Yes — core feature** | No | **Never, by constitution** |
| Data stored where | Cloud (their servers) | Cloud | Cloud + broker | Cloud | **Local disk only** |
| Composite "score" that hides disagreement | Yes (Tickertape Score) | No (raw ratios) | N/A | Partial (technical rating) | **Never — disagreement always shown separately** |
| Notification/re-engagement design | Yes | Minimal | Yes (rebalance alerts) | Yes, heavily | **Explicitly minimized (≤1 nudge/session)** |
| Social/crowd validation layer | No | Community comments | Manager reputation | Yes, core feature | **None — single-user by design** |
| Tracks user's OWN forecast accuracy over time | No | No | No | No | **Yes — prediction book + Brier score** |
| Reconciles actions against user's own stated rules | No | No | No | No | **Yes — Sunday ritual, Screen 2** |
| Explainability of every number | Partial | High (raw formulas visible) | Low (managed black box) | Low (indicator black box) | **High — one-line causal chain required** |
| Charting depth | Basic | None | None | **Best-in-class** | Minimal, not a priority |
| Fundamental data depth/history | High | **Highest** | N/A | Low | Low (news-derived only) |
| Monetization pressure shaping what's shown | Yes (PRO upsell, ads) | Some (PRO tier) | Yes (basket fees) | Yes (subscription tiers) | **None — no business model, no incentive to overstate anything** |

---

## The actual moat

Feature-by-feature, jarvis loses on data depth (Screener), charting
(TradingView), execution convenience (smallcase), and broker integration
polish (Tickertape) — all four gaps are real and mostly permanent, not
backlog items a future sprint quietly closes. Pretending otherwise would
be exactly the kind of overclaiming Session #1's attack catalog was
written to avoid.

**The one axis where jarvis isn't just smaller, it's different in kind:**
all four competitors are businesses whose revenue depends on attention,
AUM, or subscription retention. Their incentive, structurally, is more
usage, more alerts, more upsell surfaces, more reasons to reopen the app.
None of them can build "silence is a valid output" as a headline feature
— it would cannibalize their own engagement metrics. None of them can
build a Sunday ritual that ends by asking "did you follow your OWN
rules" — that's a feature that actively reduces trading frequency, which
for smallcase and TradingView (transaction/subscription-volume businesses)
would be closer to a bug.

**jarvis has no monetization need, because it's built for one person.**
That's not a limitation being reframed as a virtue — it's the actual
structural reason the constitution's most distinctive articles (2, 3,
11, 13, 15) are commercially irrational for any of these four products
but exactly correct for a personal tool. The moat isn't "jarvis is
better at analysis" — Screener wins that outright. The moat is "jarvis
is the only one of these five tools with zero incentive to keep the user
uncertain, engaged, or trading more than their own stated rules call
for." That incentive alignment can't be bought or copied by a competitor
without them abandoning their business model.

**Concretely, what this means the user gets that no combination of the
four competitors provides**, even used together: a closed loop from
thesis → logged prediction → resolved outcome → calibration score →
behavioral review that asks "did you follow this," with zero party
in that loop benefiting from the user being wrong, anxious, or
overtrading. Tickertape+Screener+TradingView+a notebook app gets you
data, charts, and execution — it does not get you that closed
accountability loop, because none of them are designed to hold up a
mirror to the user's own track record on purpose.

---

## Anti-goals (explicitly NOT competing on these)

Stated plainly so a future sprint doesn't quietly scope-creep toward
"let's also do X because Tickertape has it":

1. **Not building charting to rival TradingView.** jarvis's percentile/
   impact displays and cross-currents bars are not chart replacements —
   they answer "how does this compare to today's corpus," not "what's
   the price pattern." No candlestick engine, ever, unless a specific
   sprint makes an explicit, reasoned exception.
2. **Not building fundamental-data depth to rival Screener.** jarvis's
   engine reads news text, not audited filings. It will never be a
   substitute for looking up actual financial statements, and no
   sprint should imply otherwise in its UI language.
3. **Not enabling one-click execution, ever, in any form** — not a
   "quick trade" button, not a broker deep-link, not a "buy this
   smallcase-style basket" feature. This is Article 2, and this
   session's smallcase comparison is the concrete cautionary example to
   cite if this is ever proposed.
4. **Not building social/community features.** No shared ideas, no
   crowd upvotes, no visible track records of other users — jarvis is
   single-user permanently, and Session #6's Sunday ritual specifically
   depends on the user only ever seeing their OWN calibration, never a
   crowd's, to avoid substituting social proof for self-knowledge.
5. **Not chasing real-time tick data, options chains, or intraday
   scalping tools.** jarvis's cadence (daily rollups, weekly ritual) is
   deliberately slower than the market's, matching Article 3's anti-
   urgency stance — a real-time options flow feature would be a direct
   contradiction of the tool's actual purpose.
6. **Not trying to acquire users or scale beyond one person.** This
   isn't a limitation to eventually outgrow — it's definitional. A
   multi-user jarvis would need accounts, cloud storage, and probably
   some monetization, all of which are the exact things Article 7 and
   this session's moat argument depend on NOT existing.

---

## What to steal anyway (legitimate ideas, wrong company to imitate)

Being opposed to a competitor's business model doesn't mean every
individual design choice they made is wrong. Three ideas worth taking
from tools jarvis otherwise shouldn't emulate:

- **From Screener**: the "show the formula, not just the number" ethic.
  jarvis already does this in principle (Article 6) — the concrete
  UX lesson is Screener's per-metric hover tooltip showing the exact
  calculation, which Session #12's UX language / Sprint 17's provenance
  drill-down should treat as the bar to clear, not just "we have a
  breakdown available somewhere."
- **From Tickertape**: the honesty of a single, prominent "as of [time]"
  timestamp on every data point on screen — small, cheap, and directly
  reinforces Article 4 ("says who, as of when") without adding any of
  Tickertape's engagement mechanics.
- **From TradingView**: nothing about the social layer, but the
  low-friction interaction model for annotating a chart (click, drag,
  label) is a genuinely good pattern for jarvis's own journal entry UI
  (Sprint 11) — annotating a specific decision should feel that fast,
  even though what's being annotated (a private thesis) and who sees it
  (nobody) are completely different.

---

## Summary

jarvis will never out-data Screener, out-chart TradingView, out-execute
smallcase, or out-integrate Tickertape, and Sprint planning should stop
quietly assuming those gaps close on their own. What jarvis has that
none of the four can copy without abandoning their own business model is
a closed, honest, single-user accountability loop with zero incentive to
keep the user uncertain or engaged. That's the actual product — not
"a lightweight version of these four tools," but the one tool in this
comparison set built entirely around a bet none of the four can afford
to make: that the user's real bottleneck isn't more data, it's a more
accurate model of their own past decisions.

---

**Remaining session: #10** (Sonnet/High) — Interview story: the 5-minute
demo arc, the opening line, and honest, rehearsed answers to "why no
ML/AI?" and "why vanilla JS, no framework?"
