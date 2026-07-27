// @ts-check
/* ============================================================
   J.A.R.V.I.S — money manager
   Holdings ledger, allocation, SIP projector, cash engine.
   All data stays in this browser (localStorage).
   ============================================================ */

const Portfolio = {
  KEY: 'jarvis.portfolio.v1',
  VERSION: 1,
  MIGRATIONS: { 0: (data) => data }, // v0 (unversioned object) -> v1: shape unchanged, just wrapped
  state: { holdings: [], budget: { income: 0, expense: 0 }, watchlist: [] },

  load(){
    const data = Schema.load(this.KEY, this.VERSION, null, this.MIGRATIONS);
    if (data) this.state = { ...this.state, ...data };
    return this;
  },
  save(){ Schema.save(this.KEY, this.VERSION, this.state); Bus.emit('portfolio:changed', {}); },

  add(h){ this.state.holdings.push({ id: U.uid(), ...h }); this.save(); },
  remove(id){ this.state.holdings = this.state.holdings.filter(h => h.id !== id); this.save(); },
  loadDemo(){ this.state.holdings = JDATA.DEMO_BOOK.map(h => ({ id: U.uid(), ...h })); this.save(); },

  value(h){ return h.qty * h.cur; },
  cost(h){ return h.qty * h.buy; },
  netWorth(){ return this.state.holdings.reduce((s,h) => s + this.value(h), 0); },
  totalCost(){ return this.state.holdings.reduce((s,h) => s + this.cost(h), 0); },
  totalPL(){ return this.netWorth() - this.totalCost(); },

  allocation(){
    const agg = {};
    for (const h of this.state.holdings){
      agg[h.type] = (agg[h.type] || 0) + this.value(h);
    }
    return Object.entries(agg).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);
  },

  sipFV(monthly, years, ratePct){
    const r = ratePct/100/12, n = years*12;
    const fv = monthly * ((Math.pow(1+r, n) - 1) / r) * (1+r);
    return { fv, invested: monthly * n, gain: fv - monthly*n };
  },

  toggleWatch(name){
    const i = this.state.watchlist.indexOf(name);
    if (i >= 0) this.state.watchlist.splice(i, 1); else this.state.watchlist.push(name);
    this.save();
    return i < 0;
  },

  /* Jarvis-drafted observations about the book */
  insights(){
    const out = [];
    const hs = this.state.holdings;
    if (!hs.length) return out;
    const nw = this.netWorth();
    const alloc = this.allocation();

    if (alloc[0] && alloc[0].value / nw > .6)
      out.push(`Concentration flag: ${alloc[0].label} is ${(100*alloc[0].value/nw).toFixed(0)}% of the book. Diversification is the only free lunch, Sir.`);

    const cash = alloc.find(a => a.label === 'Cash');
    const monthlyExp = this.state.budget.expense || 0;
    if (monthlyExp > 0){
      const months = cash ? cash.value / monthlyExp : 0;
      if (months < 3) out.push(`Emergency buffer covers ~${months.toFixed(1)} months of expenses. Protocol recommends 6. Build the moat before the siege.`);
      else out.push(`Emergency buffer: ~${months.toFixed(1)} months of expenses secured. Acceptable resilience.`);
    }

    const winners = hs.filter(h => this.value(h) > this.cost(h) * 1.25);
    if (winners.length)
      out.push(`${winners.length} holding${winners.length>1?'s':''} up 25%+ (${winners.slice(0,3).map(h=>h.name).join(', ')}). Review position sizes — let winners run, but rebalance what has outgrown its risk budget.`);

    // link to detected patterns
    const topSectors = Engine.clusters.slice(0, 3).map(c => c.sector);
    const exposed = new Set();
    for (const h of hs){
      for (const s of topSectors){
        if ((JDATA.SECTORS[s]?.watch || []).some(w => h.name.toLowerCase().includes(w.toLowerCase().split(' ')[0])))
          exposed.add(JDATA.SECTORS[s].label);
      }
    }
    if (exposed.size)
      out.push(`Your book already rides ${[...exposed].join(' & ')} — sectors where my pattern engine sees active capital flows. Alignment noted.`);
    else if (Engine.clusters.length)
      out.push(`None of your holdings map to the top detected pattern (${Engine.clusters[0].label}). Worth a research pass in the Ideas Lab.`);

    const savings = this.state.budget.income - this.state.budget.expense;
    if (this.state.budget.income > 0 && savings > 0)
      out.push(`Deploying your ₹${savings.toLocaleString('en-IN')}/mo surplus as a SIP at 12% builds ~${U.fmtCompact(this.sipFV(savings, 10, 12).fv)} in 10 years. Time in the market, Sir.`);

    return out.slice(0, 4);
  }
};
