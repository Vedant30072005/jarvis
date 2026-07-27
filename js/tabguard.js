// @ts-check
/* ============================================================
   J.A.R.V.I.S — multi-tab write guard (Sprint 5.5)
   Two open tabs must not both write today's rollup (Store.snapshotToday).
   Rough leader election over BroadcastChannel: every tab announces its
   birth time; the oldest surviving tab is the writer. No explicit
   "goodbye" needed to hand over leadership — a closed tab simply stops
   heartbeating and is pruned by survivors within STALE_MS, at which
   point the next-oldest tab becomes leader automatically.

   Fails open: if BroadcastChannel isn't available, every tab writes,
   same as before this sprint — a missing guard must never become a
   missing feature.
   ============================================================ */

const TabGuard = {
  CHANNEL: 'jarvis.tabs',
  HEARTBEAT_MS: 4000,
  STALE_MS: 10000,

  id: U.uid(),
  bornAt: Date.now(),
  /** @type {Object<string, {bornAt:number, lastSeen:number}>} */
  peers: {},
  /** @type {BroadcastChannel|null} */
  _chan: null,
  _supported: true,

  init(){
    if (!('BroadcastChannel' in window)){ this._supported = false; return; }
    try {
      this._chan = new BroadcastChannel(this.CHANNEL);
      this._chan.onmessage = (e) => this._onMessage(e.data);
      this._announce();
      setInterval(() => this._announce(), this.HEARTBEAT_MS);
      addEventListener('beforeunload', () => { try { this._chan?.close(); } catch(e){} });
    } catch(e){ this._supported = false; }
  },

  _announce(){
    try { this._chan?.postMessage({ type: 'hello', id: this.id, bornAt: this.bornAt }); }
    catch(e){ /* channel closed or unavailable — this tab just falls back to fail-open */ }
  },

  _onMessage(msg){
    if (!msg || msg.type !== 'hello' || msg.id === this.id) return;
    this.peers[msg.id] = { bornAt: msg.bornAt, lastSeen: Date.now() };
  },

  _liveSeniorPeers(){
    const cutoff = Date.now() - this.STALE_MS;
    return Object.entries(this.peers).filter(([, p]) => p.lastSeen >= cutoff);
  },

  /** True if this tab should perform shared, once-per-day writes
   *  (currently: Store.snapshotToday). Fails open (true) whenever
   *  leader election isn't running, so the guard can only ever
   *  suppress a write, never silently drop the feature entirely. */
  isWriter(){
    if (!this._supported) return true;
    const seniors = this._liveSeniorPeers().filter(([id, p]) =>
      p.bornAt < this.bornAt || (p.bornAt === this.bornAt && id < this.id));
    return seniors.length === 0;
  }
};
