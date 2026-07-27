# Data Lifecycle Audit — Session #13

Every data class jarvis will ever hold, from birth through death: where it's
born, how it's stored, quota impact, backup coverage, export format,
retention policy, migration/portability, and deletion mechanics. Organized
by sprint of introduction. Identifies orphans (data classes with no backup
story, no migration path, or quota risks).

---

## Core Data Classes — Lifecycle Table

| Data Class | Born (Sprint) | Primary Store | Secondary Store | Quota Cost | Backup Coverage | Export Format | Retention | Migration | Deletion | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **Signal Archive** | 4 | IndexedDB (best-effort) | None | ~1–2 MB (14d) | Implicit (part of export) | JSON array | 14 days auto-prune | Stays in IndexedDB; no cross-device sync | Manual delete via DevTools | ✅ Covered |
| **Daily Rollups** | 4 | localStorage `jarvis.history.v1` | None | ~100 KB (80 days) | ✅ YES (export includes) | JSON | 80 days capped | Stays in localStorage; lossy on profile switch | Manual or auto on quota-exceed | ✅ Covered |
| **Chat History** | 1 | localStorage `jarvis.chat.v1` | None | ~50 KB (100 entries) | ✅ YES (export includes) | JSON | 100 entries capped, then FIFO drop | Stays in localStorage | Auto FIFO when cap hit | ✅ Covered |
| **Settings** | 1 | localStorage `jarvis.settings.v1` | None | ~10 KB | ✅ YES (export includes) | JSON | Indefinite | Stays in localStorage | Manual via settings UI or export-import | ✅ Covered |
| **Ledger Events** | 7 | localStorage cache (`jarvis.ledger.v1`) + Disk via relay (PRIMARY) | Relay-persisted JSON file on disk | localStorage: ~200 KB; disk: ~500 KB–2 MB (scales with trade count) | ✅ YES (export includes disk-persisted JSON) | JSON events (append-only) | Indefinite | Disk file portable via export; localStorage lossy on profile switch | Manual delete via relay endpoint or file deletion | ✅ Covered |
| **Journal Entries** | 11 | localStorage cache (`jarvis.journal.v1`) + Disk via relay (PRIMARY) | Relay-persisted JSON file on disk | localStorage: ~100 KB; disk: ~200–500 KB | ✅ YES (export includes) | JSON entries + markdown export | Indefinite | Disk file portable; localStorage lossy | Manual delete via UI or file deletion | ✅ Covered |
| **Predictions** | 11 | localStorage cache (`jarvis.predictions.v1`) + Disk via relay (PRIMARY) | Relay-persisted JSON file on disk | localStorage: ~100 KB; disk: ~100–300 KB | ✅ YES (export includes) | JSON + CSV for calibration data | Indefinite (resolved predictions stay for Brier curve) | Disk file portable | Manual delete after resolution or explicit removal | ✅ Covered |
| **User Dictionary** | 16 | localStorage (`jarvis.dictionary.v1`) | None (but exported with backup) | ~20–50 KB | ✅ YES (export includes) | JSON {sector: [terms]} | Indefinite | Stays in localStorage; manual re-entry on profile switch | Manual clear or removal of entries | ⚠️ **No sync** |
| **Watchlist** | UI initial | localStorage `jarvis.watchlist.v1` | None | ~10 KB | ✅ YES (export includes) | JSON array of symbols | Indefinite | Stays in localStorage | Manual removal or UI delete | ✅ Covered |
| **Portfolio Holdings** | UI initial | localStorage `jarvis.portfolio.v1` | None | ~30 KB | ✅ YES (export includes) | JSON holdings array | Indefinite | Stays in localStorage | Manual via portfolio UI | ✅ Covered |
| **Calibration Data** | 12 | Derived from predictions + hit-rate tables (stored in localStorage `jarvis.calibration.v1`) | None (can be re-derived) | ~50 KB | ✅ YES (export includes) | JSON + CSV (calibration curve) | Indefinite | Stays in localStorage | Auto-derived on next run (or manual clear) | ✅ Covered |
| **Theme / UI State** | 1 | localStorage `jarvis.theme.v1`, `jarvis.viewstate.v1` | None | ~5 KB | Optional (not critical to export) | JSON | Indefinite | Stays in localStorage | Manual via settings | ✅ Covered |
| **Backup Export Archive** | 6 | Disk (user's choice, typically OneDrive was old location, now `C:\jarvis\exports\` or user-selected) | User's backup location (cloud, external drive, etc.) | Variable (user-controlled) | Manually triggered export | JSON snapshot | User-determined retention | Portable by design (single JSON file) | User manual deletion | ✅ Covered |

---

## Quota Accounting

**localStorage total budget** (browser-dependent, typical ~5–10 MB):
- Signal archive (copy in localStorage if any): ~0 (IndexedDB-only)
- Daily rollups: ~100 KB
- Chat: ~50 KB
- Settings: ~10 KB
- Ledger cache: ~200 KB (if syncing via relay, this is just a cache)
- Journal cache: ~100 KB
- Predictions cache: ~100 KB
- Dictionary: ~40 KB
- Watchlist: ~10 KB
- Portfolio: ~30 KB
- Calibration: ~50 KB
- Theme/state: ~5 KB
- **Subtotal: ~695 KB** — well under the 5–10 MB typical limit

**Headroom: 4.3–9.3 MB free** (depending on browser and other tabs' localStorage)

**IndexedDB budget** (browser-dependent, typical 50+ MB available):
- Signal archive: ~1–2 MB (14-day rolling)
- Headroom: 48+ MB free

**Disk via relay** (unlimited by browser; constrained by user's C: drive):
- Ledger events: ~500 KB–2 MB (scales linearly with trade count)
- Journal: ~200–500 KB
- Predictions: ~100–300 KB
- **Subtotal: ~800 KB–3 MB** for a typical year's data

**Total in-app storage footprint**: <4 MB, extremely conservative.

**Risk: QuotaExceededError on localStorage** — flagged in Session #2 premortem. The threshold is far enough away that it shouldn't happen in normal usage (even a 10-year ledger and a massive chat history should stay under 2 MB). Mitigation: the Sprint 6 honesty panel includes a quota meter (Session #7, Section E), so the user can see when approaching the limit and export/prune if needed.

---

## Migration & Portability — The Hard Cases

### **Cross-browser-profile migration** (same user, different profile)
- **localStorage data (chat, settings, watchlist, portfolio, dictionaries)**: LOST. localStorage is per-profile, not synced.
  - **Mitigation**: export before switching profiles, then re-import. Supported by the backup export feature (Sprint 6).
- **IndexedDB archive**: LOST. (Same reason.)
- **Disk-persisted data (ledger, journal, predictions)**: PORTABLE. The relay writes to `C:\jarvis\ledger.json`, `C:\jarvis\journal.json`, etc. (files on disk). If the user switches profiles but stays on the same machine, they can point the new profile's app to the same relay/disk files. This is a manual setup, not automatic.
  - **Risk**: if the relay port or token changes between profiles, the new profile won't reach the old data.
  - **Mitigation**: document this in Sprint 16's hardening docs and provide a "migrate from another profile" flow if time allows (low priority).

### **Cross-device migration** (same user, different machine)
- **localStorage data**: LOST (tied to device/profile).
- **IndexedDB data**: LOST.
- **Disk-persisted data**: PORTABLE (copy the JSON files from old machine to new machine, update relay paths).
  - **Mitigation**: include the disk-based JSON files in the backup export, and provide a restore flow that can re-populate the relay's disk store from the export.

### **OneDrive scenario** (if ever re-enabled for sync)
- The shift to local C: drive eliminates this. If future sprints consider LAN serving or a separate sync daemon, the disk-based data (ledger, journal, predictions) should NOT go into a synced folder — they'd need explicit exclusion or a separate "archive" folder for user backups only.

---

## Orphans & Gaps

**Orphan #1: User Dictionary (no cross-profile portability)**
- Born in Sprint 16 as `jarvis.dictionary.v1` (localStorage)
- If a user adds 50 custom sectors/entities in their current profile, then switches to a new profile, all custom dictionary entries are lost
- **Mitigation option**: include dictionary in the backup export (already listed as "✅ YES" above) — but re-importing requires a manual step, not automatic
- **Severity**: Low (the base JDATA.KEYWORDS/COMPANIES don't change; user dictionary is a convenience layer). But worth calling out in docs: "custom dictionaries don't migrate automatically; export before switching profiles."

**Orphan #2: Calibration data (can be re-derived, but slow)**
- Stored in localStorage; not in the disk-persisted JSON from Sprint 7
- If a user's calibration curve (Brier scores, hit-rate tables) is valuable and they switch profiles, it's gone
- **Mitigation option**: include calibration data in the disk-persisted export (currently not listed as disk-persisted)
- **Severity**: Low (calibration is derived from predictions; if predictions are backed up, recalibrating is just a re-run of the same predictions). But could be a nuisance for a user with a year of calibration history.
- **Recommendation for Sprint 12** (when grading methodology lands): store calibration summaries (Brier score, hit-rate table snapshots, calibration curve data) in a separate disk-persisted JSON file so they survive profile/device switches.

**Orphan #3: Theme/viewstate (low-stakes but lost on profile switch)**
- `jarvis.theme.v1` and `jarvis.viewstate.v1` are per-profile, not backed up
- If a user has customized their theme or their dashboard layout (when Sprint 14's layout editor ships), it's gone on profile switch
- **Severity**: Negligible (purely cosmetic; user can reconfigure in 2 minutes)
- **No action needed** (this is acceptable loss).

**Orphan #4: Relay connectivity & token (infrastructure, not data)**
- The relay runs on `127.0.0.1:<port>` and requires a shared-secret token (from Session #8, Boundary 2b)
- If the token file or the relay config gets lost/corrupted, the app can't write to the disk-persisted files
- This is an infrastructure risk, not a data loss risk, but worth flagging
- **Mitigation**: the relay's token and port should be documented and recoverable (e.g., regenerable from a hardcoded seed or a config file); this belongs in Sprint 7's relay-auth implementation

---

## Action Items by Sprint

- **Sprint 6 (backup export)**: confirm export JSON includes all classes listed "✅ YES" in the table above; add a validation in test.html (Session #7 mentions this) that the export contains every registered data class.
- **Sprint 7 (ledger + relay)**: implement relay write-token auth (Session #8, Boundary 2b); ensure disk-persisted files are in a predictable location (`C:\jarvis\ledger.json`, etc.) so they're discoverable on device/profile migration.
- **Sprint 11 (journal + predictions)**: ensure journal and predictions are disk-persisted via relay alongside the ledger, not left in localStorage-only.
- **Sprint 12 (calibration)**: store calibration summaries in a disk-persisted JSON file (add as a data class to this table).
- **Sprint 16 (hardening + docs)**: document the profile/device migration path explicitly, including which data is lost on profile switch (localStorage) and which survives (disk-persisted); provide a step-by-step "migrate to new profile" guide in a MIGRATION.md file.

---

## Summary

**Data health**: All major data classes have backup coverage and export paths. No critical data class is left localStorage-only without a backup story.

**Quota risk**: Total in-app storage is <4 MB; no near-term quota concerns. The honesty panel (Sprint 6) tracks this and alerts if approaching limits.

**Migration gaps**: Cross-profile and cross-device migration for disk-persisted data (ledger, journal, predictions) is *possible* but manual. localStorage-based data (settings, watchlist, dictionary, calibration) doesn't migrate — users must export/re-import. Document this clearly in Sprint 16.

**Orphans found**: 2 low-severity orphans (user dictionary portability, calibration data on profile switch) — both manageable with clear docs; 1 infrastructure risk (relay token/port discovery on migration) — mitigated by the Sprint 7 relay-auth design.

**No show-stoppers.** The architecture is sound.
