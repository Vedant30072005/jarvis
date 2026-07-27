// @ts-check
/* ============================================================
   J.A.R.V.I.S — goals (Sprint 8 core slice)
   Bare CRUD for savings/investment goals: name, current value, target
   value, target date. Schema-versioned from day one (Sprint 5.5).
   Progress-over-time snapshots and editing are deferred — this slice
   only proves the data model and a simple list render.
   ============================================================ */

const Goals = {
  KEY: 'jarvis.goals.v1',
  VERSION: 1,
  MIGRATIONS: { 0: (data) => data },

  load(){ return /** @type {any[]} */ (Schema.load(this.KEY, this.VERSION, [], this.MIGRATIONS)); },
  save(list){ Schema.save(this.KEY, this.VERSION, list); Bus.emit('goals:changed', {}); },

  /** @param {{name:string, currentValue:number, targetValue:number, targetDate:string}} g */
  add(g){
    const list = this.load();
    list.push({ id: U.uid(), ...g, createdAt: Date.now() });
    this.save(list);
    return list.length;
  },

  remove(id){
    const list = this.load().filter(g => g.id !== id);
    this.save(list);
  },

  /** Updates an existing goal in place (name/currentValue/targetValue/
   *  targetDate) — the piece the core slice's CRUD left out: without
   *  this, "tracking progress toward a goal" required deleting and
   *  re-adding it every time, losing createdAt and defeating the whole
   *  point of a goals tracker. @param {string} id @param {object} patch
   *  @returns {boolean} true if a matching goal was found and updated */
  update(id, patch){
    const list = this.load();
    const idx = list.findIndex(g => g.id === id);
    if (idx < 0) return false;
    list[idx] = { ...list[idx], ...patch };
    this.save(list);
    return true;
  },

  /** @param {{currentValue:number, targetValue:number}} g */
  progressPct(g){
    if (!g.targetValue || g.targetValue <= 0) return 0;
    return U.clamp(Math.round(100 * g.currentValue / g.targetValue), 0, 100);
  },

  /** Whole months from today until targetDate; null if unparseable, 0 if past.
   *  @param {string} targetDate */
  monthsRemaining(targetDate){
    const target = new Date(targetDate);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    return months > 0 ? months : 0;
  }
};
