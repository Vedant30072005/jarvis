// @ts-check
/* ============================================================
   J.A.R.V.I.S — brain: fenced, cite-or-silent intent matcher
   (Sprint 10 core slice: 5 intents · Brain v2: full 17-intent grammar)

   Three deterministic layers, no AI anywhere:

   1. INTENT GRAMMAR — an ordered regex table, specific intents before
      general ones (a query like "predictions due soon" must hit the
      due-soon intent before the broader predictions-open one).
   2. SLOT EXTRACTION — matchSector()/matchPct(): pure lexicon lookups
      against JDATA.SECTORS (labels, keys, watch names) and
      JDATA.COMPANIES (64 names/symbols → their sector). Short,
      ambiguous tokens ("it", "ev") only match when typed uppercase as
      a standalone word, so "how does it affect..." never reads as the
      IT sector.
   3. GROUNDED COMPOSITION — every answer is a template filled with
      real module state (Engine, Portfolio, Ledger, Mirror,
      Counterfactual, SundayReview), each with an honest empty-state.

   "Fenced, cite-or-silent": once an intent matches, the answer is
   either a real number traceable to a real panel, or an explicit
   "nothing to report" — never a fabricated middle ground. ask()
   returns undefined only when NO intent recognises the query, and the
   caller (jarvis.js) falls through to its personality table.

   Still deferred: intent-learning from user corrections, and the
   composed morning-briefing ritual.
   ============================================================ */

