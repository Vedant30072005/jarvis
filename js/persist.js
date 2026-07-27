// @ts-check
/* ============================================================
   J.A.R.V.I.S — disk-durability client (Threat Model Boundary 2b)

   Mirrors irreplaceable localStorage blobs to the relay's disk store
   so they survive a browser-profile wipe (Constitution Article 14 —
   "data outlives the software" — made real, not just satisfied by
   manual-export discipline).

   Model: localStorage is the fast working copy; disk is the durable
   mirror. On every Schema.save of a durable key, the serialized value
   is POSTed to the relay (best-effort, fire-and-forget). At boot, any
   durable key that is MISSING from localStorage but PRESENT on disk is
   restored — that's the profile-wipe recovery path. If the relay isn't
   running, everything degrades to exactly the pre-durability behaviour:
   localStorage-only, no errors, no blocking.
   ============================================================ */

const Persist = {
  BASE: 'http://localhost:5510',
  token: /** @type {string|null} */ (null),
  available: false,

  /** The classes worth mirroring — irreplaceable user data only. NOT
   *  settings (reconfigurable), chat (ephemeral), rollups/eod/niftylog
   *  (re-derivable or re-importable), or brainmisses (diagnostic).
   *  Must stay in sync with the relay's own DURABLE_KEYS allowlist. */
  DURABLE_KEYS: new Set([
    'jarvis.ledger.v1', 'jarvis.journal.v1', 'jarvis.predictions.v1',
    'jarvis.goals.v1', 'jarvis.sundayreview.v1', 'jarvis.taught.v1',
    'jarvis.portfolio.v1'
  ]),

  /** @param {string} url @param {RequestInit} [opts] @param {number} [ms] */
  async _fetch(url, opts, ms = 1500){
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctl.signal }); }
    finally { clearTimeout(t); }
  },

  /** Probe the relay and grab the write token. Safe to call once at
   *  boot; sets `available` and returns it. */
  async probe(){
    try {
      const res = await this._fetch(`${this.BASE}/token`);
      if (res && res.ok){
        const j = await res.json();
        if (j && typeof j.token === 'string'){ this.token = j.token; this.available = true; return true; }
      }
    } catch(e){ /* relay down — stay localStorage-only */ }
    this.available = false;
    return false;
  },

  /** Best-effort mirror of a durable key to disk. No-op (and never
   *  throws) when the relay is unavailable or the key isn't durable.
   *  @param {string} key @param {string} serialized the exact string written to localStorage */
  mirror(key, serialized){
    if (!this.available || !this.token || !this.DURABLE_KEYS.has(key)) return;
    this._fetch(`${this.BASE}/store/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': this.token },
      body: serialized
    }).catch(() => { /* mirror is best-effort; localStorage already holds the truth */ });
  },

  /** Read a durable key's disk copy, or null. @param {string} key */
  async restore(key){
    if (!this.available || !this.DURABLE_KEYS.has(key)) return null;
    try {
      const res = await this._fetch(`${this.BASE}/store/${encodeURIComponent(key)}`);
      if (res && res.ok){ const t = await res.text(); return t && t.length ? t : null; }
    } catch(e){ /* fall through to null */ }
    return null;
  },

  /** Boot-time recovery: for every durable key that localStorage lacks
   *  but disk has, write the disk copy back into localStorage. Returns
   *  the list of keys actually restored (so the caller can re-load the
   *  one cached module, Portfolio). @returns {Promise<string[]>} */
  async restoreMissing(){
    if (!this.available) return [];
    const restored = [];
    for (const key of this.DURABLE_KEYS){
      let hasLocal = false;
      try { hasLocal = localStorage.getItem(key) !== null; } catch(e){}
      if (hasLocal) continue;
      const disk = await this.restore(key);
      if (disk){
        try { localStorage.setItem(key, disk); restored.push(key); } catch(e){}
      }
    }
    return restored;
  }
};
