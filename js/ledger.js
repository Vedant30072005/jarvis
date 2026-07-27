// @ts-check
/* ============================================================
   J.A.R.V.I.S — trade ledger (Sprint 7 core slice)
   Event-sourced, append-only, per Session #4's schema. This slice
   imports Zerodha tradebook CSVs into 'buy'/'sell' events, replays
   them into current holdings, and computes portfolio XIRR via
   bisection (robust to the sign-change cash-flow patterns Newton-
   Raphson can fail to converge on — Session #4 Test 10).

   Deferred to later sprints (Session #15 core-slice plan): dividend/
   split/bonus/buyback/delisting/fund-merger/correction/void event
   types, relay-to-disk persistence, a full ledger drill-down UI, and
   net-worth history. This slice only proves import → replay → XIRR
   works end to end on the two event types a Zerodha tradebook
   actually contains.
   ============================================================ */

const Ledger = {
  KEY: 'jarvis.ledger.v1',
  VERSION: 1,
  MIGRATIONS: { 0: (data) => data },

  load(){ return /** @type {any[]} */ (Schema.load(this.KEY, this.VERSION, [], this.MIGRATIONS)); },
  save(events){ Schema.save(this.KEY, this.VERSION, events); },

  /** Minimal CSV split — Zerodha tradebook exports don't quote fields that
   *  contain commas, so a straightforward split is sufficient here; a
   *  fuller RFC4180 parser is unneeded scope for this slice. */
  _parseCsv(text){
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) return { header: [], rows: [] };
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/["']/g, '')));
    return { header, rows };
  },

  /** @param {string[]} header @param {RegExp} pattern */
  _col(header, pattern){ return header.findIndex(h => pattern.test(h)); },

  /** Parses a Zerodha tradebook CSV into buy/sell LedgerEvents.
   *  Expected columns (order-independent, matched by regex): symbol,
   *  trade_date (or date), trade_type (or type: buy/sell), quantity
   *  (or qty), price. Unrecognised columns are ignored.
   *  @param {string} text @returns {{events:any[], skipped:number}} */
  parseZerodhaCsv(text){
    const { header, rows } = this._parseCsv(text);
    const iSymbol = this._col(header, /symbol|tradingsymbol/);
    const iDate = this._col(header, /trade_date|^date$/);
    const iType = this._col(header, /trade_type|^type$/);
    const iQty = this._col(header, /quantity|qty/);
    const iPrice = this._col(header, /^price$|trade_price/);
    const iTradeId = this._col(header, /trade_id/);

    if (iSymbol < 0 || iDate < 0 || iType < 0 || iQty < 0 || iPrice < 0){
      throw new Error('Could not find symbol/date/type/quantity/price columns — is this a Zerodha tradebook export?');
    }

    const events = [];
    let skipped = 0;
    for (const row of rows){
      const symbol = row[iSymbol];
      const dateRaw = row[iDate];
      const typeRaw = (row[iType] || '').toLowerCase();
      const qty = Math.abs(parseFloat(row[iQty]));
      const price = parseFloat(row[iPrice]);
      const date = this._normalizeDate(dateRaw);
      if (!symbol || !date || !isFinite(qty) || !isFinite(price) || qty <= 0 || price < 0 ||
          (typeRaw !== 'buy' && typeRaw !== 'sell')){
        skipped++; continue;
      }
      const tradeId = iTradeId >= 0 ? row[iTradeId] : null;
      events.push({
        id: tradeId ? 'zerodha-' + tradeId : U.uid(),
        date, type: typeRaw, symbol: symbol.toUpperCase(),
        quantity: typeRaw === 'sell' ? -qty : qty,
        price, source: 'zerodha-import', importedAt: Date.now()
      });
    }
    return { events, skipped };
  },

  /** Accepts DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY; returns YYYY-MM-DD or null. */
  _normalizeDate(raw){
    if (!raw) return null;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(raw);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  },

  /** Imports a CSV, appending new events and skipping ones whose id
   *  (trade_id-derived) is already in the ledger — safe to re-import
   *  the same file without duplicating trades.
   *  @param {string} text */
  importZerodhaCsv(text){
    const { events: parsed, skipped } = this.parseZerodhaCsv(text);
    const existing = this.load();
    const knownIds = new Set(existing.map(e => e.id));
    const fresh = parsed.filter(e => !knownIds.has(e.id));
    this.save([...existing, ...fresh]);
    Bus.emit('ledger:changed', {});
    return { imported: fresh.length, duplicates: parsed.length - fresh.length, skipped };
  },

  /** Replays all events into current per-symbol holdings.
   *  @param {any[]} [events] @returns {Object<string,{quantity:number, costBasis:number, lastPrice:number, lastDate:string, tradeCount:number}>} */
  replay(events){
    events = events || this.load();
    /** @type {Object<string,{quantity:number, costBasis:number, lastPrice:number, lastDate:string, tradeCount:number}>} */
    const holdings = {};
    const sorted = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (const e of sorted){
      const h = holdings[e.symbol] = holdings[e.symbol] || { quantity: 0, costBasis: 0, lastPrice: 0, lastDate: '', tradeCount: 0 };
      if (e.type === 'buy'){
        h.quantity += e.quantity;
        h.costBasis += e.quantity * e.price;
      } else if (e.type === 'sell'){
        const sellQty = -e.quantity; // e.quantity is negative for sells
        const costPerUnit = h.quantity > 0 ? h.costBasis / h.quantity : 0;
        h.quantity += e.quantity; // subtract
        h.costBasis -= sellQty * costPerUnit;
      }
      h.lastPrice = e.price;
      h.lastDate = e.date;
      h.tradeCount++;
    }
    return holdings;
  },

  /** XIRR via bisection over [-99.99%, +1000%] annualised — deliberately
   *  no Newton-Raphson step (Session #4 Test 10: multi-sign-change cash
   *  flows can make Newton-Raphson fail to converge; bisection always
   *  converges given a bracketing sign change). Marks any still-open
   *  holdings at their LAST TRADED PRICE from the ledger itself — not a
   *  live quote — and says so plainly in the UI, per Article 4.
   *  @param {any[]} [events] @returns {number|null} annualised rate, or null if unsolvable */
  xirr(events){
    events = events || this.load();
    if (!events.length) return null;

    /** @type {{date:Date, amount:number}[]} */
    const flows = events
      .filter(e => e.type === 'buy' || e.type === 'sell')
      .map(e => ({ date: new Date(e.date), amount: -e.quantity * e.price })); // buy: qty>0 → negative outflow; sell: qty<0 → positive inflow

    const holdings = this.replay(events);
    const today = new Date();
    let terminalValue = 0;
    for (const symbol in holdings){
      const h = holdings[symbol];
      // A single trade's own price is not a "last traded price" mark — it's
      // just that trade's own cost, and using it here would trivially
      // cancel the position's own cash flow into a fake ~0% return. Only
      // mark an open position once a LATER, separate trade in the same
      // symbol has actually re-priced it.
      if (h.quantity > 0.0001 && h.tradeCount > 1) terminalValue += h.quantity * h.lastPrice;
    }
    if (terminalValue > 0) flows.push({ date: today, amount: terminalValue });

    if (flows.length < 2) return null;
    const hasPositive = flows.some(f => f.amount > 0);
    const hasNegative = flows.some(f => f.amount < 0);
    if (!hasPositive || !hasNegative) return null; // no real return to solve for

    const t0 = flows.reduce((min, f) => f.date < min ? f.date : min, flows[0].date).getTime();
    const npv = (rate) => flows.reduce((sum, f) => {
      const years = (f.date.getTime() - t0) / (365 * 86400000);
      return sum + f.amount / Math.pow(1 + rate, years);
    }, 0);

    let lo = -0.9999, hi = 10;
    let nLo = npv(lo), nHi = npv(hi);
    if (nLo * nHi > 0) return null; // no sign change in this bracket — bail honestly rather than guess

    for (let i = 0; i < 200; i++){
      const mid = (lo + hi) / 2;
      const nMid = npv(mid);
      if (Math.abs(nMid) < 1e-6) return mid;
      if (nLo * nMid < 0){ hi = mid; nHi = nMid; } else { lo = mid; nLo = nMid; }
    }
    return (lo + hi) / 2;
  },

  /** One summary line's worth of numbers for the My Money view.
   *  @param {any[]} [events] */
  summary(events){
    events = events || this.load();
    const holdings = this.replay(events);
    let holdingsValue = 0, costBasis = 0;
    for (const symbol in holdings){
      const h = holdings[symbol];
      if (h.quantity > 0.0001){ holdingsValue += h.quantity * h.lastPrice; costBasis += h.costBasis; }
    }
    return {
      n: events.length,
      holdingsValue, costBasis,
      unrealizedPL: holdingsValue - costBasis,
      xirr: this.xirr(events)
    };
  }
};
