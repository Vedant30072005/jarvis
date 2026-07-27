// @ts-check
/* ============================================================
   J.A.R.V.I.S — analysis engine
   Turns raw headlines into entities, sentiment, money flows,
   cross-source patterns and drafted investment theses.
   ============================================================ */

/* ---------------- tiny utils ---------------- */
const U = {
  esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  fmtINR(n){ return '₹' + Math.round(n).toLocaleString('en-IN'); },
  fmtCr(cr){
    if (cr >= 100000) return '₹' + (cr/100000).toFixed(2).replace(/\.00$/,'') + ' L cr';
    if (cr >= 1000)  return '₹' + Math.round(cr).toLocaleString('en-IN') + ' cr';
    return '₹' + cr.toFixed(0) + ' cr';
  },
  ago(h){
    if (h < 1) return 'moments ago';
    if (h < 24) return Math.round(h) + 'h ago';
    return Math.round(h/24) + 'd ago';
  },
  /** ORD-905: the ONE place "today" is defined, local calendar date as YYYY-MM-DD.
   *  @param {Date} [d] @returns {string} */
  todayKey(d = new Date()){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  },
  clamp(n, a, b){ return Math.max(a, Math.min(b, n)); },
  uid(){ return 'x' + Math.random().toString(36).slice(2, 9); },
  pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
};

