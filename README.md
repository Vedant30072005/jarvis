# J.A.R.V.I.S — Economic Intelligence

[![GitHub repo](https://img.shields.io/badge/GitHub-Vedant30072005%2Fjarvis-181717?logo=github)](https://github.com/Vedant30072005/jarvis)

A glassmorphism, Iron-Man-styled personal assistant for economics. It scans news,
connects patterns across independent sources, traces where big capital is moving,
drafts investment research theses, and manages a personal money ledger — with a
talking (Web Speech API) JARVIS chat dock.

## Run

Serve the repo root with any static server:

```
npx http-server -p 5500 -c-1 .
# → http://localhost:5500/
```

For live news and durability (disk backup of your ledger/portfolio),
also run `node relay.js` — see `HOW-TO-USE.md`.

## Views

| View | What it does |
|---|---|
| **Command Center** | Greeting, KPI tiles, sector radar sweep, top flows/patterns/ideas/intel |
| **Intel Feed** | Categorised, impact-ranked signals with entity tags + per-article JARVIS analysis |
| **Patterns** | Cross-source clusters with entity network graphs, momentum and story timelines |
| **Money Flow** | Every disclosed ₹/$ traced source → sector: bars, donut, ledger table |
| **Ideas Lab** | Machine-drafted theses with conviction rings, catalysts, risk registers, watchlist |
| **My Money** | Holdings ledger, allocation donut, SIP projector, cash engine, JARVIS insights |

## Data modes

- **SIM FEED** (default): a built-in demonstration dataset so the whole pipeline works offline.
- **FETCH LIVE** (Intel Feed): pulls real Google News RSS headlines through public CORS
  relays (allorigins → corsproxy → rss2json) and runs them through the same engine.
  Live headlines are escaped and treated as data only.

## JARVIS commands

`brief me` · `where is the money going` · `show patterns` · `top ideas` ·
`scan live news` · `add 10 HDFC Bank at 1700` · `sip 15000 for 15 years at 12%` ·
`what is FII` · `party protocol` · `help`

Voice input needs Chrome/Edge (Web Speech API). Toggle spoken replies with the
speaker icon in the top bar.

## Notes

- Portfolio/watchlist/budget live in `localStorage` only — nothing leaves the browser.
- Chart palette is colour-blind-safe and validated for the dark surface.
- `prefers-reduced-motion` and the in-app "Cinematic effects" switch disable heavy animation.
- **Everything here is research & education, not financial advice.**
