# Constitution v2 — Amendment Proposal (Session #14)

Per Article 12, only the human amends `CONSTITUTION.md` — this document is
a **proposal**, not a change. It re-reads the current 12 articles against
everything the six thinking rounds and prior sessions established, and
recommends: one factual update, four new articles, and one honest flag
that an existing article is under real strain and needs a decision, not
silent drift.

Current constitution reproduced for reference at the bottom of this
document. Nothing below assumes an amendment has been accepted until
you say so.

---

## Part A — Factual update to an existing article (not a policy change)

### Article 7 — "Data never leaves this machine"

**What changed since this was written**: the project has physically moved
from `OneDrive\Documents\jarvis\` to `C:\jarvis\`, specifically to make
this article **literally true** rather than aspirationally true. Session
#8's threat model had flagged a real tension — OneDrive's sync daemon
would have moved ledger/journal/prediction data to Microsoft's cloud the
moment Sprint 7 wrote it to disk, in direct violation of this article's
plain text. That tension is now resolved by the move, not by an exception
carved into the article.

**Recommended addition** (factual, not a loosening of the rule):

> 7. **Data never leaves this machine** except whitelisted public GET
>    requests (news RSS, quote/NAV endpoints). No accounts, no telemetry,
>    no cloud storage of personal data. *The project directory lives
>    outside any cloud-sync folder (OneDrive, Google Drive, Dropbox,
>    etc.) specifically so this article is enforced by the filesystem
>    itself, not by policy discipline alone. If the project is ever moved,
>    the destination must be verified non-synced before any ledger/journal
>    write lands there.*

This doesn't change what the article means — it records *why* the
directory lives where it does, so a future session (or a future you,
months from now) doesn't casually move the project back into a synced
folder without realizing that would silently reopen a closed threat.

**Also resolves**: Session #8's Boundary 3 (LAN serving) gets a cleaner
answer under this reading — LAN serving would be a *new*, deliberate
exception to Article 7, not an extension of existing behavior, and per
Article 12 it would need explicit human authorization the same way the
No-AI-APIs section already reserves for its own seam points. Recommend
this be stated explicitly if LAN serving is ever proposed for a sprint.

---

## Part B — New articles, proposed

### Proposed Article 13 — Witnesses, not gates

> 13. **The tool witnesses; it does not enforce.** Guardrails work by
>     making bypassed rules undeniable after the fact (reconciliation,
>     the Sunday review), never by blocking an action in the moment. A
>     user who wants to act against their own stated rules always can —
>     closing the tab and going to the broker directly is always
>     available and the tool does not pretend otherwise. This is
>     consistent with Article 2 (no buy buttons) but goes further: Article
>     2 says the tool never enables a bad action; this article says the
>     tool never *pretends* to prevent one it structurally cannot prevent.

**Why this earns constitutional status, not just a design note**: every
enforcement mechanism a single-user desktop tool could build (locks,
confirmations, cooldowns) is trivially bypassable by the same user it's
meant to help, and Session #2's premortem plus the Sprint 15 design
(Session #6's Sunday-review reconciliation) both concluded the only
honest design is after-the-fact witnessing. Writing this down prevents a
future sprint from reaching for a "gate" pattern (a blocking confirmation
dialog, a forced cooldown) out of habit, when the tool's actual philosophy
already rejected that approach for good reason.

---

### Proposed Article 14 — Data outlives the software

> 14. **Every irreplaceable data class exports to a format readable
>     without this tool.** Ledger → CSV. Journal → markdown. Predictions →
>     plain table. If jarvis is abandoned, the user should still hold a
>     complete, human-readable record of their trading history in files
>     any spreadsheet or text editor can open — not a proprietary blob
>     only this codebase can parse.

**Why this earns constitutional status**: Session #2's premortem
(cause: "graceful abandonment") and Session #13's data lifecycle audit
both treat this as load-bearing rather than a nice-to-have — a personal
project's most likely ending is abandonment, and whether that ending
leaves the user's trading history intact or trapped is a decision made
now, in the schema, not retrofittable later. This also gives teeth to
Article 10 ("delete before add") — a feature can be safely deleted only
if the data it was responsible for has already been proven exportable in
a form outliving the feature itself.

---

### Proposed Article 15 — Calm is measured, never rewarded

> 15. **The tool tracks engagement to reduce it, never to encourage it.**
>     No streaks, no badges, no completion percentages, no visual reward
>     for opening the app more often or logging more entries. Consistency
>     (journal entries, review completion) is *reported* in the Sunday
>     review, never gamified. If a metric could be mistaken for a
>     leaderboard, it doesn't ship.

**Why this earns constitutional status**: this extends Article 3 ("silence
is a valid output") from a passive constraint (don't auto-refresh, don't
manufacture urgency) into an active one (don't reward attention itself).
Article 3 as written stops the tool from creating false urgency; this
article stops it from creating false *engagement* — a subtler and, for a
tool literally designed to reduce compulsive market-checking, arguably
more important failure mode to rule out permanently. The anti-gamification
doctrine surfaced repeatedly across the thinking rounds and the Sunday
ritual design (Session #6) — it deserves to be load-bearing doctrine, not
an implicit habit that erodes the first time a "fun" feature is proposed.

---

### Proposed Article 16 — Maintenance has a budget, and features answer to it

> 16. **Steady-state upkeep of this tool must fit in ~30 minutes a week.**
>     Dictionary teaching, backup verification, journal entry, the Sunday
>     review itself — combined, not each. Any feature that demands
>     recurring manual grooming beyond this budget is redesigned to need
>     less, or cut. This is a hard constraint on scope, evaluated the same
>     way Article 10 evaluates unused features.

**Why this earns constitutional status**: this is the single check against
the scope-creep failure mode Session #2's premortem ranked as the #1 most
likely cause of death for this project — "it never stopped being under
construction" is a building-side failure, but its mirror on the
using-side is "it became a chore." A numeric budget, checked against every
new feature the same way Article 10 checks feature usage, is the only
thing that reliably catches this before a sprint ships something that
quietly costs the user 45 minutes a week they didn't sign up for.

---

## Part C — A flag, not a proposal: Article 8 is at capacity right now

**Article 8** reads: *"The sidebar holds six views, forever. New features
nest inside an existing view as a tab, section, or modal — never a seventh
nav item."*

**Verified against the actual codebase** (`index.html`): the sidebar
currently has exactly six nav items — Command Center, Intel Feed,
Patterns, Money Flow, Ideas Lab, My Money. **The article is not being
violated — but it is fully at capacity**, and the sprints ahead
(honesty panel, threat board, ledger UI, journal, prediction book, sonar,
alert center, brain, Sunday review) are a lot of substantial new surface
area, all of which must nest inside these six views per this article's
plain text.

This isn't a recommendation to change Article 8 — the constraint is a good
one, and loosening it at the first sign of pressure would be exactly the
kind of scope-creep Article 16 (proposed above) exists to prevent. It's a
flag that **the mapping of new features to existing views needs an
explicit decision now**, before six more sprints arrive assuming space
that may not obviously exist:

- Honesty panel, threat board → likely tabs inside **Command Center**
  (it's already the dashboard-of-dashboards view)
- Ledger, XIRR, net-worth history → tabs inside **My Money** (natural fit)
- Journal, prediction book, thesis kanban → tabs inside **Ideas Lab**
  (theses and predictions are downstream of ideas)
- Sonar, alert center → likely modal/panel inside **Patterns** (anomalies
  are a kind of pattern) or **Command Center** (as an alert tray)
- Brain (Sprint 10) → probably a persistent overlay/modal, not tied to
  any single view, since it should be queryable from anywhere
- Sunday review → a full-screen modal takeover, not a nav item — it's a
  ritual, not a place you navigate to and browse

**Recommendation**: confirm this mapping (or a better one) explicitly at
the start of Sprint 6, since it's the first sprint adding a genuinely new
category of UI (honesty panel, alert spine) rather than extending an
existing one.

---

## Summary table

| # | Change | Type | Status |
|---|---|---|---|
| Art 7 | Add factual note on non-synced directory + LAN-serving exception clause | Clarification, not a policy change | Recommend accepting |
| Art 13 (new) | Witnesses, not gates | New article | Recommend accepting |
| Art 14 (new) | Data outlives the software | New article | Recommend accepting |
| Art 15 (new) | Calm is measured, never rewarded | New article | Recommend accepting |
| Art 16 (new) | Maintenance budget (~30 min/week) | New article | Recommend accepting |
| Art 8 | No change proposed — flagged as at-capacity | Flag only | Needs a view-mapping decision before Sprint 6, not a constitutional change |

If accepted, the constitution grows from 12 to 16 articles. All four new
articles trace directly to a specific failure mode identified in an
earlier session (premortem, data lifecycle, or the Sunday ritual design) —
none are speculative additions; each is doctrine earned by something that
was actually found while building, matching this constitution's own
apparent standard (every existing article reads like it was written in
response to a real design decision, not adopted from a generic template).

---

## Appendix — Current Constitution (v1), for reference

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
