// @ts-check
/* ============================================================
   J.A.R.V.I.S — provenance drill-down (Sprint 17 core slice)
   Constitution Article 6: "every conclusion is explainable as a
   one-line chain a human can read." This module is that promise made
   clickable — a small registry of providers, each turning a displayed
   number back into its formula + the real inputs that produced it.

   Wired to 5 flagship numbers this sprint (impact, conviction, XIRR,
   Brier score, parser health) — deliberately not every number in the
   app. The registry pattern means adding a 6th is a ~10-line addition,
   not a redesign; which numbers get wired next is a scope choice, not
   an architecture one.
   ============================================================ */

const Provenance = {
  /** @type {Object<string, (data:any)=>{formula:string, inputs:Array<{label:string,value:any}>, note?:string}>} */
  providers: {
    impact(item){
      return {
        formula: 'impact% = round(100 × rank(impactRaw) / (n+1)), ties averaged, clamped to [1,99]',
        inputs: [
          { label: 'impactRaw (pre-percentile)', value: item.impactRaw },
          { label: 'corpus size today (n)', value: Engine.items.length },
          { label: 'confirmed (+15 to impactRaw)', value: item.confirmed ? 'yes' : 'no' },
          { label: 'hype-flagged (×0.5 to impactRaw)', value: item.hype ? 'yes' : 'no' },
          { label: 'displayed impact', value: item.impact }
        ],
        note: 'Percentile, not a raw score — the same impactRaw ranks differently on a busy vs quiet day, by design (Session #7).'
      };
    },
    conviction(idea){
      const c = idea.convComponents || {};
      return {
        formula: 'convictionV2 = 0.40×clusterScore + 0.20×sourcesTerm + 0.20×flowsTerm + 0.20×sentiTerm',
        inputs: [
          { label: 'clusterScore', value: c.clusterScore },
          { label: 'sourcesTerm', value: c.sourcesTerm },
          { label: 'flowsTerm', value: c.flowsTerm },
          { label: 'sentiTerm', value: c.sentiTerm },
          { label: 'convictionV1 (comparison)', value: idea.convictionV1 },
          { label: 'displayed conviction', value: idea.conviction }
        ],
        note: 'v1/v2 run side by side (Sprint 5) — the flag in Engine.FLAGS.convictionV2 picks which one is displayed.'
      };
    },
    xirr(summary){
      const xirrDisplay = summary.xirr === null ? 'not solvable from this history' : (summary.xirr * 100).toFixed(1) + '%';
      return {
        formula: 'XIRR: bisection solve for r where Σ cashflow_i / (1+r)^(years_i) = 0',
        inputs: [
          { label: 'trades in this ledger', value: summary.n },
          { label: 'holdings value (terminal mark)', value: U.fmtCompact(summary.holdingsValue) },
          { label: 'unrealised P&L', value: U.fmtCompact(summary.unrealizedPL) },
          { label: 'displayed XIRR', value: xirrDisplay }
        ],
        note: 'Open positions are marked at the last traded price in your imported ledger, not a live quote (Sprint 7).'
      };
    },
    brier(calibration){
      return {
        formula: 'Brier = mean((forecast_probability/100 − outcome)²) over resolved predictions, outcome ∈ {0,1}',
        inputs: [
          { label: 'N resolved', value: calibration.n },
          { label: 'gate (min N to display)', value: Mirror.BRIER_MIN_N },
          { label: 'displayed score', value: calibration.ready ? calibration.score : 'below gate — showing raw count instead' }
        ],
        note: '0.25 is the "always 50/50" baseline to beat, not zero (Session #5).'
      };
    },
    parserHealth(honesty){
      const m = honesty.metrics.find(x => x.key === 'parser');
      return {
        formula: 'parser health % = 100 × (items with ≥1 detected entity) / (total items today)',
        inputs: [
          { label: "today's corpus size", value: honesty.n },
          { label: 'displayed', value: m ? m.display : 'n/a' }
        ],
        note: 'A rough proxy for "did entity extraction find anything useful" — not a claim about extraction accuracy.'
      };
    }
  },

  /** @param {string} type @param {any} data */
  compute(type, data){
    const p = this.providers[type];
    return p ? p(data) : null;
  }
};
