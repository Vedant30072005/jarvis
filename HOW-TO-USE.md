# How to Use J.A.R.V.I.S

A rule-based personal trading/investment intelligence dashboard. No AI
APIs, no accounts, no cloud — everything lives in this browser
(`localStorage`/IndexedDB) plus one optional local relay for real news.
Open `index.html` directly, or run `node relay.js` first for live
headlines and real NSE quotes.

## The six views

| View | What it's for |
|---|---|
| **Command Center** | The daily situation report — sector radar, top flows, top patterns, top ideas, high-impact intel, the Honesty Panel (is today's data thin or solid?), and the Threat Board (active bearish clusters). |
| **Intel Feed** | Every signal, ranked by impact, with an evidence grade (A/B/C/D — click any impact number to see the formula) and a confirmation chip. Hype-flagged items are quarantined, not hidden. |
| **Patterns** | Corroborated clusters, Cross-Currents (sectors with genuine bull/bear disagreement — never averaged away), the Anomaly Sonar, and the **Scenario Stress Test** — pick a macro shock (crude, rates, rupee, VIX, monsoon…) and it propagates one step through 73 signed/lagged causal edges to your actual holdings, showing which sectors are favoured vs pressured. Direction only, no magnitude, no feedback loops — an honest single-step estimate. |
| **Money Flow** | Every disclosed rupee, traced from source to destination sector. |
| **Ideas Lab** | Machine-drafted research theses (never orders — see the disclaimer on that view), your Prediction Book (with a real Brier score once you've resolved 15+), and your Journal. |
| **My Money** | Holdings, a real trade ledger (import a Zerodha CSV) with XIRR, EOD price sync (NSE bhavcopy import), a Nifty counterfactual, Goals, and a tax estimator. |

## Getting real data in

- **Live news**: click FETCH LIVE in Intel Feed. Works better with the
  local relay running (`node relay.js`) — falls back to public CORS
  proxies otherwise, then simulation.
- **Your trades**: My Money → Trade Ledger → Import CSV (a Zerodha
  tradebook export).
- **EOD prices**: My Money → EOD Quotes → Import Bhavcopy (the standard
  daily NSE equity-close file).
- **Demo data**: My Money → Load Demo Book, or open with `?demo=true`
  in the URL — loads a frozen sample portfolio + ledger. Never
  overwrites real data without asking first.

## The weekly ritual

Click the clock icon (top right) for the **Sunday Review** — a
calibration check, not a performance review. Walks through this
week's trades, whether you logged a thesis before each one, overdue
predictions (must resolve to continue — the one place this ritual has
real teeth), blind spots, alert health, calibration, and closes with
one commitment for next week. Download the markdown memo at the end.

## Talking to JARVIS

Open the chat dock (bottom right / the chat icon) and ask things like
*"why is the Nifty up today"* (real index levels through the relay,
plus the day's highest-impact signals — it shows what moved and what
was reported, and says plainly that it can't prove which caused which;
with the relay off it refuses to quote a level rather than read out the
simulated tape), *"what's hot right now"*, *"what should I worry
about"*, *"how's HAL doing"* (your own qty, value, P&L and real
headline mentions of that
name — not just its sector, and it says plainly if you don't hold it),
*"what if defence drops 15%"*, *"what's my
biggest single-stock risk"*, *"how much of my portfolio is hedged"*,
*"am I beating the Nifty"*, *"how often do I trade"*, *"did I follow my
own rules this week"*, *"how calibrated am I"*, *"brief me"*, or
*"where is the money going"*, *"compare banking vs defence"*,
*"is my portfolio sitting in any contested sectors"* (connects a real
Cross-Currents disagreement directly to your own holdings — a
composed insight none of the single-topic questions surface on their
own), or *"give me the morning briefing"* (now includes that same
cross-referenced read automatically). The brain understands sectors and all 64
tracked company names/symbols (one-typo tolerant — "relianc" still
works), and remembers the last sector you named, so "…and the bear
case?" works as a follow-up — it always says when it's assuming. Pure
lexicon matching, no AI. Every answer either cites a real number with
a panel link, or says plainly that it doesn't know — it never
fabricates a middle ground. When it misses entirely, it offers "did
you mean" chips — clicking one teaches it your phrasing permanently
(stored locally, reversible, zero AI: a user-curated alias table).
Anything it can't even guess at lands in the Sunday review as "queries
I couldn't answer," which decides what gets built next.

## Where things are explained

- **`CONSTITUTION.md`** — the 16 design principles this tool won't break.
- **`DECISIONS.md`** — why each sprint was built the way it was, including bugs caught and scope deliberately cut.
- **`THREAT-MODEL.md`** — every trust boundary, honestly graded.
- **Settings (gear icon)** — voice, effects, privacy blur (hides rupee amounts, hover to reveal), backup export/import, USD/INR rate.

## Durability — don't lose your ledger

By default everything lives in this browser's storage, which a
profile wipe or "clear site data" can erase. Run the relay
(`node relay.js`) and JARVIS automatically mirrors your irreplaceable
data — ledger, journal, predictions, goals, portfolio, Sunday
commitments — to disk files in `data/`. If your browser storage is
ever wiped, just reload with the relay running and it all comes back.
The relay writes are protected by a per-startup token so no other tab
can tamper with your files. Without the relay, nothing changes —
still works, still local, just no automatic disk backup (use Settings
→ Export for a manual one). The `data/` folder is git-ignored; never
commit it.

## Privacy, in one line

Everything stays on this machine except whitelisted GET requests for
public news/quotes. A dedicated, extension-free browser profile is
recommended (shown once on first boot) — see `THREAT-MODEL.md`,
Boundary 1, for why.

## The market tape (LIVE vs SIM)

The ticker across the top used to be a pure simulation — seeded values
nudged by a random walk every few seconds. Those prints looked exactly
like real quotes, and had drifted the Nifty ~2,200 points away from the
actual index. It now pulls **real** index, FX and commodity quotes
through the relay (`node relay.js`) and tells you which mode it is in:

- **LIVE** badge — real quotes, refreshed every 60s; hover any value for
  its as-of time. Live values are never touched by the random walk.
- **SIM FEED** badge — the relay isn't running, so the tape falls back
  to seeded values and dims any cell it can't quote for real.

Gold is quoted **$/oz**, not ₹/10g, on purpose: the international spot
price it maps to sits below the duty- and GST-inclusive Indian domestic
price, so labelling it in rupees would be false precision.
