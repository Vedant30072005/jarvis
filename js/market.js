// @ts-check
/* ============================================================
   J.A.R.V.I.S — live market tape (indices, FX, commodities)

   The ticker used to be a pure random walk: seeded values nudged by
   Math.random() every 3 seconds. Those prints look exactly like real
   market data to anyone reading the screen — a fabricated number
   wearing the costume of a quote. That is precisely what Constitution
   Art. 4 ("every number answers says-who, as-of-when") exists to stop,
   and the drift had wandered the seeded Nifty ~2,200 points away from
   the real index.

   This module pulls the real thing through the relay's Yahoo proxy and
   stamps every value LIVE + as-of. When the relay is down it falls back
   to the seeded SIM values and SAYS SO (badge + per-cell dimming) —
   the same graceful-degradation contract every other relay feature in
   this app follows. A simulated tape is fine; a simulated tape wearing
   a live tape's face is not.
   ============================================================ */

const Market = {
  /** Ticker label → Yahoo symbol. Only instruments with a direct,
   *  unambiguous quote get one.
   *
   *  Deliberately NOT converting international gold (GC=F, $/oz) into
   *  domestic ₹/10g: Indian physical gold carries import duty + GST on
   *  top of international spot, so the converted figure would sit
   *  ~9-10% below what an Indian buyer actually pays. Quoting that as
   *  "GOLD ₹/10g" would be false precision dressed as a local price,
   *  so the label states $/oz and the number stays honest. */
  SYMBOLS: {
    'NIFTY 50':   '^NSEI',
    'SENSEX':     '^BSESN',
    'BANK NIFTY': '^NSEBANK',
    'USD/INR':    'INR=X',
    'GOLD $/oz':  'GC=F',
    'BRENT $':    'BZ=F',
    'BTC $':      'BTC-USD',
    'NASDAQ FUT': 'NQ=F'
  },

  /** label → {price, changePct, ts} for whatever came back live.
   *  @type {Object<string, {price:number, changePct:number, ts:number}>} */
  live: {},

  /** epoch ms of the most recent successful refresh, or null. */
  asOf: /** @type {number|null} */ (null),

  get isLive(){ return Object.keys(this.live).length > 0; },

  /** Pull every mapped symbol in one relay round-trip. Never throws;
   *  returns how many instruments actually refreshed (0 = relay
   *  unreachable or every symbol failed → caller stays on SIM).
   *
   *  Deliberately does NOT gate on Live.relayAvailable(): that probe
   *  caches its result for the whole session, so a relay started AFTER
   *  the page would never be noticed. Letting the fetch itself be the
   *  probe makes the tape self-healing on the next 60s tick.
   *  @returns {Promise<number>} */
  async refresh(){
    const labels = Object.keys(this.SYMBOLS);
    const qs = labels.map(l => encodeURIComponent(this.SYMBOLS[l])).join(',');
    try {
      const text = await Live.fetchWithTimeout(`${Live.RELAY_BASE}/quote?symbols=${qs}`, 7000);
      const json = JSON.parse(text);
      let n = 0;
      for (const label of labels){
        const e = json[this.SYMBOLS[label]];
        if (e && typeof e.price === 'number' && isFinite(e.price)){
          this.live[label] = {
            price: e.price,
            changePct: typeof e.changePct === 'number' ? e.changePct : 0,
            ts: e.ts || Date.now()
          };
          n++;
        }
      }
      if (n) this.asOf = Date.now();
      return n;
    } catch(e){ return 0; /* relay down — caller keeps the SIM tape */ }
  },

  /** @param {string} label @returns {{price:number, changePct:number, ts:number}|null} */
  get(label){ return this.live[label] || null; },

  /** "HH:MM" of the freshest fetch, or null if never live. */
  stamp(){
    return this.asOf
      ? new Date(this.asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : null;
  },

  /** The index levels the brain is allowed to cite — LIVE only, never
   *  the SIM seeds. The brain is cite-or-silent: quoting an invented
   *  index level as an answer would be exactly the fabrication it
   *  refuses to commit.
   *  @returns {Array<{label:string, price:number, changePct:number}>} */
  indices(){
    return ['NIFTY 50', 'SENSEX', 'BANK NIFTY']
      .map(l => ({ label: l, q: this.live[l] }))
      .filter(x => x.q)
      .map(x => ({ label: x.label, price: x.q.price, changePct: x.q.changePct }));
  }
};
