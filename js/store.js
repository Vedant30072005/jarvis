// @ts-check
/* ============================================================
   J.A.R.V.I.S — signal archive (ORD-203, ORD-905)
   IndexedDB memory of every signal ever seen (90-day prune) plus a
   localStorage daily rollup (jarvis.history.v1) that feeds real KPI
   history, "NEW" badges, momentum deltas, and — starting Sprint 9 —
   the anomaly sonar's term-frequency baseline.

   Everything here degrades gracefully: IndexedDB is unavailable in some
   private-browsing modes, and that must never break the app (Constitution:
   truth over delight, but also never crash over a missing nice-to-have).
   ============================================================ */

const Store = {
  DB_NAME: 'jarvis',
  DB_VERSION: 1,
  STORE_SIGNALS: 'signals',
  HISTORY_KEY: 'jarvis.history.v1',
  HISTORY_VERSION: 1,
  HISTORY_MIGRATIONS: { 0: (data) => data }, // v0 (unversioned array) -> v1: shape unchanged, just wrapped
  MAX_ROLLUP_DAYS: 120,
  PRUNE_DAYS: 90,

  /** @type {Promise<IDBDatabase>|null} */
  _dbPromise: null,
  /** @type {Set<string>} keys present in the archive as of session start — powers "NEW" badges */
  _priorKeys: new Set(),
  _available: null, // null = unknown, true/false once probed
  /** @type {Set<string>[]} shingle sets from ~24h-ago archived signals — powers Sprint 14's echo-vs-novelty */
  _yesterdayShingleSets: [],

  open(){
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)){ reject(new Error('IndexedDB unavailable')); return; }
      let req;
      try { req = indexedDB.open(this.DB_NAME, this.DB_VERSION); }
      catch(e){ reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(Store.STORE_SIGNALS)) db.createObjectStore(Store.STORE_SIGNALS, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
    return this._dbPromise;
  },

  async isAvailable(){
    if (this._available !== null) return this._available;
    try { await this.open(); this._available = true; }
    catch(e){ this._available = false; }
    return this._available;
  },

  /** @param {NewsItem|RawNewsItem} item @returns {string} */
  keyFor(item){
    return String(item.t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
  },

  /** Load every known key once at session start, before the first render,
   *  so "NEW" badges can be computed synchronously against a stable snapshot. */
  async loadPriorKeys(){
    try {
      const db = await this.open();
      const tx = db.transaction(this.STORE_SIGNALS, 'readonly');
      const store = tx.objectStore(this.STORE_SIGNALS);
      const keys = await new Promise((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(/** @type {string[]} */ (req.result));
        req.onerror = () => reject(req.error);
      });
      this._priorKeys = new Set(keys);
    } catch(e){ this._priorKeys = new Set(); /* archive unavailable — everything just reads as NEW this session, harmless */ }
  },

  /** Loads shingle sets for signals archived roughly 20-48h ago (a loose
   *  "yesterday" window — Sprint 14's echo-vs-novelty is explicitly rough,
   *  not calendar-precise), for Engine.computeNovelty() to compare today's
   *  items against. Best-effort like the rest of the archive: unavailable
   *  IndexedDB just means everything reads as novel this session. */
  async loadYesterdayShingles(){
    try {
      const db = await this.open();
      const tx = db.transaction(this.STORE_SIGNALS, 'readonly');
      const store = tx.objectStore(this.STORE_SIGNALS);
      const records = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(/** @type {any[]} */ (req.result));
        req.onerror = () => reject(req.error);
      });
      const from = Date.now() - 48 * 3600000, to = Date.now() - 20 * 3600000;
      this._yesterdayShingleSets = records
        .filter(r => r.lastSeen >= from && r.lastSeen < to && r.title)
        .map(r => Engine.shingles(r.title));
    } catch(e){ this._yesterdayShingleSets = []; }
  },

  /** @param {NewsItem} item */
  isNew(item){
    return !this._priorKeys.has(this.keyFor(item));
  },

  /** @param {NewsItem[]} items */
  async upsertSignals(items){
    try {
      const db = await this.open();
      const tx = db.transaction(this.STORE_SIGNALS, 'readwrite');
      const store = tx.objectStore(this.STORE_SIGNALS);
      const now = Date.now();
      for (const item of items){
        const key = this.keyFor(item);
        store.put({
          key, lastSeen: now,
          firstSeen: now, // put() below only fills this on first write per key; refined via get-then-put would cost a round trip per item — acceptable to let firstSeen re-stamp on every write since NEW-ness is judged against _priorKeys, not this field
          sectors: item.sectors, senti: item.senti, impact: item.impact, amountCr: item.amountCr,
          title: item.t, source: item.s,
          engineVersion: JDATA.ENGINE_VERSION // scores are only comparable within one engine version
        });
      }
      await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(null); tx.onerror = () => reject(tx.error); });
    } catch(e){ /* archive is best-effort */ }
  },

  async pruneOld(){
    try {
      const db = await this.open();
      const cutoff = Date.now() - this.PRUNE_DAYS * 86400000;
      const tx = db.transaction(this.STORE_SIGNALS, 'readwrite');
      const store = tx.objectStore(this.STORE_SIGNALS);
      await new Promise((resolve, reject) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor){
            if (cursor.value.lastSeen < cutoff) cursor.delete();
            cursor.continue();
          } else resolve(null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch(e){ /* archive is best-effort */ }
  },

  /* ---------------- daily rollups (localStorage) ---------------- */

  loadHistory(){
    return /** @type {any[]} */ (Schema.load(this.HISTORY_KEY, this.HISTORY_VERSION, [], this.HISTORY_MIGRATIONS));
  },
  saveHistory(rollups){
    Schema.save(this.HISTORY_KEY, this.HISTORY_VERSION, rollups);
  },

  /** @param {string} text @returns {string[]} */
  tokenize(text){
    return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !/^\d+$/.test(w) && !JDATA.STOPWORDS.has(w));
  },

  /** Document-frequency-style term counts for today: a term counts once
   *  per ARTICLE that mentions it, not once per raw occurrence, so one
   *  verbose piece can't fake a burst on its own. Bigrams included.
   *  @param {NewsItem[]} items @param {number} [capTerms] @param {number} [capSources] */
  computeTermCounts(items, capTerms = 300, capSources = 4){
    /** @type {Object<string, number>} */
    const counts = {};
    /** @type {Object<string, Set<string>>} */
    const sourceSets = {};
    for (const item of items){
      const known = new Set(item.entities.map(e => e.tag.toLowerCase()));
      const uni = this.tokenize(item.t + ' ' + (item.b || ''));
      const terms = new Set();
      uni.forEach(w => { if (!known.has(w)) terms.add(w); });
      for (let i = 0; i < uni.length - 1; i++){
        const bg = uni[i] + ' ' + uni[i+1];
        if (!known.has(bg)) terms.add(bg);
      }
      terms.forEach(term => {
        counts[term] = (counts[term] || 0) + 1;
        (sourceSets[term] = sourceSets[term] || new Set()).add(item.s);
      });
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, capTerms);
    /** @type {Object<string, number>} */
    const termCounts = {};
    /** @type {Object<string, string[]>} */
    const termSources = {};
    for (const [term, count] of top){ termCounts[term] = count; termSources[term] = [...sourceSets[term]].slice(0, capSources); }
    return { termCounts, termSources };
  },

  /** Upsert today's rollup entry (idempotent by date — safe to call on
   *  every data change; never duplicates, never needs a "did I already
   *  run today" flag). */
  snapshotToday(){
    const dateKey = U.todayKey();
    const todayItems = Engine.items.filter(i => i.h < 24);
    const st = Engine.stats();

    /** @type {Object<string, {count:number, impactSum:number, flowsCr:number}>} */
    const perSector = {};
    Engine.flowBySector().forEach(r => { perSector[r.sector] = { count: r.count, impactSum: 0, flowsCr: r.total }; });
    todayItems.forEach(i => i.sectors.forEach(s => {
      perSector[s] = perSector[s] || { count: 0, impactSum: 0, flowsCr: 0 };
      perSector[s].impactSum += i.impact;
    }));

    const { termCounts, termSources } = this.computeTermCounts(todayItems);

    const rollup = {
      date: dateKey,
      engineVersion: JDATA.ENGINE_VERSION, // scores are only comparable within one engine version
      signals: st.signals,
      trackedCr: st.trackedCr,
      bullPct: st.bullPct,
      patterns: Engine.clusters.length,
      perSector, termCounts, termSources
    };

    let hist = this.loadHistory();
    const idx = hist.findIndex((/** @type {any} */ r) => r.date === dateKey);
    if (idx >= 0) hist[idx] = rollup; else hist.push(rollup);
    hist.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (hist.length > this.MAX_ROLLUP_DAYS) hist = hist.slice(-this.MAX_ROLLUP_DAYS);
    this.saveHistory(hist);
    return rollup;
  },

  /** Last N days of a numeric rollup field, oldest-first, padded flat if
   *  history is too sparse for a real trend yet.
   *  @param {string} field @param {number} fallback @param {number} [n] */
  series(field, fallback, n = 14){
    const hist = this.loadHistory();
    const vals = hist.map((/** @type {any} */ r) => Number(r[field]) || 0).slice(-n);
    if (vals.length < 2) return [fallback, fallback];
    return vals;
  },

  /** Momentum for `sector` N days ago (impactSum), for computing deltas
   *  on pattern cards. @param {string} sector @param {number} daysAgo */
  sectorImpactDaysAgo(sector, daysAgo){
    const hist = this.loadHistory();
    const key = U.todayKey(new Date(Date.now() - daysAgo * 86400000));
    const row = hist.find((/** @type {any} */ r) => r.date === key);
    return row?.perSector?.[sector]?.impactSum ?? null;
  }
};
