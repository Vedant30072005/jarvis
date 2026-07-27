// @ts-check
/* ============================================================
   J.A.R.V.I.S — honesty panel (Sprint 6)
   Five self-graded metrics on today's corpus, banded green/amber/red,
   plus a localStorage quota meter. Read-only — no drill-down popovers
   yet (Sprint 6 optional extension, deferred per the Session #15
   core-slice plan).

   Never lets a busy day and a quiet day look equally confident: below
   LOW_VOLUME_FLOOR items, every ratio here carries an explicit "less
   reliable" caveat instead of a bare number at the same visual weight
   (red-team Session #1, attack #12 — quiet-day percentile inflation).
   ============================================================ */

const Honesty = {
  LOW_VOLUME_FLOOR: 15,
  QUOTA_BYTES_ASSUMED: 5 * 1024 * 1024, // conservative floor across browsers; real quota is usually higher

  /** @param {number} value @param {number} greenAt @param {number} amberAt @param {boolean} higherIsBetter */
  band(value, greenAt, amberAt, higherIsBetter){
    if (higherIsBetter){
      if (value >= greenAt) return 'green';
      if (value >= amberAt) return 'amber';
      return 'red';
    }
    if (value <= greenAt) return 'green';
    if (value <= amberAt) return 'amber';
    return 'red';
  },

  quotaUsedPct(){
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if (!key) continue;
        bytes += key.length + (localStorage.getItem(key) || '').length;
      }
    } catch(e){ return 0; }
    return Math.min(100, Math.round(100 * bytes / this.QUOTA_BYTES_ASSUMED));
  },

  compute(){
    const items = Engine.items;
    const n = items.length;
    const lowVolume = n < this.LOW_VOLUME_FLOOR;

    const sources = new Set(items.map(i => i.s)).size;
    const withEntities = items.filter(i => i.entities && i.entities.length > 0).length;
    const parserHealthPct = n ? Math.round(100 * withEntities / n) : 0;
    const confirmedCount = items.filter(i => i.confirmed).length;
    const corroborationPct = n ? Math.round(100 * confirmedCount / n) : 0;
    const hypeCount = items.filter(i => i.hype).length;
    const hypePct = n ? Math.round(100 * hypeCount / n) : 0;

    return {
      n, lowVolume,
      truncation: Engine.truncation,
      metrics: [
        { key:'sources', label:'EFFECTIVE SOURCE COUNT', display: String(sources), band: this.band(sources, 8, 4, true) },
        { key:'parser', label:'PARSER HEALTH', display: parserHealthPct + '%', band: this.band(parserHealthPct, 80, 50, true) },
        { key:'corroboration', label:'CORROBORATION RATE', display: corroborationPct + '%', band: this.band(corroborationPct, 30, 15, true) },
        { key:'hype', label:'HYPE RATE', display: hypePct + '%', band: this.band(hypePct, 10, 25, false) },
        { key:'engine', label:'ENGINE VERSION', display: 'v' + JDATA.ENGINE_VERSION, band: 'neutral' },
        // Attack #15 fix (red-team Session #1): if Engine.run() ever caps
        // analysis (a flood, deliberate or organic), that MUST be visible
        // here, never silent — silent truncation during a flood is
        // exactly when integrity matters most and is least likely to be
        // manually noticed.
        ...(Engine.truncation.capped ? [{ key:'truncation', label:'ANALYSIS CAP',
          display: `capped at ${Engine.truncation.analyzed} — ${Engine.truncation.skipped} not analyzed`, band: 'red' }] : [])
      ],
      quotaPct: this.quotaUsedPct()
    };
  },

  /** Derives a handful of real, currently-cheap alerts from today's data
   *  and raises them through the shared Alerts contract — a concrete,
   *  end-to-end proof the alert spine works before Sprint 9's sonar
   *  becomes its main producer. Idempotent: re-running just refreshes
   *  the same dedupeKeys instead of piling up duplicates. */
  seedAlerts(){
    const h = this.compute();
    if (h.lowVolume){
      Alerts.raise({ severity:'info', source:'honesty', dedupeKey:'low-volume-day',
        message:`Only ${h.n} signals today — ratios on this panel are less reliable than on a normal-volume day.` });
    }
    const hypeMetric = h.metrics.find(m => m.key === 'hype');
    if (hypeMetric && hypeMetric.band === 'red'){
      Alerts.raise({ severity:'warn', source:'honesty', dedupeKey:'hype-rate-high',
        message:`Hype rate at ${hypeMetric.display} today — a larger-than-usual share of the feed reads as manufactured.` });
    }
    if (h.truncation.capped){
      Alerts.raise({ severity:'warn', source:'honesty', dedupeKey:'analysis-capped',
        message:`Analysis capped at ${h.truncation.analyzed} most-recent items — ${h.truncation.skipped} items this cycle were not analyzed.` });
    }
    const caution = Engine.ideas.find(i => i.kind === 'caution');
    if (caution){
      Alerts.raise({ severity:'warn', source:'threat-board', dedupeKey:'caution-' + caution.sector,
        message:`${caution.label} has turned defensive — bearish cluster active.` });
    }
  }
};
