# J.A.R.V.I.S — Threat Model

Formalized from Session #8's thinking output at Sprint 16 (hardening),
re-verified against the actual codebase as it stands after Sprint 15 —
every "what's there today" claim below was checked against real code,
not assumed from the original design. Where the plan and the build
diverged, this document follows the build.

**Ground truth this document accepts**: jarvis is a single-user personal
tool with no server-side authority, no accounts, no encryption-at-rest,
and a stated constitutional principle that financial data never leaves
the machine (Constitution Art. 7). Every boundary below is evaluated
against that baseline, not enterprise-SaaS expectations that don't apply
here.

---

## Boundary 1 — Browser extensions with page access

**What's there**: localStorage and IndexedDB hold the signal archive,
chat history, settings, portfolio, ledger, journal, predictions, goals,
EOD quotes, Nifty log, and Sunday-review history — all plaintext JSON.

**What an attacker gets**: any browser extension granted "read/write on
all sites" can read every key jarvis writes, including full trade
history, holdings, and cost basis. No client-side encryption scheme
changes this meaningfully — the decryption key would need to be
derivable by the same page the extension can also read.

**Mitigation status**: **accepted, not solved.** Recommend a dedicated,
extension-free browser profile for jarvis. This is now surfaced as a
one-time in-app notice (Sprint 16) — see `js/app.js`, `notifyBrowserProfile()`.

**Severity**: High impact (full financial history) if it happens, low
likelihood for a careful single user not installing random extensions.

---

## Boundary 2 — The local relay (`relay.js`)

**What's there today** (re-verified against `relay.js`): binds
`127.0.0.1` only, never `0.0.0.0`. Outbound fetches are gated by an
**exact-hostname whitelist** (`ALLOWED_HOSTS`, a `Set`, checked with
`===` — no substring/suffix match). Inbound CORS reflects the request's
`Origin` header only when it matches
`^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$` — never a wildcard,
never a non-local origin. GET-only, 2MB response cap, upstream response
headers are never forwarded to the client.

**What an attacker gets today**: nothing remotely — unreachable from
outside the machine. A malicious page in another tab attempting a
same-origin bypass via CORS reflection is blocked by the exact-origin
check.

**Status update (durability build)**: the relay now HAS write endpoints
(`GET`/`POST /store/<key>`) so irreplaceable data survives a browser-
profile wipe — and Boundary 2b's shared-secret-token requirement
shipped in the SAME change, not after, exactly as the original design
mandated. The write path is defended by:
1. A per-startup random token (`crypto.randomBytes(24)`), required on
   every `POST` via the `X-Jarvis-Token` header — a tab that can't read
   the token can't write. Wrong/missing token → 403 (verified by curl).
2. `GET /token` is exposed only to exact-localhost origins via the
   existing CORS reflection, so a page at `evil.com` can't read the
   token cross-origin, and its `POST` preflight (custom header) fails
   the same CORS check before the write ever fires.
3. A key allowlist + `^jarvis\.[a-z]+\.v\d+$` regex on `/store/<key>`
   — path-traversal shapes (`../`) and non-durable keys → 400 (verified
   by curl). Bodies are capped at 2MB and must parse as JSON.
`POST` is permitted ONLY on `/store`; every other route stays GET-only,
preserving the original proxy posture.

