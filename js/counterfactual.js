// @ts-check
/* ============================================================
   J.A.R.V.I.S — counterfactual: 2 of 3 horse-race lanes (Sprint 12 core slice)
   Real trades (Ledger.xirr, unchanged) vs a synthetic "what if every
   rupee had bought Nifty instead" lane, built from the SAME dates and
   SAME rupee amounts as the real ledger — an honest apples-to-apples
   comparison, not two different math methods dressed up to look
   comparable. The third lane (paper ideas — what if every drafted
   thesis had been bought) is deferred: it needs idea-formation-date
   price tracking, which is literally Sprint 14's own scoped "narrative
   age" work, not built yet.

   The index level itself has to be user-logged (one number, whenever
   they think to enter it) since there's no verified live index feed —
   same honesty tradeoff as Quotes' bhavcopy import.
   ============================================================ */

const Counterfactual = {
  NIFTY_KEY: 'jarvis.niftylog.v1',
  NIFTY_VERSION: 1,
  NIFTY_MIGRATIONS: { 0: (data) => data },

  loadNiftyLog(){ return /** @type {Array<{date:string, level:number}>} */ (Schema.load(this.NIFTY_KEY, this.NIFTY_VERSION, [], this.NIFTY_MIGRATIONS)); },

  /** @param {number} level */
  logLevel(level){
    const dateKey = U.todayKey();
    const log = this.loadNiftyLog();
    const idx = log.findIndex(r => r.date === dateKey);
    if (idx >= 0) log[idx].level = level; else log.push({ date: dateKey, level });
    log.sort((a, b) => a.date.localeCompare(b.date));
    Schema.save(this.NIFTY_KEY, this.NIFTY_VERSION, log);
    return log.length;
  },

  /** Nearest logged level at or before `date`; falls back to the earliest
   *  logged level if nothing precedes it (better than refusing to price
   *  a trade at all, honestly this is still an approximation either way).
   *  @param {{date:string,level:number}[]} log @param {string} date */
  _nearestLevel(log, date){
    if (!log.length) return null;
    const before = log.filter(r => r.date <= date);
    return before.length ? before[before.length - 1].level : log[0].level;
  },

  /** Same bisection as Ledger.xirr — duplicated intentionally rather than
   *  imported, so this module stays independently readable and neither
   *  file risks a shared-code regression touching the other's tested math.
   *  @param {{date:Date, amount:number}[]} flows */
  _bisectXirr(flows){
    if (flows.length < 2) return null;
    const hasPositive = flows.some(f => f.amount > 0), hasNegative = flows.some(f => f.amount < 0);
    if (!hasPositive || !hasNegative) return null;
    const t0 = flows.reduce((min, f) => f.date < min ? f.date : min, flows[0].date).getTime();
    const npv = (rate) => flows.reduce((s, f) => {
      const years = (f.date.getTime() - t0) / (365 * 86400000);
      return s + f.amount / Math.pow(1 + rate, years);
    }, 0);
    let lo = -0.9999, hi = 10, nLo = npv(lo), nHi = npv(hi);
    if (nLo * nHi > 0) return null;
    for (let i = 0; i < 200; i++){
      const mid = (lo + hi) / 2, nMid = npv(mid);
      if (Math.abs(nMid) < 1e-6) return mid;
      if (nLo * nMid < 0){ hi = mid; nHi = nMid; } else { lo = mid; nLo = nMid; }
    }
    return (lo + hi) / 2;
  },

  /** @returns {{ready:boolean, xirr:number|null, tradesUsed:number, niftyDaysLogged:number}} */
  indexXirr(){
    const niftyLog = this.loadNiftyLog();
    const events = [...Ledger.load()].filter(e => e.type === 'buy' || e.type === 'sell')
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (niftyLog.length < 2 || !events.length) return { ready: false, xirr: null, tradesUsed: 0, niftyDaysLogged: niftyLog.length };

    let units = 0;
    const flows = [];
    for (const e of events){
      const level = this._nearestLevel(niftyLog, e.date);
      if (level === null) continue;
      const cashOut = e.quantity * e.price; // positive = spent (buy), negative = received (sell) — same convention as Ledger
      units += cashOut / level;
      flows.push({ date: new Date(e.date), amount: -cashOut });
    }
    const latest = niftyLog[niftyLog.length - 1];
    if (units > 0.0001) flows.push({ date: new Date(latest.date), amount: units * latest.level });

    return { ready: true, xirr: this._bisectXirr(flows), tradesUsed: flows.length, niftyDaysLogged: niftyLog.length };
  }
};
