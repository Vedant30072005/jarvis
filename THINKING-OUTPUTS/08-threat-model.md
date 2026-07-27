# Threat Model — Session #8

Every trust boundary jarvis crosses, what an attacker positioned at each
boundary actually gets, what's already mitigated, and what's consciously
accepted rather than solved. Grounded in the real `relay.js` (127.0.0.1-only
bind, exact-hostname outbound whitelist, origin-reflected CORS for
localhost/127.0.0.1 only — verified in code, not assumed) and the planned
Sprint 7 relay-to-disk writes, Sprint 13 possible LAN serving, and the
OneDrive-sync exposure already flagged in the premortem (Session #2).

**Ground truth this document accepts**: jarvis is a single-user personal
tool with no server-side authority, no accounts, no encryption-at-rest, and
a stated constitutional principle that financial data never leaves the
machine (Constitution Art. 7). Every boundary below is evaluated against
that baseline, not against enterprise-SaaS expectations that don't apply
here.

---

## Boundary 1 — Browser extensions with page access

**What's there**: localStorage and IndexedDB, holding signal archive,
chat history, settings, and (from Sprint 7) the transactions ledger,
journal, and predictions in plaintext JSON.

**What an attacker gets**: any browser extension granted "read/write on
all sites" — a malicious or compromised extension, not a targeted attack —
can read every localStorage key and IndexedDB record jarvis writes,
including full trade history, holdings, and cost basis. Vanilla JS run in
a normal browser tab has no meaningful defense against this; encrypting
client-side with a key that must itself live somewhere accessible to the
same page doesn't remove the extension's access, it just adds complexity
without closing the boundary.

**Mitigation status**: **accepted, not solved.** No client-side encryption
scheme changes this threat model meaningfully, because the decryption key
would need to be derivable by the same page the extension can also read.

**What we actually do about it**: document the boundary explicitly (this
document) and recommend a **dedicated, extension-free browser profile**
for jarvis — a Chrome/Edge/Firefox profile with zero installed extensions,
used only for this tool. This is a real, effective mitigation (most
extension-based data theft targets the browser profile a user already has
everything installed in) and costs the user nothing to adopt. Surface this
recommendation in the app itself (a one-time banner or a settings-page
note), not just in a doc nobody reads.

**Severity**: High impact (full financial history) if it happens, but low
likelihood for a careful single user who isn't installing random
extensions — acceptable given the alternative (client-side crypto theater)
provides no real protection.

---

## Boundary 2 — The local relay (`relay.js`)

**What's there today** (verified in code): binds `127.0.0.1` only, never
`0.0.0.0` — confirmed unreachable from the LAN or wifi. Outbound fetches
are gated by an **exact-hostname whitelist** (not a substring/regex match —
deliberately, per the code comment, to prevent a bypass like
`news.google.com.attacker.io` matching a careless `.includes()` check).
Inbound CORS reflects the request's `Origin` header only when it parses as
exactly `http(s)://localhost(:port)` or `http(s)://127.0.0.1(:port)` —
never a wildcard, never a non-local origin. GET-only, 2MB response cap,
never forwards upstream headers back to the client.

**What an attacker gets today**: nothing remotely — the relay is
unreachable from outside the machine. The realistic attacker here is a
**malicious website open in another tab** on the same machine, attempting
a same-origin-policy bypass via the relay's own CORS reflection. Because
the origin-check regex is exact (`^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$`),
a page at `https://evil.com` cannot get the relay to reflect its origin —
the browser's CORS enforcement blocks the response from being readable.
The relay is doing the right thing today.

**What changes at Sprint 7 (relay-to-disk writes)**: once the relay can
**write** files (the ledger, per the amended Sprint 7 scope), the threat
changes shape. Any process on the same machine that can reach
`127.0.0.1:<port>` — not just the jarvis browser tab, but *any* local
process, including a malicious script running in a completely unrelated
browser tab that happens to guess or scan the port — could potentially
issue a write request if there's no additional authentication. Read-only
relay endpoints (quotes, RSS) are low-stakes if abused (worst case:
someone else's tab fetches a stock quote through your relay). A **write**
endpoint that can be triggered by any local origin is a materially
different risk: it could corrupt or inject fake data into the ledger.

**Mitigation required before Sprint 7 ships write endpoints**: a **shared
secret token**, generated on relay startup, written to a file only the
jarvis app reads (e.g., a `.jarvis-token` file in the project directory,
read via a `fetch` from the app on load — never hardcoded, never logged),
and required as a header on every write request. This is not
enterprise-grade auth — it's a shared-secret handshake between the one
legitimate client and the relay, sufficient because the actual threat is
"another browser tab on the same machine," not a remote attacker (the
127.0.0.1 bind already excludes remote attackers entirely). Document this
explicitly in Sprint 7's task scope — it is currently unaddressed there.

**Severity**: Low today (read-only, already well-defended). **Becomes
Medium at Sprint 7** if the write-token isn't added before write endpoints
ship — flag this as a blocking pre-requisite, not a nice-to-have.

---

## Boundary 3 — LAN serving (proposed in earlier thinking rounds, not yet built)

**What's there**: nothing yet — this is a proposed future capability
(serving the app itself on the home LAN so the morning briefing works from
a phone in bed), explicitly flagged as a tradeoff in round 3 of the
thinking sessions.

**What an attacker gets if built carelessly**: anyone on the same wifi
network — a neighbor within range of a weakly-secured home router, a
compromised IoT device on the same network, a guest who was given the wifi
password months ago — could reach the full app, including financial data,
if the relay's bind address changes from `127.0.0.1` to `0.0.0.0` or the
LAN IP without additional protection.

**Mitigation required if this is ever built**: this must **never** simply
flip the existing relay's bind address. It requires (a) a separate,
explicitly-opt-in LAN mode, (b) a token or PIN required on every request
from a non-localhost origin, and (c) prominent UI showing "LAN access is
ON" whenever active, so it's never silently left enabled. Given the
severity (this is the boundary that turns a personal-machine-only tool
into a home-network-exposed one), **this capability should not be built
casually as a side effect of another sprint** — it needs its own explicit
design pass and its own explicit go/no-go decision, not an assumption that
it's a small extension of Sprint 7's relay work.

**Severity**: currently zero (not built). If built without the mitigations
above: High — this is the one boundary that could expose the ledger beyond
the single machine the Constitution promises it stays on.

---

## Boundary 4 — OneDrive sync

**What's there**: the entire project directory, including (from Sprint 7)
any relay-to-disk-persisted ledger/journal/prediction files, sits inside a
folder actively synced by OneDrive to Microsoft's cloud and to any other
device signed into the same Microsoft account.

**What this actually means, stated plainly**: this is a deliberate,
different trust boundary than "stays on the machine" — the moment
financial data is written to a file inside `OneDrive\Documents\jarvis\`,
it leaves the machine, by design, the moment OneDrive's sync daemon picks
it up. This isn't a vulnerability being introduced by jarvis; it's an
existing norm the user has already accepted for other sensitive documents
in the same OneDrive folder (bank statements, PAN cards, Aadhaar images,
passport scans are already visible sitting in sibling folders in this same
Documents tree). Framed honestly: OneDrive-as-backup is consistent with
how this user already treats sensitive documents, not a new exposure
category being introduced.

**What an attacker gets**: whoever compromises the Microsoft account (or
any other device signed into it) gets the ledger too. This is the existing
blast radius of a Microsoft account compromise for this user already — it
doesn't get meaningfully larger because jarvis's financial data joins
files that are already there.

**Conflict with Constitution Art. 7 ("financial data never leaves the
machine")**: this is a real tension, not a false alarm. Two honest options,
already flagged in the Session #2 premortem:
1. **Exclude** the ledger/journal/prediction files specifically from
   OneDrive sync (a `.onedrive-exclude` pattern or moving those specific
   files to a non-synced local-only folder, with the app pointing there
   instead) — preserves the Constitution's letter.
2. **Amend the Constitution** to explicitly carve out "OneDrive sync to
   the user's own account" as an accepted exception, matching the user's
   existing practice with other sensitive documents, and gain OneDrive's
   free off-machine backup and multi-device reach as a benefit instead of
   fighting it.

**This document's recommendation**: option 2, formalized in the
Constitution-v2 session (#14) — fighting OneDrive sync for files that live
in a OneDrive folder is fragile (sync-exclusion rules are easy to
misconfigure or silently stop working after an OS update) and the actual
risk (Microsoft account compromise) is already the user's accepted risk
for every other sensitive document in this tree. Pretending otherwise for
jarvis alone is inconsistent, not more secure.

**Severity**: Medium — real exposure, but consistent with an already-accepted
risk profile, not a new one.

---

## Boundary 5 — CSV import (Zerodha tradebook, Sprint 7)

**What's there**: a file-upload flow that parses a CSV the user downloads
from their broker and feeds it into the ledger's event-sourcing pipeline.

**What an attacker gets**: this is a **local parsing**, not a network
boundary — the risk isn't data exfiltration, it's a **malformed or
malicious CSV crashing the parser or injecting bad data into the ledger**
(e.g., a CSV with a formula-injection payload like `=cmd|'/c calc'!A1` if
the file is ever re-opened in Excel, or simply malformed rows that produce
silently wrong cost-basis math). Low likelihood (the user is importing
their own broker's export, not an untrusted third-party file) but worth a
cheap defense given the ledger's correctness stakes.

**Mitigation**: validate every parsed row against the Session #4 ledger
schema before it becomes an event (reject, don't silently coerce, on
malformed rows); never write values that look like spreadsheet formulas
(`^[=+\-@]`) back into any exported CSV without a leading apostrophe or
quote — this is the standard, cheap fix for formula-injection in
CSV-round-trip tools, relevant because the ledger will also *export* CSV
(Session #4's "human-readable export" requirement).

**Severity**: Low (self-inflicted risk from the user's own broker export),
but the fix is cheap enough that there's no reason not to add it in Sprint 7.

---

## Boundary 6 — Multi-tab / multi-device write races

**What's there**: jarvis is designed to sit open all day; nothing prevents
opening it in two tabs, or (if LAN serving is ever built) two devices at
once.

**What an attacker gets**: this isn't an attacker boundary in the
traditional sense — it's a **data-integrity hazard**, not a
confidentiality one. Two tabs writing to localStorage/IndexedDB
concurrently can race: double daily-rollups, a ledger write from tab A
overwritten by a stale read-modify-write from tab B. Already flagged in
the earlier thinking rounds and assigned to Sprint 5.5 (BroadcastChannel
single-writer guard) — included here for completeness since a threat model
should cover integrity, not just confidentiality/availability.

**Severity**: Medium for data integrity, zero for confidentiality. Already
scheduled (Sprint 5.5) — no new action needed here beyond confirming that
sprint doesn't get dropped.

---

## Boundary 7 — Third-party upstream sources (RSS feeds, quote APIs)

**What's there**: the relay fetches from an exact-hostname whitelist of
news/data sources and returns their content to the app, which renders
headline text (escaped via `U.esc`, confirmed in `engine.js`) into the DOM.

**What an attacker gets**: if a whitelisted source were compromised and
began serving malicious content, the relay would faithfully proxy it. The
app's `U.esc()` HTML-escaping (already verified in the codebase) prevents
this from becoming stored XSS via headline text. The 2MB response cap
prevents a compromised/malicious upstream from serving an oversized
payload to exhaust memory. The realistic residual risk is content-level,
not code-execution: a compromised source could serve a fabricated headline
that fools the engine's sentiment/impact scoring (a data-integrity/gaming
concern, addressed by Session #1's red-team session on adversarial
content, not a security-boundary concern per se).

**Severity**: Low — the render-layer escaping and payload cap already
close the code-execution path; the remaining risk is analytical (garbage
in, garbage scored), which is Session #1's territory, not this document's.

---

## Summary table

| # | Boundary | Attacker gets | Status | Severity |
|---|---|---|---|---|
| 1 | Browser extensions | Full ledger/journal read | Accepted; recommend dedicated browser profile | High impact, low likelihood |
| 2 | Local relay (read) | Nothing (well-defended today) | Mitigated | Low |
| 2b | Local relay (write, Sprint 7) | Ledger corruption from another local tab | **Needs token auth before Sprint 7 ships writes** | Medium if unaddressed |
| 3 | LAN serving | Full app exposed on home network | Not built; needs its own design pass if ever built | High if built carelessly |
| 4 | OneDrive sync | Ledger exposed via Microsoft account compromise | Consciously accept via Constitution amendment (recommended) | Medium, consistent with existing risk |
| 5 | CSV import | Malformed data / formula injection | Needs schema validation + CSV-export escaping in Sprint 7 | Low |
| 6 | Multi-tab races | Data integrity, not confidentiality | Scheduled Sprint 5.5 | Medium (integrity only) |
| 7 | Upstream sources | Content-level gaming, not code execution | Already mitigated (escaping, size cap) | Low |

---

## Action items by sprint

- **Sprint 5.5**: confirm BroadcastChannel single-writer guard (Boundary 6) stays in scope.
- **Sprint 7**: add relay write-token auth (Boundary 2b) as a blocking pre-requisite before shipping any write endpoint; add CSV schema validation and formula-injection escaping (Boundary 5).
- **Sprint 14 (Constitution v2, Session #14)**: resolve the OneDrive tension (Boundary 4) explicitly — recommend amending Art. 7 rather than fighting sync.
- **Sprint 16 (hardening)**: this document becomes `THREAT-MODEL.md` in the repo root; add the dedicated-browser-profile recommendation (Boundary 1) as an in-app one-time notice.
- **If/when LAN serving is ever proposed (no sprint currently)**: treat Boundary 3 as requiring its own explicit design session before any code — never as a casual extension of relay work.
