// @ts-check
/* ============================================================
   J.A.R.V.I.S — bulk EOD quotes (Sprint 12 core slice)
   Imports an NSE bhavcopy CSV (the standard daily equity-close file,
   same one traders download from nseindia.com) rather than a live
   scrape — this project has no verified relay/network path to fetch
   it automatically, and a CSV import mirrors the already-proven
   Zerodha tradebook pattern (Sprint 7) instead of building untestable
   live-fetch scaffolding. Stores a dated snapshot, capped to
   MAX_DAYS, and can mark Portfolio holdings at the latest close.

   Symbol matching is a real, honestly-imperfect problem: a holding
   named "HDFC Bank" must match the bhavcopy symbol "HDFCBANK". Loose
   normalisation (uppercase, strip non-alphanumerics) handles most
   common cases; unmatched holdings are reported, never silently
   left looking synced when they aren't.
   ============================================================ */

const Quotes = {
  EOD_KEY: 'jarvis.eod.v1',
  EOD_VERSION: 1,
  EOD_MIGRATIONS: { 0: (data) => data },
  MAX_DAYS: 30,

  load(){ return /** @type {Array<{date:string, prices:Object<string,number>}>} */ (Schema.load(this.EOD_KEY, this.EOD_VERSION, [], this.EOD_MIGRATIONS)); },
  save(snapshots){ Schema.save(this.EOD_KEY, this.EOD_VERSION, snapshots); },

  /** NSE bhavcopy TIMESTAMP is "DD-MON-YYYY" (e.g. "15-JAN-2024"), a
   *  format Ledger._normalizeDate doesn't cover (it only handles numeric-
   *  month forms from broker tradebooks) — falls back to it for any
   *  other shape a differently-sourced EOD file might use.
   *  @param {string} raw @returns {string|null} YYYY-MM-DD or null */
  _normalizeDate(raw){
    if (!raw) return null;
    const MONTHS = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' };
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw.trim());
    if (m && MONTHS[m[2].toUpperCase()]) return `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`;
    return Ledger._normalizeDate(raw);
  },

  _parseCsv(text){
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) return { header: [], rows: [] };
    const header = lines[0].split(',').map(h => h.trim().toUpperCase().replace(/["']/g, ''));
    const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/["']/g, '')));
    return { header, rows };
  },

  /** Parses a standard NSE bhavcopy CSV (SYMBOL, SERIES, CLOSE, TIMESTAMP
   *  among its columns; SERIES filtered to 'EQ' — equity, not preference
   *  shares/ETF series variants that share a symbol).
   *  @param {string} text @returns {{date:string|null, prices:Object<string,number>, skipped:number}} */
  parseBhavcopy(text){
    const { header, rows } = this._parseCsv(text);
    const iSymbol = header.indexOf('SYMBOL');
    const iSeries = header.indexOf('SERIES');
    const iClose = header.indexOf('CLOSE');
    const iDate = header.indexOf('TIMESTAMP');
    if (iSymbol < 0 || iSeries < 0 || iClose < 0){
      throw new Error('Could not find SYMBOL/SERIES/CLOSE columns — is this an NSE bhavcopy export?');
    }
    /** @type {Object<string,number>} */
    const prices = {};
    let skipped = 0, date = null;
    for (const row of rows){
      if (row[iSeries] !== 'EQ'){ skipped++; continue; }
      const symbol = row[iSymbol];
      const close = parseFloat(row[iClose]);
      if (!symbol || !isFinite(close) || close <= 0){ skipped++; continue; }
      prices[symbol] = close;
      if (!date && iDate >= 0 && row[iDate]) date = this._normalizeDate(row[iDate]);
    }
    return { date: date || U.todayKey(), prices, skipped };
  },

  /** @param {string} text */
  importBhavcopy(text){
    const { date, prices, skipped } = this.parseBhavcopy(text);
    const n = Object.keys(prices).length;
    if (!n) throw new Error('No equity (EQ series) rows found in that file.');
    let snapshots = this.load();
    const idx = snapshots.findIndex(s => s.date === date);
    if (idx >= 0) snapshots[idx] = { date, prices }; else snapshots.push({ date, prices });
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    if (snapshots.length > this.MAX_DAYS) snapshots = snapshots.slice(-this.MAX_DAYS);
    this.save(snapshots);
    return { date, symbolsImported: n, skipped };
  },

  latest(){
    const snapshots = this.load();
    return snapshots.length ? snapshots[snapshots.length - 1] : null;
  },

  /** @param {string} holdingName @param {Object<string,number>} prices */
  matchSymbol(holdingName, prices){
    const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const target = norm(holdingName);
    if (!target) return null;
    if (prices[holdingName] !== undefined) return holdingName; // exact symbol already
    for (const symbol in prices){
      if (norm(symbol) === target) return symbol;
    }
    return null;
  },

  /** Marks every Portfolio holding at the latest EOD close where a symbol
   *  match is found; leaves unmatched holdings' price untouched and
   *  reports them rather than pretending the whole book synced.
   *  @returns {{ready:boolean, date?:string, matched:number, unmatched:string[]}} */
  applyToPortfolio(){
    const snap = this.latest();
    if (!snap) return { ready: false, matched: 0, unmatched: [] };
    let matched = 0;
    const unmatched = [];
    for (const h of Portfolio.state.holdings){
      const symbol = this.matchSymbol(h.name, snap.prices);
      if (symbol){ h.cur = snap.prices[symbol]; matched++; }
      else unmatched.push(h.name);
    }
    if (matched) Portfolio.save();
    return { ready: true, date: snap.date, matched, unmatched };
  },

  /* ---------------- live per-symbol quotes (via relay's Yahoo proxy) ----------------
     relay.js has carried a working GET /quote?symbols=... endpoint since
     Sprint 12 (Yahoo Finance chart API, cached, exact-hostname whitelisted)
     with NO frontend caller — this closes that gap. Same graceful-
     degradation contract as Live: relay unreachable → return null, never
     throw, caller falls back to the existing bhavcopy-only flow. */

  /** @param {string[]} symbols bare NSE symbols (no .NS suffix — added here)
   *  @returns {Promise<Object<string,{price:number, changePct:number}>|null>} null = relay unreachable */
  async fetchLive(symbols){
    if (!symbols.length) return {};
    if (!(await Live.relayAvailable())) return null;
    const qs = symbols.map(s => encodeURIComponent(s + '.NS')).join(',');
    try {
      const text = await Live.fetchWithTimeout(`${Live.RELAY_BASE}/quote?symbols=${qs}`, 6000);
      const json = JSON.parse(text);
      const out = {};
      for (const sym of symbols){
        const entry = json[sym + '.NS'];
        if (entry && typeof entry.price === 'number') out[sym] = entry;
      }
      return out;
    } catch(e){ return null; }
  },

  /** Live-syncs Portfolio holdings' current price straight from the
   *  market — no CSV needed. Only touches holdings mapped to a tracked
   *  NSE symbol (JDATA.COMPANIES); MF/Gold/Crypto/Cash and unmapped
   *  names are left untouched and reported, never silently skipped.
   *  Stamps `liveAsOf` (epoch ms) on every updated holding so the UI can
   *  say exactly when, rather than blending live intraday data with a
   *  manually-imported EOD close under one ambiguous timestamp
   *  (Constitution Art. 4 — every number answers "as of when").
   *  @returns {Promise<{ready:boolean, matched:number, unmatched:string[]}>} */
  async syncLivePrices(){
    /** @type {Object<string, any[]>} */
    const bySymbol = {};
    const unmatched = [];
    for (const h of Portfolio.state.holdings){
      const n = h.name.toLowerCase();
      const co = JDATA.COMPANIES.find(c => n === c.name.toLowerCase() || n.includes(c.name.toLowerCase()) || n === c.sym.toLowerCase());
      if (co) (bySymbol[co.sym] = bySymbol[co.sym] || []).push(h);
      else unmatched.push(h.name);
    }
    const symbols = Object.keys(bySymbol);
    if (!symbols.length) return { ready: false, matched: 0, unmatched };
    const quotes = await this.fetchLive(symbols);
    if (quotes === null) return { ready: false, matched: 0, unmatched };
    let matched = 0;
    const now = Date.now();
    for (const sym of symbols){
      const entry = quotes[sym];
      if (!entry){ unmatched.push(...bySymbol[sym].map(h => h.name)); continue; }
      for (const h of bySymbol[sym]){ h.cur = entry.price; h.liveAsOf = now; matched++; }
    }
    if (matched) Portfolio.save();
    return { ready: true, matched, unmatched };
  }
};
