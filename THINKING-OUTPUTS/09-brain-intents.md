# Brain Intent Grammar — Session #9

Every question JARVIS's brain should be able to answer, mapped to the
computed facts that answer it and the exact citation format (link to the
panel + specific rows/numbers). Grounded in what's already computed by
Sprints 5–12: clusters, ideas, flows, ledger, holdings, quotes, journal,
predictions. No open-ended NLP — every answer cites its sources and links
to panels so the user can verify the claim one click away.

Organized by category with the 80/20 set (~18 intents) marked as core.
Remaining intents are valid but lower-traffic (edge cases, nuanced
variations).

---

## Category 1: Market Status & Narratives (Core: 5/7)

### **Core 1.1: "What's hot right now?"** [CORE]
**Intent template**: "What sectors / companies are the engine flagging as momentum clusters right now?"
**Data source**: `Engine.clusters`, filtered `momentum > percentile(50)`, sorted descending
**Citation format**: "Defence × HAL: conviction 78, 12 signals across 5 sources in the last 48h. [→ Intel Feed]"
**Linked panel**: Intel Feed, filtered to that sector
**Follow-up clarity**: "Hot by what metric?" → momentum (signal recency + impact), or conviction (breadth + flow)?

### **Core 1.2: "What's contested?"** [CORE]
**Intent template**: "Which sectors have both bullish and bearish signals right now?"
**Data source**: `Engine.clusters`, filtered where `bull > 0 AND bear > 0`, sorted by `min(bull, bear) / max(bull, bear)` (tie-closeness)
**Citation format**: "Banking: 8 bullish, 7 bearish signals. Contested. [→ Cross-Currents View]"
**Linked panel**: Cross-Currents (the split-fill bar view from Session #12)

### **Core 1.3: "What should I be worried about?"** [CORE]
**Intent template**: "What sectors are bearish, and why?"
**Data source**: `Engine.ideas` filtered `kind == 'caution'`, sorted by conviction descending
**Citation format**: "CAUTION: Banking sector. Conviction 71. Rising deposit stress + NIM pressure from rate regime. Catalysts: [headline 1], [headline 2]. [→ Threat Board]"
**Linked panel**: Threat Board (or the caution ideas in the main feed)

### **1.4: "What's the bull case for X?"** [non-core, higher-intent search]
**Intent template**: "Show me the bullish cluster for [sector]."
**Data source**: `Engine.ideas` filtered `kind == 'long' AND sector == X`; if exists, show the cluster's narrative + top items
**Citation format**: "[Sector] — Conviction 82. [Narrative]. Bullish signals: [count], bearish: [count]. [→ Intel Feed, sector filter]"
**Fallback**: if no active cluster, "No current bullish momentum on [sector]."

### **1.5: "What bearish signals should I know about in X?"** [non-core]
**Intent template**: "What's the bear case for [sector]?"
**Data source**: `Engine.items` filtered `sector == X AND senti == 'bear'`, sorted by impact descending
**Citation format**: "[Sector]: 3 bearish signals in the last 48h. Most impactful: '[headline]' (source: [source], [grade badge]). [→ Intel Feed]"

---

## Category 2: Holdings & Personal Impact (Core: 4/5)

### **Core 2.1: "How does [sector/company] affect MY portfolio?"** [CORE]
**Intent template**: "Show me my exposure to [sector/company] and current P&L."
**Data source**: `Portfolio.holdings`, filtered by sector/company; paired with latest quote for P&L
**Citation format**: "You hold: 100 units of HAL @ ₹1,450 avg cost. Current value: ₹1,580 (+₹13,000, +9%). [→ Portfolio View]"
**Linked panel**: Portfolio, scrolled/filtered to that holding
**Caveat**: if that sector/company has an active bearish cluster, append: "+ Bearish momentum: [caution idea]. Consider [risk] [→ Threat Board]"

### **Core 2.2: "What's my worst-case sector?"** [CORE]
**Intent template**: "Which of my holdings is in the most bearish cluster?"
**Data source**: `Portfolio.holdings` × `Engine.clusters` (left join on sector), filter for bear > bull, sort by (user's $ exposure) × (cluster bear-mass) descending
**Citation format**: "Banking (₹2.5L exposure): bearish momentum. 7 bear signals, 1 bull. Estimated exposure to [risk]. [→ Portfolio + Threat Board]"

### **Core 2.3: "How much of my portfolio is in bullish calls right now?"** [CORE]
**Intent template**: "What % of my capital is in sectors with active long ideas?"
**Data source**: sum(`holdings[sector] where sector in active_long_ideas`) / total_portfolio
**Citation format**: "42% of your portfolio is in active long ideas (Defence, IT, Energy). Conviction range: 65–82. [→ Portfolio breakdown]"

### **2.4: "Am I overweight in any sector?"** [non-core]
**Intent template**: "How does my sector allocation compare to the index?"
**Data source**: needs Nifty 50 sector weights (Sprint 12 availability); compare user allocation vs index
**Citation format**: "You're 25% in Banking (Nifty: 18%). Overweight by 7pp. [→ Portfolio Allocation]"
**Availability gate**: requires Sprint 12's live index weights

### **Core 2.5: "What if [sector] drops 10%? What's my portfolio impact?"** [CORE]
**Intent template**: "Show me portfolio sensitivity to a [sector] move."
**Data source**: `Portfolio.holdings[sector] * 10%` (rough; ideally uses correlation if available)
**Citation format**: "If Banking drops 10%: your portfolio down ~₹25,000 (−1.8%). Exposed via HDFC (₹2L), ICICI (₹1.2L). [→ Scenario card]"
**Linked panel**: Scenario Cards (Sprint 14)

---

## Category 3: Predictions & Calibration (Core: 3/4)

### **Core 3.1: "What predictions do I have open?"** [CORE]
**Intent template**: "Show my active predictions and their resolution dates."
**Data source**: `Journal.predictions` filtered `resolved == false`, sorted by resolution_date ascending
**Citation format**: "[Prediction]: 'Defence stocks beat index by 12% by EOY.' Probability: 72%. Resolve by: Dec 31. Days left: 165. [→ Prediction Book]"

### **Core 3.2: "How calibrated am I? What's my Brier score?"** [CORE]
**Intent template**: "How accurate have my past predictions been?"
**Data source**: `Journal.predictions` filtered `resolved == true`; compute Brier score, calibration curve
**Citation format**: "Brier score: 0.18 (N=23 resolved predictions). You're well-calibrated in [sector]. Overconfident in [other sector]. [→ Calibration Curve]"
**N-gate**: below N=10 resolved, return "Too few resolved predictions yet" (Session #5 rule)

### **3.3: "What was I predicting about [sector] 3 months ago? Was I right?"** [non-core, investigative]
**Intent template**: "Historical prediction re-examination."
**Data source**: `Journal.predictions` filtered `sector == X AND created < now() - 3mo AND resolved == true`
**Citation format**: "[Old prediction]: '[text]' resolved [pass/fail]. You said [prob]%, actual outcome [0/1]. [→ Journal, filtered]"

### **Core 3.4: "What predictions are coming due soon?"** [CORE]
**Intent template**: "Which of my predictions need to be resolved in the next week?"
**Data source**: `Journal.predictions` filtered `resolution_date in next 7 days AND resolved == false`
**Citation format**: "[Prediction]: due [date]. '[text]'. [→ Prediction Book, scroll to due-dates]"

---

## Category 4: Risk & Hedging (Core: 2/4)

### **Core 4.1: "What's my biggest single-stock risk?"** [CORE]
**Intent template**: "Which one holding would hurt the most if it crashed?"
**Data source**: `Portfolio.holdings` sorted by `current_value` descending, filtered to top 1
**Citation format**: "HAL (₹2.8L): 16% of portfolio. If it dropped 20%, down ₹56,000 (−4%). Currently in bullish cluster. [→ Portfolio view]"

### **Core 4.2: "How much of my portfolio is hedged?"** [CORE]
**Intent template**: "What % of my capital is in defensive positions (gold, cash, bonds, or caution-idea sectors)?"
**Data source**: sum(`holdings[sector] where sector in [gold, cash] OR in_caution_ideas`) / total
**Citation format**: "Hedged: 18% (Gold ₹1.2L, Cash ₹800K). Unhedged: 82%. [→ Portfolio breakdown]"
**Availability**: gold and cash need to be entered as holdings (user responsibility)

### **4.3: "What's my worst-case portfolio value if the market crashes 20%?"** [non-core, scenario]
**Intent template**: "Stress test my portfolio."
**Data source**: requires correlation matrix (Session #12 availability); apply 20% market shock
**Citation format**: "Market down 20%: estimated portfolio down 18% (correlation = 0.9). Estimated value: ₹82L [from ₹100L]. [→ Scenario stress cards]"
**Availability gate**: Sprint 14+

### **4.4: "Which of my positions would do best in a defensive regime?"** [non-core]
**Intent template**: "If the market turns risk-off, what am I well-positioned for?"
**Data source**: `Portfolio.holdings` × correlation to VIX (inverse correlation = defensive); or filter by sector (gold, pharma, FMCG defensive bias)
**Citation format**: "Defensive positions: Gold (₹1.2L), Pharma (₹800K). Anti-correlation to VIX makes them upside in risk-off. [→ Portfolio + Regime indicator]"

---

## Category 5: Performance & Edge (Core: 2/5)

### **Core 5.1: "How am I doing vs the index? Am I beating or lagging Nifty?"** [CORE]
**Intent template**: "What's my alpha / outperformance vs the benchmark?"
**Data source**: `Portfolio.currentPnL - Nifty50PnL` (both from start of comparison period); or XIRR comparison
**Citation format**: "YTD: your portfolio +18%, Nifty +14%. Outperforming by +4pp. Over 3y: +12.5% XIRR vs index +9%. [→ Counterfactual lane]"
**Caveat**: "This outperformance includes survivorship of your picks; it doesn't account for timing skill vs luck." (honesty)

### **Core 5.2: "What's my edge? Am I making smart decisions or just lucky?"** [CORE]
**Intent template**: "Decompose: skill vs luck in my trading record."
**Data source**: Brier score on predictions (calibration), hit-rate on long ideas vs caution ideas, consistency of edge across sectors
**Citation format**: "Your long ideas hit 58% of the time (N=12). Statistically above coin-flip [link to confidence interval from Session #5]. But concentrated in Defence (overfitting risk). [→ Hit-rate table]"
**Nuance**: "This is early-stage data (only 3 months). Keep a journal to track this over time. [→ Prediction book]"

### **5.3: "What's my Sharpe ratio? Risk-adjusted returns?"** [non-core, advanced]
**Intent template**: "Return per unit of volatility."
**Data source**: daily P&L history; compute Sharpe = (avg_daily_return) / (std_dev_daily_return)
**Citation format**: "Sharpe: 0.8 (N=250 trading days). Nifty Sharpe: 0.6. You're taking smarter risks. [→ Performance dashboard]"
**Availability gate**: Sprint 12+ (need quote history)

### **5.4: "Do I have an edge or am I just following the crowd?"** [non-core, self-awareness]
**Intent template**: "Are my ideas independent or reacting to media narratives?"
**Data source**: correlation between your journal thesis dates and media-signal-cluster dates; independently-timed ideas =\= crowd-following
**Citation format**: "42% of your active predictions predate major media surges on that sector. You may have a timing edge. [→ Journal + Intel feed timeline]"

### **5.5: "How often do I trade? Am I churning?"** [non-core, behavioral]
**Intent template**: "Trade frequency and turnover ratio."
**Data source**: `Ledger.events` filtered to buys+sells; count per month, compute turnover = (sum of sells) / avg_portfolio_value
**Citation format**: "Last 90 days: 12 trades (5 buys, 7 sells). Turnover: 12%. Low activity (90-day hold average). [→ Trading journal stats]"

---

## Category 6: Behavior & Discipline (Core: 1/3)

### **Core 6.1: "Did I follow my own rules this week?"** [CORE]
**Intent template**: "Guardrails check: how many rule-breaks did I have?"
**Data source**: reconciliation of `Journal.theses` (stated before trade) vs `Ledger.trades` (actual); any trade without a prior thesis = rule break
**Citation format**: "This week: 3 trades. Theses logged beforehand for all 3. No rule breaks. ✓ [→ Sunday review]"
**Mirror feature tie**: this is Season #15's "witnesses not gates" reconciliation engine

### **6.2: "Am I overthinking? How much do I change my mind?"** [non-core, behavioral]
**Intent template**: "Prediction edits, trade reversals, thesis rewrites."
**Data source**: `Journal.predictions` with edit history; `Ledger.corrections` count; exit-within-N-days on entry
**Citation format**: "Last month: 8 predictions, 2 edited before resolution (25%). 3 trades exited within 2 days of entry. Possible overthinking in [sector]. [→ Journal analysis]"

### **6.3: "What's my biggest blind spot?"** [non-core, hard]
**Intent template**: "Where am I most overconfident or absent?"
**Data source**: sectors you have zero holdings in despite high media attention; probability predictions where your Brier score is worst
**Citation format**: "You have zero exposure to Semis despite 8 bullish clusters this year. FOMO signal? Or intentional avoid? [→ Portfolio coverage]"

---

## Category 7: Operational / System (Non-core: 4/4)

### **7.1: "Is the engine working? Are my signals accurate?"**
→ Covered by Session #5 (hit-rate tables, grading methodology). Brain can surface these but doesn't compute them.

### **7.2: "What data is stale? What's the engine's confidence?"**
→ Covered by Session #12 (UX language of uncertainty, as-of timestamps, calibration states).

### **7.3: "Should I import my Zerodha trades?"**
→ Operational prompt, not a Q&A. Brain can surface this as a nudge when the ledger hasn't been updated in 30+ days, linking to the CSV import UI.

### **7.4: "Should I export my data for backup?"**
→ Similarly, nudge when last export was >30 days ago. Link to export button.

---

## The 80/20 set (recommended core intents for Sprint 10)

Intents marked `[CORE]` above — these 18 cover the vast majority of
question types:

1. What's hot right now?
2. What's contested?
3. What should I worry about?
4. How does [sector/company] affect my portfolio?
5. What's my worst-case sector?
6. How much of my portfolio is in bullish calls?
7. What if [sector] drops 10%?
8. What predictions do I have open?
9. How calibrated am I?
10. What predictions are coming due?
11. What's my biggest single-stock risk?
12. How much of my portfolio is hedged?
13. How am I doing vs the index?
14. What's my edge?
15. Did I follow my own rules this week?
16. What's my worst-case portfolio in a crash?
17. How much do I trade?
18. Am I beating Nifty?

Intents 1–12 and 13–18 form a natural hierarchy: (1–3) current
market status, (4–7) personal impact, (8–10) predictions/calibration,
(11–12) risk, (13–18) performance/behavior. A brain that nails these 18
leaves the user few unasked questions; the remaining 12 are elaborations
for users who dig deeper.

---

## Implementation notes for Sprint 10

- **Each intent is one arrow: intent → data source → panel link.** The
  brain's job is to pattern-match the user's natural language to a
  canonical intent, then execute the mapping. No synthesis beyond what the
  mapping provides.
- **Every answer cites its panel.** The brain is a discovery tool for the
  data the user already has, not a summary tool that tries to replicate
  it. "See the Threat Board for details" beats trying to inline a
  mini-threat-board in a text response.
- **Fallbacks for insufficient data**: If N < 10 for a statistical claim,
  return "not enough data yet; come back after [date]" rather than
  overstating certainty.
- **Rank answers by recency**: if multiple sectors match a query, show
  the most-recently-mentioned one first (most signal activity).
- **Built-in caveats**: e.g., "you're beating Nifty, but your sample is
  only 3 months" — honesty about sample size and confounds is part of
  every answer, not a separate "advanced mode."
