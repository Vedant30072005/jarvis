// @ts-check
/* ============================================================
   J.A.R.V.I.S — alert spine (Sprint 6)
   A single, versioned contract every future alert-raising feature
   (Sprint 9's sonar, Sprint 6's own honesty panel) emits through,
   instead of each feature inventing its own ad hoc notification shape.
   Emits 'alert:raised' on the Bus for anything that wants to react
   live; also keeps an in-memory `active` list for direct rendering.
   ============================================================ */

const Alerts = {
  /** @type {Array<{severity:'info'|'warn'|'critical', source:string, dedupeKey:string, message:string, raisedAt:number, expiresAt:number}>} */
  active: [],

  /** Raise (or refresh, if `dedupeKey` already has a live alert) an alert.
   *  @param {{severity:'info'|'warn'|'critical', source:string, dedupeKey:string, message:string, ttlMs?:number}} spec */
  raise({ severity, source, dedupeKey, message, ttlMs = 24 * 3600000 }){
    this._expireOld();
    const existing = this.active.find(a => a.dedupeKey === dedupeKey);
    if (existing){
      existing.message = message; existing.raisedAt = Date.now(); existing.expiresAt = Date.now() + ttlMs;
      return existing;
    }
    const alert = { severity, source, dedupeKey, message, raisedAt: Date.now(), expiresAt: Date.now() + ttlMs };
    this.active.push(alert);
    Bus.emit('alert:raised', alert);
    return alert;
  },

  _expireOld(){
    const now = Date.now();
    this.active = this.active.filter(a => a.expiresAt > now);
  },

  list(){ this._expireOld(); return this.active; }
};
