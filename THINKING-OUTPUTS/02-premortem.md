# Premortem — Session #2

**January 2028. jarvis is an abandoned folder.** Below is the honest postmortem
of why, written as if it already happened — ranked by how likely each cause
actually is given what's been observed building this project so far (not
generic startup-mortality tropes). Each cause inverts into a prevention that
fits the plan already in motion.

---

## 1. It died because building it never stopped being building it

**What happened**: Eighteen-plus sprints of engine, ledger, sonar, brain,
guardrails — the project stayed permanently "under construction." The user
kept adding scope (six rounds of thinking, each generating 10+ new ideas)
faster than any sprint shipped. There was always one more truth-layer
refinement before it felt "done enough to use daily." The daily-use habit
never formed because there was no stable version to form a habit around.

**Real evidence this is the #1 risk**: this conversation alone generated
5 rounds of "think more" that turned an 18-sprint plan into a richer but
larger plan, plus 15 more thinking sessions on top of that. The gravitational
pull here is toward more design, not more usage.

**Inversion**: A running tool beats a complete one. **After Sprint 6 ships,
declare a "use it for real for two weeks" checkpoint before touching Sprint
7** — no new sprint starts until the user has actually run the honesty panel,
the threat board, and cross-currents against real market days and found them
useful or found them wanting. If a two-week real-use period surfaces zero
"I wish it did X" moments, that's a signal the plan is over-designed relative
to actual need, not a signal to keep building blind.

---

## 2. It died because the agent-based build process is fragile across sessions

**What happened**: Sprint 5 was assigned to a background agent — twice — and
both times the parent session exited before the agent finished, silently
losing hours of work each time. Nothing caught this except a lucky manual
survey before relaunching. If this had gone unnoticed once (agent claims
"done," decisions doc never gets the entry, next sprint builds on
half-finished code), the codebase would have accumulated silent gaps that
compound — a Sprint 9 built atop a Sprint 5 that was 85% done, quietly wrong
in the missing 15%.

**Real evidence this is real, not hypothetical**: it happened twice, live,
in this exact conversation.

**Inversion**: **Never trust "agent reported done" — always require one
verifiable artifact per sprint**: either a passing test.html run witnessed
live, or a DECISIONS.md entry with actual numbers from a real check (not
just prose claiming success). Sprint 5's recovery worked because test.html
existed and could be run in node and produce a pass count — that pattern
(a runnable, numeric verification artifact) should be non-negotiable for
every future sprint, and background-agent sprints specifically should
checkpoint progress into a file mid-task, not just at the end, so a crash
loses minutes, not hours.

---

## 3. It died because OneDrive sync fought the filesystem

**What happened**: The project lives inside a OneDrive-synced folder. Git
operations, IndexedDB-adjacent file writes (relay-to-disk persistence
planned for Sprint 7), and rapid successive file edits during agent sessions
all raced against OneDrive's background sync daemon. At some point a
half-synced file, a "file in use" lock, or a sync conflict copy
(`filename-conflict.json`) silently corrupted the ledger — the single most
irreplaceable data class in the project — and nobody noticed until it was
too late to reconstruct months of trades.

**Real evidence this is plausible**: the project was *just* moved specifically
because it was nested inside a `6-sem-project` folder shared with an
unrelated e-commerce app — but it's still inside OneDrive's sync scope, and
Sprint 7's relay-to-disk plan writes financial JSON to a synced folder
without ever having addressed this.

**Inversion**: **Before Sprint 7's relay-to-disk lands, decide explicitly**:
either (a) exclude the ledger/journal/prediction files from OneDrive sync
(a `.` prefix folder or a OneDrive "always keep local" + sync-pause rule),
or (b) accept OneDrive as a free off-machine backup and add write-safety
(atomic write-to-temp-then-rename, never write-in-place) so a sync mid-write
can't corrupt the file. Either is fine; deciding neither is the failure mode.

---

## 3.5. It died because localStorage silently hit its ceiling mid-trade-entry

