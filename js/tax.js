// @ts-check
/* ============================================================
   J.A.R.V.I.S — tax-as-data-table (Sprint 8 core slice)
   Current capital-gains rates as a plain data table (AY 2026-27, post
   the July 2024 Budget changes), plus one flat compute function. No
   scenario analysis, no exit-timing wizard — those are explicitly
   later-sprint scope per the Session #15 core-slice plan.

   Illustrative only — not tax advice. Rates are a snapshot the user
   must verify against the actual Finance Act before filing; this
   module exists to save a lookup, not to replace a CA (Constitution
   Article 4: every number says who, as of when).
   ============================================================ */

const Tax = {
  AS_OF: 'AY 2026-27 (post Budget 2024)',

  /** stcgRate/ltcgRate null means that bucket is taxed at the user's income
   *  slab rate, not a flat percentage — computeGain() reports this as
   *  `slabTaxed` rather than guessing a number.
   *  @type {Object<string, {label:string, stcgMonths:number, stcgRate:number|null, ltcgRate:number|null, ltcgExemption:number, note:string}>} */
  RATES: {
    equity: {
      label: 'Listed equity / equity-oriented MF (≥65% equity)',
      stcgMonths: 12, stcgRate: 0.20, ltcgRate: 0.125, ltcgExemption: 125000,
      note: 'STCG 20% flat if held <12 months. LTCG 12.5% on gains above ₹1.25L/year if held ≥12 months.'
    },
    debt: {
      label: 'Debt mutual funds (post-April-2023 purchases)',
      stcgMonths: 0, stcgRate: null, ltcgRate: null, ltcgExemption: 0,
      note: 'No LTCG concept — taxed at your income slab rate regardless of holding period.'
    },
    gold: {
      label: 'Gold (physical / ETF / MF)',
      stcgMonths: 24, stcgRate: null, ltcgRate: 0.125, ltcgExemption: 0,
      note: 'STCG (<24 months) taxed at slab rate. LTCG (≥24 months) 12.5%, no indexation.'
    },
    intlEquity: {
      label: 'International equity funds',
      stcgMonths: 24, stcgRate: null, ltcgRate: 0.125, ltcgExemption: 0,
      note: 'STCG (<24 months) taxed at slab rate. LTCG (≥24 months) 12.5%, no indexation.'
    }
  },

  /** Computes tax on a single realised gain. Returns a slab-rate note
   *  instead of a number wherever the rate genuinely depends on the
   *  user's income bracket — guessing a slab would be a false-precision
   *  number no different from the hype this project's engine refuses
   *  to launder elsewhere.
   *  @param {{assetClass:string, gain:number, holdingMonths:number}} p
   *  @returns {{bucket:'STCG'|'LTCG', rate:number, tax:number}|{bucket:'STCG'|'LTCG', slabTaxed:true, note:string}|null} */
  computeGain({ assetClass, gain, holdingMonths }){
    const r = this.RATES[assetClass];
    if (!r || gain <= 0) return null;
    const isLongTerm = holdingMonths >= r.stcgMonths;
    const bucket = isLongTerm ? 'LTCG' : 'STCG';

    // Gated per-bucket on that bucket's own rate, not a single asset-wide
    // flag — gold and international funds are slab-taxed short-term but a
    // flat LTCG rate long-term, so the two buckets must be checked independently.
    if (isLongTerm && r.ltcgRate !== null){
      const taxableGain = Math.max(0, gain - r.ltcgExemption);
      return { bucket, rate: r.ltcgRate, tax: Math.round(taxableGain * r.ltcgRate) };
    }
    if (!isLongTerm && r.stcgRate !== null){
      return { bucket, rate: r.stcgRate, tax: Math.round(gain * r.stcgRate) };
    }
    return { bucket, slabTaxed: true, note: r.note };
  }
};
