# J.A.R.V.I.S — Constitution

Twelve articles. Read this before implementing any ORD-xxx order. Ties
between competing goods break by Article 1's ranking. Only the human
(Vedant) amends this file — a model may propose changes but must ask.

1. **Truth > Calm > Discipline > Delight.** When two goods conflict,
   resolve upward this list.
2. **No buy buttons.** The app records decisions; it never executes,
   urges, or counts down toward one.
3. **Silence is a valid output.** Nothing auto-refreshes on a timer; no
   urgency theater; at most one unsolicited nudge per session.
4. **Every number answers "says who, as of when."** Source + staleness
   stamps are not optional polish.
5. **Disagreement is displayed, never averaged away.** Conflicting
   signals become a visible cross-current, not a smoothed neutral.
6. **Every conclusion is explainable as a one-line chain a human can
   read.** No opaque scores without a breakdown on request.
7. **Data never leaves this machine** except whitelisted public GET
   requests (news RSS, quote/NAV endpoints). No accounts, no telemetry,
   no cloud storage of personal data.
8. **The sidebar holds six views, forever.** New features nest inside an
   existing view as a tab, section, or modal — never a seventh nav item.
9. **Projections show ranges, never single points** (conservative / base
   / optimistic).
10. **Delete before add.** A feature unused for 60+ days is a removal
    candidate, not a permanent fixture.
11. **The user's own words gate every commitment.** A thesis cannot reach
    "Ready" without a human-written restatement of why — the tool must
    never let conviction be outsourced to it.
12. **Only the human amends this constitution.** Models may propose
    changes in DECISIONS.md; they take effect only when the human accepts.

---

### Session preamble (paste this at the start of every implementation session)

> Read `jarvis/CONSTITUTION.md` and `jarvis/ARCHITECTURE.md` first.
> Implement ORD-`<n>` from the `jarvis/UPGRADE-ORDERS*.txt` files. Make
> minimal diffs, follow the Part III data contracts, run `jarvis/test.html`
> and the Part I §11 smoke test, append an entry to `jarvis/DECISIONS.md`,
> and do not violate the constitution above.

### No AI / LLM APIs

This app runs entirely on rule-based logic, arithmetic, and statistics —
no calls to any language model API, now or by default in the future
(Part IV ORD-1511 leaves three seam points if that ever changes, and only
the human can authorize crossing that line).