const Brain = {
  /* ---------------- layer 0: normalization pre-pass ---------------- */

  /** Ordered, case-preserving canonicalization rules applied before
   *  intent matching — each maps a paraphrase onto the exact trigger
   *  words the intent grammar already understands, so coverage grows
   *  without loosening any intent regex. Replacements are lowercase
   *  literals; everything untouched keeps its case (the uppercase-"IT"
   *  sector guard depends on that). Every rule here must have a golden-
   *  corpus utterance in test.html proving it converts a miss into the
   *  intended intent — no speculative rules.
   *  @type {Array<[RegExp, string]>} */
  NORMALIZE_RULES: [
    [/\b(tanks?|plunges?|slides?|sinks?|tumbles?|declines?)\b/gi, 'drops'],
    [/\b(better|worse) than (the )?(nifty|index|market)\b/gi, 'beating the nifty'],
    [/\b(lagging|trailing|underperforming) (the )?(nifty|index|market)\b/gi, 'beating the nifty'],
    [/\b(overweight|invested) in (?!bullish|long)/gi, 'exposure to '],
    [/\b(shares?|stocks?|units) in\b/gi, 'exposure to'],
    [/\bhow (safe|protected) (am i|is my portfolio)\b/gi, 'how hedged am i'],
    [/\bwhat.?s (buzzing|moving|trending)\b/gi, "what's hot"],
    [/\b(broke|break|breaking) (my |any )?(own )?rules\b/gi, 'rule break'],
    [/\btrading too (much|often)\b|\btoo many trades\b/gi, 'churning'],
    [/\bmixed (signals?|coverage|opinions?)\b/gi, 'contested signals'],
    [/\b(prediction|forecast) (accuracy|track record)\b/gi, 'calibration'],
    [/\b(outstanding|pending) (predictions?|forecasts?)\b/gi, 'predictions open'],
    [/\bconcentrat(ed|ion)\b(?! risk)/gi, 'concentration risk'],
    [/\bbiggest (position|holding)\b/gi, 'largest position'],
    [/\bhow.?s (my )?([a-z0-9&.\s]+?) (doing|performing|holding up)\b/gi, 'exposure to $2'],
    [/\bhow is (my )?([a-z0-9&.\s]+?) (doing|performing|holding up)\b/gi, 'exposure to $2']
  ],

  /** @param {string} query */
  normalize(query){
    let q = String(query);
    for (const [rx, to] of this.NORMALIZE_RULES) q = q.replace(rx, to);
    return q;
  },

  /* ---------------- teach loop: guesses + taught phrases (Brain v3) ---------------- */

  /** Per-intent metadata for the "did you mean" flow: `example` is the
   *  canonical utterance shown on a suggestion chip (and re-asked when
   *  clicked); `vocab` is the exact-token lexicon the guess scorer
   *  matches a missed query against. Hand-written, no AI. */
  INTENT_META: {
    'scenario':             { example: 'What if crude spikes 20%?', vocab: ['crude','oil','rbi','rate','rupee','dollar','vix','fii','monsoon','inflation','tariff','macro','scenario','propagate'] },
    'market-today':         { example: 'Why is the Nifty up today?', vocab: ['nifty','sensex','market','driving','reason','rally','selloff','today'] },
    'sector-shock':         { example: 'What if defence drops 10%?', vocab: ['drops','drop','crash','crashes','falls','shock','correction'] },
    'compare-sectors':      { example: 'Compare banking vs defence', vocab: ['compare','versus','comparison'] },
    'sector-bull-case':     { example: "What's the bull case for defence?", vocab: ['bull','bullish','upside'] },
    'sector-bear-case':     { example: 'Any bearish signals in banking?', vocab: ['bear','bearish','downside','negative'] },
    'sector-exposure':      { example: "What's my exposure to defence?", vocab: ['exposure','own','hold','holding','invested'] },
    'worst-case-sector':    { example: "What's my worst-case sector?", vocab: ['worst'] },
    'single-stock-risk':    { example: "What's my biggest single-stock risk?", vocab: ['risk','risky','concentration','concentrated','biggest','largest'] },
    'hedged':               { example: 'How much of my portfolio is hedged?', vocab: ['hedged','hedge','defensive','gold','cash','safe','protected'] },
    'vs-index':             { example: 'Am I beating the Nifty?', vocab: ['nifty','index','benchmark','beating','outperform','returns','alpha'] },
    'trade-frequency':      { example: 'How often do I trade?', vocab: ['often','churn','frequency','overtrading','trades'] },
    'rules-check':          { example: 'Did I follow my own rules this week?', vocab: ['rules','discipline','thesis','broke'] },
    'calibration':          { example: 'How calibrated am I?', vocab: ['calibrated','calibration','brier','accuracy','accurate'] },
    'predictions-due-soon': { example: 'Any predictions coming due?', vocab: ['due','overdue','deadline'] },
    'predictions-open':     { example: 'What predictions are open?', vocab: ['predictions','prediction','forecasts','open'] },
    'briefing':             { example: 'Give me the morning briefing', vocab: ['briefing','summary','overview','rundown'] },
    'whats-hot':            { example: "What's hot right now?", vocab: ['hot','momentum','trending','moving'] },
    'contested-exposure':   { example: 'Is my portfolio sitting in any contested sectors?', vocab: ['contested','disagreement','conflicting','holdings','dispute'] },
    'whats-contested':      { example: 'Which sectors are contested?', vocab: ['contested','disagreement','split','mixed'] },
    'worry':                { example: 'What should I be worried about?', vocab: ['worried','worry','threats','threat','risks','caution','danger'] },
    'bullish-capital':      { example: 'How much of my portfolio is in bullish calls?', vocab: ['bullish','calls','allocated'] }
  },

  /** Scored "did you mean": every intent's vocab-overlap with the
   *  (normalized, stopword-stripped) query, descending, score > 0 only.
   *  @param {string} query @param {number} [n] @returns {Array<{id:string, score:number}>} */
  guessScored(query, n = 4){
    const tokens = new Set(this.normalize(String(query)).toLowerCase()
      .split(/[^a-z0-9%]+/).filter(w => w.length > 2 && !JDATA.STOPWORDS.has(w)));
    return Object.entries(this.INTENT_META)
      .map(([id, meta]) => ({ id, score: meta.vocab.reduce((s, v) => s + (tokens.has(v) ? 1 : 0), 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  },

  /** Ids only (top-n) — the shape the teach-loop chips consume.
   *  @param {string} query @param {number} [n] @returns {string[]} */
  guess(query, n = 3){ return this.guessScored(query, n).map(x => x.id); },

  /** Graded interpretation — the brain expresses HOW sure it is, so the
   *  caller can answer confidently, disambiguate, or ask, instead of the
   *  old binary match/dead-end. Four tiers:
   *    'match'      — an exact grammar or taught routing (certain).
   *    'confident'  — no exact match, but ONE dominant guess (strong
   *                   vocab evidence, clear lead) → answer it WITH the
   *                   interpretation stated, honestly, and offer a
   *                   one-tap correction.
   *    'ambiguous'  — 2+ plausible guesses too close to call → chips.
   *    'unknown'    — nothing → miss log + help.
   *  Confidence gate: a sole candidate needs score ≥ 2, or the top must
   *  beat the runner-up by ≥ 2 — a single weak token (score 1) is never
   *  enough to auto-answer, because a wrong confident answer is worse
   *  than an honest "did you mean".
   *  @param {string} query
   *  @returns {{kind:'match'|'confident', intent:any, interpretation?:string} | {kind:'ambiguous', guesses:string[]} | {kind:'unknown'}} */
  interpret(query){
    const qNorm = this.normalize(String(query));
    const exact = this._taughtIntent(qNorm) || this._match(qNorm);
    if (exact) return { kind: 'match', intent: exact };

    const scored = this.guessScored(qNorm, 4);
    if (!scored.length) return { kind: 'unknown' };

    const top = scored[0], second = scored[1];
    const dominant = (scored.length === 1 && top.score >= 2) ||
                     (top.score >= 2 && (!second || top.score - second.score >= 2));
    if (dominant){
      const intent = this.intentById(top.id);
      if (intent) return { kind: 'confident', intent, interpretation: this.INTENT_META[top.id].example, guesses: scored.map(x => x.id) };
    }
    return { kind: 'ambiguous', guesses: scored.map(x => x.id) };
  },

  /* ---- taught phrases (jarvis.taught.v1): user-corrected routings ---- */

  TAUGHT_KEY: 'jarvis.taught.v1',
  TAUGHT_VERSION: 1,
  TAUGHT_MIGRATIONS: { 0: (data) => data },
  TAUGHT_MAX: 100,

  loadTaught(){ return /** @type {Array<{phrase:string, intentId:string, createdAt:number}>} */ (Schema.load(this.TAUGHT_KEY, this.TAUGHT_VERSION, [], this.TAUGHT_MIGRATIONS)); },

  /** Permanently routes a phrasing to an intent — the user clicking a
   *  "did you mean" chip IS the correction signal that calls this.
   *  Taught routings are checked BEFORE the regex table (an explicit
   *  user correction outranks the built-in grammar). Re-teaching a
   *  phrase replaces its old routing; capped FIFO.
   *  @param {string} phrase @param {string} intentId */
  teach(phrase, intentId){
    if (!this.INTENTS.some(i => i.id === intentId)) return false;
    const key = this.normalize(String(phrase)).toLowerCase().trim();
    if (!key) return false;
    let list = this.loadTaught().filter(t => t.phrase !== key);
    list.push({ phrase: key, intentId, createdAt: Date.now() });
    if (list.length > this.TAUGHT_MAX) list = list.slice(-this.TAUGHT_MAX);
    Schema.save(this.TAUGHT_KEY, this.TAUGHT_VERSION, list);
    return true;
  },

  /** @param {string} phrase */
  forget(phrase){
    const key = this.normalize(String(phrase)).toLowerCase().trim();
    const list = this.loadTaught();
    const kept = list.filter(t => t.phrase !== key);
    if (kept.length === list.length) return false;
    Schema.save(this.TAUGHT_KEY, this.TAUGHT_VERSION, kept);
    return true;
  },

  /** @param {string} qNorm normalized query */
  _taughtIntent(qNorm){
    const key = qNorm.toLowerCase().trim();
    const hit = this.loadTaught().find(t => t.phrase === key);
    return hit ? this.INTENTS.find(i => i.id === hit.intentId) || null : null;
  },

  /* ---------------- miss log (jarvis.brainmisses.v1) ---------------- */

  MISS_KEY: 'jarvis.brainmisses.v1',
  MISS_VERSION: 1,
  MISS_MIGRATIONS: { 0: (data) => data },
  MISS_MAX: 50,

  loadMisses(){ return /** @type {Array<{q:string, t:number}>} */ (Schema.load(this.MISS_KEY, this.MISS_VERSION, [], this.MISS_MIGRATIONS)); },

  /** Called by jarvis.js when a query falls through BOTH the brain and
   *  the personality table — the data-driven answer to "which intent
   *  should be built next." Capped FIFO; surfaced in the Sunday review.
   *  @param {string} query */
  logMiss(query){
    let list = this.loadMisses();
    list.push({ q: String(query).slice(0, 140), t: Date.now() });
    if (list.length > this.MISS_MAX) list = list.slice(-this.MISS_MAX);
    Schema.save(this.MISS_KEY, this.MISS_VERSION, list);
    return list.length;
  },

  /* ---------------- slot extraction ---------------- */

  _rxEsc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },

  // Label words too generic to identify a sector on their own.
  _LABEL_STOPWORDS: new Set(['services', 'transition']),

  /** All sectors mentioned in the query, ordered by first appearance.
   *  Three passes: sector labels/keys (short ambiguous tokens like
   *  "it"/"ev" require uppercase in the raw query), company names/
   *  symbols mapped to their sector, then a GUARDED fuzzy pass —
   *  edit distance ≤1, query tokens ≥5 chars, company lexicon only —
   *  so "relianc" still resolves without opening the door to loose
   *  matching. @param {string} query @returns {string[]} */
  matchSectors(query){
    const raw = String(query);
    const q = raw.toLowerCase().replace(/defense/g, 'defence'); // tolerate the US spelling
    /** @type {Object<string, number>} */
    const found = {};
    const note = (key, idx) => { if (idx >= 0 && (found[key] === undefined || idx < found[key])) found[key] = idx; };

    for (const [key, s] of Object.entries(JDATA.SECTORS)){
      const label = s.label.toLowerCase();
      const parts = [label, ...label.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !this._LABEL_STOPWORDS.has(w)), key];
      for (const p of parts){
        if (p.length <= 3){
          const m = new RegExp(`\\b${p.toUpperCase()}\\b`).exec(raw);
          if (m) note(key, m.index);
        } else {
          const m = new RegExp(`\\b${this._rxEsc(p)}\\b`).exec(q);
          if (m) note(key, m.index);
        }
      }
    }
    for (const c of JDATA.COMPANIES){
      const nm = c.name.toLowerCase();
      if (nm.length >= 3){ const m = new RegExp(`\\b${this._rxEsc(nm)}\\b`).exec(q); if (m) note(c.sector, m.index); }
      const sym = c.sym.toLowerCase();
      if (sym.length >= 3){ const m = new RegExp(`\\b${this._rxEsc(sym)}\\b`).exec(q); if (m) note(c.sector, m.index); }
    }
    // guarded fuzzy pass — company lexicon only, never sector labels
    const tokens = q.split(/[^a-z0-9]+/);
    let pos = 0;
    for (const t of tokens){
      const idx = t ? q.indexOf(t, pos) : -1;
      if (idx >= 0) pos = idx + t.length;
      if (t.length < 5) continue;
      for (const c of JDATA.COMPANIES){
        const words = c.name.toLowerCase().split(/\s+/).filter(w => w.length >= 5);
        if (c.sym.length >= 5) words.push(c.sym.toLowerCase());
        if (words.some(w => this._lev1(t, w))) note(c.sector, idx);
      }
    }
    return Object.entries(found).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  },

  /** First (or only) sector in the query, or null. @param {string} query */
  matchSector(query){ return this.matchSectors(query)[0] || null; },

  /** The first specific COMPANY (not just its sector) explicitly named
   *  in the query, by exact name/symbol match only — deliberately no
   *  fuzzy pass here (unlike matchSectors' guarded fuzzy fallback):
   *  misreading which sector a typo pointed at just broadens an answer,
   *  but misreading WHICH COMPANY you hold and quoting its qty/P&L would
   *  be a wrong fact stated as certain, which the brain never does.
   *  @param {string} query @returns {{name:string, sector:string, sym:string}|null} */
  matchCompany(query){
    const q = String(query).toLowerCase();
    let best = null, bestIdx = Infinity;
    for (const c of JDATA.COMPANIES){
      const nm = c.name.toLowerCase();
      if (nm.length >= 3){
        const m = new RegExp(`\\b${this._rxEsc(nm)}\\b`).exec(q);
        if (m && m.index < bestIdx){ best = c; bestIdx = m.index; }
      }
      const sym = c.sym.toLowerCase();
      if (sym.length >= 3){
        const m = new RegExp(`\\b${this._rxEsc(sym)}\\b`).exec(q);
        if (m && m.index < bestIdx){ best = c; bestIdx = m.index; }
      }
    }
    return best;
  },

  /** Actual holdings matching a specific company (not the whole sector)
   *  — exact/substring name or symbol match, the same heuristic
   *  `holdingsInSector` uses per-sector. @param {{name:string, sym:string}} company */
  holdingsForCompany(company){
    const nm = company.name.toLowerCase(), sym = company.sym.toLowerCase();
    return Portfolio.state.holdings.filter(h => {
      const n = h.name.toLowerCase();
      return n === nm || n.includes(nm) || n === sym || n.includes(sym);
    });
  },

  /** Headlines that literally name this company (by exact name or
   *  symbol substring in the headline text) — cite-or-silent: this
   *  counts real textual mentions, never a fabricated relevance score.
   *  @param {{name:string, sym:string}} company */
  companyMentions(company){
    const rx = new RegExp(`\\b${this._rxEsc(company.name.toLowerCase())}\\b|\\b${this._rxEsc(company.sym.toLowerCase())}\\b`, 'i');
    return Engine.items.filter(i => rx.test(i.t));
  },

  /** Edit distance ≤ 1 (one substitution, insertion, or deletion). */
  _lev1(a, b){
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb){
      if (a[i] === b[j]){ i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  },

  /* ---------------- one-turn sector memory ---------------- */

  /** @type {string|null} last EXPLICITLY named sector — session-only, never persisted */
  _lastSector: null,

  /** Sector slot with one-turn memory: an explicit sector match wins
   *  and refreshes the memory; with no sector in the query, fall back
   *  to the last explicitly-named one — and the answer SAYS so
   *  (assumptions are stated, never silent). fallback:false is for
   *  intents where a missing sector legitimately means something else
   *  (a market-wide shock), not "reuse the last one."
   *  @param {string} query @returns {{key:string, assumed:boolean}|null} */
  resolveSector(query, { fallback = true } = {}){
    const key = this.matchSector(query);
    if (key){ this._lastSector = key; return { key, assumed: false }; }
    return (fallback && this._lastSector) ? { key: this._lastSector, assumed: true } : null;
  },

  /** First "N%" in the query, or null. @param {string} query */
  matchPct(query){
    const m = String(query).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) : null;
  },

  /** Holdings whose name maps to `sectorKey` — via the sector's watch
   *  list (first-word match, same heuristic Portfolio.insights uses)
   *  or the company table. @param {string} sectorKey */
  holdingsInSector(sectorKey){
    const watch = (JDATA.SECTORS[sectorKey]?.watch || []).map(w => w.toLowerCase().split(' ')[0]);
    const companies = JDATA.COMPANIES.filter(c => c.sector === sectorKey);
    return Portfolio.state.holdings.filter(h => {
      const n = h.name.toLowerCase();
      return watch.some(w => n.includes(w)) ||
        companies.some(c => n === c.name.toLowerCase() || n.includes(c.name.toLowerCase()) || n === c.sym.toLowerCase());
    });
  },

  _sectorLabel(key){ return JDATA.SECTORS[key]?.label || key; },

  /* ---------------- intent grammar (specific → general) ---------------- */

  /** @type {Array<{id:string, rx:RegExp, answer:(q:string)=>{text:string, goto?:string}}>} */
  INTENTS: [
    {
      // Macro-shock scenario: propagate through the causal graph. Placed
      // BEFORE sector-shock so "what if crude drops 20%" routes here (oil
      // is a macro shock, not a holdable sector) while "what if defence
      // drops 10%" — no macro term — falls through to sector-shock.
      id: 'scenario',
      rx: /\b(crude|oil price|\brbi\b|rate\s*(cut|hike|rise|reduction)|repo rate|rupee|dollar|\binr\b|\bvix\b|volatility\s*(spike|surge)|\bfii\b|\bfpi\b|monsoon|inflation|tariff|el\s*ni|border\s*tension|budget\s*(capex|defen))/i,
      answer(q){
        const shock = Scenario.matchShock(q);
        if (!shock){
          const cat = Scenario.catalog().slice(0, 8).map(c => c.label.replace(/\s*\(.*?\)/, '')).join(', ');
          return { text: `I can stress-test macro shocks through the causal graph, Sir. Available: ${U.esc(cat)}… Try "what if crude spikes 20%" or "what happens if RBI cuts rates". [→ Patterns, Causal Graph]`, goto: 'patterns' };
        }
        const rows = Scenario.propagate(shock);
        const imp = Scenario.portfolioImpact(rows);
        const arrow = s => s > 0 ? '▲' : '▼';
        const top = rows.slice(0, 5).map(r =>
          `${arrow(r.sign)} ${U.esc(r.to)} (${r.lagDays}d${r.exposure > 0 ? `, your ${U.fmtCompact(r.exposure)}` : ''})`).join('\n▸ ');
        let text = `<b>${U.esc(shock)}</b> propagates to ${rows.length} sectors (single-step, net-average direction, no magnitude):\n▸ ${top}`;
        if (imp.anyExposure){
          const parts = [];
          if (imp.helped.length) parts.push(`${U.fmtCompact(imp.helpedCr)} across ${imp.helped.length} sector${imp.helped.length === 1 ? '' : 's'} helped`);
          if (imp.hurt.length) parts.push(`<span class="hl-red">${U.fmtCompact(imp.hurtCr)} across ${imp.hurt.length} hurt</span>`);
          text += `\n\nYour book: ${parts.join(', ')}. Direction only — the edges carry no magnitude.`;
        } else {
          text += `\n\nNone of your holdings map to the affected sectors.`;
        }
        return { text: text + ' [→ Patterns, Causal Graph]', goto: 'patterns' };
      }
    },
    {
      // "Why is the market up today?" — a question about what ACTUALLY
      // happened, not a hypothetical. Placed after `scenario` (macro
      // stress-tests keep priority) but BEFORE `sector-shock`, whose
      // /down N%/ pattern would otherwise read "why is Nifty down 1%"
      // as a what-if shock. The trigger requires "why" or "the reason",
      // which no hypothetical ("what if the market drops 20%") carries,
      // so the two never compete.
      id: 'market-today',
      rx: /\b(?:why|what(?:'s| is| are)? the reason)\b[^?]{0,50}?\b(?:market|nifty|sensex|index|stocks?)\b[^?]{0,50}?\b(?:up|down|ris\w+|rall\w+|fall\w+|fell|gain\w*|los\w+|green|red|jump\w*|surg\w+|slump\w*|tank\w*)\b|what.?s (?:driving|behind) the (?:market|nifty|sensex|rally|selloff)|how.?s the market (?:doing|today)|\bmarket (?:today|recap)\b/i,
      answer(){
        const idx = Market.indices();
        // Cite-or-silent: the SIM tape's numbers are invented, so with no
        // live quotes the honest answer is "I don't know", never a
        // simulated level dressed as today's close.
        if (!idx.length){
          return { text: `I don't have live index levels, Sir — the market tape needs the relay running (<code>node relay.js</code>). Without it the ticker you see is simulated, and I won't quote you an invented level as though it were today's market.` };
        }
        const stamp = Market.stamp();
        const levels = idx.map(i =>
          `<b>${U.esc(i.label)}</b> ${i.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span class="${i.changePct >= 0 ? 'hl-green' : 'hl-red'}">${i.changePct >= 0 ? '▲' : '▼'}${Math.abs(i.changePct).toFixed(2)}%</span>`
        ).join(' · ');

        const top = Engine.items.filter(i => !i.hype)
          .sort((a, b) => b.impact - a.impact).slice(0, 3);
        const sig = top.length
          ? top.map(i => `▸ ${i.senti === 'bull' ? '▲' : i.senti === 'bear' ? '▼' : '•'} "${U.esc(String(i.t).slice(0, 90))}" — ${U.esc(i.s)}, impact ${i.impact}`).join('\n')
          : '▸ Nothing on the board yet — run FETCH LIVE in Intel Feed for today\'s wires.';

        return {
          text: `${levels}${stamp ? ` <span style="color:var(--txt-3);font-size:.72rem">(live · as of ${stamp})</span>` : ''}\n\nHighest-impact signals on the board right now:\n${sig}\n\n<span style="color:var(--txt-3);font-size:.72rem">I can show you what moved and what was reported — I can't prove which caused which. No single headline "explains" an index move, and I won't pretend otherwise.</span>`,
          goto: 'intel'
        };
      }
    },
    {
      id: 'sector-shock',
      rx: /(drops?|falls?|crash(es)?|corrects?|down)\s+(by\s+)?\d+(\.\d+)?\s*%/i,
      answer(q){
        const pct = Brain.matchPct(q) ?? 10;
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your book is empty, Sir — a shock to nothing costs nothing. Add holdings in My Money first.' };
        // fallback:false — a shock with no named sector means the whole
        // market, not "the sector we were just talking about."
        const sector = Brain.resolveSector(q, { fallback: false })?.key || null;
        const scope = sector ? Brain.holdingsInSector(sector) : Portfolio.state.holdings;
        const exposure = scope.reduce((s, h) => s + Portfolio.value(h), 0);
        const hit = exposure * pct / 100;
        const label = sector ? U.esc(Brain._sectorLabel(sector)) : 'the whole market';
        if (sector && !exposure) return { text: `A ${pct}% drop in ${label} costs you nothing directly — no holdings in your book map to that sector. [→ My Money]`, goto: 'portfolio' };
        return { text: `If ${label} drops ${pct}%: roughly <span class="hl-red">−${U.fmtCompact(hit)}</span> on ${U.fmtCompact(exposure)} exposed (${(100 * hit / nw).toFixed(1)}% of the book). Linear estimate — single-step shock, no correlation effects. [→ My Money]`, goto: 'portfolio' };
      }
    },
    {
      id: 'compare-sectors',
      rx: /\bcompare\b|\bversus\b|\bvs\.?\b/i,
      answer(q){
        const keys = Brain.matchSectors(q);
        if (keys.length < 2){
          // "compare vs the nifty/index/market" is the vs-index intent's
          // territory — hand it over rather than mis-answering.
          if (/nifty|index|market/i.test(q)) return Brain.intentById('vs-index').answer(q);
          return { text: 'Compare what with what, Sir? Name two sectors — e.g. "compare banking vs defence".' };
        }
        const nw = Portfolio.netWorth();
        const line = key => {
          const c = Engine.clusters.find(x => x.sector === key);
          const exp = Brain.holdingsInSector(key).reduce((s, h) => s + Portfolio.value(h), 0);
          const cluster = c ? `momentum ${c.score}/100, ${c.bull} bull / ${c.bear} bear` : 'no active cluster';
          const expTxt = nw ? `, your exposure ${U.fmtCompact(exp)} (${(100 * exp / nw).toFixed(0)}%)` : '';
          return `<b>${U.esc(Brain._sectorLabel(key))}</b>: ${cluster}${expTxt}`;
        };
        return { text: keys.slice(0, 2).map(line).join(' — vs — ') + '. [→ Patterns]', goto: 'patterns' };
      }
    },
    {
      id: 'sector-bull-case',
      rx: /bull(ish)? case\b/i,
      answer(q){
        const r = Brain.resolveSector(q);
        if (!r) return { text: `Which sector, Sir? I track: ${Object.values(JDATA.SECTORS).map(s => s.label).join(', ')}.` };
        const sector = r.key;
        const assumed = r.assumed ? ` (assuming you still mean ${U.esc(Brain._sectorLabel(sector))} — name a sector to switch)` : '';
        const idea = Engine.ideas.find(i => i.kind === 'long' && i.sector === sector);
        if (!idea){
          const c = Engine.clusters.find(x => x.sector === sector);
          return { text: (c
            ? `No active long thesis on <b>${U.esc(Brain._sectorLabel(sector))}</b> — the cluster is live (momentum ${c.score}/100, ${c.bull} bull / ${c.bear} bear) but hasn't earned a drafted idea. [→ Patterns]`
            : `No current bullish momentum on <b>${U.esc(Brain._sectorLabel(sector))}</b> — no active cluster at all.`) + assumed, goto: c ? 'patterns' : undefined };
        }
        return { text: `<b>${U.esc(idea.label)}</b> — conviction ${idea.conviction}%, ${idea.horizon}. ${U.esc(idea.thesis.slice(0, 160))} [→ Ideas Lab]` + assumed, goto: 'ideas' };
      }
    },
    {
      id: 'sector-bear-case',
      rx: /bear(ish)? (case|signals?)|what.?s bearish/i,
      answer(q){
        const r = Brain.resolveSector(q);
        if (!r) return { text: `Which sector, Sir? I track: ${Object.values(JDATA.SECTORS).map(s => s.label).join(', ')}.` };
        const sector = r.key;
        const assumed = r.assumed ? ` (assuming you still mean ${U.esc(Brain._sectorLabel(sector))} — name a sector to switch)` : '';
        const bears = Engine.items.filter(i => i.sectors.includes(sector) && i.senti === 'bear' && !i.hype)
          .sort((a, b) => b.impact - a.impact);
        if (!bears.length) return { text: `No bearish signals on <b>${U.esc(Brain._sectorLabel(sector))}</b> in the current corpus. [→ Intel Feed]` + assumed, goto: 'intel' };
        const top = bears[0];
        return { text: `<b>${U.esc(Brain._sectorLabel(sector))}</b>: ${bears.length} bearish signal${bears.length === 1 ? '' : 's'}. Most impactful: "${U.esc(top.t.slice(0, 100))}" — ${U.esc(top.s)}, grade ${top.grade}, impact ${top.impact}. [→ Intel Feed]` + assumed, goto: 'intel' };
      }
    },
    {
      id: 'sector-exposure',
      rx: /\bexposure\b|affect my (portfolio|book|money)|do i (own|hold)\b/i,
      answer(q){
        // Company-level branch: a named company (not just its sector)
        // gets its OWN qty/value/P&L and its own headline mentions —
        // the gap that made "how's HAL doing" collapse into a sector
        // rollup before. Checked first; falls through to the unchanged
        // sector-only logic below when no specific company is named.
        const company = Brain.matchCompany(q);
        if (company){
          const nw = Portfolio.netWorth();
          if (!nw) return { text: 'Your ledger is empty, Sir — no exposure to anything yet. Add holdings in My Money.' };
          const held = Brain.holdingsForCompany(company);
          const name = U.esc(company.name);
          const sectorLabel = U.esc(Brain._sectorLabel(company.sector));
          const cluster = Engine.clusters.find(x => x.sector === company.sector);
          const mentions = Brain.companyMentions(company);
          const mentionNote = mentions.length ? ` ${mentions.length} signal${mentions.length === 1 ? '' : 's'} in today's feed name${mentions.length === 1 ? 's' : ''} it directly.` : '';
          if (!held.length){
            const sectorNote = cluster ? ` Sector-wide (${sectorLabel}): momentum ${cluster.score}/100, ${cluster.bull} bull / ${cluster.bear} bear.` : '';
            return { text: `You don't hold <b>${name}</b> directly, Sir — zero position in that specific name.${sectorNote}${mentionNote} [→ My Money]`, goto: 'portfolio' };
          }
          const value = held.reduce((s, h) => s + Portfolio.value(h), 0);
          const cost = held.reduce((s, h) => s + Portfolio.cost(h), 0);
          const qty = held.reduce((s, h) => s + h.qty, 0);
          const plPct = cost ? (100 * (value - cost) / cost).toFixed(1) : '0';
          let text = `<b>${name}</b> (${U.esc(company.sym)}): ${qty % 1 === 0 ? qty : qty.toFixed(2)} unit${qty === 1 ? '' : 's'}, ${U.fmtCompact(value)} (${(100 * value / nw).toFixed(0)}% of book), P&L ${+plPct >= 0 ? '+' : ''}${plPct}%.`;
          if (cluster) text += ` Sector (${sectorLabel}) momentum: ${cluster.score}/100.`;
          text += mentionNote + ` [→ My Money]`;
          return { text, goto: 'portfolio' };
        }
        const r = Brain.resolveSector(q);
        if (!r) return { text: `Which sector or company, Sir? I track: ${Object.values(JDATA.SECTORS).map(s => s.label).join(', ')}.` };
        const sector = r.key;
        const assumed = r.assumed ? ` (assuming you still mean ${U.esc(Brain._sectorLabel(sector))} — name a sector to switch)` : '';
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your ledger is empty, Sir — no exposure to anything yet. Add holdings in My Money.' };
        const held = Brain.holdingsInSector(sector);
        const label = U.esc(Brain._sectorLabel(sector));
        if (!held.length) return { text: `Zero direct exposure to <b>${label}</b> in your book. [→ My Money]` + assumed, goto: 'portfolio' };
        const value = held.reduce((s, h) => s + Portfolio.value(h), 0);
        const cost = held.reduce((s, h) => s + Portfolio.cost(h), 0);
        const plPct = cost ? (100 * (value - cost) / cost).toFixed(1) : '0';
        let text = `<b>${label}</b>: ${held.map(h => U.esc(h.name)).join(', ')} — ${U.fmtCompact(value)} (${(100 * value / nw).toFixed(0)}% of book), P&L ${+plPct >= 0 ? '+' : ''}${plPct}%. [→ My Money]`;
        const caution = Engine.ideas.find(i => i.kind === 'caution' && i.sector === sector);
        if (caution) text += ` ⚠ Bearish cluster active on this sector — conviction ${caution.conviction}. [→ Threat Board]`;
        return { text: text + assumed, goto: 'portfolio' };
      }
    },
    {
      id: 'worst-case-sector',
      rx: /worst.?case sector|worst sector|which.*holdings?.*bearish/i,
      answer(){
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your book is empty, Sir — no sector can hurt you yet.' };
        const bearish = Engine.clusters.filter(c => c.bear > c.bull);
        if (!bearish.length) return { text: 'No bearish clusters active right now — nothing on the board threatens your holdings directly.' };
        const ranked = bearish.map(c => ({ c, exposure: Brain.holdingsInSector(c.sector).reduce((s, h) => s + Portfolio.value(h), 0) }))
          .sort((a, b) => b.exposure - a.exposure);
        const worst = ranked[0];
        if (!worst.exposure) return { text: `${bearish.length} bearish cluster${bearish.length === 1 ? '' : 's'} active (${bearish.map(x => U.esc(x.label)).join(', ')}) — but none of your holdings map to them. [→ Patterns]`, goto: 'patterns' };
        return { text: `<b>${U.esc(worst.c.label)}</b>: ${U.fmtCompact(worst.exposure)} of your book (${(100 * worst.exposure / nw).toFixed(0)}%) sits in a bearish cluster — ${worst.c.bear} bear vs ${worst.c.bull} bull signals. [→ Threat Board]`, goto: 'command' };
      }
    },
    {
      id: 'single-stock-risk',
      rx: /biggest .*risk|largest (position|holding)|concentration risk|single.?stock risk/i,
      answer(){
        const hs = Portfolio.state.holdings;
        if (!hs.length) return { text: 'Your book is empty, Sir — concentration risk is the one problem you don\'t have.' };
        const nw = Portfolio.netWorth();
        const top = [...hs].sort((a, b) => Portfolio.value(b) - Portfolio.value(a))[0];
        const v = Portfolio.value(top);
        return { text: `<b>${U.esc(top.name)}</b>: ${U.fmtCompact(v)} — ${(100 * v / nw).toFixed(0)}% of the book. A 20% drop there costs <span class="hl-red">−${U.fmtCompact(v * 0.2)}</span> (${(20 * v / nw).toFixed(1)}% of net worth). [→ My Money]`, goto: 'portfolio' };
      }
    },
    {
      id: 'hedged',
      rx: /\bhedged?\b|defensive (positions?|allocation)|safe.?haven/i,
      answer(){
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your book is empty, Sir — nothing to hedge yet.' };
        const alloc = Portfolio.allocation();
        const defensive = alloc.filter(a => a.label === 'Gold' || a.label === 'Cash').reduce((s, a) => s + a.value, 0);
        const pct = Math.round(100 * defensive / nw);
        return { text: `Defensive allocation: <b>${pct}%</b> (${U.fmtCompact(defensive)} in Gold/Cash) vs ${100 - pct}% risk assets. Only asset classes entered as holdings count — I can't see what I'm not told. [→ My Money]`, goto: 'portfolio' };
      }
    },
    {
      id: 'vs-index',
      rx: /\b(beat|beating|outperform\w*)\b.*(nifty|index|market)|vs\.? (the )?(nifty|index)|how am i doing (vs|against)/i,
      answer(){
        if (!Ledger.load().length) return { text: 'No trade ledger imported yet, Sir — import a Zerodha CSV in My Money and I can run the horse race.' };
        const real = Ledger.xirr();
        const idx = Counterfactual.indexXirr();
        const fmt = v => v === null ? 'not solvable yet' : (v * 100).toFixed(1) + '%';
        if (!idx.ready) return { text: `Your real-trades XIRR: <b>${fmt(real)}</b>. The Nifty comparison needs at least 2 logged index levels — log today's in My Money. [→ My Money]`, goto: 'portfolio' };
        const verdict = (real !== null && idx.xirr !== null)
          ? (real > idx.xirr ? 'Ahead of the synthetic Nifty lane' : real < idx.xirr ? 'Behind the synthetic Nifty lane' : 'Dead level with the index')
          : 'Comparison incomplete';
        return { text: `${verdict}: your trades <b>${fmt(real)}</b> vs same-cash-same-dates Nifty <b>${fmt(idx.xirr)}</b> (${idx.niftyDaysLogged} levels logged). Small sample — this measures history, not skill. [→ My Money]`, goto: 'portfolio' };
      }
    },
    {
      id: 'trade-frequency',
      rx: /how (often|frequently|much) do i trade|trade frequency|churn(ing)?|overtrad\w*|how many trades/i,
      answer(){
        const all = Ledger.load().filter(e => e.type === 'buy' || e.type === 'sell');
        if (!all.length) return { text: 'No trade ledger imported yet, Sir — nothing to measure. [→ My Money]', goto: 'portfolio' };
        const cutoff90 = U.todayKey(new Date(Date.now() - 90 * 86400000));
        const last90 = all.filter(e => String(e.date) >= cutoff90);
        const week = SundayReview.weekTrades();
        const nw = Portfolio.netWorth();
        const turnover = last90.reduce((s, e) => s + Math.abs(e.quantity * e.price), 0);
        const turnoverTxt = nw > 0 ? ` Turnover: ${Math.round(100 * turnover / nw)}% of current book value.` : '';
        return { text: `Last 90 days: <b>${last90.length} trade${last90.length === 1 ? '' : 's'}</b> (${week.length} this week; ${all.length} all-time on file).${turnoverTxt} [→ My Money]`, goto: 'portfolio' };
      }
    },
    {
      id: 'rules-check',
      rx: /follow(ed)? (my )?(own )?rules|rule[- ]?(break|breaks|following|check)|disciplin/i,
      answer(){
        const r = SundayReview.reconciliation();
        if (!r.total) return { text: 'No trades this week, Sir — nothing to reconcile. The cleanest kind of discipline.' };
        if (!r.flagged.length) return { text: `✓ All ${r.total} trade${r.total === 1 ? '' : 's'} this week had a journal entry within ${SundayReview.RECONCILE_WINDOW_DAYS} days beforehand. No rule breaks.` };
        return { text: `${r.withThesis}/${r.total} trades this week had a prior journal entry. ⚠ No thesis found for: ${r.flagged.map(t => U.esc(t.symbol)).join(', ')}. Presence-only check — I verify an entry existed nearby, not that it matches the trade. [→ Sunday Review]` };
      }
    },
    {
      id: 'calibration',
      rx: /calibrat(ed|ion)?|brier|how accurate .*(predictions?|forecasts?)/i,
      answer(){
        const b = Mirror.brierScore();
        if (!b.ready) return { text: `${b.n} resolved prediction${b.n === 1 ? '' : 's'} so far — I need ${Mirror.BRIER_MIN_N} before a Brier score means anything. Keep resolving. [→ Ideas Lab]`, goto: 'ideas' };
        const read = b.score < 0.20 ? 'meaningfully better than a coin-flipper' : b.score <= 0.30 ? 'roughly at the "always 50/50" baseline' : 'worse than always saying 50/50 — overconfidence is the usual culprit';
        return { text: `Brier score: <b>${b.score}</b> over ${b.n} resolved predictions — ${read} (0.25 is the baseline to beat, lower is better). [→ Ideas Lab]`, goto: 'ideas' };
      }
    },
    {
      id: 'predictions-due-soon',
      rx: /(predictions?|forecasts?).*(coming )?due\b|due (soon|this week)|overdue (predictions?|forecasts?)/i,
      answer(){
        const today = U.todayKey();
        const horizon = U.todayKey(new Date(Date.now() + 7 * 86400000));
        const open = Mirror.loadPredictions().filter(p => !p.resolved);
        const overdue = open.filter(p => String(p.resolveBy) < today);
        const soon = open.filter(p => String(p.resolveBy) >= today && String(p.resolveBy) <= horizon);
        if (!overdue.length && !soon.length) return { text: `Nothing due in the next 7 days${open.length ? ` — ${open.length} open prediction${open.length === 1 ? '' : 's'}, all further out` : ''}. [→ Ideas Lab]`, goto: 'ideas' };
        const parts = [];
        if (overdue.length) parts.push(`<b>${overdue.length} OVERDUE</b> (oldest: "${U.esc(overdue[0].title.slice(0, 60))}") — resolve in the Sunday Review or Ideas Lab`);
        if (soon.length) parts.push(`${soon.length} due within 7 days`);
        return { text: parts.join('; ') + '. [→ Ideas Lab]', goto: 'ideas' };
      }
    },
    {
      id: 'predictions-open',
      rx: /predictions? (open|active)|what.*predict/i,
      answer(){
        const open = Mirror.loadPredictions().filter(p => !p.resolved);
        if (!open.length) return { text: 'No open predictions logged yet — add one in the Ideas Lab.' };
        const soonest = [...open].sort((a, b) => String(a.resolveBy).localeCompare(String(b.resolveBy)))[0];
        return { text: `${open.length} open prediction${open.length === 1 ? '' : 's'}. Nearest: "${U.esc(soonest.title)}" — ${soonest.probability}% probability, due ${U.esc(soonest.resolveBy)}. [→ Ideas Lab]`, goto: 'ideas' };
      }
    },
    {
      id: 'briefing',
      // Deliberately does NOT match plain "brief me" — that stays with
      // jarvis.js's personality-table sitrep. This is the composed,
      // grounded version: five existing intents stitched in a fixed
      // order, each already carrying its own honest empty-state, so
      // composition adds zero new fabrication risk.
      rx: /\b(morning|daily|full|proper) briefing\b|\bbrief me (properly|fully|in full)\b/i,
      answer(q){
        // Deeper composed reasoning: 'contested-exposure' is included so
        // the briefing doesn't just concatenate independent single-topic
        // answers — it also surfaces whether the user's OWN money sits
        // in today's cross-current disagreement, a connection none of
        // the other four lines make on their own.
        const ids = ['whats-hot', 'contested-exposure', 'worry', 'predictions-due-soon', 'rules-check'];
        const lines = ids.map(id => Brain.intentById(id).answer(q).text);
        return { text: 'Morning briefing, Sir:\n▸ ' + lines.join('\n▸ '), goto: 'command' };
      }
    },
    {
      id: 'whats-hot',
      rx: /what.?s hot|\bhot\b.*(sector|stock|right now)|momentum right now/i,
      answer(){
        const top = [...Engine.clusters].sort((a, b) => b.score - a.score)[0];
        if (!top) return { text: 'Nothing hot on the board yet, Sir — feed me signals first.' };
        return { text: `<b>${U.esc(top.label)}</b> — momentum ${top.score}/100, ${top.items.length} signals across ${top.sources} sources. [→ Patterns]`, goto: 'patterns' };
      }
    },
    {
      // Brain v3.3: deeper composed reasoning (autonomy axis — more
      // noticing, same restraint: pure information, cite-or-silent,
      // still only fires when asked, no execution, no extra nudges).
      // Connects TWO real things nothing else currently connects:
      // Cross-Currents (Article 5 — genuine bull/bear disagreement,
      // never averaged away) and the user's ACTUAL holdings. The
      // existing 'whats-contested' below answers a global "what's
      // split" question; 'worst-case-sector' answers a holdings-aware
      // question but only for one-sided BEARISH clusters. Neither
      // answers "is any of MY money sitting in a sector where the
      // market genuinely can't agree" — placed BEFORE 'whats-contested'
      // since it's the more specific case (a "my holdings" query should
      // never fall through to the global-only answer).
      id: 'contested-exposure',
      rx: /(contested|disagreement|conflicting|split (signals|opinion)).{0,30}\b(my|held|holding)\b|\b(my|held|holding)\b.{0,30}(contested|disagreement|conflicting|split (signals|opinion))/i,
      answer(){
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your book is empty, Sir — no holdings to cross-reference against contested sectors yet.' };
        const contested = Engine.clusters.filter(c => c.bull > 0 && c.bear > 0);
        if (!contested.length) return { text: 'No genuinely contested sectors right now, Sir — coverage is one-sided across the board, so none of your holdings face live disagreement.' };
        const held = contested.map(c => ({ c, exposure: Brain.holdingsInSector(c.sector).reduce((s, h) => s + Portfolio.value(h), 0) }))
          .filter(x => x.exposure > 0)
          .sort((a, b) => b.exposure - a.exposure);
        if (!held.length) return { text: `${contested.length} sector${contested.length === 1 ? '' : 's'} genuinely contested right now (${contested.map(c => U.esc(c.label)).join(', ')}) — but none of your holdings sit there. [→ Patterns]`, goto: 'patterns' };
        const top = held[0];
        return { text: `<b>${U.esc(top.c.label)}</b>: ${U.fmtCompact(top.exposure)} of your book (${(100 * top.exposure / nw).toFixed(0)}%) sits in a sector with genuine disagreement — ${top.c.bull} bullish vs ${top.c.bear} bearish signals active at once, neither side has won yet. [→ Patterns, Cross-Currents]`, goto: 'patterns' };
      }
    },
    {
      id: 'whats-contested',
      rx: /contested|disagreement|split (signals|opinion)|both bullish and bearish/i,
      answer(){
        const contested = Engine.clusters.filter(c => c.bull > 0 && c.bear > 0)
          .sort((a, b) => Math.min(b.bull, b.bear) - Math.min(a.bull, a.bear))[0];
        if (!contested) return { text: 'No genuinely contested sectors right now — coverage is one-sided across the board.' };
        return { text: `<b>${U.esc(contested.label)}</b> is contested: ${contested.bull} bullish vs ${contested.bear} bearish signals active at once. [→ Patterns, Cross-Currents]`, goto: 'patterns' };
      }
    },
    {
      id: 'worry',
      rx: /worr(y|ied)|what.*(caution|threat)/i,
      answer(){
        const caution = Engine.ideas.find(i => i.kind === 'caution');
        if (!caution) return { text: 'Nothing on the threat board right now, Sir.' };
        return { text: `CAUTION: <b>${U.esc(caution.label)}</b>. Conviction ${caution.conviction}. ${U.esc(caution.thesis.slice(0, 140))} [→ Command Center, Threat Board]`, goto: 'command' };
      }
    },
    {
      id: 'bullish-capital',
      rx: /how much.*(bullish|long ideas)|% .*(bullish|long ideas)|bullish calls/i,
      answer(){
        const nw = Portfolio.netWorth();
        if (!nw) return { text: 'Your ledger is empty, Sir — nothing to measure yet. Add holdings in My Money.' };
        const longSectors = new Set(Engine.ideas.filter(i => i.kind === 'long').map(i => i.sector));
        let matched = 0;
        Portfolio.state.holdings.forEach(h => {
          for (const s of longSectors){
            if (Brain.holdingsInSector(s).includes(h)){ matched += Portfolio.value(h); break; }
          }
        });
        const pct = Math.round(100 * matched / nw);
        return { text: `${pct}% of your portfolio (${U.fmtCompact(matched)} of ${U.fmtCompact(nw)}) sits in sectors with an active long idea right now. [→ My Money]`, goto: 'portfolio' };
      }
    }
  ],

  /** @param {string} qNorm normalized query */
  _match(qNorm){
    for (const intent of this.INTENTS){
      if (intent.rx.test(qNorm)) return intent;
    }
    return null;
  },

  /** @param {string} id @returns {any|null} */
  intentById(id){ return this.INTENTS.find(i => i.id === id) || null; },

  /** Exact-routing resolver shared by matchIntentId/ask: taught routings
   *  win over the regex grammar (an explicit user correction outranks the
   *  built-in rules). @param {string} qNorm @returns {any|null} */
  _resolve(qNorm){ return this._taughtIntent(qNorm) || this._match(qNorm); },

  /** Which intent (by id) would answer this query, or null — the
   *  testable seam the golden utterance corpus measures recall against.
   *  @param {string} query */
  matchIntentId(query){
    const intent = this._resolve(this.normalize(String(query)));
    return intent ? intent.id : null;
  },

  /** @param {string} query @returns {{text:string, goto?:string}|undefined} undefined = no intent recognised this query at all */
  ask(query){
    const qNorm = this.normalize(String(query));
    const intent = this._resolve(qNorm);
    return intent ? intent.answer(qNorm) : undefined;
  }
};