**What happened**: Chat history, signal archive, daily rollups, and
(Sprint 7+) ledger entries all compete for the same ~5–10MB localStorage
budget. On an ordinary Tuesday, a `QuotaExceededError` fired silently inside
a `try/catch` (the existing pattern in `store.js`'s `saveHistory` — "quota
exceeded — history just won't extend this tick, non-critical") while the
user was mid-entry on a real trade. The trade write silently failed. The
user believed it was logged. Three months later, the ledger's XIRR was
subtly wrong and nobody could tell why, because the missing entry left no
trace.

**Real evidence**: the exact silent-catch pattern already exists in
`store.js` today for non-critical data — the risk is that pattern gets
copied verbatim into a ledger write, where "non-critical" stops being true.

**Inversion**: **The honesty panel's quota meter (Session #7, Section E)
must be wired to a hard rule, not just a display**: any write to a
data class marked "irreplaceable" (ledger, journal, predictions) that hits
`QuotaExceededError` must surface a blocking, unmissable error — never the
silent-degrade pattern that's correctly used for archive/rollup data.
Different data classes need different failure philosophies; Sprint 7 must
explicitly choose "loud" for money data, not inherit "quiet" by copy-paste.

---

## 4. It died because the tool told the truth about itself, and the truth was unflattering

**What happened**: The honesty panel worked exactly as designed. The
horse-race lane (Sprint 12) ran for six months and showed the engine-driven
paper portfolio underperforming the index. The calibration curve (Sprint 11)
showed predictions poorly calibrated. Confronted with hard evidence that the
elaborate machine wasn't adding value, the user's engagement with the tool
dropped — not because it broke, but because it worked and delivered an answer
nobody enjoys hearing.

**Real evidence this is a genuine risk, not paranoia**: this is the intended,
designed behavior of the counterfactual ledger and calibration curve from the
thinking rounds — "the tool must be willing to say no." A tool that can
say "you'd have done better in an index fund" is, by design, a tool that can
make itself unpleasant to open.

**Inversion**: This one **should not be prevented** — it should be
**reframed as success, explicitly, in the tool's own copy.** If the
counterfactual shows underperformance, the honest framing isn't "the tool
failed" — it's "the tool did its job: it told you to stop paying an
attention-tax for no edge, and that's worth more than the money." Sprint 12's
UI copy for the horse-race lane should pre-write this framing now, before the
data ever says it, so the user isn't ambushed by an unplanned response to bad
news. A premortem's job here isn't to avoid the outcome — it's to make sure
the outcome doesn't read as failure when it's actually the tool succeeding.

---

## 5. It died because the sonar cried wolf and got muted

**What happened**: The anomaly sonar (Sprint 9) fired constantly in its
first month — thresholds fit to three weeks of unusually calm baseline data,
then a normal news cycle looked like anomalies everywhere. The user muted
it once out of annoyance. Muted notifications don't get re-enabled;
they get forgotten. By the time a real anomaly worth seeing occurred, the
channel was already dead.

**Real evidence**: this is a known failure mode of every alerting system
ever built, and the plan already has partial defenses (calibration gate,
median/MAD, calendar suppression) — the risk is those defenses being built
correctly in isolation but the interaction between them being wrong (e.g.
the calibration gate clears at day 21 exactly when a genuinely volatile
month starts, producing a wall of "post-calibration" alerts on day 22).

**Inversion**: The alert-outcome tracking idea from the earlier rounds
(fired → seen → acted, per alert type) needs a **teeth clause**: any alert
type with a sub-20% action rate over 30 days gets automatically demoted to
"log only" without asking permission, and the honesty panel says so out
loud. **Self-demoting alerts, not just self-tracking ones** — tracking alone
doesn't prevent the mute-and-forget death, only automatic demotion does.

---

## 6. It died because the entity/keyword dictionaries silently stopped matching reality

**What happened**: Two years on, new companies IPO'd, ministries got
renamed, scheme names changed with each budget, and slang shifted. Nobody
updated `JDATA.KEYWORDS`/`JDATA.COMPANIES`. The unclassified-residue metric
(Session #7, Section B) crept upward for months — but nobody looked at the
honesty panel because Failure Mode #4 had already reduced how often the
tool got opened. The engine kept running, kept looking confident, and kept
being wrong about an increasing share of the news.

**Real evidence**: rule-based systems don't crash when their assumptions
go stale — they degrade silently and keep producing confident-looking
output, which is worse than crashing.

**Inversion**: The two-click teach-flow (already in the amended Sprint 16
task) is necessary but not sufficient — **it only helps if someone's still
opening the tool.** Pair it with a scheduled, not opened-triggered check:
a monthly local reminder (calendar entry, not an in-app nag, respecting the
anti-engagement doctrine) to spend 10 minutes reviewing residue and adding
new entities. Put this literally on the user's actual calendar during
Sprint 16, not just in the app.

---

## 7. It died in a placement-interview demo, live, in front of the person who mattered most

**What happened**: The user demoed jarvis in an interview. A live "FETCH
LIVE" pull hit a source that had changed its RSS shape (a real, known risk —
"parsers silently degrade" is already flagged elsewhere in this plan). The
Intel feed came back empty on stage. No tour-mode/staged-demo-data fallback
existed yet because Sprint 13 (where it's scoped) hadn't shipped before the
interview happened, because sprint sequencing put demo-readiness late in
the plan relative to when actual interviews occur.

**Real evidence**: the current plan puts tour mode in Sprint 13 of 17 —
i.e., near the end — while placement interviews are a real, currently-active
concern for a sixth-semester student, on a timeline the sprint plan doesn't
know about and can't wait for.

**Inversion**: **Tour mode should not wait for Sprint 13.** A minimal
version — a hardcoded, frozen JSON snapshot of "good-looking" sample data
that the app can load instead of live/simulation feeds with one toggle —
is a half-day task, not a sprint. Build a bare-bones version of it
opportunistically, whenever an interview is actually scheduled, rather than
strictly waiting for its full sprint slot. This is the one item in the whole
plan where "build it exactly in sprint order" is the wrong call, because its
deadline is external and unpredictable, not internal to the project.

---

## Ranked summary (most to least likely to actually kill this project)

| # | Cause | Prevention | When to act |
|---|---|---|---|
| 1 | Perpetual building, never using | Two-week real-use checkpoint after Sprint 6 | After Sprint 6 ships |
| 2 | Silent agent-task failure compounding | Numeric verification artifact required per sprint, mid-task checkpointing | Every sprint, starting now |
| 3.5 | Silent quota failure on money data | Loud-fail rule for irreplaceable data classes | Sprint 7 |
| 3 | OneDrive sync corrupting the ledger | Explicit sync-exclusion or atomic-write decision | Before Sprint 7's relay-to-disk |
| 6 | Dictionaries rotting unnoticed | Calendar-scheduled review, not app-triggered | Sprint 16, but schedule now |
| 5 | Sonar crying wolf and getting muted | Automatic alert-type demotion, not just tracking | Sprint 9 |
| 7 | Demo fails at the interview | Minimal tour-mode built ad hoc before any real interview | As soon as an interview is scheduled |
| 4 | Tool tells an unflattering truth | Pre-written honest-success framing in UI copy | Sprint 12 |

The uncomfortable throughline: **five of these eight are about the human
side of the system — attention, sync habits, interview timing, alert
fatigue, muted honesty — not about the engine's math.** The math has had six
rounds of scrutiny already. The human-facing failure modes have had almost
none until this session.
