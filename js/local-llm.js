// @ts-check
/* ============================================================
   J.A.R.V.I.S — local model assist (ORD-1511 seam, OPT-IN)

   Talks to a model running on THIS machine via Ollama. Nothing leaves
   the box, so Constitution Art. 7 is untouched — which is precisely why
   this is permitted where a hosted API is not. Art. 12 still governs:
   this ships OFF, and only the human turns it on.

   v2 — FULL CONVERSATIONAL BRAIN

   The original v1 could only ROUTE and ASK. v2 adds:
     · chat()    — multi-turn conversation via /api/chat, with system
                   prompt + sliding history window. The model CAN now
                   compose answers, grounded in context assembled by
                   LLMContext (js/llm-context.js).
     · stream()  — same as chat() but yields tokens incrementally via
                   a callback, so the chat dock can typewriter them in
                   real time instead of waiting for the full response.

   The v1 methods (route, critique) are UNCHANGED and still follow the
   old fenced rules: route may only return an existing intent id,
   critique may only return questions. The new chat/stream methods are
   a different, broader capability — but still local-only, still opt-in.

   THE SAFETY BOUNDARY SHIFTS: v1 structurally prevented the model from
   answering. v2 lets it answer, but the answers are grounded in real
   app state injected via the system prompt (portfolio, signals, clusters,
   market tape). The model can still hallucinate — the honest response is
   to tell the user this is an AI-generated interpretation, not a
   cite-or-silent deterministic answer. That distinction is surfaced in
   the UI via the 🤖 badge on LLM responses.
   ============================================================ */

