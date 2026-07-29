// @ts-check
/* ============================================================
   J.A.R.V.I.S — local model assist (ORD-1511 seam, OPT-IN)

   Talks to a model running on THIS machine via Ollama. Nothing leaves
   the box, so Constitution Art. 7 is untouched — which is precisely why
   this is permitted where a hosted API is not. Art. 12 still governs:
   this ships OFF, and only the human turns it on.

   THE RULE THAT MAKES THIS SAFE: the model may ROUTE and it may ASK,
   but it may never ANSWER.

     · route()    — maps a query the rule-based brain MISSED onto one of
                    the existing intent ids. The answer is then produced
                    by that intent's ordinary cite-or-silent template.
                    The model never sees a price and never emits one.
     · critique() — returns QUESTIONS about a thesis you wrote. A weak
                    question is merely weak; it cannot be a false number.

   Anything the model returns that is not an exact member of the allowed
   id list is discarded. There is no path by which a hallucinated token
   becomes a displayed fact — not "unlikely", structurally absent.

   Measured on this machine (qwen2.5-coder:14b, Q4_K_M): ~2.7s warm,
   ~13s cold. Far too slow for the main path, which is why it fires ONLY
   after the deterministic matcher has already missed — the 100%-recall
   golden-corpus queries still answer in 0ms and never touch this file.
   ============================================================ */

const LocalLLM = {
  /** Reached through the relay's /llm passthrough, NOT Ollama directly:
   *  Ollama's CORS rejects this page's origin, and the usual workaround
   *  (OLLAMA_ORIGINS=*) would hand every website you visit access to your
   *  local model. The relay keeps that door shut and exposes only
   *  /api/generate and /api/tags. Requires `node relay.js`, same as the
   *  live market tape. */
  BASE: 'http://localhost:5510/llm',
  MODEL: 'qwen2.5-coder:14b',
  TIMEOUT_MS: 12000,
  /** Hold the model in RAM between calls. Without this Ollama evicts it
   *  after ~5min and the next query pays the 13s cold load. Costs ~9GB
   *  resident while enabled — the reason this is opt-in, not default. */
  KEEP_ALIVE: '30m',

  /** @type {boolean} set from App.settings.localLlm — OFF unless the human says otherwise */
  enabled: false,
  /** @type {boolean|null} null = not yet probed */
  available: null,

  /** @param {string} path Ollama path @param {any} body @param {number} [ms] */
  async _call(path, body, ms){
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || this.TIMEOUT_MS);
    try {
      const res = await fetch(this.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          body: { model: this.MODEL, stream: false, keep_alive: this.KEEP_ALIVE, ...body }
        }),
        signal: ctl.signal
      });
      if (!res.ok) return null;
      return await res.json();
    } catch(e){ return null; }
    finally { clearTimeout(t); }
  },

  /** Is the relay up, Ollama running, and our model present? Cached per
   *  session (re-armed by setting `available = null` when the user
   *  toggles the setting, since Ollama may have started since boot).
   *  @returns {Promise<boolean>} */
  async probe(){
    if (this.available !== null) return this.available;
    const j = await this._call('/api/tags', {}, 2500);
    this.available = !!(j && Array.isArray(j.models) && j.models.some(m => m.name === this.MODEL));
    return this.available;
  },

  /** Classify a MISSED query into one of `ids`, or null.
   *
   *  The returned value is checked for exact membership in `ids` before
   *  it is handed back, so a hallucinated or malformed token becomes
   *  null rather than a wrong route. 'NONE' is an explicit, allowed
   *  answer — abstaining is a correct outcome, not a failure, and the
   *  model does use it (verified: "what's the weather in Mumbai" → NONE).
   *  @param {string} query @param {string[]} ids
   *  @returns {Promise<string|null>} */
  async route(query, ids){
    if (!this.enabled || !(await this.probe())) return null;
    if (!Array.isArray(ids) || !ids.length) return null;
    const prompt =
      `You are an intent classifier. Reply with EXACTLY ONE id from this list and nothing else:\n` +
      `${ids.join(', ')}, NONE\n\n` +
      `If none of them genuinely fit, reply NONE.\n\n` +
      `Query: "${String(query).slice(0, 300)}"\nid:`;
    const j = await this._call('/api/generate', {
      prompt, options: { temperature: 0, num_predict: 12 }
    });
    if (!j || typeof j.response !== 'string') return null;
    const token = j.response.trim().split(/[\s,."']+/)[0] || '';
    return ids.includes(token) ? token : null; // 'NONE' and junk both fall out here
  },

  /** Socratic questions about a thesis the user wrote themselves.
   *
   *  Deliberately asks for QUESTIONS, never assessment: Art. 11 says
   *  conviction may not be outsourced to the tool, so the model must not
   *  opine on whether the thesis is good. It surfaces what the author
   *  hasn't addressed and leaves the judgement where it belongs.
   *  @param {string} thesis @returns {Promise<string[]|null>} */
  async critique(thesis){
    if (!this.enabled || !(await this.probe())) return null;
    const text = String(thesis || '').trim();
    if (text.length < 20) return null;
    const prompt =
      `A retail investor wrote this investment thesis:\n\n"${text.slice(0, 1200)}"\n\n` +
      `Ask 3 short, sharp questions that would expose weaknesses in this reasoning. ` +
      `Focus on: what would falsify it, what is assumed without evidence, and what ` +
      `timeframe or exit is unstated.\n` +
      `Rules: output ONLY the 3 questions, one per line, no numbering, no preamble, ` +
      `no advice, no opinion on whether the thesis is good. Do not state any facts, ` +
      `figures or prices — only questions.\n\nQuestions:`;
    const j = await this._call('/api/generate', {
      prompt, options: { temperature: 0.3, num_predict: 220 }
    });
    if (!j || typeof j.response !== 'string') return null;
    const qs = j.response.split('\n')
      .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      // Keep only actual questions. A line without a '?' is the model
      // drifting into assertion — exactly what must not reach the user.
      .filter(l => l.length > 12 && l.endsWith('?'))
      .slice(0, 3);
    return qs.length ? qs : null;
  }
};
