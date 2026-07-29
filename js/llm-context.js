// @ts-check
/* ============================================================
   J.A.R.V.I.S — LLM context provider

   Assembles grounded, real-time app state into a system prompt
   so the local model answers with actual data, not hallucinated
   figures. This module reads from Engine, Portfolio, Market,
   Mirror, and JDATA — it must load AFTER all of them.

   Constitution compliance:
     Art. 4 — every number says who, as of when (we inject source info)
     Art. 7 — nothing here leaves the machine (context goes to local Ollama)
     Art. 11 — the model may interpret, but conviction stays with the user
   ============================================================ */

const LLMContext = {

  /** Build the full system prompt: JARVIS persona + live app state.
   *  Called once per LLM invocation (not per token).
   *  @returns {string} */
  systemPrompt(){
    const time = new Date();
    const hour = time.getHours();
    const greeting = hour < 5 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    let prompt = `You are J.A.R.V.I.S — Just A Rather Very Intelligent System — a personal economic intelligence assistant for an Indian retail investor. You speak in a calm, precise, British-butler tone — respectful, occasionally dry-witted, and always grounded. Address the user as "Sir".

Current time: ${time.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })} (${greeting}).

CRITICAL RULES:
- You are running LOCALLY on the user's machine via Ollama. Nothing you say leaves this computer.
- NEVER fabricate stock prices, NAV values, index levels, or any financial figures. If you don't have the data, say so honestly.
- NEVER recommend buying or selling specific securities. You analyse, you do not execute or urge.
- When citing data, always note it comes from the signals/patterns currently on the board — not from your training data.
- Keep responses concise and actionable. This is a terminal-style chat, not an essay prompt.
- Use ₹ for Indian Rupee amounts. Use crore/lakh notation (e.g., ₹1,500 Cr).
- You may use bold (**text**) for emphasis. Keep formatting minimal.

Below is the LIVE STATE of the app right now. Use this data — and ONLY this data — when answering questions about the user's portfolio, market signals, or patterns.\n\n`;

    prompt += this._portfolioContext();
    prompt += this._signalsContext();
    prompt += this._patternsContext();
    prompt += this._marketContext();
    prompt += this._predictionsContext();

    return prompt;
  },

  /** Compact portfolio summary for context injection.
   *  @returns {string} */
  _portfolioContext(){
    const nw = typeof Portfolio !== 'undefined' ? Portfolio.netWorth() : 0;
    if (!nw) return '--- PORTFOLIO ---\nNo holdings recorded yet.\n\n';

    const holdings = Portfolio.state.holdings;
    const pl = Portfolio.totalPL();
    const cost = Portfolio.totalCost();
    const plPct = cost ? (100 * pl / cost).toFixed(1) : '0';
    const alloc = Portfolio.allocation();

    let ctx = `--- PORTFOLIO ---\n`;
    ctx += `Net worth: ${U.fmtCompact(nw)} | P&L: ${pl >= 0 ? '+' : ''}${plPct}% (${U.fmtCompact(Math.abs(pl))})\n`;
    ctx += `Allocation: ${alloc.map(a => `${a.label} ${(100 * a.value / nw).toFixed(0)}%`).join(', ')}\n`;
    ctx += `Holdings (${holdings.length}):\n`;
    holdings.slice(0, 20).forEach(h => {
      const val = Portfolio.value(h);
      const hPl = val - Portfolio.cost(h);
      ctx += `  • ${h.name}: ${h.qty} units, ${U.fmtCompact(val)} (${hPl >= 0 ? '+' : ''}${cost ? (100 * hPl / Portfolio.cost(h)).toFixed(1) : 0}%)\n`;
    });
    if (holdings.length > 20) ctx += `  ... and ${holdings.length - 20} more\n`;
    ctx += '\n';
    return ctx;
  },

  /** Top signals currently on the board.
   *  @returns {string} */
  _signalsContext(){
    if (typeof Engine === 'undefined' || !Engine.items.length)
      return '--- SIGNALS ---\nNo signals on the board.\n\n';

    const top = [...Engine.items].filter(i => !i.hype)
      .sort((a, b) => b.impact - a.impact).slice(0, 10);
    const st = Engine.stats();

    let ctx = `--- SIGNALS ---\n`;
    ctx += `${st.signals} signals scanned | Bias: ${st.bullPct}% bullish | Tracked capital: ${U.fmtCr(st.trackedCr)}\n`;
    ctx += `Top 10 by impact:\n`;
    top.forEach(i => {
      const senti = i.senti === 'bull' ? '▲' : i.senti === 'bear' ? '▼' : '•';
      ctx += `  ${senti} [impact ${i.impact}] "${i.t.slice(0, 100)}" — ${i.s}, sectors: ${i.sectors.join(', ') || 'none'}\n`;
    });
    ctx += '\n';
    return ctx;
  },

  /** Active pattern clusters.
   *  @returns {string} */
  _patternsContext(){
    if (typeof Engine === 'undefined' || !Engine.clusters.length)
      return '--- PATTERNS ---\nNo active patterns.\n\n';

    let ctx = `--- PATTERNS ---\n`;
    ctx += `${Engine.clusters.length} active pattern clusters:\n`;
    Engine.clusters.slice(0, 8).forEach(c => {
      ctx += `  • ${c.label}: momentum ${c.score}/100, ${c.items.length} signals, ${c.bull} bull / ${c.bear} bear, ${c.sources} sources\n`;
    });

    // Ideas/theses
    const ideas = Engine.ideas;
    if (ideas.length){
      ctx += `Drafted theses:\n`;
      ideas.slice(0, 5).forEach(i => {
        ctx += `  • [${i.kind}] ${i.label}: conviction ${i.conviction}%, ${i.horizon}. "${i.thesis.slice(0, 120)}"\n`;
      });
    }
    ctx += '\n';
    return ctx;
  },

  /** Market tape / index levels (if available).
   *  @returns {string} */
  _marketContext(){
    if (typeof Market === 'undefined') return '';
    const idx = Market.indices();
    if (!idx.length) return '--- MARKET ---\nNo live index data (relay may not be running).\n\n';

    let ctx = `--- MARKET ---\n`;
    ctx += `Session: ${Market.session().label}\n`;
    idx.forEach(i => {
      ctx += `  ${i.label}: ${i.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${i.changePct >= 0 ? '+' : ''}${i.changePct.toFixed(2)}%)\n`;
    });
    const stamp = Market.stamp();
    if (stamp) ctx += `  Last fetched: ${stamp}\n`;
    ctx += '\n';
    return ctx;
  },

  /** Prediction track record.
   *  @returns {string} */
  _predictionsContext(){
    if (typeof Mirror === 'undefined') return '';
    const preds = Mirror.loadPredictions();
    if (!preds.length) return '';

    const open = preds.filter(p => !p.resolved);
    const resolved = preds.filter(p => p.resolved);
    const brier = Mirror.brierScore();

    let ctx = `--- PREDICTIONS ---\n`;
    ctx += `${open.length} open, ${resolved.length} resolved`;
    if (brier.ready) ctx += ` | Brier score: ${brier.score} (lower is better, 0.25 = coin flip baseline)`;
    ctx += '\n';
    if (open.length){
      ctx += `Open predictions:\n`;
      open.slice(0, 5).forEach(p => {
        ctx += `  • "${p.title}" — ${p.probability}% probability, due ${p.resolveBy}\n`;
      });
    }
    ctx += '\n';
    return ctx;
  },

  /** For a specific query, find relevant signals to inject as extra
   *  grounding. Returns a compact string, or empty if nothing relevant.
   *  @param {string} query @returns {string} */
  relevantContext(query){
    if (typeof Brain === 'undefined' || typeof Engine === 'undefined') return '';
    const sectors = Brain.matchSectors(query);
    if (!sectors.length) return '';

    let ctx = `\n--- RELEVANT TO YOUR QUERY ---\n`;
    sectors.forEach(key => {
      const label = JDATA.SECTORS[key]?.label || key;
      const signals = Engine.items.filter(i => i.sectors.includes(key) && !i.hype)
        .sort((a, b) => b.impact - a.impact).slice(0, 5);
      const cluster = Engine.clusters.find(c => c.sector === key);
      const holdings = Brain.holdingsInSector(key);
      const exposure = holdings.reduce((s, h) => s + Portfolio.value(h), 0);

      ctx += `${label}:\n`;
      if (cluster) ctx += `  Cluster: momentum ${cluster.score}/100, ${cluster.bull}B/${cluster.bear}b\n`;
      if (exposure) ctx += `  Your exposure: ${U.fmtCompact(exposure)} across ${holdings.map(h => h.name).join(', ')}\n`;
      if (signals.length){
        ctx += `  Recent signals:\n`;
        signals.forEach(s => ctx += `    ${s.senti === 'bull' ? '▲' : s.senti === 'bear' ? '▼' : '•'} "${s.t.slice(0, 80)}" — ${s.s}\n`);
      }
    });
    return ctx;
  }
};
