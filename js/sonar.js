// @ts-check
/* ============================================================
   J.A.R.V.I.S — anomaly sonar (Sprint 9 core slice + robustness batch)
   Two independent anomaly signals, both read-only this sprint (no
   alert-spine integration, no calendar suppression — later-sprint
   scope per the Session #15 core-slice plan):

   1. Term-frequency spikes: today's term mentions vs a MEDIAN/MAD
      baseline over prior days' rollups (Store.computeTermCounts).
      Robustness batch (red-team Session #1):
        - median/MAD instead of mean/stddev — one wild outlier day
          two weeks ago no longer drags the whole baseline (a mean
          gets pulled toward it; a median mostly ignores it).
        - Attack #5 (calibration-gap timing): a term with ZERO prior
          mentions in EVERY history day (a brand-new entity, or one
          just added to JDATA.COMPANIES) has a degenerate own-series
          baseline — median/MAD of all-zeros is (0, 0), which would
          make ANY mention count read as an infinite-sigma "spike".
          Cold-start terms instead borrow the CROSS-TERM baseline
          (median of other terms' own medians/MADs that day) — a
          conservative, realistic threshold instead of a fragile
          all-zero one. Cold-start protection, not cold-start
          blindness OR cold-start hair-trigger.

   2. Pump-dump guard: Session #1's attacks #1 and #2 — a confirmed
      corroboration group whose sources are ALL untiered (coordinated
      low-tier burst), and same-company mention velocity in a short
      window, independent of dedup grouping (catches reworded
      duplicates that dodge shingle matching).
   ============================================================ */

const Sonar = {
  BASELINE_MIN_DAYS: 3,     // below this, ANY baseline (even robust) is too noisy to trust
  SPIKE_SIGMA: 2,           // robust z-score threshold, applied to MAD scaled to stddev-equivalent units
  SPIKE_MIN_COUNT: 3,       // floor so a lone 1-vs-0 day never reads as a "spike"
  MAD_TO_SIGMA: 1.4826,     // consistency constant: scales MAD to be comparable to stddev under normality

  PUMP_VELOCITY_WINDOW_H: 2,
  PUMP_VELOCITY_THRESHOLD: 4, // hard-coded per the core-slice plan; no calibration this sprint

  mean(arr){ return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; },

  /** Sample standard deviation (n-1 denominator); 0 for fewer than 2 points.
   *  Kept for callers/tests that still want the original mean/stddev view
   *  (e.g. displaying "vs your usual average") — no longer used to GATE
   *  the spike decision itself, see median()/mad() below. */
  stddev(arr, m){
    if (arr.length < 2) return 0;
    const mn = m ?? this.mean(arr);
    const variance = arr.reduce((s, x) => s + (x - mn) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
  },

  /** @param {number[]} arr */
  median(arr){
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },

  /** Median Absolute Deviation — robust spread measure, resistant to the
   *  single-outlier-day distortion mean/stddev suffers from.
   *  @param {number[]} arr @param {number} [med] */
  mad(arr, med){
    const m = med ?? this.median(arr);
    return this.median(arr.map(x => Math.abs(x - m)));
  },

  /** @param {NewsItem[]} items today's corpus
   *  @param {any[]} [historyOverride] injectable for tests; defaults to Store's real history
   *  @returns {{ready:boolean, daysAvailable:number, spikes:Array<{term:string, today:number, median:number, mad:number, borrowed:boolean, sources:string[]}>}} */
  termSpikes(items, historyOverride){
    const today = U.todayKey();
    const history = (historyOverride || Store.loadHistory()).filter(r => r.date !== today);
    if (history.length < this.BASELINE_MIN_DAYS) return { ready: false, daysAvailable: history.length, spikes: [] };

    const { termCounts, termSources } = Store.computeTermCounts(items);

    // Per-term (median, MAD) over its own history, for every term seen
    // TODAY — needed both for each term's own baseline and to build the
    // cross-term borrowed baseline (attack #5) from whichever of today's
    // terms actually have real (non-degenerate) history of their own.
    /** @type {Object<string, {series:number[], med:number, mad:number}>} */
    const perTerm = {};
    for (const term in termCounts){
      const series = history.map(r => (r.termCounts && r.termCounts[term]) || 0);
      const med = this.median(series);
      perTerm[term] = { series, med, mad: this.mad(series, med) };
    }
    const realBaselines = Object.values(perTerm).filter(t => !t.series.every(x => x === 0));
    const borrowedMed = realBaselines.length ? this.median(realBaselines.map(t => t.med)) : 0;
    const borrowedMad = realBaselines.length ? this.median(realBaselines.map(t => t.mad)) : 0;

    const spikes = [];
    for (const term in termCounts){
      const todayCount = termCounts[term];
      if (todayCount < this.SPIKE_MIN_COUNT) continue;
      const own = perTerm[term];
      const coldStart = own.series.every(x => x === 0); // never mentioned before today
      const med = coldStart ? borrowedMed : own.med;
      const madv = coldStart ? borrowedMad : own.mad;
      const spread = madv * this.MAD_TO_SIGMA;
      if (todayCount > med + this.SPIKE_SIGMA * spread){
        spikes.push({ term, today: todayCount, median: Math.round(med * 10) / 10, mad: Math.round(madv * 10) / 10,
          borrowed: coldStart, sources: termSources[term] || [] });
      }
    }
    spikes.sort((a, b) => (b.today - b.median) - (a.today - a.median));
    return { ready: true, daysAvailable: history.length, spikes };
  },

  /** @param {NewsItem[]} items
   *  @param {any[]} [groupsOverride] injectable for tests; defaults to Engine.groups
   *  @returns {Array<{sector:string|null, label:string, reason:'coordinated-low-tier-burst'|'mention-velocity-spike', count:number, sources:string[]}>} */
  pumpDumpGuard(items, groupsOverride){
    const flags = [];

    // Attack #1: a "confirmed" (2+ distinct source names) group where
    // NOT ONE of those sources is tiered (official/wire) — distinct
    // source NAMES without any source-tier diversity is a weak proxy
    // for genuine independent corroboration.
    const groups = groupsOverride || Engine.groups;
    for (const g of groups){
      if (g.confirmed && !g.sources.some(s => JDATA.sourceWeight(s) > 1)){
        flags.push({ sector: g.sector, label: String(g.title).slice(0, 70), reason: 'coordinated-low-tier-burst',
          count: g.sources.length, sources: g.sources });
      }
    }

    // Attack #2: same-entity mention velocity in a short window,
    // computed independently of dedup — catches reworded duplicates
    // that dodge shingle matching by varying wording (and amount).
    /** @type {Object<string, NewsItem[]>} */
    const byEntity = {};
    for (const i of items) for (const e of i.entities) (byEntity[e.tag] = byEntity[e.tag] || []).push(i);
    for (const entity in byEntity){
      const mentions = byEntity[entity].filter(i => i.h <= this.PUMP_VELOCITY_WINDOW_H);
      if (mentions.length >= this.PUMP_VELOCITY_THRESHOLD){
        flags.push({ sector: mentions[0].sectors[0] || null, label: entity, reason: 'mention-velocity-spike',
          count: mentions.length, sources: [...new Set(mentions.map(i => i.s))] });
      }
    }
    return flags;
  }
};
