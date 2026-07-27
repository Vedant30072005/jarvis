// @ts-check
/* ============================================================
   J.A.R.V.I.S — mirror: prediction book + journal (Sprint 6 skeleton,
   Sprint 11 full build)
   Schema-versioned from day one (Sprint 5.5). Sprint 11 adds
   resolution and Brier scoring; a full calibration curve, thesis
   kanban, advanced analytics, and journal search are all deferred
   per the Session #15 core-slice plan.
   ============================================================ */

const Mirror = {
  PRED_KEY: 'jarvis.predictions.v1',
  PRED_VERSION: 1,
  PRED_MIGRATIONS: { 0: (data) => data },
  BRIER_MIN_N: 15, // Session #5's grading methodology: never show a Brier score below this

  JOURNAL_KEY: 'jarvis.journal.v1',
  JOURNAL_VERSION: 1,
  JOURNAL_MIGRATIONS: { 0: (data) => data },

  loadPredictions(){ return /** @type {any[]} */ (Schema.load(this.PRED_KEY, this.PRED_VERSION, [], this.PRED_MIGRATIONS)); },
  /** @param {{title:string, probability:number, resolveBy:string}} p */
  addPrediction({ title, probability, resolveBy }){
    const list = this.loadPredictions();
    list.push({ id: U.uid(), title, probability, resolveBy, resolved: false, outcome: null, createdAt: Date.now() });
    Schema.save(this.PRED_KEY, this.PRED_VERSION, list);
    Bus.emit('predictions:changed', {});
    return list.length;
  },

  /** Resolves an open prediction with the real outcome. Once resolved, a
   *  prediction is never edited again — it's an event-sourced record of
   *  what was actually predicted and what actually happened, matching
   *  the ledger's own "no edit-in-place" doctrine.
   *  @param {string} id @param {boolean} outcomeYes */
  resolvePrediction(id, outcomeYes){
    const list = this.loadPredictions();
    const p = list.find(x => x.id === id);
    if (!p || p.resolved) return false;
    p.resolved = true;
    p.outcome = outcomeYes ? 1 : 0;
    p.resolvedAt = Date.now();
    Schema.save(this.PRED_KEY, this.PRED_VERSION, list);
    Bus.emit('predictions:changed', {});
    return true;
  },

  /** Brier score = mean((forecast_probability − outcome)²) over resolved
   *  predictions, outcome ∈ {0,1}. Lower is better; 0.25 is the score of
   *  someone who always says "50/50" — the baseline to beat, not zero.
   *  Gated at BRIER_MIN_N per Session #5: below that, report the raw
   *  resolved count instead of a number that would be noise at this N.
   *  @param {any[]} [predictions] @returns {{ready:boolean, n:number, score?:number}} */
  brierScore(predictions){
    const resolved = (predictions || this.loadPredictions()).filter(p => p.resolved);
    const n = resolved.length;
    if (n < this.BRIER_MIN_N) return { ready: false, n };
    const sumSq = resolved.reduce((s, p) => s + Math.pow(p.probability / 100 - p.outcome, 2), 0);
    return { ready: true, n, score: Math.round((sumSq / n) * 1000) / 1000 };
  },

  loadJournal(){ return /** @type {any[]} */ (Schema.load(this.JOURNAL_KEY, this.JOURNAL_VERSION, [], this.JOURNAL_MIGRATIONS)); },
  /** @param {{text:string}} e */
  addJournalEntry({ text }){
    const list = this.loadJournal();
    list.push({ id: U.uid(), text, createdAt: Date.now() });
    Schema.save(this.JOURNAL_KEY, this.JOURNAL_VERSION, list);
    Bus.emit('journal:changed', {});
    return list.length;
  }
};
