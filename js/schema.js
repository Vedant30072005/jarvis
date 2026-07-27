// @ts-check
/* ============================================================
   J.A.R.V.I.S — schema versioning (Sprint 5.5)
   Every persisted blob gets an internal `v` field, independent of the
   key name. A schema change bumps `v` and registers a migration keyed
   by the FROM-version; the key name itself never needs to change again.
   Data written before this sprint has no envelope — it's read as v0
   and migrated forward like anything else.
   ============================================================ */

const Schema = {
  /** @param {number} v @param {any} data */
  wrap(v, data){ return { v, data }; },

  /** Read + migrate a localStorage key to `currentVersion`.
   *  @param {string} key
   *  @param {number} currentVersion
   *  @param {any} fallback used if the key is missing, corrupt, or empty
   *  @param {Object<number, (data:any)=>any>} [migrations] keyed by FROM version;
   *         each fn upgrades data from that version to the next one up.
   */
  load(key, currentVersion, fallback, migrations = {}){
    let raw;
    try { raw = localStorage.getItem(key); } catch(e){ return fallback; }
    if (!raw) return fallback;

    let parsed;
    try { parsed = JSON.parse(raw); } catch(e){ return fallback; }

    // Pre-Sprint-5.5 data has no envelope — it IS the payload, treated as v0.
    let v = 0, data = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        typeof parsed.v === 'number' && 'data' in parsed){
      v = parsed.v; data = parsed.data;
    }

    while (v < currentVersion){
      const migrate = migrations[v];
      if (!migrate) break; // nothing registered for this hop — stop, use data as-is
      try { data = migrate(data); v++; }
      catch(e){ console.error(`[Schema] migration from v${v} failed for "${key}":`, e); break; }
    }
    return data;
  },

  /** @param {string} key @param {number} currentVersion @param {any} data */
  save(key, currentVersion, data){
    const serialized = JSON.stringify(this.wrap(currentVersion, data));
    try { localStorage.setItem(key, serialized); }
    catch(e){ /* quota exceeded — non-critical, caller's data just won't extend this tick */ }
    // Durability mirror (Boundary 2b): best-effort disk copy via the
    // relay. Guarded on Persist existing so Schema stays independent of
    // script load order and works fine when the relay is absent.
    if (typeof Persist !== 'undefined') Persist.mirror(key, serialized);
  }
};
