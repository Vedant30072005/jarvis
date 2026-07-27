// @ts-check
/* ============================================================
   J.A.R.V.I.S — Sunday review (Sprint 15 core slice)
   "Witnesses, not gates" (Constitution Article 13): every "blocking"
   screen here only blocks FORWARD PROGRESS within the ritual — the
   user can always close the modal and walk away, same as anywhere
   else in the app. Nothing here prevents an action in the moment; it
   only makes the fact of what happened undeniable after the fact.

   Two screens from Session #6's original design are adapted, not
   dropped silently:
   - Blind spots: real click/view-tracking infrastructure doesn't
     exist (that's the "attention-distribution drift" optional
     extension, explicitly deferred). Substituted with a real,
     computable proxy — active clusters the user holds zero portfolio
     exposure to, reusing the exact sector-matching heuristic from
     Sprint 10's Brain.
   - Alerts: fired-vs-acted OUTCOME tracking doesn't exist either
     (same deferred extension). Shows currently-active alerts only.
   The "One Question" reflection screen and the next-Sunday commitment
   callback are both deferred per the Session #15 core-slice plan.
   ============================================================ */

const SundayReview = {
  KEY: 'jarvis.sundayreview.v1',
  VERSION: 1,
  MIGRATIONS: { 0: (data) => data },
  RECONCILE_WINDOW_DAYS: 3, // a journal entry within N days before a trade counts as "logged beforehand" — no NLP, presence-only

  loadHistory(){ return /** @type {any[]} */ (Schema.load(this.KEY, this.VERSION, [], this.MIGRATIONS)); },

  /** @param {{ifText:string, willText:string}} c */
  saveCommitment({ ifText, willText }){
    const history = this.loadHistory();
    history.push({ id: U.uid(), date: U.todayKey(), ifText, willText, createdAt: Date.now() });
    Schema.save(this.KEY, this.VERSION, history);
    return history.length;
  },

  weekTrades(){
    const cutoff = U.todayKey(new Date(Date.now() - 7 * 86400000));
    return Ledger.load().filter(e => (e.type === 'buy' || e.type === 'sell') && String(e.date) >= cutoff);
  },

  weekNumbers(){
    const trades = this.weekTrades();
    const buys = trades.filter(t => t.type === 'buy').length;
    const sells = trades.filter(t => t.type === 'sell').length;
    const turnoverCr = trades.reduce((s, t) => s + Math.abs(t.quantity * t.price), 0);
    const nw = Portfolio.netWorth();
    return { trades: trades.length, buys, sells, turnoverPct: nw > 0 ? Math.round(100 * turnoverCr / nw) : null };
  },

  /** Rough, presence-only reconciliation — no NLP, matching the rest of
   *  this engine's "no fancy matching" discipline: did ANY journal entry
   *  exist within RECONCILE_WINDOW_DAYS before a trade? */
  reconciliation(){
    const trades = this.weekTrades();
    const journal = Mirror.loadJournal();
    const flagged = [];
    let withThesis = 0;
    for (const t of trades){
      const tradeTime = new Date(t.date).getTime();
      const windowStart = tradeTime - this.RECONCILE_WINDOW_DAYS * 86400000;
      const hasEntry = journal.some(j => j.createdAt >= windowStart && j.createdAt <= tradeTime + 86400000);
      if (hasEntry) withThesis++; else flagged.push(t);
    }
    return { total: trades.length, withThesis, flagged };
  },

  predictionsDue(){
    const today = U.todayKey();
    return Mirror.loadPredictions().filter(p => !p.resolved && String(p.resolveBy) < today);
  },

  /** Active clusters with zero portfolio exposure — see module header
   *  for why this substitutes for click/view-tracking "blind spots." */
  blindSpots(){
    const holdings = Portfolio.state.holdings;
    return Engine.clusters.filter(c => {
      const exposed = holdings.some(h => (JDATA.SECTORS[c.sector]?.watch || []).some(w => h.name.toLowerCase().includes(w.toLowerCase().split(' ')[0])));
      return !exposed;
    }).sort((a, b) => b.score - a.score);
  },

  activeAlerts(){ return Alerts.list(); },

  calibration(){ return Mirror.brierScore(); },

  /** Deterministic template-filled markdown — no generated prose, per
   *  Session #6's own emphasis on this being a durable, exportable
   *  artifact rather than a UI-only experience.
   *  @param {any} d */
  generateMemo(d){
    const lines = [
      `# Sunday Review — ${new Date().toDateString()}`, '',
      `**Numbers**: ${d.numbers.trades} trades (${d.numbers.buys} buy, ${d.numbers.sells} sell)${d.numbers.turnoverPct !== null ? `, ${d.numbers.turnoverPct}% turnover` : ''}.`, '',
      `**Rule-following**: ${d.reconciliation.withThesis}/${d.reconciliation.total} trades had a thesis logged beforehand.` +
        (d.reconciliation.flagged.length ? ` Flagged: ${d.reconciliation.flagged.map(t => t.symbol).join(', ')}.` : ''), '',
      `**Predictions resolved this session**: ${d.predictionsResolvedCount}.`, '',
      `**Blind spots**: ${d.blindSpots.length ? d.blindSpots.slice(0, 3).map(c => c.label).join(', ') : 'none — every active cluster has some exposure'}.`, '',
      `**Alerts**: ${d.alerts.length} active.`, '',
      `**Calibration**: ${d.calibration.ready ? `Brier ${d.calibration.score} (N=${d.calibration.n})` : `${d.calibration.n} resolved — need ${Mirror.BRIER_MIN_N}`}.`, '',
      `**This week's commitment**: "If ${d.ifText}, I will ${d.willText}."`
    ];
    return lines.join('\n');
  }
};
