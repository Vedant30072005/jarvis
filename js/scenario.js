// @ts-check
/* ============================================================
   J.A.R.V.I.S — scenario stress engine (causal-graph propagation)

   Turns JDATA.CAUSAL_EDGES from an inert lookup table into actual
   second-order reasoning: given a shock ("Crude +20%"), propagate it
   one step through the signed/lagged edges to every affected sector,
   and — where the user holds that sector — flag the direction and
   rupee exposure of the hit.

   Honesty rules, straight from Session #3's own caveats, enforced in
   the UI copy every card carries:
   - SINGLE STEP ONLY. No multi-hop propagation, no feedback loops
     ("IT strong → rupee strengthens → IT weaker" would need an
     iterating equilibrium solver — explicitly out of scope).
   - Signs are NET-AVERAGE directional effects, not point predictions,
     and carry NO magnitude — "positively exposed", never "+X%".
   - Lags are typical repricing estimates, not guarantees.

   Pure rule-based graph traversal. No AI, no probabilities invented.
   ============================================================ */

const Scenario = {
  /** Causal destination label → JDATA.SECTORS key, or null when the
   *  destination has no matching portfolio sector (Real Estate,
   *  Aviation, Paints, Shipping, Monsoon are intermediate/uncovered). */
  DEST_TO_SECTOR: {
    'banks': 'banks', 'it & ai': 'it', 'infra': 'infra', 'pharma': 'pharma',
    'semis': 'semis', 'defence': 'defence', 'ev & auto': 'ev', 'gold': 'gold',
    'metals': 'metals', 'metals & mining': 'metals',
    'energy': 'energy', 'energy (oil & gas)': 'energy', 'energy (renewables)': 'energy'
  },

  /** @param {string} destLabel @returns {string|null} */
  destSectorKey(destLabel){
    return this.DEST_TO_SECTOR[String(destLabel).toLowerCase().trim()] || null;
  },

  /** Family key groups the split shock strings ("USD strength (INR
   *  weakens)" + "USD strength") so propagating one gathers both;
   *  the +/- stays in the key so opposite crude shocks never merge.
   *  @param {string} from */
  _familyKey(from){
    return String(from).toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, ' ')  // drop parentheticals
      .replace(/\s*\/.*$/, '')          // drop "/ tariff escalation" tails
      .replace(/\s+/g, ' ').trim();
  },

  /** Distinct shock families available, each with a representative
   *  canonical `from` label and its edge count — powers the catalog UI
   *  and the "I have these scenarios" fallback. */
  catalog(){
    const seen = {};
    for (const e of JDATA.CAUSAL_EDGES){
      const k = this._familyKey(e.from);
      (seen[k] = seen[k] || { key: k, label: e.from, count: 0 }).count++;
    }
    return Object.values(seen).sort((a, b) => b.count - a.count);
  },

  /** Ordered query→canonical-shock matchers. First match wins; the
   *  canonical label is one that really exists in CAUSAL_EDGES so
   *  propagate() always finds edges. Direction words disambiguate the
   *  ± shocks (crude up vs down, rate cut vs hike, rupee weak vs
   *  strong, FII in vs out, monsoon fail vs good).
   *  @type {Array<{rx:RegExp, shock:string}>} */
  MATCHERS: [
    { rx: /(crude|oil)\b.*(fall|drop|crash|slump|decline|down|cheaper|−|-\s*\d)/i, shock: 'Crude −20%' },
    { rx: /(crude|oil)\b/i, shock: 'Crude +20%' }, // crude, direction unspecified → the spike case
    { rx: /(rate|rbi).*(cut|reduction|lower|ease|easing)|cut.*rate/i, shock: 'RBI rate cut' },
    { rx: /(rate|rbi).*(hike|raise|rise|increase|tighten)|hike.*rate/i, shock: 'RBI rate hike' },
    { rx: /(rupee.*(weak|fall|depreciat|slid)|dollar.*(strong|rise|surg)|inr.*weak|usd.*(strong|up))/i, shock: 'USD strength (INR weakens)' },
    { rx: /(rupee.*(strong|rise|apprec)|dollar.*(weak|fall)|inr.*strong)/i, shock: 'USD weakness (INR strengthens)' },
    { rx: /china.*(friction|tension|tariff|trade\s*war|slowdown|weak)|tariff\s*(war|escalat)/i, shock: 'China trade friction / tariff escalation' },
    { rx: /(vix|volatility).*(spike|surge|jump|rise|up)|market.*(panic|crash|selloff|sell-off)|risk.?off/i, shock: 'VIX spike' },
    { rx: /(fii|foreign|fpi).*(inflow|buying|buy|pour|rotation)/i, shock: 'FII inflows (broad EM rotation)' },
    { rx: /(fii|foreign|fpi).*(outflow|selling|sell|exit|flee|de.?risk)/i, shock: 'FII outflows (EM de-risking)' },
    { rx: /monsoon.*(fail|deficit|weak|poor|below|drought)/i, shock: 'Monsoon failure' },
    { rx: /monsoon.*(good|adequate|surplus|normal|strong|above)/i, shock: 'Monsoon adequate' },
    { rx: /budget.*(capex|infra|spending|allocation)|capex.*(boost|push|surge)/i, shock: 'Budget capex boost' },
    { rx: /budget.*defen[cs]e|defen[cs]e.*(budget|spending|allocation)/i, shock: 'Budget defence spending boost' },
    { rx: /inflation.*(spike|surge|rise|jump|high|hot)|high inflation/i, shock: 'Inflation spike' },
    { rx: /border.*(tension|clash|conflict)|india.?china.*(war|conflict|standoff|tension)/i, shock: 'India-China border tensions' }
  ],

  /** @param {string} query @returns {string|null} canonical shock label */
  matchShock(query){
    const q = String(query);
    for (const m of this.MATCHERS) if (m.rx.test(q)) return m.shock;
    return null;
  },

  /** Propagate a shock ONE STEP. Gathers every edge whose `from` shares
   *  the shock's family, resolves each destination to a held sector
   *  where possible, and attaches the user's real rupee exposure.
   *  Deduplicates destinations (a family with a full + short form can
   *  list the same sector twice) keeping the shorter lag.
   *  @param {string} shockFrom canonical shock label
   *  @returns {Array<{to:string, sign:number, lagDays:number, why:string, sectorKey:string|null, held:any[], exposure:number}>} */
  propagate(shockFrom){
    const fam = this._familyKey(shockFrom);
    const edges = JDATA.CAUSAL_EDGES.filter(e => this._familyKey(e.from) === fam);
    /** @type {Object<string, any>} */
    const byDest = {};
    for (const e of edges){
      const sectorKey = this.destSectorKey(e.to);
      let held = [];
      if (sectorKey === 'gold'){
        held = Portfolio.state.holdings.filter(h => h.type === 'Gold' ||
          (typeof Brain !== 'undefined' && Brain.holdingsInSector('gold').includes(h)));
      } else if (sectorKey && typeof Brain !== 'undefined'){
        held = Brain.holdingsInSector(sectorKey);
      }
      const exposure = held.reduce((s, h) => s + Portfolio.value(h), 0);
      const row = { to: e.to, sign: e.sign, lagDays: e.lagDays, why: e.why, sectorKey, held, exposure };
      const key = (sectorKey || e.to) + ':' + (e.sign > 0 ? '+' : '-');
      if (!byDest[key] || e.lagDays < byDest[key].lagDays) byDest[key] = row;
    }
    return Object.values(byDest).sort((a, b) => a.lagDays - b.lagDays);
  },

  /** Portfolio-level roll-up of a propagation: which held sectors are
   *  helped vs hurt, and the total rupee exposure on each side. Pure
   *  direction — no magnitude, because the edges carry none.
   *  @param {ReturnType<Scenario['propagate']>} rows */
  portfolioImpact(rows){
    const helped = rows.filter(r => r.exposure > 0 && r.sign > 0);
    const hurt = rows.filter(r => r.exposure > 0 && r.sign < 0);
    const sum = arr => arr.reduce((s, r) => s + r.exposure, 0);
    return { helped, hurt, helpedCr: sum(helped), hurtCr: sum(hurt), anyExposure: helped.length + hurt.length > 0 };
  }
};
