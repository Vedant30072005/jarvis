// @ts-check
/* ============================================================
   J.A.R.V.I.S — assistant core
   Intent parsing, drafted responses, voice I/O, personality.
   ============================================================ */

const Jarvis = {
  voiceOn: false,
  _voice: null,
  _speakQueue: [],
  busy: false,

  /* ---------------- chat persistence (ORD-103) ---------------- */
  HISTORY_KEY: 'jarvis.chat.v1',
  HISTORY_VERSION: 1,
  HISTORY_MIGRATIONS: { 0: (data) => data }, // v0 (unversioned array) -> v1: shape unchanged, just wrapped
  HISTORY_MAX: 80,

  persist(role, html){
    let hist = Schema.load(this.HISTORY_KEY, this.HISTORY_VERSION, [], this.HISTORY_MIGRATIONS);
    hist.push({ role, html, t: Date.now() });
    if (hist.length > this.HISTORY_MAX) hist = hist.slice(-this.HISTORY_MAX);
    Schema.save(this.HISTORY_KEY, this.HISTORY_VERSION, hist);
  },

  restoreHistory(){
    const hist = Schema.load(this.HISTORY_KEY, this.HISTORY_VERSION, [], this.HISTORY_MIGRATIONS);
    if (!hist.length) return;
    const log = this.el();
    for (const entry of hist){
      const m = document.createElement('div');
      m.className = 'msg ' + (entry.role === 'user' ? 'user' : 'jarvis');
      m.innerHTML = `<span class="who">${entry.role === 'user' ? 'YOU' : 'J.A.R.V.I.S'}</span><div class="msg-bubble">${entry.html}</div>`;
      log.appendChild(m);
    }
    log.scrollTop = log.scrollHeight;
  },

  clearHistory(){
    localStorage.removeItem(this.HISTORY_KEY);
    const log = this.el();
    if (log) log.innerHTML = '';
  },

  /* ---------------- chat rendering ---------------- */
  el(){ return document.getElementById('chatLog'); },

  user(text){
    const log = this.el();
    const m = document.createElement('div');
    m.className = 'msg user';
    const safe = U.esc(text);
    m.innerHTML = `<span class="who">YOU</span><div class="msg-bubble">${safe}</div>`;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    this.persist('user', safe);
  },

  async say(html, { speak = true, instant = false } = {}){
    const log = this.el();
    const m = document.createElement('div');
    m.className = 'msg jarvis';
    m.innerHTML = `<span class="who">J.A.R.V.I.S</span><div class="msg-bubble"></div>`;
    log.appendChild(m);
    const bubble = m.querySelector('.msg-bubble');
    const orb = document.getElementById('jarvisOrb');
    const wave = document.getElementById('jarvisWave');
    orb?.classList.add('speaking'); wave?.classList.add('on');
    if (speak && this.voiceOn) this.speak(html);
    const scroller = setInterval(() => { log.scrollTop = log.scrollHeight; }, 120);
    await FX.type(bubble, html, instant ? 0 : 11);
    clearInterval(scroller);
    log.scrollTop = log.scrollHeight;
    if (!speechSynthesis?.speaking){ orb?.classList.remove('speaking'); wave?.classList.remove('on'); }
    this.persist('jarvis', html);
  },

  /* ---------------- text-to-speech ---------------- */
  pickVoice(){
    const vs = speechSynthesis.getVoices();
    this._voice =
      vs.find(v => /en-GB/i.test(v.lang) && /male|daniel|george|ryan|arthur/i.test(v.name)) ||
      vs.find(v => /en-GB/i.test(v.lang)) ||
      vs.find(v => /en/i.test(v.lang)) || null;
  },

  speak(html){
    if (!('speechSynthesis' in window)) return;
    const text = html.replace(/<[^>]+>/g, '').replace(/[▸●₹]/g, ' rupees ').replace(/\s+/g, ' ').slice(0, 420);
    const u = new SpeechSynthesisUtterance(text);
    if (!this._voice) this.pickVoice();
    if (this._voice) u.voice = this._voice;
    u.rate = 1.03; u.pitch = 0.85;
    u.onend = () => {
      document.getElementById('jarvisOrb')?.classList.remove('speaking');
      document.getElementById('jarvisWave')?.classList.remove('on');
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  /* ---------------- speech recognition ---------------- */
  listen(onText, onState){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR){ onState?.('unsupported'); return null; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = e => {
      const t = [...e.results].map(r => r[0].transcript).join('');
      onText(t, e.results[e.results.length-1].isFinal);
    };
    rec.onstart = () => onState?.('listening');
    rec.onend = () => onState?.('idle');
    rec.onerror = () => onState?.('idle');
    rec.start();
    return rec;
  },

  /* ---------------- helpers ---------------- */
  hour(){ return new Date().getHours(); },
  salutation(){
    const h = this.hour();
    return h < 5 ? 'Burning the midnight oil, Sir' : h < 12 ? 'Good morning, Sir' : h < 17 ? 'Good afternoon, Sir' : 'Good evening, Sir';
  },

  brief(){
    const st = Engine.stats();
    const c = Engine.clusters[0];
    const f = Engine.flows[0];
    const idea = Engine.ideas.find(i => i.kind === 'long');
    let out = `${this.salutation()}. Situation report:\n`;
    out += `▸ <b>${st.signals} signals</b> scanned · ${st.patterns} patterns live · bias <span class="${st.bullPct >= 55 ? 'hl-green' : st.bullPct <= 45 ? 'hl-red' : ''}">${st.bullPct}% bullish</span>.\n`;
    if (c) out += `▸ Strongest pattern: <b>${U.esc(c.label)}</b> — ${c.items.length} signals from ${c.sources} sources.\n`;
    if (f) out += `▸ Largest flow: <span class="hl-gold">${U.fmtCr(f.amountCr)}</span> → ${U.esc(JDATA.SECTORS[f.to]?.label || f.to)} (${JDATA.FLOW_SOURCES[f.from].label}).\n`;
    if (idea) out += `▸ Top thesis: <b>${U.esc(idea.label)}</b> at ${idea.conviction}% conviction, ${idea.horizon} horizon.\n`;
    const nw = Portfolio.netWorth();
    if (nw > 0){
      const pl = Portfolio.totalPL();
      out += `▸ Your book: <b>${U.fmtCompact(nw)}</b>, ${pl >= 0 ? '<span class="hl-green">+' : '<span class="hl-red">'}${U.fmtCompact(Math.abs(pl)).slice(1)}</span> unrealised.\n`;
    }
    out += `Shall I open the flows map or the ideas lab?`;
    return out;
  },

  /* ---------------- intent table ---------------- */
  INTENTS: [
    { rx: /^(hi|hello|hey|yo|namaste|good (morning|afternoon|evening))\b/i,
      fn(){ return `${this.salutation()}. All economic protocols are green. Ask for a <b>brief</b>, the <b>money flow</b>, <b>patterns</b>, <b>ideas</b>, or your <b>portfolio</b>.`; } },

    { rx: /brief|briefing|sitrep|situation|update me|what.?s (happening|up|new)|morning report/i,
      fn(){ return this.brief(); } },

    { rx: /where.*(money|capital)|big money|money ?flow|follow the money|flows/i,
      fn(){
        const rows = Engine.flowBySector().slice(0, 4);
        if (!rows.length) return 'No disclosed flows on the board yet, Sir. Try fetching the live feed.';
        let out = `Tracked capital: <span class="hl-gold">${U.fmtCr(Engine.totalTracked())}</span>. The gravity wells:\n`;
        rows.forEach((r, i) => out += `▸ <b>${U.esc(r.label)}</b> — ${U.fmtCr(r.total)} across ${r.count} disclosure${r.count>1?'s':''}\n`);
        out += `Opening the full map is one click away — Money Flow, left rail.`;
        App.gotoView('flows', { silent: true });
        return out;
      } },

    { rx: /pattern|connect (the )?dots|theme|clusters?|trend/i,
      fn(){
        if (!Engine.clusters.length) return 'The pattern board is empty. Feed me signals first, Sir.';
        let out = `${Engine.clusters.length} patterns on the board. The loudest:\n`;
        Engine.clusters.slice(0, 3).forEach(c =>
          out += `▸ <b>${U.esc(c.name)}</b> — momentum ${c.score}/100, ${c.items.length} signals, ${c.bull} bullish / ${c.bear} bearish\n`);
        out += 'The full constellation is in the Patterns bay.';
        App.gotoView('patterns', { silent: true });
        return out;
      } },

    { rx: /idea|invest in|what (should|do) i buy|opportunit|recommend|thesis|theses/i,
      fn(){
        const ideas = Engine.ideas.slice(0, 3);
        if (!ideas.length) return 'No theses drafted yet, Sir.';
        let out = 'Drafted theses, ranked by conviction:\n';
        ideas.forEach(i => out += `▸ <b>${U.esc(i.label)}</b> — ${i.conviction}% conviction · ${i.horizon}\n`);
        out += `Names to research: ${U.esc(ideas[0].watch.slice(0,3).join(', '))}.\nFor the record: these are research drafts, not orders. Verify valuations before deploying capital.`;
        App.gotoView('ideas', { silent: true });
        return out;
      } },

    { rx: /fetch live|go live|refresh (the )?(feed|news)|live (feed|news|uplink)|scan (the )?(news|wires)/i,
      fn(){ App.fetchLive(); return 'Engaging live uplink. Pulling the wires now — I will report when the ingest completes.'; } },

    { rx: /news|intel|headlines|signals/i,
      fn(){
        const top = [...Engine.items].sort((a,b) => b.impact - a.impact).slice(0, 4);
        let out = 'Highest-impact intel on the board:\n';
        top.forEach(i => out += `▸ [${i.impact}] <b>${U.esc(i.t.slice(0, 90))}</b> — ${U.esc(i.s)}\n`);
        App.gotoView('intel', { silent: true });
        return out;
      } },

    { rx: /add (\d+(?:\.\d+)?) (?:shares? |units? )?(?:of )?(.+?) (?:at|@) ?₹?([\d,]+(?:\.\d+)?)/i,
      fn(m){
        const qty = parseFloat(m[1]), name = m[2].trim(), price = parseFloat(m[3].replace(/,/g,''));
        Portfolio.add({ name: name.replace(/\b\w/g, c => c.toUpperCase()), type:'Equity', qty, buy: price, cur: price });
        App.renderPortfolio();
        return `Logged: <b>${qty} × ${U.esc(name)}</b> at ${U.fmtINR(price)}. The ledger stands at <span class="hl-gold">${U.fmtCompact(Portfolio.netWorth())}</span>.`;
      } },

    { rx: /portfolio|net ?worth|holdings|my (money|book|wealth)|balance/i,
      fn(){
        const nw = Portfolio.netWorth();
        if (!nw) { App.gotoView('portfolio', { silent: true }); return 'The ledger is empty, Sir. Say something like <b>"add 10 HDFC Bank at 1700"</b>, or load the demo book in My Money.'; }
        const pl = Portfolio.totalPL(); const cost = Portfolio.totalCost();
        const plPct = cost ? (100*pl/cost).toFixed(1) : '0';
        const alloc = Portfolio.allocation();
        let out = `Net worth under management: <b>${U.fmtCompact(nw)}</b> · unrealised ${pl >= 0 ? `<span class="hl-green">+${plPct}%</span>` : `<span class="hl-red">${plPct}%</span>`}.\n`;
        out += `Allocation: ${alloc.map(a => `${U.esc(a.label)} ${(100*a.value/nw).toFixed(0)}%`).join(' · ')}.\n`;
        const ins = Portfolio.insights();
        if (ins.length) out += `▸ ${U.esc(ins[0])}`;
        App.gotoView('portfolio', { silent: true });
        return out;
      } },

    { rx: /sip.*?([\d,]{3,})(?:.*?(\d{1,2})\s*(?:years|yrs|y))?(?:.*?(\d{1,2}(?:\.\d+)?)\s*%)?/i,
      fn(m){
        const amt = parseFloat(m[1].replace(/,/g,'')), yrs = parseInt(m[2] || 10), rate = parseFloat(m[3] || 12);
        const { fv, invested, gain } = Portfolio.sipFV(amt, yrs, rate);
        return `SIP simulation — ${U.fmtINR(amt)}/month for ${yrs} years at ${rate}%:\n▸ Invested: ${U.fmtCompact(invested)}\n▸ Projected value: <span class="hl-gold">${U.fmtCompact(fv)}</span>\n▸ Compounding does <span class="hl-green">${U.fmtCompact(gain)}</span> of the lifting.\nAssumed return is illustrative, Sir — markets don't sign contracts.`;
      } },

    { rx: /lumpsum ([\d,]+).*?(\d{1,2})\s*(?:years|yrs|y)(?:.*?(\d{1,2}(?:\.\d+)?)\s*%)?/i,
      fn(m){
        const p = parseFloat(m[1].replace(/,/g,'')), yrs = parseInt(m[2]), rate = parseFloat(m[3] || 12);
        const fv = p * Math.pow(1 + rate/100, yrs);
        return `${U.fmtINR(p)} compounding at ${rate}% for ${yrs} years becomes <span class="hl-gold">${U.fmtCompact(fv)}</span> — a ${(fv/p).toFixed(1)}× multiple.`;
      } },

    // Glossary lookup. The old regex was /what is|define|explain|meaning of/
    // — which swallowed ANY sentence opening with "what is", including
    // "what is the reason behind today's Nifty going up 1%", and answered
    // it with "that term isn't in my glossary". A definition request has a
    // recognisable shape: the trigger is followed by a SHORT bare term at
    // the end of the query, not a clause. Anchoring on that shape keeps
    // "what is FII" here and lets real questions fall through to the brain.
    { rx: /\b(?:what(?:'s| is| are)|define|explain|meaning of)\s+(?:an?\s+|the\s+)?[a-z][a-z&/ ]{1,22}\s*\??$|\bwhat does\s+[a-z][a-z&/ ]{1,22}\s+mean\b/i,
      fn(m, text){
        const key = Object.keys(JDATA.GLOSSARY).find(k => text.toLowerCase().includes(k));
        if (key) return `<b>${key.toUpperCase()}</b> — ${U.esc(JDATA.GLOSSARY[key])}`;
        return `That term isn't in my economics glossary yet, Sir. I currently teach: ${Object.keys(JDATA.GLOSSARY).map(k => k.toUpperCase()).join(', ')}.`;
      } },

    { rx: /joke|make me laugh|funny/i,
      fn(){ return U.pick([
        'I told the portfolio a joke about diversification. It didn\'t laugh — it was too concentrated.',
        'Why did the momentum trader cross the road? Everyone else was doing it.',
        'Inflation is like toothpaste, Sir. Easy to squeeze out, remarkably difficult to put back.',
        'A market analyst is someone who can explain tomorrow why yesterday\'s prediction failed today.'
      ]); } },

    { rx: /party protocol|celebrate|we did it/i,
      fn(){ FX.confetti(120); return 'Party protocol engaged, Sir. Do try to celebrate responsibly — compounding resumes at market open.'; } },

    { rx: /i am iron man/i,
      fn(){ return 'Noted for the record, Sir. Though may I suggest we build the fortune before the suit — titanium alloy is not cheap.'; } },

    { rx: /who are you|your name|about you/i,
      fn(){ return 'J.A.R.V.I.S — Just A Rather Very Intelligent System, economics build. I scan the wires, connect patterns across sources, trace where big capital moves, draft research theses, and keep your ledger. Consider me the quiet partner who never sleeps and never panics.'; } },

    { rx: /open (command|intel|pattern|flow|idea|portfolio|money)/i,
      fn(m){
        const map = { command:'command', intel:'intel', pattern:'patterns', flow:'flows', idea:'ideas', portfolio:'portfolio', money:'portfolio' };
        const v = map[m[1].toLowerCase()];
        App.gotoView(v);
        return `Opening ${v}, Sir.`;
      } },

    { rx: /thank/i, fn(){ return 'Always, Sir.'; } },

    { rx: /help|commands|what can you do/i,
      fn(){ return `At your service. Try:\n▸ <b>brief me</b> — full situation report\n▸ <b>where is the money going</b> — flow map\n▸ <b>show patterns</b> / <b>top ideas</b>\n▸ <b>scan live news</b> — real headlines via uplink\n▸ <b>add 10 HDFC Bank at 1700</b> — ledger entry\n▸ <b>sip 15000 for 15 years at 12%</b> — projections\n▸ <b>what is FII</b> — the glossary\n▸ <b>party protocol</b> — you've earned it`; } }
  ],

  async handle(text){
    const t = text.trim();
    if (!t) return;
    this.user(t);
    await new Promise(r => setTimeout(r, 260));
    // Brain v3.1: graded confidence. interpret() expresses HOW sure the
    // brain is — exact 'match', a dominant 'confident' guess, a close
    // 'ambiguous' set, or 'unknown'. The fenced brain gets first refusal
    // (its answers are always grounded), but only an EXACT match jumps
    // ahead of the personality-chat table; confident/ambiguous guesses
    // are checked AFTER it, so explicit commands ("brief me", "add 10
    // HDFC", "joke") always beat a fuzzy interpretation.
    const interp = Brain.interpret(t);
    if (interp.kind === 'match'){
      const out = interp.intent.answer(Brain.normalize(t));
      if (out.goto) App.gotoView(out.goto, { silent: true });
      await this.say(out.text);
      return;
    }
    for (const intent of this.INTENTS){
      const m = t.match(intent.rx);
      if (m){
        const out = intent.fn.call(this, m, t);
        if (out) await this.say(out);
        return;
      }
    }
    const teachChips = (ids) => ids.map(id =>
      `<button class="chip" data-teach-intent="${id}" data-teach-phrase="${U.esc(t)}">${U.esc(Brain.INTENT_META[id].example)}</button>`).join('');

    // Confident guess: answer it, but STATE the interpretation and offer
    // one-tap correction/confirmation (clicking any chip teaches that
    // phrasing permanently). An honest "here's my read, fix it if wrong",
    // never a silent guess passed off as certainty.
    if (interp.kind === 'confident'){
      const out = interp.intent.answer(Brain.normalize(t));
      if (out.goto) App.gotoView(out.goto, { silent: true });
      await this.say(`<span style="color:var(--txt-3);font-size:.72rem">Reading that as <b>"${U.esc(interp.interpretation)}"</b>:</span><br>${out.text}` +
        `<div style="margin-top:8px;color:var(--txt-3);font-size:.72rem">Right? Tap to lock it in, or pick another:</div><div class="chip-row" style="margin-top:4px">${teachChips(interp.guesses)}</div>`);
      return;
    }

    // Ambiguous or unknown: log the miss (feeds the Sunday review's
    // "queries I couldn't answer") and offer chips when there's at least
    // one plausible guess to teach.
    Brain.logMiss(t);
    if (interp.kind === 'ambiguous' && interp.guesses.length){
      await this.say(`I didn't quite parse that, Sir. Did you mean:<div class="chip-row" style="margin-top:8px">${teachChips(interp.guesses)}</div><span style="color:var(--txt-3);font-size:.72rem">Picking one teaches me — that phrasing will route there from now on.</span>`);
      return;
    }
    await this.say(`I didn't quite parse that, Sir. Perhaps try <b>"brief me"</b>, <b>"where is the money going"</b>, or <b>"help"</b> for the full command set.`);
  }
};

if ('speechSynthesis' in window){
  speechSynthesis.onvoiceschanged = () => Jarvis.pickVoice();
}