const LocalLLM = {
  /** Reached through the relay's /llm passthrough, NOT Ollama directly:
   *  Ollama's CORS rejects this page's origin, and the usual workaround
   *  (OLLAMA_ORIGINS=*) would hand every website you visit access to your
   *  local model. The relay keeps that door shut and exposes only
   *  /api/generate, /api/chat and /api/tags. Requires `node relay.js`,
   *  same as the live market tape. */
  BASE: 'http://localhost:5510/llm',

  /** Preference order, best-for-this-job first. NOT a hardcoded single
   *  name: shipping one exact string is how the first cut of this file
   *  silently never activated — it asked for `qwen2.5:14b` while the
   *  machine had `qwen2.5-coder:14b`, and the exact-match probe just
   *  returned false forever with no visible error.
   *
   *  Why instruct outranks coder here: both routing and thesis critique
   *  are natural-language reasoning, not code generation. A -coder model
   *  is tuned for the latter and is measurably blunter at the former, so
   *  it is a usable fallback rather than the first choice. 14B outranks
   *  7B because the human asked for "slower but better".
   *
   *  `MODEL` is resolved at probe() time from what is actually installed,
   *  and a user override (Settings) wins over the whole list. */
  MODEL_PREFERENCE: ['qwen2.5:14b', 'qwen2.5-coder:14b', 'qwen2.5:7b', 'qwen2.5-coder:7b'],
  /** @type {string|null} resolved from the live model list on first probe */
  MODEL: null,
  /** @type {string|null} explicit user choice; beats MODEL_PREFERENCE */
  modelOverride: null,
  TIMEOUT_MS: 12000,
  /** Timeout for chat/stream — longer because the model may produce
   *  multi-paragraph responses, not single-token classifications. */
  CHAT_TIMEOUT_MS: 120000,
  /** Hold the model in RAM between calls. Without this Ollama evicts it
   *  after ~5min and the next query pays the 13s cold load. Costs ~9GB
   *  resident while enabled — the reason this is opt-in, not default. */
  KEEP_ALIVE: '30m',

  /* ---- tuning parameters (conservative defaults) ---- */
  TEMPERATURE: 0.7,
  TOP_P: 0.9,
  NUM_PREDICT: 1024,
  /** Max turns (user+assistant pairs) to keep in the sliding window.
   *  Session-only — cleared on page reload. */
  MAX_HISTORY_TURNS: 10,

  /** @type {boolean} set from App.settings.localLlm — OFF unless the human says otherwise */
  enabled: false,
  /** @type {boolean|null} null = not yet probed */
  available: null,

  /* ---- session conversation history (not persisted) ---- */
  /** @type {Array<{role: 'user'|'assistant', content: string}>} */
  _history: [],

  /** Clear conversation history — called on page load, or when user
   *  explicitly wants a fresh context. */
  clearHistory(){ this._history = []; },

  /** Add a message to the sliding window. Trims oldest pairs when over
   *  MAX_HISTORY_TURNS (each pair = 1 user + 1 assistant message).
   *  @param {'user'|'assistant'} role @param {string} content */
  _pushHistory(role, content){
    this._history.push({ role, content });
    // Trim to MAX_HISTORY_TURNS pairs (2 messages per pair)
    const maxMessages = this.MAX_HISTORY_TURNS * 2;
    if (this._history.length > maxMessages){
      this._history = this._history.slice(-maxMessages);
    }
  },

  /* ---- low-level transport ---- */

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

  /** Streaming call — yields chunks via callback. Returns the full
   *  assembled response text when done, or null on error.
   *  @param {string} path @param {any} body @param {(chunk: string) => void} onChunk @param {number} [ms]
   *  @returns {Promise<string|null>} */
  async _stream(path, body, onChunk, ms){
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || this.CHAT_TIMEOUT_MS);
    try {
      const res = await fetch(this.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          body: { model: this.MODEL, stream: true, keep_alive: this.KEEP_ALIVE, ...body }
        }),
        signal: ctl.signal
      });
      if (!res.ok) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const decoder = new TextDecoder();
      let full = '';
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // Ollama streams newline-delimited JSON objects
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines){
          try {
            const obj = JSON.parse(line);
            const token = obj.message?.content || obj.response || '';
            if (token){
              full += token;
              onChunk(token);
            }
          } catch(e){ /* partial JSON line — skip */ }
        }
      }
      return full || null;
    } catch(e){ return null; }
    finally { clearTimeout(t); }
  },

  /* ---- probe ---- */

  /** @type {string[]} model names seen on the last probe — surfaced in
   *  Settings so an unusable state can be diagnosed by looking, rather
   *  than by guessing why nothing happens. */
  installed: [],

  /** Is the relay up, Ollama running, and a usable model present? Also
   *  RESOLVES which model to use, rather than demanding one exact name.
   *  Cached per session (re-armed by setting `available = null` when the
   *  user toggles the setting, since Ollama may have started since boot).
   *  @returns {Promise<boolean>} */
  async probe(){
    if (this.available !== null) return this.available;
    const j = await this._call('/api/tags', {}, 2500);
    const names = (j && Array.isArray(j.models)) ? j.models.map(m => m.name).filter(Boolean) : [];
    this.installed = names;
    this.MODEL = this.pickModel(names);
    this.available = !!this.MODEL;
    return this.available;
  },

  /** Choose a model from what is actually installed. An explicit user
   *  override wins if present; otherwise take the first preference that
   *  exists; otherwise fall back to ANY qwen2.5 build (so a tag we did
   *  not anticipate — a q8, a :32b — still works instead of disabling
   *  the feature over an unrecognised suffix). Returns null when nothing
   *  suitable is installed, which is an honest "off", not a silent one.
   *  @param {string[]} names @returns {string|null} */
  pickModel(names){
    if (!names.length) return null;
    if (this.modelOverride && names.includes(this.modelOverride)) return this.modelOverride;
    const preferred = this.MODEL_PREFERENCE.find(m => names.includes(m));
    if (preferred) return preferred;
    return names.find(n => /^qwen2\.5/i.test(n)) || null;
  },

  /* ---- v1 methods (unchanged, fenced) ---- */

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
  },

  /* ---- v2 methods: full conversational brain ---- */

  /** Multi-turn chat with the local model. Sends the system prompt +
   *  conversation history + the new user message. Returns the assistant's
   *  full response, or null on failure.
   *
   *  @param {string} userMessage the user's new message
   *  @param {string} [systemPrompt] system prompt with grounded context
   *  @param {{temperature?: number, num_predict?: number, top_p?: number}} [opts]
   *  @returns {Promise<string|null>} */
  async chat(userMessage, systemPrompt, opts = {}){
    if (!this.enabled || !(await this.probe())) return null;
    const messages = this._buildMessages(userMessage, systemPrompt);
    const j = await this._call('/api/chat', {
      messages,
      options: {
        temperature: opts.temperature ?? this.TEMPERATURE,
        num_predict: opts.num_predict ?? this.NUM_PREDICT,
        top_p: opts.top_p ?? this.TOP_P
      }
    }, this.CHAT_TIMEOUT_MS);
    if (!j || !j.message || typeof j.message.content !== 'string') return null;
    const response = j.message.content.trim();
    if (!response) return null;
    // Record the exchange in history
    this._pushHistory('user', userMessage);
    this._pushHistory('assistant', response);
    return response;
  },

  /** Streaming multi-turn chat — tokens arrive via `onChunk` for
   *  real-time display. Returns the full assembled response, or null.
   *
   *  @param {string} userMessage
   *  @param {string} [systemPrompt]
   *  @param {(chunk: string) => void} onChunk called with each token as it arrives
   *  @param {{temperature?: number, num_predict?: number, top_p?: number}} [opts]
   *  @returns {Promise<string|null>} */
  async stream(userMessage, systemPrompt, onChunk, opts = {}){
    if (!this.enabled || !(await this.probe())) return null;
    if (typeof onChunk !== 'function') return this.chat(userMessage, systemPrompt, opts);
    const messages = this._buildMessages(userMessage, systemPrompt);
    const full = await this._stream('/api/chat', {
      messages,
      options: {
        temperature: opts.temperature ?? this.TEMPERATURE,
        num_predict: opts.num_predict ?? this.NUM_PREDICT,
        top_p: opts.top_p ?? this.TOP_P
      }
    }, onChunk, this.CHAT_TIMEOUT_MS);
    if (full){
      this._pushHistory('user', userMessage);
      this._pushHistory('assistant', full);
    }
    return full;
  },

  /** Assemble the messages array for /api/chat: system prompt (if any)
   *  + conversation history + the new user message.
   *  @param {string} userMessage @param {string} [systemPrompt]
   *  @returns {Array<{role: string, content: string}>} */
  _buildMessages(userMessage, systemPrompt){
    /** @type {Array<{role: string, content: string}>} */
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    // Inject conversation history for multi-turn coherence
    for (const msg of this._history){
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: String(userMessage).slice(0, 4000) });
    return messages;
  }
};