const Engine = {
  items: [],        // analyzed news items
  clusters: [],     // detected patterns
  flows: [],        // money flow records (from corroboration groups, ORD-901)
  groups: [],       // corroboration groups (ORD-301)
  ideas: [],        // drafted theses
  // Attack #15 fix (red-team Session #1): buildGroups() is an O(n²)
  // pairwise shingle-comparison pass — a flood of near-duplicate items
  // (deliberate DoS, or just an unusually chatty real news day) could
  // degrade it to the point of a UI hang. run() caps analysis at this
  // many items (freshest-first), and ALWAYS surfaces the cap visibly
  // (see .truncation below + Honesty.compute()) rather than silently
  // truncating — silent truncation during a flood is exactly when
  // integrity matters most and is least likely to be manually noticed.
  MAX_ITEMS_PER_PASS: 300,
  truncation: { capped: false, analyzed: 0, skipped: 0 },

  USD_INR: 85.5,

  /* Sprint 5 (C6): conviction v2 (M5) ships behind this flag so v1 and v2
   * can be compared for one sprint before v1 is deleted (Part III C6). */
  FLAGS: { convictionV2: false },

  /** Negation-aware lexicon match count (ORD-302). A hit preceded within
   *  ~3 words by a JDATA.NEGATIONS term does not count — "denies plans to
   *  invest" must not read bullish just because "invest" is in range.
   *  @param {string} text @param {RegExp} rx @returns {number} */
  countSentimentHits(text, rx){
    const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g');
    let hits = 0, m;
    while ((m = g.exec(text)) !== null){
      const before = text.slice(Math.max(0, m.index - 40), m.index).trim();
      const lastWords = before.split(/\s+/).slice(-3).join(' ');
      if (!JDATA.NEGATIONS.test(lastWords)) hits++;
      if (m[0].length === 0) g.lastIndex++; // guard zero-width matches
    }
    return hits;
  },

  /* ------------- per-item analysis ------------- */
  analyzeItem(raw){
    const text = raw.t + ' ' + (raw.b || '');
    const entities = [];
    const sectors = new Set();
    for (const kw of JDATA.KEYWORDS){
      if (kw.rx.test(text)){
        entities.push({ tag: kw.tag, sector: kw.sector || null });
        if (kw.sector) sectors.add(kw.sector);
      }
    }
    // ORD-302 / Part II A4: headlines ending "?" are questions/conditionals,
    // not assertions — halve their verb-derived weight so "Will X crash?"
    // doesn't read as fully bearish.
    const qMark = /\?\s*$/.test(raw.t.trim());
    let bullHits = this.countSentimentHits(text, JDATA.BULL);
    let bearHits = this.countSentimentHits(text, JDATA.BEAR);
    if (qMark){ bullHits *= 0.5; bearHits *= 0.5; }
    const senti = bullHits > bearHits ? 'bull' : bearHits > bullHits ? 'bear' : 'neut';

    const amountCr = this.parseAmount(text);

    // ORD-1701 (a-d): astroturf/hype score — cheap heuristics, no AI.
    const hypeScore = JDATA.hypeScore(text, raw.s);
    const hype = hypeScore >= JDATA.HYPE_THRESHOLD;

    // impact 0-100: money size + entity richness + strong verbs
    let impactBase = 22;
    if (amountCr) impactBase += U.clamp(Math.log10(amountCr + 1) * 11, 0, 44);
    impactBase += U.clamp(entities.length * 4, 0, 20);
    impactBase += (bullHits + bearHits) * 3; // already halved above for "?" headlines
    impactBase *= JDATA.sourceWeight(raw.s); // ORD-202: official/wire sources earn more weight
    if (hype) impactBase *= 0.5;             // ORD-1701: hype-flagged items get impact halved
    impactBase = Math.round(U.clamp(impactBase, 10, 99));

    // flow classification — ORD-302 direction: outflow verbs sign the amount
    // negative for that sector. Hype items are excluded from flow-tracking.
    let flow = null;
    if (amountCr && sectors.size && !hype){
      const toSector = [...sectors][0];
      let from = 'corporate';
      if (raw.cat === 'gov' || /cabinet|ministry|government|budget|scheme|outlay|railways|PIB/i.test(text)) from = 'gov';
      else if (/FII|FPI|foreign fund|foreign inflow|EM equity|global funds|overseas|sovereign fund|pension fund|Japan|subsidy tranche/i.test(text) && raw.cat !== 'corporate') from = 'foreign';
      else if (/DII|mutual fund|SIP|insurer|private equity|institutions/i.test(text)) from = 'institution';
      else if (/NVIDIA|Google|global pharma|hyperscaler/i.test(text)) from = 'foreign';
      const outflow = JDATA.OUTFLOW_RX.test(text);
      flow = { from, to: toSector, amountCr: outflow ? -amountCr : amountCr };
    }

    // ORD-903: impact starts equal to the raw/base score; computePercentiles()
    // overwrites `impact` with the corpus percentile after all items exist,
    // keeping `impactBase`/`impactRaw` around for archive/tooltip use.
    return { ...raw, entities, sectors: [...sectors], senti, impact: impactBase, impactBase, impactRaw: impactBase,
      amountCr, flow, live: !!raw.live, hype, hypeScore, qMark, gid: null, confirmed: false };
  },

  /* Everything normalizes to crore INR before any summation — flow math on
     mixed units is meaningless. Indian media writes the same money as
     "₹5,000 crore", "Rs 5,000 crore", "Rs. 1.2 lakh crore", "$14 billion",
     "USD 2.5 bn"; all forms must land on one number. A currency marker
     (₹/Rs/$/USD) is REQUIRED — bare "5 crore" is more often people than
     rupees ("5 crore subscribers") and stays unparsed on purpose. */
  AMOUNT_RX: {
    lakhCr:   /(?:₹|\bRs\.?)\s?([\d,.]+)\s*lakh\s*crore/i,
    crore:    /(?:₹|\bRs\.?)\s?([\d,.]+)\s*(?:crore|cr)\b/i,
    trillion: /(?:\$|\bUS\$|\bUSD\b)\s?([\d,.]+)\s*trillion\b/i,
    billion:  /(?:\$|\bUS\$|\bUSD\b)\s?([\d,.]+)\s*(?:billion|bn)\b/i,
    million:  /(?:\$|\bUS\$|\bUSD\b)\s?([\d,.]+)\s*(?:million|mn)\b/i
  },
  parseAmount(text){
    const num = (/** @type {RegExpMatchArray} */ m) => parseFloat(m[1].replace(/,/g,''));
    let total = 0;
    let m = text.match(this.AMOUNT_RX.lakhCr);
    if (m) total = Math.max(total, num(m) * 100000);
    m = text.match(this.AMOUNT_RX.crore);
    if (m) total = Math.max(total, num(m));
    m = text.match(this.AMOUNT_RX.trillion);
    if (m) total = Math.max(total, num(m) * this.USD_INR * 100000); // was hardcoded at 85.5's value; now respects the USD_INR setting
    m = text.match(this.AMOUNT_RX.billion);
    if (m) total = Math.max(total, num(m) * this.USD_INR * 100);
    m = text.match(this.AMOUNT_RX.million);
    if (m) total = Math.max(total, num(m) * this.USD_INR / 10);
    return total ? Math.round(total) : 0;
  },

  /* ------------- full pipeline ------------- */
  run(rawItems){
    let list = rawItems;
    if (list.length > this.MAX_ITEMS_PER_PASS){
      // freshest-first (lowest .h = most recent) — keep the newest MAX,
      // not an arbitrary prefix, so the visible cap still means "today's
      // most current items" rather than whatever order they arrived in.
      list = [...list].sort((a, b) => (a.h ?? 999) - (b.h ?? 999)).slice(0, this.MAX_ITEMS_PER_PASS);
      this.truncation = { capped: true, analyzed: list.length, skipped: rawItems.length - list.length };
    } else {
      this.truncation = { capped: false, analyzed: list.length, skipped: 0 };
    }
    this.items = list.map(r => r.entities ? r : this.analyzeItem(r))
      .sort((a,b) => a.h - b.h);
    this.buildGroups();        // ORD-301/901: corroboration groups first
    this.computeGrades();      // Sprint 14: A/B/C/D evidence grade, needs .confirmed/.hype from buildGroups
    this.computeNovelty();     // Sprint 14: echo-vs-novelty against yesterday's archived shingles
    this.computePercentiles(); // ORD-903: impact -> corpus percentile
    this.buildFlows();         // ORD-901: flows built from groups, not raw items
    this.buildClusters();
    this.buildIdeas();
    return this;
  },

  /** Session #12's A/B/C/D evidence grade — derived entirely from state
   *  the engine already tracks (confirmation, source tier, hype), never
   *  a separate judgment call. A = confirmed with at least one tiered
   *  (official/wire) source; B = confirmed but all sources untiered;
   *  C = single-source, not hype; D = hype-flagged (overrides the rest,
   *  since a hype-flagged item's sourcing doesn't redeem its content).
   *  @param {NewsItem} item @returns {'A'|'B'|'C'|'D'} */
  evidenceGrade(item){
    if (item.hype) return 'D';
    if (item.confirmed){
      const hasTiered = (item.groupSources || []).some(s => JDATA.sourceWeight(s) > 1);
      return hasTiered ? 'A' : 'B';
    }
    return 'C';
  },

  computeGrades(){
    for (const item of this.items) item.grade = this.evidenceGrade(item);
  },

  /** Echo-vs-novelty (Sprint 14, rough not perfect): an item is "novel"
   *  unless its shingles closely match something archived ~24h ago,
   *  using the same 0.55 Jaccard threshold as same-day dedup. With no
   *  yesterday-shingle history loaded yet (cold start, or Store's
   *  archive unavailable), everything defaults to novel=true rather
   *  than guessing echo status from nothing. */
  computeNovelty(){
    const yesterday = (typeof Store !== 'undefined' && Store._yesterdayShingleSets) || [];
    for (const item of this.items){
      if (!yesterday.length){ item.novel = true; continue; }
      const todaySet = this.shingles(item.t);
      item.novel = !yesterday.some(ySet => this.jaccard(todaySet, ySet) >= 0.55);
    }
  },

  /** 3-word shingles of a lowercased, punctuation-stripped title (M2). */
  shingles(title){
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const s = new Set();
    for (let i = 0; i <= words.length - 3; i++) s.add(words.slice(i, i + 3).join(' '));
    if (!s.size && words.length) s.add(words.join(' '));
    return s;
  },
  jaccard(a, b){
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
  },

  /* ------------- ORD-301/901: corroboration groups -------------
     Same story from 2+ sources becomes one Group: title-shingle Jaccard
     J >= 0.55, OR same sector + same company entity + amounts within ±10%
     within 72h (M2). Groups with 2+ distinct sources are "confirmed" and
     get +15 impact (boosts IMPACT, never amount — Part II's amendment to
     ORD-301). Per the ORD-901 amendment, the group's tracked amount is the
     MAX across members (same money reported N times), never the SUM. */
  buildGroups(){
    const items = this.items;
    const shingleSets = items.map(i => this.shingles(i.t));
    const parent = items.map((_, i) => i);
    const find = x => { while (parent[x] !== x){ parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };

    for (let i = 0; i < items.length; i++){
      for (let j = i + 1; j < items.length; j++){
        let dup = this.jaccard(shingleSets[i], shingleSets[j]) >= 0.55;
        if (!dup){
          const hoursApart = Math.abs(items[i].h - items[j].h);
          const sameSector = items[i].sectors.length && items[i].sectors.some(s => items[j].sectors.includes(s));
          const sameCompany = items[i].entities.some(e => items[j].entities.some(e2 => e2.tag === e.tag));
          if (hoursApart <= 72 && sameSector && sameCompany && items[i].amountCr && items[j].amountCr){
            const ratio = items[i].amountCr / items[j].amountCr;
            if (ratio >= 0.9 && ratio <= 1.111) dup = true;
          }
        }
        if (dup) union(i, j);
      }
    }

    const byRoot = {};
    items.forEach((it, idx) => { const r = find(idx); (byRoot[r] = byRoot[r] || []).push(it); });

    this.groups = [];
    for (const arr of Object.values(byRoot)){
      const sources = [...new Set(arr.map(i => i.s))];
      const confirmed = sources.length >= 2;
      const canonical = arr.slice().sort((a, b) => b.impactBase - a.impactBase)[0];
      const maxAmount = Math.max(0, ...arr.map(i => i.amountCr || 0)); // ORD-901 amendment: MAX, never SUM
      arr.forEach(i => {
        i.gid = 'g' + canonical.id;
        i.confirmed = confirmed;
        i.groupSize = arr.length;
        i.groupSources = sources;
        // Always derive from impactBase so re-running (e.g. on ingest) never
        // double-applies the confirmation bonus across successive run()s.
        i.impactRaw = confirmed ? U.clamp(i.impactBase + 15, 10, 140) : i.impactBase;
      });
      this.groups.push({
        gid: 'g' + canonical.id, memberIds: arr.map(i => i.id), canonicalId: canonical.id,
        sources, confirmed, amountCr: maxAmount, sector: canonical.sectors[0] || null,
        flow: canonical.flow ? { ...canonical.flow, amountCr: canonical.flow.amountCr < 0 ? -maxAmount : maxAmount } : null,
        senti: canonical.senti, title: canonical.t, h: Math.min(...arr.map(i => i.h))
      });
    }
  },

  /** ORD-903/M3: impactPct = round(100*rank/(n+1)) over impactRaw, ties
   *  averaged, clamped 1..99. impactRaw stays available for the archive/
   *  tooltip; the publicly displayed `.impact` becomes the percentile. */
  computePercentiles(){
    const n = this.items.length;
    if (!n){ return; }
    const sorted = [...this.items].sort((a, b) => a.impactRaw - b.impactRaw);
    let i = 0;
    while (i < n){
      let j = i;
      while (j + 1 < n && sorted[j + 1].impactRaw === sorted[i].impactRaw) j++;
      const avgRank = (i + 1 + j + 1) / 2; // 1-indexed, inclusive of tie band
      const pct = U.clamp(Math.round(100 * avgRank / (n + 1)), 1, 99);
      for (let k = i; k <= j; k++) sorted[k].impact = pct;
      i = j + 1;
    }
  },

  ingest(newRaw){
    const known = new Set(this.items.map(i => i.t.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0, 70)));
    const fresh = [];
    for (const r of newRaw){
      const key = r.t.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0, 70);
      if (!known.has(key)){ known.add(key); fresh.push(this.analyzeItem(r)); }
    }
    if (fresh.length){
      this.run([...fresh, ...this.items]);
      Bus.emit('data:updated', { reason: 'live' }); // ORD-1301: let subscribers react instead of the caller re-rendering by hand
    }
    return fresh.length;
  },

  /* ------------- money flows -------------
     ORD-901: built from corroboration GROUPS, not raw items, so the same
     ₹75,000 cr story reported 4x contributes one flow, not four. */
  buildFlows(){
    this.flows = this.groups.filter(g => g.flow).map(g => ({
      id: g.gid, from: g.flow.from, to: g.flow.to, amountCr: g.flow.amountCr,
      title: g.title, h: g.h, senti: g.senti, sources: g.sources, dedupedFrom: g.memberIds.length
    })).sort((a,b) => Math.abs(b.amountCr) - Math.abs(a.amountCr));
  },

  /* ORD-302: per-sector/source aggregation NETS signed amounts (an inflow
     and an outflow in the same sector partly cancel — that is the honest
     picture of "money in motion"), unlike totalTracked() below which is a
     magnitude/volume-of-activity KPI. See DECISIONS.md for the rationale. */
  flowBySector(){
    const agg = {};
    for (const f of this.flows){
      agg[f.to] = agg[f.to] || { sector: f.to, label: JDATA.SECTORS[f.to]?.label || f.to, total: 0, count: 0 };
      agg[f.to].total += f.amountCr; agg[f.to].count++;
    }
    return Object.values(agg).sort((a,b) => Math.abs(b.total) - Math.abs(a.total));
  },

  flowBySource(){
    const agg = {};
    for (const f of this.flows){
      agg[f.from] = agg[f.from] || { key: f.from, ...JDATA.FLOW_SOURCES[f.from], total: 0, count: 0 };
      agg[f.from].total += f.amountCr; agg[f.from].count++;
    }
    return Object.values(agg).sort((a,b) => Math.abs(b.total) - Math.abs(a.total));
  },

  /* Deliberately a magnitude sum (sum of |amountCr|), not a net — this KPI
     reads as "how much disclosed capital activity is on the board", and an
     inflow + an equal outflow are two real, separate news events, not zero
     activity. Netting belongs to flowBySector/flowBySource (directional
     answer to "where is money going"), not to this volume-of-activity KPI. */
  totalTracked(){ return this.flows.reduce((s,f) => s + Math.abs(f.amountCr), 0); },

  /* ------------- pattern clusters ------------- */
  buildClusters(){
    const bySector = {};
    for (const it of this.items){
      if (it.hype) continue; // ORD-1701: hype-flagged items excluded from pattern/idea inputs
      for (const s of it.sectors){
        (bySector[s] = bySector[s] || []).push(it);
      }
    }
    const clusters = [];
    for (const [sector, arr] of Object.entries(bySector)){
      if (arr.length < 2) continue;
      const meta = JDATA.SECTORS[sector];
      // Attack #13 fix (red-team Session #1): an item tagged with N
      // sectors contributes impact/N to each cluster, not full impact N
      // times over — one story is one unit of evidence no matter how
      // many sector regexes it happens to trip. Still counts everywhere
      // it's relevant, just at fractional weight.
      const momentum = arr.reduce((s,i) => s + (i.impact / Math.max(1, i.sectors.length)) * Math.max(.35, 1 - i.h/96), 0);
      // Cluster-level flowsCr stays a magnitude (sum of |amountCr|) — it feeds
      // narrative copy ("capital in motion") and M5's log-scaled conviction
      // term, where a signed net could read as a nonsensical negative sum
      // even though the cluster genuinely has capital moving both ways.
      const flowsCr = arr.reduce((s,i) => s + Math.abs(i.flow?.amountCr || 0), 0);
      // Attack #9 fix (red-team Session #1): a question headline ("Is X
      // About to Crash?") already has its IMPACT halved (line ~79 above),
      // but that halving is applied to BOTH bullHits and bearHits before
      // the bull>bear comparison, which is a no-op for classification —
      // a bear-leaning question still lands squarely in item.senti==='bear'
      // and, unguarded, counted FULLY toward the cluster's bear tally. A
      // cluster built entirely from "is X doomed?" bear-baiting headlines
      // could tip c.bear > c.bull and trigger a CAUTION idea despite zero
      // concrete assertions anywhere in the corpus. Fixed by excluding
      // qMark items from the cluster-level bull/bear COUNT entirely (not
      // just the impact-weight) — a question is not an assertion, and
      // repeated bear-baiting questions read as attention-seeking, not
      // genuine bearish signal. Individual items keep their own .senti
      // for display; this only changes what the CLUSTER tally counts.
      const bull = arr.filter(i => i.senti === 'bull' && !i.qMark).length;
      const bear = arr.filter(i => i.senti === 'bear' && !i.qMark).length;
      const neut = arr.length - bull - bear;
      // dominant macro tag across the cluster
      const tagCount = {};
      arr.forEach(i => i.entities.forEach(e => { if (!e.sector) tagCount[e.tag] = (tagCount[e.tag]||0) + 1; }));
      const topTag = Object.entries(tagCount).sort((a,b) => b[1]-a[1])[0]?.[0];
      const sources = new Set(arr.map(i => i.s)).size;
      clusters.push({
        sector, label: meta?.label || sector,
        name: (meta?.label || sector).toUpperCase() + (topTag ? ' × ' + topTag.toUpperCase() : ''),
        items: arr.sort((a,b) => a.h - b.h),
        momentum: Math.round(momentum), flowsCr, bull, bear, neut, sources, topTag,
        narrative: this.narrate(meta?.label || sector, arr, flowsCr, sources, bull, bear)
      });
    }
    const max = Math.max(1, ...clusters.map(c => c.momentum));
    clusters.forEach(c => c.score = Math.round(100 * c.momentum / max));
    this.clusters = clusters.sort((a,b) => b.momentum - a.momentum).slice(0, 8);
  },

  narrate(label, arr, flowsCr, sources, bull, bear){
    const window = Math.round(Math.max(...arr.map(i => i.h)));
    const lean = bull > bear ? 'constructive' : bear > bull ? 'defensive' : 'mixed';
    let s = `${arr.length} independent signals from ${sources} sources inside ${window}h converge on ${label}. Tone is ${lean}.`;
    if (flowsCr) s += ` Disclosed capital in motion: ${U.fmtCr(flowsCr)}.`;
    return s;
  },

  /** M5: conviction v2, computed uniformly across long/caution ideas from
   *  four weighted components (kept on the idea for the lineage tooltip).
   *  Ships behind Engine.FLAGS.convictionV2 alongside v1 for one sprint of
   *  comparison (Part III C6) before v1 is deleted next sprint. */
  convictionV2(c){
    const members = Math.max(c.items.length, 1);
    const clusterScore = c.score;
    const sourcesTerm = Math.min(c.sources / 6, 1) * 100;
    const flowsTerm = Math.min(Math.log10(Math.max(c.flowsCr, 1)) / 6, 1) * 100;
    const sentiTerm = (((c.bull - c.bear) / members) + 1) / 2 * 100;
    const conv = U.clamp(Math.round(
      0.40 * clusterScore + 0.20 * sourcesTerm + 0.20 * flowsTerm + 0.20 * sentiTerm
    ), 20, 96);
    return { conv, components: { clusterScore: Math.round(clusterScore), sourcesTerm: Math.round(sourcesTerm), flowsTerm: Math.round(flowsTerm), sentiTerm: Math.round(sentiTerm) } };
  },

  /* ------------- idea generation ------------- */
  buildIdeas(){
    const HORIZON = { gov:'2–4 YRS', corporate:'1–3 YRS', foreign:'6–18 MO', institution:'6–18 MO' };
    const ideas = [];
    for (const c of this.clusters.slice(0, 6)){
      const v2 = this.convictionV2(c);
      if (c.bear > c.bull) {
        const convictionV1 = U.clamp(Math.round(c.score * .8), 20, 90);
        ideas.push({
          kind:'caution', sector: c.sector, label: c.label,
          title: 'CAUTION PROTOCOL — ' + c.label,
          conviction: this.FLAGS.convictionV2 ? v2.conv : convictionV1,
          convictionV1, convictionV2: v2.conv, convComponents: v2.components,
          horizon: 'MONITOR',
          thesis: `Signal tone in ${c.label} has turned defensive (${c.bear} bearish vs ${c.bull} bullish signals). If you hold exposure here, tighten position sizing and wait for the pattern to resolve before adding.`,
          catalysts: c.items.slice(0,3).map(i => i.t),
          risks: ['Bearish clusters can reverse quickly on policy response', JDATA.SECTORS[c.sector]?.risk || 'Sector-specific execution risk'],
          watch: JDATA.SECTORS[c.sector]?.watch || [], clusterName: c.name
        });
        continue;
      }
      const domFlow = this.flows.filter(f => f.to === c.sector).sort((a,b) => Math.abs(b.amountCr) - Math.abs(a.amountCr))[0];
      const convictionV1 = U.clamp(Math.round(c.score * .55 + (c.bull/(c.items.length))*30 + (c.flowsCr ? 15 : 0)), 25, 96);
      ideas.push({
        kind:'long', sector: c.sector, label: c.label,
        title: c.label.toUpperCase() + ' — RIDE THE ' + (c.topTag ? c.topTag.toUpperCase() : 'MOMENTUM') + ' WAVE',
        conviction: this.FLAGS.convictionV2 ? v2.conv : convictionV1,
        convictionV1, convictionV2: v2.conv, convComponents: v2.components,
        horizon: HORIZON[domFlow?.from] || '1–3 YRS',
        thesis: `${c.narrative} Capital committed at this scale typically takes quarters to show up in earnings — the market usually reprices the obvious beneficiaries first, then the suppliers behind them. The second-order names are where patient research pays.`,
        catalysts: c.items.filter(i => i.senti !== 'bear').slice(0,3).map(i => i.t),
        risks: [JDATA.SECTORS[c.sector]?.risk || 'Execution risk', 'Valuations may already price in the theme — check before entry'],
        watch: JDATA.SECTORS[c.sector]?.watch || [], clusterName: c.name
      });
    }
    this.ideas = ideas.sort((a,b) => b.conviction - a.conviction);
  },

  /* ------------- quick stats for HUD ------------- */
  stats(){
    const bull = this.items.filter(i => i.senti === 'bull').length;
    const bear = this.items.filter(i => i.senti === 'bear').length;
    return {
      signals: this.items.length,
      patterns: this.clusters.length,
      trackedCr: this.totalTracked(),
      bullPct: this.items.length ? Math.round(100 * bull / (bull + bear || 1)) : 0,
      alerts: this.items.filter(i => i.impact >= 80).length,
      topSector: this.flowBySector()[0] || null
    };
  }
};