**Honest residual**: an attacker who ALREADY runs a server on a
localhost origin could read the token (it's a localhost origin) — but
that attacker already has local code execution and can read the disk
files directly, so the token isn't the weak link there. The token
reduces the threat from "any website in any tab" to "an attacker with
existing local execution," which is a genuine, bounded improvement, not
a claim of perfect protection.

**Severity**: Low. Read path well-defended (verified in code); write
path token-gated and allowlisted (verified by curl round-trip incl. the
403/400 rejection cases).

---

## Boundary 3 — LAN serving (proposed, not built)

**What's there**: nothing. Still unbuilt as of Sprint 16.

**What an attacker gets if built carelessly**: anyone on the same wifi
network could reach the full app, including financial data, if the
relay's bind address ever changed from `127.0.0.1`.

**Mitigation required if this is ever built**: a separate, explicitly
opt-in LAN mode; a token/PIN on every non-localhost request; prominent
"LAN access is ON" UI whenever active. **This must not be built as a
casual extension of relay work** — it needs its own design pass and its
own go/no-go decision.

**Severity**: currently zero (not built). High if built carelessly.

---

## Boundary 4 — OneDrive sync

**Status: RESOLVED, not merely accepted.** Session #8 originally
recommended two options — exclude the project from sync, or amend the
Constitution to accept the sync exposure. **The project was physically
relocated to `C:\jarvis`** (outside any cloud-sync folder), and
Constitution Article 7 was amended (Session #14) to record this as the
enforcement mechanism: *"the project directory lives outside any
cloud-sync folder... so this article is enforced by the filesystem
itself, not by policy discipline alone."*

**Relocated again**: the project now lives at
`C:\Users\Vedan\Downloads\Jarvis`. Verified before the move that
`Downloads` is a plain local folder, not OneDrive-redirected — no
Known Folder Move registry override exists for it (checked
`HKCU\...\User Shell Folders`), unlike `Documents`, which this
machine's OneDrive *has* redirected. So the boundary stays resolved;
only the concrete path changed. Verified post-move: `.git` and all
files moved intact, `node relay.js` starts and serves `/health` +
`/token` correctly from the new path (paths are `__dirname`-relative,
no hardcoded absolute paths existed in code).

This is the cleaner of the two original options — it closes the
exposure rather than accepting it. The residual risk is procedural, not
technical: **if the project is ever moved into a synced folder without
realizing it, this boundary reopens silently.** Article 7's amended
text exists specifically so a future session catches this before it
happens — the check that matters is "is the *current* location outside
sync scope," not "is it still at the original path."

**Severity**: Zero today. Would return to Medium if the project is ever
relocated into a synced folder again.

---

## Boundary 5 — Local file imports (CSV)

**What's there**: two CSV import flows now — the Zerodha tradebook
(Sprint 7, `Ledger.parseZerodhaCsv`) and the NSE bhavcopy (Sprint 12,
`Quotes.parseBhavcopy`). Both are **local parsing**, not a network
boundary.

**What an attacker gets**: not data exfiltration — a malformed or
adversarial CSV could crash the parser or inject bad data into the
ledger/quotes store.

**Status update since Session #8**: both parsers already **reject,
not silently coerce**, malformed rows (missing required columns,
non-finite prices, unparseable dates all increment a `skipped` counter
and are excluded — verified in both `ledger.js` and `quotes.js`, and
covered by test.html assertions). This satisfies the original
mitigation's spirit.

**Formula-injection escaping**: **not applicable** — no CSV *export*
feature exists anywhere in the codebase (only JSON backup export and
CSV *import*). The original concern (values that look like spreadsheet
formulas surviving an export round-trip) has no code path to exploit
yet. Revisit if a ledger CSV export is ever built.

**Severity**: Low — self-inflicted risk from the user's own files,
already validated on the way in.

---

## Boundary 6 — Multi-tab / multi-device write races

**Status: RESOLVED (Sprint 5.5).** `js/tabguard.js` implements
BroadcastChannel-based leader election — every tab announces its birth
time; the oldest live tab is the sole writer for shared, once-per-tick
state (the daily rollup). Verified live with two real browser tabs
during Sprint 5.5: the older tab correctly elected as writer, the newer
tab correctly deferred.

**Severity**: Resolved for the one shared-write path that existed at
the time (daily rollups). New shared-write paths added in later sprints
(ledger, goals, predictions, journal, EOD quotes, Sunday review) are
each single-record-append operations from user-initiated actions
(a click, a form submit) — the classic double-write race this boundary
describes doesn't apply to them the same way, since they're not
periodic background writes racing on a timer. Worth re-examining if any
future sprint adds another periodic/automatic background write.

---

## Boundary 7 — Third-party upstream sources (RSS, quotes)

**What's there**: the relay fetches from the exact-hostname whitelist
and returns content the app renders into the DOM. `GET /quote` (Yahoo
Finance chart API, Sprint 12) existed in `relay.js` since Sprint 12 but
had NO frontend caller until this pass wired `Quotes.syncLivePrices()`
to it — the reachable surface itself didn't change (the endpoint was
always live on `127.0.0.1:5510` regardless of whether the app called
it), only whether the legitimate app now exercises it routinely. Quote
responses are narrower risk than RSS text: pure JSON, type-checked
(`typeof meta.regularMarketPrice !== 'number'` rejects malformed
payloads before use) and rendered as a formatted number, never as HTML
— no escaping surface applies because nothing from it is ever injected
as markup.

**What an attacker gets**: if a whitelisted source were compromised,
the relay would faithfully proxy the content. `U.esc()` HTML-escaping
(verified applied to every rendered headline/title across `app.js`)
prevents stored XSS. The 2MB cap prevents memory exhaustion from an
oversized payload.

**Residual risk**: content-level, not code-execution — a compromised
source serving a fabricated headline that games the engine's
sentiment/impact scoring. This is Session #1's red-team territory
(the pump-and-dump and hype-detection guards), not a security-boundary
concern.

**Severity**: Low.

---

## Boundary 8 — Demo data URL parameter (new since Session #8, Sprint 13)

**What's there**: `?demo=true` triggers `App.maybeLoadDemoFromUrl()`,
which loads a frozen demo portfolio + ledger.

**What an attacker gets**: a crafted link with this parameter could, at
worst, either (a) load harmless fake demo data into a fresh install
with nothing to lose, or (b) if real data already exists, trigger a
confirmation dialog the user must actively click through — it can never
silently overwrite real data. No data exfiltration path exists; this is
purely a local-state-loading convenience feature.

**Severity**: Negligible — already gated at build time, not a
retrofit. Included here for completeness, since a threat model written
after new surface area ships should account for it explicitly rather
than only covering what existed when the document was first drafted.

---

## Summary table

| # | Boundary | Attacker gets | Status | Severity |
|---|---|---|---|---|
| 1 | Browser extensions | Full ledger/journal read | Accepted; dedicated-profile notice now shown in-app | High impact, low likelihood |
| 2 | Local relay (read) | Nothing (well-defended) | Mitigated, re-verified in code | Low |
| 2b | Local relay (write) | Ledger corruption from another local tab | **Built + defended** — per-startup token + exact-localhost CORS + key allowlist; 403/400 rejections verified by curl | Low |
| 3 | LAN serving | Full app exposed on home network | Not built; needs its own design pass if ever proposed | High if built carelessly |
| 4 | OneDrive sync | Ledger exposed via account compromise | **Resolved** — project relocated outside any synced folder | Zero today |
| 5 | CSV import (tradebook + bhavcopy) | Malformed data | **Resolved** — both parsers reject malformed rows, tested | Low |
| 6 | Multi-tab races | Data integrity, not confidentiality | **Resolved** for periodic writes (Sprint 5.5 TabGuard) | Low |
| 7 | Upstream sources | Content-level gaming | Mitigated (escaping, size cap); analytical risk is Session #1's territory | Low |
| 8 | Demo data URL param | Fake data load / confirmation-gated overwrite | Already gated at build time | Negligible |

---

## What changed at Sprint 16

- Restore drill performed live: exported a real backup covering all 11
  current data classes (settings, chat, portfolio, ledger, goals,
  predictions, journal, EOD quotes, Nifty log, Sunday review, signal-
  archive rollups), cleared `localStorage` entirely, re-imported through
  the exact same code path the real Import button uses, reloaded the
  page, and verified every module read its data back correctly with no
  data loss and no code changes needed. The generic `jarvis.*`-prefix
  export/import scan (built in Sprint 1) has held up across 15 sprints
  of new data classes without ever needing a per-sprint update — the
  right call, in retrospect, versus a hardcoded key list.
- Boundary 1's dedicated-browser-profile recommendation is now a real
  in-app one-time notice, not just a line in a document nobody reads.
- Every boundary's status was re-verified against actual code rather
  than carried forward from the original design intent — three
  diverged from plan (2b never built, 4 resolved differently than
  recommended, 6 resolved as scheduled) and are corrected above.

## Living-document note

This file should be re-checked, not just re-read, whenever a sprint
adds a new local-file-import flow, a new network boundary, or a new
shared/periodic write path — the pattern established this sprint
(verify against real code, correct divergences plainly, don't just
carry forward old claims) is the standard for future updates too.
