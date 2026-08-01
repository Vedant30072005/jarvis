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

  /* ---------------- Live Stocks Monitor baskets ----------------

     Each entry is a SYMBOL and a NAME — nothing more. The earlier
     12-name version carried `fallbackPrice`/`fallbackChange` seeds so a
     card could still show a price with the relay down; those are gone.
     A seeded price is an invented number wearing a quote's costume, and
     the moment a basket-wide breadth average is computed on top of it,
     the fabrication stops being one dud card and becomes a false read on
     the whole market. A card with no quote now says NO QUOTE (Art. 1:
     truth over delight — an honest gap beats a confident lie). */

  /** NIFTY 50 constituents, plus HAL (carried over from the earlier
   *  hand-picked list). Symbols are Yahoo's `.NS` NSE tickers. A ticker
   *  that gets renamed or delisted simply returns no quote and renders as
   *  such — it never silently becomes a made-up price. */
  INDIAN_STOCKS: [
    { sym:'ADANIENT.NS',    label:'ADANI ENT',     name:'Adani Enterprises' },
    { sym:'ADANIPORTS.NS',  label:'ADANI PORTS',   name:'Adani Ports & SEZ' },
    { sym:'APOLLOHOSP.NS',  label:'APOLLO HOSP',   name:'Apollo Hospitals' },
    { sym:'ASIANPAINT.NS',  label:'ASIAN PAINTS',  name:'Asian Paints' },
    { sym:'AXISBANK.NS',    label:'AXIS BANK',     name:'Axis Bank' },
    { sym:'BAJAJ-AUTO.NS',  label:'BAJAJ AUTO',    name:'Bajaj Auto' },
    { sym:'BAJAJFINSV.NS',  label:'BAJAJ FINSERV', name:'Bajaj Finserv' },
    { sym:'BAJFINANCE.NS',  label:'BAJAJ FINANCE', name:'Bajaj Finance' },
    { sym:'BEL.NS',         label:'BEL',           name:'Bharat Electronics' },
    { sym:'BHARTIARTL.NS',  label:'BHARTI AIRTEL', name:'Bharti Airtel' },
    { sym:'BPCL.NS',        label:'BPCL',          name:'Bharat Petroleum' },
    { sym:'BRITANNIA.NS',   label:'BRITANNIA',     name:'Britannia Industries' },
    { sym:'CIPLA.NS',       label:'CIPLA',         name:'Cipla' },
    { sym:'COALINDIA.NS',   label:'COAL INDIA',    name:'Coal India' },
    { sym:'DRREDDY.NS',     label:'DR REDDY',      name:"Dr. Reddy's Laboratories" },
    { sym:'EICHERMOT.NS',   label:'EICHER MOTORS', name:'Eicher Motors' },
    { sym:'GRASIM.NS',      label:'GRASIM',        name:'Grasim Industries' },
    { sym:'HAL.NS',         label:'HAL',           name:'Hindustan Aeronautics' },
    { sym:'HCLTECH.NS',     label:'HCL TECH',      name:'HCL Technologies' },
    { sym:'HDFCBANK.NS',    label:'HDFC BANK',     name:'HDFC Bank' },
    { sym:'HDFCLIFE.NS',    label:'HDFC LIFE',     name:'HDFC Life Insurance' },
    { sym:'HEROMOTOCO.NS',  label:'HERO MOTOCORP', name:'Hero MotoCorp' },
    { sym:'HINDALCO.NS',    label:'HINDALCO',      name:'Hindalco Industries' },
    { sym:'HINDUNILVR.NS',  label:'HUL',           name:'Hindustan Unilever' },
    { sym:'ICICIBANK.NS',   label:'ICICI BANK',    name:'ICICI Bank' },
    { sym:'INDUSINDBK.NS',  label:'INDUSIND BANK', name:'IndusInd Bank' },
    { sym:'INFY.NS',        label:'INFOSYS',       name:'Infosys' },
    { sym:'ITC.NS',         label:'ITC',           name:'ITC Ltd' },
    { sym:'JSWSTEEL.NS',    label:'JSW STEEL',     name:'JSW Steel' },
    { sym:'KOTAKBANK.NS',   label:'KOTAK BANK',    name:'Kotak Mahindra Bank' },
    { sym:'LT.NS',          label:'L&T',           name:'Larsen & Toubro' },
    { sym:'M&M.NS',         label:'M&M',           name:'Mahindra & Mahindra' },
    { sym:'MARUTI.NS',      label:'MARUTI',        name:'Maruti Suzuki India' },
    { sym:'NESTLEIND.NS',   label:'NESTLE INDIA',  name:'Nestle India' },
    { sym:'NTPC.NS',        label:'NTPC',          name:'NTPC Ltd' },
    { sym:'ONGC.NS',        label:'ONGC',          name:'Oil & Natural Gas Corp' },
    { sym:'POWERGRID.NS',   label:'POWER GRID',    name:'Power Grid Corp' },
    { sym:'RELIANCE.NS',    label:'RELIANCE',      name:'Reliance Industries' },
    { sym:'SBILIFE.NS',     label:'SBI LIFE',      name:'SBI Life Insurance' },
    { sym:'SBIN.NS',        label:'SBI',           name:'State Bank of India' },
    { sym:'SHRIRAMFIN.NS',  label:'SHRIRAM FIN',   name:'Shriram Finance' },
    { sym:'SUNPHARMA.NS',   label:'SUN PHARMA',    name:'Sun Pharmaceutical' },
    { sym:'TATACONSUM.NS',  label:'TATA CONSUMER', name:'Tata Consumer Products' },
    // Post-demerger the old TATAMOTORS.NS ticker 404s; the group now trades
    // as two listings. Verified live against the relay rather than assumed —
    // a guessed ticker would silently render as a permanent NO QUOTE card.
    { sym:'TMCV.NS',        label:'TATA MOTORS',   name:'Tata Motors (commercial vehicles)' },
    { sym:'TMPV.NS',        label:'TATA MOTORS PV', name:'Tata Motors Passenger Vehicles' },
    { sym:'TATASTEEL.NS',   label:'TATA STEEL',    name:'Tata Steel' },
    { sym:'TCS.NS',         label:'TCS',           name:'Tata Consultancy Services' },
    { sym:'TECHM.NS',       label:'TECH MAHINDRA', name:'Tech Mahindra' },
    { sym:'TITAN.NS',       label:'TITAN',         name:'Titan Company' },
    { sym:'TRENT.NS',       label:'TRENT',         name:'Trent Ltd' },
    { sym:'ULTRACEMCO.NS',  label:'ULTRATECH',     name:'UltraTech Cement' },
    { sym:'WIPRO.NS',       label:'WIPRO',         name:'Wipro Ltd' }
  ],

  /** The 50 largest / most-traded US names by weight in the S&P 500 and
   *  Nasdaq 100. Not an index membership list — a watchlist. */
  US_STOCKS: [
    { sym:'AAPL',  label:'AAPL',   name:'Apple Inc.' },
    { sym:'ABBV',  label:'ABBV',   name:'AbbVie Inc.' },
    { sym:'ABT',   label:'ABT',    name:'Abbott Laboratories' },
    { sym:'ACN',   label:'ACN',    name:'Accenture plc' },
    { sym:'ADBE',  label:'ADBE',   name:'Adobe Inc.' },
    { sym:'AMD',   label:'AMD',    name:'Advanced Micro Devices' },
    { sym:'AMZN',  label:'AMZN',   name:'Amazon.com Inc.' },
    { sym:'AVGO',  label:'AVGO',   name:'Broadcom Inc.' },
    { sym:'BA',    label:'BA',     name:'Boeing Co.' },
    { sym:'BAC',   label:'BAC',    name:'Bank of America' },
    { sym:'BRK-B', label:'BRK.B',  name:'Berkshire Hathaway' },
    { sym:'CAT',   label:'CAT',    name:'Caterpillar Inc.' },
    { sym:'COST',  label:'COST',   name:'Costco Wholesale' },
    { sym:'CRM',   label:'CRM',    name:'Salesforce Inc.' },
    { sym:'CSCO',  label:'CSCO',   name:'Cisco Systems' },
    { sym:'CVX',   label:'CVX',    name:'Chevron Corp.' },
    { sym:'DIS',   label:'DIS',    name:'Walt Disney Co.' },
    { sym:'GE',    label:'GE',     name:'GE Aerospace' },
    { sym:'GOOGL', label:'GOOGL',  name:'Alphabet Inc.' },
    { sym:'HD',    label:'HD',     name:'Home Depot Inc.' },
    { sym:'IBM',   label:'IBM',    name:'IBM Corp.' },
    { sym:'INTC',  label:'INTC',   name:'Intel Corp.' },
    { sym:'INTU',  label:'INTU',   name:'Intuit Inc.' },
    { sym:'JNJ',   label:'JNJ',    name:'Johnson & Johnson' },
    { sym:'JPM',   label:'JPM',    name:'JPMorgan Chase' },
    { sym:'KO',    label:'KO',     name:'Coca-Cola Co.' },
    { sym:'LIN',   label:'LIN',    name:'Linde plc' },
    { sym:'LLY',   label:'LLY',    name:'Eli Lilly & Co.' },
    { sym:'MA',    label:'MA',     name:'Mastercard Inc.' },
    { sym:'MCD',   label:'MCD',    name:"McDonald's Corp." },
    { sym:'META',  label:'META',   name:'Meta Platforms' },
    { sym:'MRK',   label:'MRK',    name:'Merck & Co.' },
    { sym:'MSFT',  label:'MSFT',   name:'Microsoft Corp.' },
    { sym:'NFLX',  label:'NFLX',   name:'Netflix Inc.' },
    { sym:'NOW',   label:'NOW',    name:'ServiceNow Inc.' },
    { sym:'NVDA',  label:'NVDA',   name:'NVIDIA Corp.' },
    { sym:'ORCL',  label:'ORCL',   name:'Oracle Corp.' },
    { sym:'PEP',   label:'PEP',    name:'PepsiCo Inc.' },
    { sym:'PG',    label:'PG',     name:'Procter & Gamble' },
    { sym:'PLTR',  label:'PLTR',   name:'Palantir Technologies' },
    { sym:'QCOM',  label:'QCOM',   name:'Qualcomm Inc.' },
    { sym:'TMO',   label:'TMO',    name:'Thermo Fisher Scientific' },
    { sym:'TSLA',  label:'TSLA',   name:'Tesla Inc.' },
    { sym:'TXN',   label:'TXN',    name:'Texas Instruments' },
    { sym:'UBER',  label:'UBER',   name:'Uber Technologies' },
    { sym:'UNH',   label:'UNH',    name:'UnitedHealth Group' },
    { sym:'V',     label:'V',      name:'Visa Inc.' },
    { sym:'WFC',   label:'WFC',    name:'Wells Fargo & Co.' },
    { sym:'WMT',   label:'WMT',    name:'Walmart Inc.' },
    { sym:'XOM',   label:'XOM',    name:'Exxon Mobil Corp.' }
  ],

  /** @param {'india'|'us'} region */
  basket(region){ return region === 'us' ? this.US_STOCKS : this.INDIAN_STOCKS; },

  /** relay.js caps /quote at 30 symbols per request and silently DROPS the
   *  tail beyond it — with a 50-name basket that would quietly amputate
   *  the last 20 and compute breadth on a truncated, alphabetically-biased
   *  slice. So requests are chunked. Chunks run one after another, not all
   *  at once: each chunk fans out to that many upstream Yahoo calls inside
   *  the relay, and firing 50 in one breath earns a rate-limit — which
   *  comes back as nulls, i.e. a thinner basket, i.e. the same silent bias
   *  by a slower route. */
  QUOTE_BATCH: 20,

  /** Fetch quotes for any number of symbols, batching to respect the relay
   *  cap. A failed batch contributes nothing rather than failing the lot;
   *  the caller renders those symbols as NO QUOTE.
   *  @param {string[]} symbols @returns {Promise<Object<string, any>>} */
  async fetchQuotes(symbols){
    if (!symbols || !symbols.length) return {};
    const out = {};
    for (let i = 0; i < symbols.length; i += this.QUOTE_BATCH){
      const chunk = symbols.slice(i, i + this.QUOTE_BATCH);
      const qs = chunk.map(s => encodeURIComponent(s)).join(',');
      try {
        const text = await Live.fetchWithTimeout(`${Live.RELAY_BASE}/quote?symbols=${qs}`, 12000);
        Object.assign(out, JSON.parse(text) || {});
      } catch(e){ /* this batch stays missing — rendered as NO QUOTE, not invented */ }
    }
    return out;
  },

  /** Equal-weighted breadth across whatever of a basket actually came back
   *  live — the "is the market up or down today" read.
   *
   *  Deliberately NOT an index: the Nifty and the S&P are cap-weighted, so
   *  a day where Reliance falls 3% while 40 mid-weights rise 1% moves this
   *  number and the index in OPPOSITE directions. Both are true; they
   *  answer different questions ("how is the average name doing" vs "how is
   *  the market's capital doing"). The UI must therefore never label this
   *  as the index, and `tracked`/`covered` come back alongside so it can
   *  state what fraction the read is built on — an average over 6 of 51
   *  names is a rumour, not a market read (Art. 4).
   *
   *  Rows with no live quote are EXCLUDED, never treated as 0% — counting
   *  a missing quote as "flat" would drag the average toward zero and make
   *  a broken relay look like a calm market.
   *  @param {Array<{live?:boolean, changePct?:number, label?:string}>} rows */
  breadth(rows){
    const all = Array.isArray(rows) ? rows : [];
    const live = all.filter(r => r && r.live && typeof r.changePct === 'number' && isFinite(r.changePct));
    const base = { tracked: all.length, covered: live.length, up: 0, down: 0, flat: 0,
                   avgPct: null, medianPct: null, best: null, worst: null };
    if (!live.length) return base;
    const pcts = live.map(r => r.changePct).sort((a, b) => a - b);
    const mid = Math.floor(pcts.length / 2);
    const ranked = [...live].sort((a, b) => b.changePct - a.changePct);
    return {
      ...base,
      up:   live.filter(r => r.changePct > 0).length,
      down: live.filter(r => r.changePct < 0).length,
      flat: live.filter(r => r.changePct === 0).length,
      avgPct: pcts.reduce((s, p) => s + p, 0) / pcts.length,
      // median alongside the mean because one 12% mover in a 50-name basket
      // can drag the average across zero on an otherwise flat day
      medianPct: pcts.length % 2 ? pcts[mid] : (pcts[mid - 1] + pcts[mid]) / 2,
      best: ranked[0],
      worst: ranked[ranked.length - 1]
    };
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
