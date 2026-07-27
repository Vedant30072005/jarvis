// @ts-check
/* ============================================================
   J.A.R.V.I.S — live uplink
   Pulls real headlines from Google News RSS plus a handful of direct
   Indian financial/official wires. Prefers the local relay (ORD-201,
   node jarvis/relay.js) when it's running, falls back to public CORS
   proxies, and falls back again to the simulation feed if both are
   unreachable. Headlines are treated as untrusted data: they are
   escaped before rendering and only ever analysed, never executed.
   ============================================================ */

const Live = {
  RELAY_BASE: 'http://localhost:5510',
  _relayUp: null, // null = unknown yet, true/false once probed this session

  QUERIES: [
    { cat:'gov',       q:'india government budget capex policy ministry' },
    { cat:'global',    q:'global economy central bank investment billion' },
    { cat:'markets',   q:'india stock market FII DII inflow sector' },
    { cat:'corporate', q:'india company crore investment order acquisition' }
  ],

  /* ORD-202: direct wire feeds fetched as-is (no Google News search
     wrapper). Each still only reaches the network through the relay or
     the public proxies below — never fetched bare from the browser,
     since most of these hosts don't send CORS headers. Verify these
     still resolve occasionally; a dead feed just contributes zero items,
     it never fails the batch.
     `name` is the feed's own publisher — passed to parseRss as a
     sourceOverride. Real, single-publisher feeds like PIB's carry NO
     per-item <source> tag (verified live: PIB's raw RSS items have only
     <title>/<link>), so without this override every item silently fell
     back to the generic 'News Wire' label — losing attribution AND
     silently failing to earn the official-tier weight JDATA.SOURCE_WEIGHTS
     already grants "PIB"/"RBI"/"SEBI" by name. Fixed alongside adding
     3 new verified feeds (SEBI, The Hindu BusinessLine, CNBC-TV18 — each
     curl-checked live before adding, never assumed). */
  DIRECT_FEEDS: [
    { cat:'gov',     name:'PIB',   url:'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3' },
    { cat:'gov',     name:'RBI',   url:'https://www.rbi.org.in/pressreleases_rss.xml' },
    { cat:'gov',     name:'SEBI',  url:'https://www.sebi.gov.in/sebirss.xml' },
    { cat:'markets', name:'Moneycontrol',          url:'https://www.moneycontrol.com/rss/latestnews.xml' },
    { cat:'markets', name:'Economic Times',        url:'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
    { cat:'markets', name:'Livemint',               url:'https://www.livemint.com/rss/markets' },
    { cat:'markets', name:'The Hindu BusinessLine', url:'https://www.thehindubusinessline.com/markets/feeder/default.rss' },
    { cat:'markets', name:'CNBC-TV18',              url:'https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml' }
  ],

  PROXIES: [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}`
  ],

  rssUrl(q){
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=en-IN&gl=IN&ceid=IN:en`;
  },

  async fetchWithTimeout(url, ms = 6000){
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } finally { clearTimeout(t); }
  },

  /** Cheap, cached-per-session probe for the local relay (ORD-201). */
  async relayAvailable(){
    if (this._relayUp !== null) return this._relayUp;
    try {
      const res = await this.fetchWithTimeout(`${this.RELAY_BASE}/health`, 1200);
      this._relayUp = !!res;
    } catch(e){ this._relayUp = false; }
    return this._relayUp;
  },

  /** Ordered list of "how to reach this RSS url" attempts: relay first, then public proxies. */
  transportsFor(rssUrl, relayUp){
    const attempts = [];
    if (relayUp) attempts.push(() => this.fetchWithTimeout(`${this.RELAY_BASE}/rss?url=${encodeURIComponent(rssUrl)}`, 7000));
    for (const proxy of this.PROXIES) attempts.push(() => this.fetchWithTimeout(proxy(rssUrl)));
    return attempts;
  },

  /** @param {string} text @param {string} cat @param {string} [sourceOverride] the feed's own
   *  publisher name (DIRECT_FEEDS' `name`) — wins over any per-item <source>
   *  tag, since a single-publisher feed's items are never from someone else. */
  parseRss(text, cat, sourceOverride){
    const items = [];
    const now = Date.now();
    // rss2json returns JSON
    if (text.trim().startsWith('{')){
      try {
        const j = JSON.parse(text);
        for (const it of (j.items || []).slice(0, 8)){
          items.push(this.mkItem(it.title, sourceOverride || it.author || j.feed?.title || 'News Wire',
            (now - new Date(it.pubDate).getTime()) / 36e5, it.description, it.link, cat));
        }
        return items;
      } catch(e){ return []; }
    }
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    for (const it of [...doc.querySelectorAll('item')].slice(0, 8)){
      const title = it.querySelector('title')?.textContent || '';
      const src = sourceOverride || it.querySelector('source')?.textContent || 'News Wire';
      const pub = new Date(it.querySelector('pubDate')?.textContent || now).getTime();
      const desc = it.querySelector('description')?.textContent || '';
      const link = it.querySelector('link')?.textContent || '';
      items.push(this.mkItem(title, src, (now - pub) / 36e5, desc, link, cat));
    }
    return items;
  },

  mkItem(title, src, hoursAgo, desc, link, cat){
    const clean = s => { const d = document.createElement('div'); d.innerHTML = s; return (d.textContent || '').trim(); };
    let t = clean(title);
    // Google News suffixes " - Source"; strip it
    const dash = t.lastIndexOf(' - ');
    if (dash > 30){ src = t.slice(dash + 3) || src; t = t.slice(0, dash); }
    return {
      id: U.uid(), cat, s: String(src).slice(0, 34), t,
      b: clean(desc).replace(/https?:\S+/g, '').slice(0, 220),
      h: Math.max(.2, hoursAgo || 1), url: /^https?:\/\//.test(link) ? link : null, live: true
    };
  },

  async fetchOne(rssUrl, cat, relayUp, sourceOverride){
    for (const attempt of this.transportsFor(rssUrl, relayUp)){
      try {
        const text = await attempt();
        const items = this.parseRss(text, cat, sourceOverride);
        if (items.length) return items;
      } catch(e){ /* try next transport */ }
    }
    return [];
  },

  async fetch(onProgress){
    const relayUp = await this.relayAvailable();
    onProgress?.(relayUp ? 'Pulling the wires (relay)…' : 'Pulling the wires…');
    const jobs = [
      ...this.QUERIES.map(({ cat, q }) => this.fetchOne(this.rssUrl(q), cat, relayUp)),
      ...this.DIRECT_FEEDS.map(({ cat, url, name }) => this.fetchOne(url, cat, relayUp, name))
    ];
    const results = await Promise.all(jobs);
    const all = results.flat();
    if (!all.length) throw new Error('All uplink transports unreachable');
    return all;
  }
};
