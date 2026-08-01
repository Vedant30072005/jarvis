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
            quoteTime: typeof e.quoteTime === 'number' ? e.quoteTime : null,
            ts: e.ts || Date.now()
          };
          n++;
        }
      }
      if (n) this.asOf = Date.now();
      return n;
    } catch(e){ return 0; /* relay down — caller keeps the SIM tape */ }
  },

  /** Default Indian & US stocks list for Live Stocks Monitor */
  INDIAN_STOCKS: [
    { sym:'RELIANCE.NS', label:'RELIANCE', name:'Reliance Industries', fallbackPrice:3020.50, fallbackChange:1.25 },
    { sym:'TCS.NS', label:'TCS', name:'Tata Consultancy Services', fallbackPrice:4180.20, fallbackChange:-0.45 },
    { sym:'HDFCBANK.NS', label:'HDFC BANK', name:'HDFC Bank Ltd', fallbackPrice:1612.80, fallbackChange:0.85 },
    { sym:'ICICIBANK.NS', label:'ICICI BANK', name:'ICICI Bank Ltd', fallbackPrice:1204.15, fallbackChange:1.10 },
    { sym:'INFY.NS', label:'INFOSYS', name:'Infosys Ltd', fallbackPrice:1845.60, fallbackChange:-0.20 },
    { sym:'SBIN.NS', label:'SBI', name:'State Bank of India', fallbackPrice:848.30, fallbackChange:0.65 },
    { sym:'HAL.NS', label:'HAL', name:'Hindustan Aeronautics', fallbackPrice:4720.00, fallbackChange:2.40 },
    { sym:'LT.NS', label:'L&T', name:'Larsen & Toubro', fallbackPrice:3640.90, fallbackChange:1.15 },
    { sym:'M&M.NS', label:'M&M', name:'Mahindra & Mahindra', fallbackPrice:2940.50, fallbackChange:1.15 },
    { sym:'BHARTIARTL.NS', label:'BHARTI AIRTEL', name:'Bharti Airtel Ltd', fallbackPrice:1480.50, fallbackChange:0.55 },
    { sym:'AXISBANK.NS', label:'AXIS BANK', name:'Axis Bank Ltd', fallbackPrice:1175.00, fallbackChange:0.30 },
    { sym:'BAJFINANCE.NS', label:'BAJAJ FINANCE', name:'Bajaj Finance Ltd', fallbackPrice:6920.00, fallbackChange:-1.05 }
  ],

  US_STOCKS: [
    { sym:'AAPL', label:'AAPL', name:'Apple Inc.', fallbackPrice:224.50, fallbackChange:0.95 },
    { sym:'MSFT', label:'MSFT', name:'Microsoft Corp.', fallbackPrice:448.90, fallbackChange:0.40 },
    { sym:'NVDA', label:'NVDA', name:'NVIDIA Corp.', fallbackPrice:118.25, fallbackChange:3.15 },
    { sym:'GOOGL', label:'GOOGL', name:'Alphabet Inc.', fallbackPrice:182.40, fallbackChange:-0.60 },
    { sym:'AMZN', label:'AMZN', name:'Amazon.com Inc.', fallbackPrice:186.70, fallbackChange:1.05 },
    { sym:'TSLA', label:'TSLA', name:'Tesla Inc.', fallbackPrice:219.80, fallbackChange:-2.30 },
    { sym:'META', label:'META', name:'Meta Platforms', fallbackPrice:492.10, fallbackChange:1.80 },
    { sym:'AMD', label:'AMD', name:'Advanced Micro Devices', fallbackPrice:138.40, fallbackChange:2.10 },
    { sym:'NFLX', label:'NFLX', name:'Netflix Inc.', fallbackPrice:658.20, fallbackChange:0.75 },
    { sym:'BRK-B', label:'BERKSHIRE', name:'Berkshire Hathaway', fallbackPrice:445.60, fallbackChange:0.20 },
    { sym:'INTC', label:'INTEL', name:'Intel Corp.', fallbackPrice:30.15, fallbackChange:-1.45 },
    { sym:'PLTR', label:'PALANTIR', name:'Palantir Tech', fallbackPrice:27.80, fallbackChange:4.20 }
  ],

  /** Fetch quotes for an array of symbols in one relay call */
  async fetchQuotes(symbols){
    if (!symbols || !symbols.length) return {};
    const qs = symbols.map(s => encodeURIComponent(s)).join(',');
    try {
      const text = await Live.fetchWithTimeout(`${Live.RELAY_BASE}/quote?symbols=${qs}`, 8000);
      return JSON.parse(text) || {};
    } catch(e){
      return {};
    }
  },

  /** @param {string} label @returns {{price:number, changePct:number, ts:number}|null} */
  get(label){ return this.live[label] || null; },

  /** "HH:MM" of the freshest fetch, or null if never live. */
  stamp(){
    return this.asOf
      ? new Date(this.asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : null;
  },

  /* ---------------- staleness, stated not assumed ---------------- */

  /** True age of an instrument's PRINT in seconds — measured from the
   *  exchange's own timestamp, not from when we fetched it. Falls back
   *  to fetch time when the upstream gave no quoteTime, which is the
   *  pessimistic direction (never reports fresher than it can prove).
   *  @param {string} label @returns {number|null} */
  ageSec(label){
    const q = this.live[label];
    if (!q) return null;
    return Math.max(0, Math.round((Date.now() - (q.quoteTime || q.ts)) / 1000));
  },

  /** Compact human age: "8s", "3m", "2h", "4d". @param {number} sec */
  fmtAge(sec){
    if (sec == null) return '—';
    if (sec < 90) return `${sec}s`;
    if (sec < 5400) return `${Math.round(sec / 60)}m`;
    if (sec < 172800) return `${Math.round(sec / 3600)}h`;
    return `${Math.round(sec / 86400)}d`;
  },

  /** Instruments that trade on the NSE clock. Only these can be judged
   *  against the NSE session: Brent, COMEX gold and Nasdaq futures keep
   *  their own hours, so a 15-minute-old Brent print at 10am IST is
   *  normal, not a wedged feed. Flagging those would cry wolf every
   *  morning and train the eye to ignore a warning that should mean
   *  something. BTC is 24/7 but its feed is third-party, so it is
   *  likewise not evidence about NSE freshness. */
  NSE_BOUND: ['NIFTY 50', 'SENSEX', 'BANK NIFTY'],

  /** Freshest and stalest print on the tape.
   *  @param {string[]} [labels] restrict to a subset (default: all live)
   *  @returns {{freshest:number|null, stalest:number|null}} */
  ageRange(labels){
    const keys = labels || Object.keys(this.live);
    const ages = keys.map(l => this.ageSec(l)).filter(a => a != null);
    return ages.length
      ? { freshest: Math.min(...ages), stalest: Math.max(...ages) }
      : { freshest: null, stalest: null };
  },

  /** Age range across NSE-clock instruments only — the number that
   *  actually answers "is my Indian market data current right now?".
   *  @returns {{freshest:number|null, stalest:number|null}} */
  nseAgeRange(){ return this.ageRange(this.NSE_BOUND); },

  /* ---------------- NSE session clock ----------------
     Times are IST (Asia/Kolkata) regardless of where this machine
     thinks it is — a laptop on the wrong timezone must not make the
     app believe the market is open. Exchange HOLIDAYS are deliberately
     not modelled: there is no holiday list in this codebase, so on a
     trading holiday this reports OPEN while prices sit frozen. The
     staleness readout is what catches that — an "OPEN" session whose
     prints are hours old is visibly wrong, which is why age is shown
     everywhere rather than trusted silently. */

  /** @returns {{state:'OPEN'|'PRE_OPEN'|'CLOSED'|'WEEKEND', label:string}} */
  session(now = new Date()){
    // Shift to IST via the fixed +05:30 offset from UTC.
    const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
    const day = ist.getDay();                       // 0 Sun … 6 Sat
    const mins = ist.getHours() * 60 + ist.getMinutes();
    if (day === 0 || day === 6) return { state: 'WEEKEND', label: 'WEEKEND' };
    if (mins >= 555 && mins < 930) return { state: 'OPEN', label: 'MARKET OPEN' };      // 09:15–15:30
    if (mins >= 540 && mins < 555) return { state: 'PRE_OPEN', label: 'PRE-OPEN' };     // 09:00–09:15
    return { state: 'CLOSED', label: 'MARKET CLOSED' };
  },

  /** How often the tape should refresh, in ms — fast while the market
   *  is actually moving, slow when nothing can change. Polling a closed
   *  market every 20s is pure waste (and upstream load) for a number
   *  that is frozen by definition. */
  refreshMs(){
    const s = this.session().state;
    if (s === 'OPEN') return 20000;
    if (s === 'PRE_OPEN') return 30000;
    return 300000; // closed / weekend — the last close is not going to move
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
