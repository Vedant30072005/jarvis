// @ts-check
/* ============================================================
   J.A.R.V.I.S — event bus (ORD-1301)
   Tiny synchronous pub/sub. Loaded first so every later module
   can safely reference the global `Bus`. See ARCHITECTURE.md for
   the documented event contract — add new events there too.
   ============================================================ */

const Bus = {
  /** @type {Object<string, Array<(payload:any)=>void>>} */
  _handlers: {},

  /**
   * @param {string} event
   * @param {(payload:any)=>void} fn
   * @returns {() => void} unsubscribe function
   */
  on(event, fn){
    (this._handlers[event] = this._handlers[event] || []).push(fn);
    return () => this.off(event, fn);
  },

  /**
   * @param {string} event
   * @param {(payload:any)=>void} fn
   */
  off(event, fn){
    const arr = this._handlers[event];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  },

  /**
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload){
    const arr = this._handlers[event];
    if (!arr || !arr.length) return;
    // slice() so a handler that unsubscribes mid-emit doesn't skip a sibling
    for (const fn of arr.slice()){
      try { fn(payload); }
      catch(e){ console.error(`[Bus] handler for "${event}" threw:`, e); }
    }
  }
};
