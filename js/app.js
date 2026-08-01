// @ts-check
/* ============================================================
   J.A.R.V.I.S — application orchestrator
   ============================================================ */

const App = {
  view: 'command',
  mode: 'sim',            // 'sim' | 'live'
  intelFilter: 'all',
  regionFilter: 'all',
  intelQuery: '',
  _stops: [],             // canvas animation loop stoppers

  SETTINGS_KEY: 'jarvis.settings.v1',
  SETTINGS_VERSION: 1,
  SETTINGS_MIGRATIONS: { 0: (data) => data }, // v0 (unversioned object) -> v1: shape unchanged, just wrapped
  settings: { voiceOn: false, fxOff: false, bootAlways: false, usdInr: 85.5, privacyBlur: false, seenBrowserProfileNotice: false, localLlm: false },

  VIEW_TITLES: {
    command:'COMMAND CENTER', intel:'INTEL FEED', patterns:'PATTERN ENGINE',
    flows:'MONEY FLOW MAP', ideas:'IDEAS LAB', portfolio:'MY MONEY'
  },

  /* ================= settings (ORD-104) ================= */
  loadSettings(){
    const data = Schema.load(this.SETTINGS_KEY, this.SETTINGS_VERSION, null, this.SETTINGS_MIGRATIONS);
    if (data) this.settings = { ...this.settings, ...data };
    return this.settings;
  },
  saveSettings(){
    Schema.save(this.SETTINGS_KEY, this.SETTINGS_VERSION, this.settings);
    Bus.emit('settings:changed', {});
  },

  /* ================= init ================= */
  init(){
    TabGuard.init();
    this.loadSettings();
    Engine.USD_INR = this.settings.usdInr || 85.5; // ORD-205
    LocalLLM.enabled = !!this.settings.localLlm;    // ORD-1511 seam — opt-in only
    Portfolio.load();
    // Boot EMPTY, not with the fabricated corpus. The human's explicit
    // decision (2026-07-29): an honest blank screen is preferable to
    // invented headlines, even labelled ones. JDATA.FEED still exists but
    // is now opt-in only — `?demo=true`, for screenshots and for showing
    // the engine off without a network. Real wires arrive moments later
    // via the auto-uplink at the end of boot; until they do, the views
    // render their honest empty states rather than fake numbers.
    Engine.run(this.demoRequested() ? JDATA.FEED : []);

    document.body.classList.toggle('fx-off', !!this.settings.fxOff);
    document.body.classList.toggle('privacy-blur', !!this.settings.privacyBlur);
    if (this.settings.bootAlways) sessionStorage.removeItem('jarvis.booted');

    FX.particles();
    FX.cursor();
    FX.tilt();
    FX.ripples();

    this.wireNav();
    this.wireChat();
    this.wireIntel();
    this.wireStocks();
    this.wirePortfolio();
    this.wireMirror();
    this.wireScenario();
    this.wireTop();
    this.wireImport();
    this.startTicker();
    this.startClock();
    Jarvis.restoreHistory();

    // ORD-1301: fresh data (e.g. a live-feed ingest) re-renders + updates the
    // HUD without the source of the change needing to know who's listening.
    Bus.on('data:updated', () => { this.renderAll(); this.updateHud(); this.archiveTouch(); });

    let resizeDeb;
    addEventListener('resize', () => {
      clearTimeout(resizeDeb);
      resizeDeb = setTimeout(() => this.renderView(this.view), 250);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopLoops();
      else this.renderView(this.view);
    });
    addEventListener('beforeunload', () => this.stopLoops());

    document.addEventListener('jarvis:booted', async () => {
      // Durability (Boundary 2b): probe the relay's disk store, then
      // restore any irreplaceable key that's missing from localStorage
      // (the profile-wipe recovery path) BEFORE first paint. Re-load
      // Portfolio if its blob came back, since it's the one cached
      // module; ledger/journal/predictions/goals/etc. all read
      // localStorage fresh on each call, so they're automatically
      // correct once restored.
      if (await Persist.probe()){
        const restored = await Persist.restoreMissing();
        if (restored.includes(Portfolio.KEY)) Portfolio.load();
        if (restored.length) this.toast(`Restored ${restored.length} data class${restored.length === 1 ? '' : 'es'} from disk backup`, 'ok');
      }
      await Store.loadPriorKeys(); // ORD-203: know what's archive-old vs new-this-session BEFORE the first paint
      await Store.loadYesterdayShingles(); // Sprint 14: echo-vs-novelty needs yesterday's shingles before the first paint too
      Engine.computeNovelty();
      this.renderAll();
      this.updateHud();
      this.archiveTouch();
      await this.maybeLoadDemoFromUrl();
      this.notifyBrowserProfile();
      // Auto-uplink: attempt a real fetch on every boot, silently, so real
      // wires are what a user sees whenever a connection is reachable —
      // the simulated corpus is a fallback for genuine offline use, not
      // the thing a working connection should leave on screen by default.
      // fetchLive() already degrades gracefully (its own try/catch, honest
      // SIM fallback on failure) and dropSimulated retires fabricated
      // signals the moment real ones arrive, so firing it unattended here
      // is exactly as safe as the user clicking FETCH LIVE themselves —
      // just not requiring them to know to.
      this.fetchLive().catch(() => {});
      if (this.settings.voiceOn){
        Jarvis.voiceOn = true;
        document.getElementById('btnVoice').setAttribute('aria-pressed', 'true');
        document.getElementById('btnVoice').querySelector('use').setAttribute('href', '#i-vol');
      }
      setTimeout(() => {
        Jarvis.say(`${Jarvis.salutation()}. Systems online — <b>${Engine.stats().signals} signals</b> analysed, <b>${Engine.stats().patterns} patterns</b> live, <span class="hl-gold">${U.fmtCr(Engine.totalTracked())}</span> of capital tracked. Say <b>"brief me"</b> whenever you're ready.`, { speak: false });
      }, 700);
    });

    FX.boot();
  },

  /** Best-effort archive write: remember today's signals for tomorrow's
   *  deltas, prune anything past 90 days, upsert the daily rollup. Never
   *  awaited by callers — the archive is a memory aid, not a render dependency. */
  archiveTouch(){
    Store.upsertSignals(Engine.items);
    Store.pruneOld();
    // ORD-5501: today's rollup is a shared, once-per-tick write — only the
    // leader tab performs it, so two open tabs don't race to overwrite
    // each other's snapshot of the same day.
    if (TabGuard.isWriter()) Store.snapshotToday();
  },

  stopLoops(){ this._stops.forEach(fn => fn && fn()); this._stops = []; },

  /* Re-render whichever view is currently active — shared by gotoView,
     the debounced resize handler, and the visibility-return handler
     (ORD-102 / ORD-902b) so canvases always match their current size
     and hidden-view loops never keep running. */
  renderView(name){
    this.stopLoops();
    ({ command:() => this.renderCommand(), intel:() => this.renderIntel(),
       patterns:() => this.renderPatterns(), flows:() => this.renderFlows(),
       ideas:() => this.renderIdeas(), portfolio:() => this.renderPortfolio() })[name]?.();
  },

  renderAll(){
    this.stopLoops();
    this.renderCommand();
    this.renderIntel();
    this.renderPatterns();
    this.renderFlows();
    this.renderIdeas();
    this.renderPortfolio();
    FX.observeReveals();
  },

  updateHud(){
    const st = Engine.stats();
    document.getElementById('sysPatterns').textContent = String(st.patterns);
    document.getElementById('sysSignals').textContent = String(st.signals);
    document.getElementById('sysCapital').textContent = U.fmtCr(st.trackedCr);
  },

  /* ================= navigation ================= */
  wireNav(){
    document.querySelectorAll('.nav-item').forEach(btn =>
      btn.addEventListener('click', () => this.gotoView(btn.dataset.view)));
    document.addEventListener('click', e => {
      const go = e.target.closest?.('[data-goto]');
      if (go) this.gotoView(go.dataset.goto);
    });
    addEventListener('hashchange', () => {
      const v = location.hash.slice(1);
      if (this.VIEW_TITLES[v] && v !== this.view) this.gotoView(v, { fromHash: true });
    });
    const initial = location.hash.slice(1);
    if (this.VIEW_TITLES[initial]) this.view = initial;
  },

  gotoView(name, { silent = false, fromHash = false } = {}){
    if (!this.VIEW_TITLES[name]) return;
    this.view = name;
    if (!fromHash) history.replaceState(null, '', '#' + name);
    document.querySelectorAll('.nav-item').forEach(b => {
      const active = b.dataset.view === name;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    document.getElementById('viewTitle').textContent = this.VIEW_TITLES[name];
    // re-render for fresh canvas sizes + animations
    this.renderView(name);
    FX.observeReveals();
    if (!silent) document.getElementById('views').focus({ preventScroll: true });
    scrollTo({ top: 0, behavior: FX.reduced ? 'auto' : 'smooth' });
    Bus.emit('view:changed', { view: name });
  },

  /* ================= toasts / modal ================= */
  toast(msg, type = ''){
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<svg class="ic"><use href="#${type === 'err' ? 'i-alert' : type === 'ok' ? 'i-shield' : 'i-spark'}"/></svg><span>${msg}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4200);
  },

  modal(html){
    const root = document.getElementById('modalRoot');
    const trigger = document.activeElement; // Sprint 16 a11y: restore focus here on close
    root.innerHTML = `<div class="modal-backdrop"><div class="modal glass" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
    const close = () => {
      root.innerHTML = '';
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
    root.querySelector('.modal-backdrop').addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) close(); });
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const esc = e => { if (e.key === 'Escape'){ close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    // Sprint 16 a11y: move focus INTO the modal so keyboard/screen-reader
    // users aren't left on a trigger now hidden behind the backdrop.
    // Callers needing a more specific target (a form's first input) still
    // call their own .focus() right after this returns, which wins since
    // it runs later in the same synchronous tick.
    const modalEl = root.querySelector('.modal');
    const firstFocusable = modalEl.querySelector('input, select, textarea, button:not([data-close]), [tabindex]');
    (firstFocusable || modalEl).focus();
    return { root, close };
  },

  /* ORD-105: styled glass confirm, replacing native confirm(). Resolves
     true on confirm, false on cancel/backdrop/Esc. */
  confirm(message, { confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', danger = true } = {}){
    return new Promise(resolve => {
      const { root, close } = this.modal(`
        <div class="modal-head"><h3>CONFIRM, SIR?</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
        <p style="color:var(--txt-2);font-size:.92rem;line-height:1.6">${message}</p>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-act="cancel">${cancelLabel}</button>
          <button type="button" class="btn ${danger ? '' : 'btn-primary'}" data-act="ok" style="${danger ? 'color:#2b0a0e;background:linear-gradient(135deg,#ff9aa6,var(--red));box-shadow:0 0 24px rgba(255,107,122,.35)' : ''}">${confirmLabel}</button>
        </div>`);
      let settled = false;
      const escHandler = e => { if (e.key === 'Escape') finish(false); };
      const finish = v => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', escHandler);
        resolve(v);
      };
      root.querySelector('[data-act="ok"]').addEventListener('click', () => { finish(true); close(); });
      root.querySelector('[data-act="cancel"]').addEventListener('click', () => { finish(false); close(); });
      root.querySelector('.modal-backdrop').addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) finish(false); });
      document.addEventListener('keydown', escHandler);
    });
  },

  /* ================= topbar ================= */
  wireTop(){
    document.getElementById('btnSettings').addEventListener('click', () => this.openSettings());
    document.getElementById('btnSundayReview').addEventListener('click', () => this.openSundayReview());
    document.getElementById('btnStopTour').addEventListener('click', () => this.stopTour());
    const voiceBtn = document.getElementById('btnVoice');
    voiceBtn.addEventListener('click', () => {
      Jarvis.voiceOn = !Jarvis.voiceOn;
      voiceBtn.setAttribute('aria-pressed', String(Jarvis.voiceOn));
      voiceBtn.querySelector('use').setAttribute('href', Jarvis.voiceOn ? '#i-vol' : '#i-vol-off');
      if (!Jarvis.voiceOn) speechSynthesis?.cancel();
      this.toast(Jarvis.voiceOn ? 'JARVIS voice enabled' : 'JARVIS voice muted', 'ok');
      if (Jarvis.voiceOn) Jarvis.speak('Voice interface online. At your service, Sir.');
    });
  },

  openSettings(){
    const fxOff = document.body.classList.contains('fx-off');
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>SYSTEM SETTINGS</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="setting-row">
        <p>JARVIS voice replies<small>Reads responses aloud via your browser's speech engine</small></p>
        <button class="switch" id="setVoice" aria-pressed="${Jarvis.voiceOn}" aria-label="Toggle voice"></button>
      </div>
      <div class="setting-row">
        <p>Cinematic effects<small>Particles, cursor glow, tilt, scanlines. Disable on slower machines</small></p>
        <button class="switch" id="setFx" aria-pressed="${!fxOff}" aria-label="Toggle effects"></button>
      </div>
      <div class="setting-row">
        <p>Cinematic boot every load<small>Off (default): the boot sequence only plays once per browser session</small></p>
        <button class="switch" id="setBoot" aria-pressed="${!!this.settings.bootAlways}" aria-label="Toggle boot replay"></button>
      </div>
      <div class="setting-row">
        <p>Data mode<small>SIM runs the built-in demonstration feed. FETCH LIVE (Intel Feed) pulls real headlines via RSS relays</small></p>
        <span class="mode-chip mono ${this.mode === 'live' ? 'live' : ''}">${this.mode.toUpperCase()}</span>
      </div>
      <div class="setting-row">
        <p>Privacy blur<small>Blurs rupee amounts on screen (net worth, holdings values, ledger totals); percentages stay visible. Hover a blurred value to reveal it</small></p>
        <button class="switch" id="setPrivacy" aria-pressed="${!!this.settings.privacyBlur}" aria-label="Toggle privacy blur"></button>
      </div>
      <div class="setting-row">
        <p>Local model assist<small>OFF by default. Uses <b>${U.esc(LocalLLM.MODEL)}</b> running on this machine via Ollama — nothing leaves your computer. It may only <b>route</b> a question my rules failed to parse, and <b>ask</b> questions about a thesis you wrote. It never writes an answer, never produces a number, and never touches your ledger — every figure stays mine. Adds ~3s on missed questions only; holds ~9GB RAM while on</small></p>
        <button class="switch" id="setLocalLlm" aria-pressed="${!!this.settings.localLlm}" aria-label="Toggle local model assist"></button>
      </div>
      <div class="setting-row">
        <p>USD/INR rate<small>Used to convert $ amounts in headlines to ₹ crore (ORD-205). Update occasionally — new signals use it going forward</small></p>
        <input type="number" id="setUsdInr" min="1" step="0.01" value="${this.settings.usdInr}" style="width:90px;min-height:38px;text-align:right" aria-label="USD to INR rate">
      </div>
      <div class="setting-row">
        <p>Backup your data<small>Everything below lives only in this browser — export it before clearing cookies/cache or switching machines</small></p>
        <div style="display:flex;gap:8px;flex:none">
          <button class="btn btn-ghost" id="setExport" style="min-height:38px;padding:8px 14px">EXPORT</button>
          <button class="btn btn-ghost" id="setImport" style="min-height:38px;padding:8px 14px">IMPORT</button>
        </div>
      </div>
      <div class="setting-row">
        <p>Reboot JARVIS<small>Reload the app and replay the boot sequence once</small></p>
        <button class="btn btn-ghost" id="setReboot" style="min-height:38px;padding:8px 14px">REBOOT</button>
      </div>
      <div class="setting-row">
        <p>Reset local data<small>Clears portfolio, watchlist and budget stored in this browser</small></p>
        <button class="btn btn-ghost" id="setReset" style="min-height:38px;padding:8px 14px;color:var(--red);border-color:rgba(255,107,122,.4)">RESET</button>
      </div>
      <p class="side-note mono" style="margin-top:14px">JARVIS drafts research from public headlines. Education only — not personalised financial advice.</p>
    `);
    root.querySelector('#setVoice').addEventListener('click', e => {
      document.getElementById('btnVoice').click();
      e.currentTarget.setAttribute('aria-pressed', String(Jarvis.voiceOn));
      this.settings.voiceOn = Jarvis.voiceOn; this.saveSettings();
    });
    root.querySelector('#setFx').addEventListener('click', e => {
      document.body.classList.toggle('fx-off');
      const on = !document.body.classList.contains('fx-off');
      e.currentTarget.setAttribute('aria-pressed', String(on));
      this.settings.fxOff = !on; this.saveSettings();
    });
    root.querySelector('#setBoot').addEventListener('click', e => {
      this.settings.bootAlways = !this.settings.bootAlways;
      e.currentTarget.setAttribute('aria-pressed', String(this.settings.bootAlways));
      this.saveSettings();
    });
    root.querySelector('#setPrivacy').addEventListener('click', e => {
      this.settings.privacyBlur = !this.settings.privacyBlur;
      e.currentTarget.setAttribute('aria-pressed', String(this.settings.privacyBlur));
      document.body.classList.toggle('privacy-blur', !!this.settings.privacyBlur);
      this.saveSettings();
    });
    root.querySelector('#setLocalLlm').addEventListener('click', async e => {
      this.settings.localLlm = !this.settings.localLlm;
      LocalLLM.enabled = this.settings.localLlm;
      e.currentTarget.setAttribute('aria-pressed', String(this.settings.localLlm));
      this.saveSettings();
      if (this.settings.localLlm){
        LocalLLM.available = null; // re-probe: Ollama may have started since boot
        this.toast(await LocalLLM.probe()
          ? `Local model assist on — ${LocalLLM.MODEL} reachable`
          : `Ollama or ${LocalLLM.MODEL} not reachable — assist stays inert until it is`,
          await LocalLLM.probe() ? 'ok' : 'err');
      }
    });
    root.querySelector('#setUsdInr').addEventListener('change', e => {
      const v = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
      if (!v || v <= 0) return;
      this.settings.usdInr = v;
      Engine.USD_INR = v;
      this.saveSettings();
      this.toast(`USD/INR set to ${v}`, 'ok');
    });
    root.querySelector('#setExport').addEventListener('click', () => this.exportData());
    root.querySelector('#setImport').addEventListener('click', () => document.getElementById('importFileInput').click());
    root.querySelector('#setReboot').addEventListener('click', async () => {
      const ok = await this.confirm('This reloads JARVIS and replays the boot sequence once. Unsaved form input elsewhere on the page will be lost.', { confirmLabel:'REBOOT', danger:false });
      if (!ok) return;
      sessionStorage.removeItem('jarvis.booted');
      location.reload();
    });
    root.querySelector('#setReset').addEventListener('click', async () => {
      const ok = await this.confirm('Clear portfolio, watchlist and budget data stored in this browser? This cannot be undone unless you have an export.');
      if (!ok) return;
      localStorage.removeItem(Portfolio.KEY);
      Portfolio.state = { holdings: [], budget: { income: 0, expense: 0 }, watchlist: [] };
      this.renderPortfolio(); this.renderIdeas();
      close();
      this.toast('Local data cleared', 'ok');
    });
  },

  /* ================= backup / restore (ORD-110) ================= */
  exportData(){
    const data = {};
    for (let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if (key && key.startsWith('jarvis.')) data[key] = localStorage.getItem(key);
    }
    const payload = { app: 'jarvis', version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `jarvis-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.toast('Backup downloaded — keep it out of synced/cloud folders', 'ok');
  },

  wireImport(){
    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-selecting the same file later
      if (!file) return;
      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch(err){
        this.toast('That file is not valid JARVIS backup JSON', 'err');
        return;
      }
      if (!payload || typeof payload.data !== 'object' || Array.isArray(payload.data)){
        this.toast('Unrecognised backup format', 'err');
        return;
      }
      const keys = Object.keys(payload.data).filter(k => k.startsWith('jarvis.'));
      if (!keys.length){ this.toast('Backup contains no JARVIS data', 'err'); return; }
      const ok = await this.confirm(
        `This will overwrite <b>${keys.length}</b> stored key${keys.length>1?'s':''} in this browser ` +
        `(portfolio, chat, settings, etc. — whatever the backup contains) and reload JARVIS. Continue?`,
        { confirmLabel:'IMPORT & RELOAD' });
      if (!ok) return;
      for (const k of keys){
        const v = payload.data[k];
        if (typeof v === 'string') localStorage.setItem(k, v);
      }
      this.toast('Import complete — reloading', 'ok');
      setTimeout(() => location.reload(), 900);
    });
  },

  /* ================= ticker + clock ================= */
  startTicker(){
    // ORD-101: build the DOM once (duplicated for the seamless marquee),
    // then update text/classes in place on each tick instead of
    // re-innerHTML-ing the whole track (which restarted layout/animation).
    const track = document.getElementById('tickerTrack');
    const data = JDATA.TICKERS.map(t => ({ ...t, d: 0 }));
    const cellHtml = t => `<span class="tick-item"><span class="tk">${U.esc(t.k)}</span>
        <span class="tv"></span><span class="td"></span></span>`;
    track.innerHTML = data.map(cellHtml).join('') + data.map(cellHtml).join('');
    const cells = [...track.children];
    const paint = (cellEl, t, flash) => {
      cellEl.querySelector('.tv').textContent =
        t.v.toLocaleString('en-IN', { minimumFractionDigits: t.dec, maximumFractionDigits: t.dec });
      const td = cellEl.querySelector('.td');
      td.className = 'td ' + (t.d >= 0 ? 'up' : 'dn');
      // A visible "SIM" beats dimming alone: opacity is a style cue people
      // stop noticing, a word is not. Reading the tape must not require
      // hovering to learn the number is invented.
      td.textContent = `${t.d >= 0 ? '▲' : '▼'}${Math.abs(t.d).toFixed(2)}%` + (t.live ? '' : ' SIM');
      // Per-instrument honesty: a cell showing a real quote reads at full
      // strength; one still on its simulated seed is dimmed and says so on
      // hover, so a live tape can never silently carry an invented print.
      cellEl.style.opacity = t.live ? '' : '.5';
      cellEl.title = t.live
        ? `${t.k} ${t.v} · print is ${Market.fmtAge(Market.ageSec(t.k))} old (exchange timestamp) · ${Market.session().label}`
        : 'Simulated — no live quote for this instrument (run node relay.js)';
      if (flash && FX.enabled){
        const tv = cellEl.querySelector('.tv');
        tv.classList.remove('flash-up', 'flash-dn');
        void tv.offsetWidth; // restart animation
        tv.classList.add(t.d >= 0 ? 'flash-up' : 'flash-dn');
      }
    };
    const repaint = flash => data.forEach((t, i) => {
      paint(cells[i], t, flash); paint(cells[i + data.length], t, flash);
    });
    repaint(false);

    // The badge states the freshness of the tape rather than just claiming
    // "LIVE": a stale live feed is more dangerous than an honestly-labelled
    // simulated one, because it looks authoritative. During market hours a
    // print older than ~2 minutes is flagged amber so a silently-wedged
    // feed can't pass for current.
    const chip = document.getElementById('modeChip');
    const setMode = live => {
      if (!chip) return;
      const sess = Market.session();
      if (!live){
        chip.textContent = 'SIM FEED';
        chip.style.color = '';
        chip.title = 'Simulated tape — start the relay (node relay.js) for real quotes';
        return;
      }
      // Judge freshness on the NSE-clock instruments only. Brent, gold and
      // Nasdaq futures keep their own sessions, so including them would
      // paint the badge amber every Indian morning for no real reason.
      const { stalest } = Market.nseAgeRange();
      const stale = sess.state === 'OPEN' && stalest != null && stalest > 120;
      chip.textContent = `LIVE · ${Market.fmtAge(stalest)}`;
      chip.style.color = stale ? 'var(--amber, #bd8a16)' : '';
      const perInstrument = Market.NSE_BOUND
        .filter(l => Market.get(l))
        .map(l => `  ${l}: ${Market.fmtAge(Market.ageSec(l))} old`);
      chip.title = [
        `${sess.label} (NSE, IST — exchange holidays not tracked)`,
        ...perInstrument,
        `Fetched ${Market.stamp() || '—'} · refreshing every ${Math.round(Market.refreshMs() / 1000)}s`,
        // "Live" cannot mean zero-latency on a free feed — say the honest
        // floor here rather than let the word imply something no free
        // source delivers. Measured against Yahoo's own exchange
        // timestamp, not assumed.
        'No free feed is latency-free — this one measured ~3-15s behind the exchange print.',
        stale ? '⚠ Market is open but an NSE print is aging — that feed may be delayed or wedged.' : ''
      ].filter(Boolean).join('\n');
    };

    // The seeded random walk stays ONLY as the relay-down fallback. It is
    // never applied to a live value: nudging a real quote by Math.random()
    // would turn a true print into a fabricated one.
    // Deliberately NOT animated any more. A fabricated NIFTY level that
    // ticks up and down every 3s is read by every human as a live feed —
    // motion is the strongest liveness cue a price display has, stronger
    // than any badge sitting next to it. The old random walk therefore
    // dressed invented numbers as a working market connection, which is
    // the exact deception this pass exists to remove. Simulated values
    // now sit FROZEN at their seed: a static price plus the dimmed cell,
    // the per-cell SIM tag and the SIM FEED badge all agree that nothing
    // is connected. Kept as named no-ops so the live/sim switching below
    // still reads clearly.
    const startSim = () => { repaint(false); };
    const stopSim = () => {};

    const refresh = async () => {
      const n = await Market.refresh();
      data.forEach(t => {
        const q = Market.get(t.k);
        if (q){ t.v = q.price; t.d = q.changePct; t.live = true; }
      });
      if (n){ stopSim(); repaint(true); setMode(true); }
      else { startSim(); setMode(false); }
    };

    // Self-rescheduling rather than a fixed setInterval: the cadence has to
    // follow the session (20s while NSE is open, 5min when it's shut), and
    // that can change mid-session — a page left open across the 15:30 close
    // must stop hammering upstream for a price that can no longer move.
    let tapeTimer = null;
    const loop = async () => {
      await refresh();
      clearTimeout(tapeTimer);
      tapeTimer = setTimeout(loop, Market.refreshMs());
    };
    loop(); // fire immediately, don't block boot

    // Re-badge every 10s even between fetches so the displayed age counts
    // up honestly instead of freezing at whatever it was when last drawn.
    setInterval(() => { if (Market.isLive) setMode(true); }, 10000);
  },

  startClock(){
    const el = document.getElementById('clock');
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false }); };
    tick(); setInterval(tick, 1000);
  },

  /* ================= COMMAND CENTER ================= */
  renderCommand(){
    const st = Engine.stats();
    const h = new Date().getHours();
    document.getElementById('greetLine').textContent =
      (h < 5 ? 'Late night ops, Sir.' : h < 12 ? 'Good morning, Sir.' : h < 17 ? 'Good afternoon, Sir.' : 'Good evening, Sir.');
    // Say WHAT was analysed, not just how much. "32 signals analysed across
    // government, foreign and market wires" is a false claim when every one
    // of those 32 is an invented demo headline — the sentence describes real
    // reporting that never happened. The corpus type leads the sentence so it
    // cannot be skimmed past.
    const liveCount = Engine.items.filter(i => i.live).length;
    const corpus = liveCount === 0
      ? 'SIMULATED corpus (demo mode) — '
      : liveCount < st.signals
        ? `${liveCount} of ${st.signals} signals are real wires, the rest simulated — `
        : '';
    // Empty is now a legitimate, expected state (boot loads nothing until
    // real wires arrive), so it gets its own honest sentence rather than
    // "0 signals analysed", which reads like a failure.
    document.getElementById('greetSub').textContent = st.signals === 0
      ? 'No wires loaded yet — fetching live news. Nothing invented is shown while this is empty.'
      : corpus +
        `${st.signals} signals analysed · ${st.patterns} active patterns · ` +
        (st.topSector ? `heaviest capital gravity: ${st.topSector.label}.` : 'awaiting flow data.');

    const chips = document.getElementById('greetChips');
    chips.innerHTML = '';
    ['Brief me', 'Where is the money going?', 'Top ideas', 'Scan live news'].forEach(q => {
      const c = document.createElement('button');
      c.className = 'chip'; c.textContent = q;
      c.addEventListener('click', () => { this.openChat(); Jarvis.handle(q); });
      chips.appendChild(c);
    });
    const tourChip = document.createElement('button');
    tourChip.className = 'chip'; tourChip.textContent = 'Take the tour';
    tourChip.addEventListener('click', () => this.startTour());
    chips.appendChild(tourChip);

    // KPIs
    const kpis = [
      { label:'SIGNALS SCANNED', icon:'i-satellite', value: st.signals, sub: `${Engine.items.filter(i=>i.live).length} live · ${st.alerts} high-impact`, spark: true, histField:'signals' },
      { label:'CAPITAL TRACKED', icon:'i-flow', value: st.trackedCr, fmt: v => U.fmtCr(v), sub: `${Engine.flows.length} disclosed flows`, spark: true, histField:'trackedCr' },
      { label:'MARKET BIAS', icon:'i-up', value: st.bullPct, fmt: v => Math.round(v) + '% BULL', sub: st.bullPct >= 55 ? 'risk-on tone' : st.bullPct <= 45 ? 'defensive tone' : 'balanced tape', cls: st.bullPct >= 55 ? 'up' : st.bullPct <= 45 ? 'dn' : '', spark: true, histField:'bullPct' },
      { label:'PATTERNS LIVE', icon:'i-network', value: st.patterns, sub: Engine.clusters[0] ? 'strongest: ' + Engine.clusters[0].label : '—', spark: true, histField:'patterns' }
    ];
    const row = document.getElementById('kpiRow');
    row.innerHTML = kpis.map((k, i) => `
      <div class="kpi glass tilt sheen reveal" style="--d:${i*70}ms">
        <span class="kpi-label"><svg class="ic"><use href="#${k.icon}"/></svg>${k.label}</span>
        <span class="kpi-value" id="kpiV${i}">0</span>
        <span class="kpi-sub ${k.cls || ''}">${k.sub}</span>
        ${k.spark ? `<canvas class="kpi-spark" id="kpiS${i}" aria-hidden="true" title="last 14 days"></canvas>` : ''}
      </div>`).join('');
    kpis.forEach((k, i) => {
      FX.countUp(document.getElementById('kpiV' + i), k.value, { fmt: k.fmt || (v => Math.round(v).toLocaleString('en-IN')) });
      const c = document.getElementById('kpiS' + i);
      // ORD-203: real 14-day history once the archive has it, honestly flat until it does
      if (c) requestAnimationFrame(() => Charts.spark(c, Store.series(k.histField, k.value)));
    });

    // radar (only animate when this view is on screen)
    if (this.view !== 'command') return;
    const activity = {};
    Engine.items.forEach(i => i.sectors.forEach(s => {
      activity[s] = activity[s] || { n: 0, imp: 0, bull: 0, bear: 0 };
      activity[s].n++; activity[s].imp += i.impact;
      if (i.senti === 'bull') activity[s].bull++; if (i.senti === 'bear') activity[s].bear++;
    }));
    const maxImp = Math.max(1, ...Object.values(activity).map(a => a.imp));
    const blips = Object.entries(activity).map(([s, a]) => ({
      label: JDATA.SECTORS[s]?.label || s,
      angle: JDATA.SECTORS[s]?.angle ?? Math.random()*360,
      strength: a.imp / maxImp,
      senti: a.bull > a.bear ? 'bull' : a.bear > a.bull ? 'bear' : 'neut'
    }));
    const radarCanvas = document.getElementById('radarCanvas');
    requestAnimationFrame(() => {
      if (this.view !== 'command') return; // ORD-902a: view may have changed before this frame fired
      this._stops.push(Charts.radar(radarCanvas, blips, document.getElementById('radarTip')));
    });
    document.getElementById('radarLegend').innerHTML = `
      <span class="li"><i class="swatch" style="--sw:#0da271"></i>bullish</span>
      <span class="li"><i class="swatch" style="--sw:#e0489a"></i>bearish</span>
      <span class="li"><i class="swatch" style="--sw:#3b82f6"></i>neutral</span>
      <span class="li"><span class="lv">blip size & distance = activity</span></span>`;

    // live stocks monitor
    this.renderStocks();

    // mini flows
    this.renderFlowBars(document.getElementById('miniFlows'), 5);

    // top patterns
    document.getElementById('topPatterns').innerHTML = Engine.clusters.slice(0, 3).map(c => `
      <button class="mini-row" data-goto="patterns">
        <div class="mr-main">
          <div class="mr-title">${U.esc(c.name)}</div>
          <div class="mr-sub">${c.items.length} SIGNALS · ${c.sources} SOURCES${c.flowsCr ? ' · ' + U.fmtCr(c.flowsCr) : ''}</div>
        </div>
        <div class="mr-side"><span class="momentum"><span class="bars"><i></i><i></i><i></i><i></i></span>${c.score}</span></div>
      </button>`).join('') || '<p class="empty-state">No patterns yet.</p>';

    // top ideas
    document.getElementById('topIdeas').innerHTML = Engine.ideas.slice(0, 3).map(idea => `
      <button class="mini-row" data-goto="ideas">
        <div class="mr-main">
          <div class="mr-title">${U.esc(idea.label)}${idea.kind === 'caution' ? ' ⚠' : ''}</div>
          <div class="mr-sub">${idea.horizon} · ${U.esc(idea.watch.slice(0,2).join(', '))}</div>
        </div>
        <div class="mr-side"><span class="mono" style="color:var(--cyan)">${idea.conviction}%</span><div class="mr-sub">CONVICTION</div></div>
      </button>`).join('');

    // high impact intel
    document.getElementById('topIntel').innerHTML = [...Engine.items]
      .sort((a,b) => b.impact - a.impact).slice(0, 5).map(i => `
      <button class="mini-row" data-goto="intel">
        <span class="senti-badge ${i.senti}">${i.senti === 'bull' ? '▲' : i.senti === 'bear' ? '▼' : '●'}</span>
        <div class="mr-main">
          <div class="mr-title">${U.esc(i.t)}</div>
          <div class="mr-sub">${U.esc(i.s.toUpperCase())} · ${U.ago(i.h).toUpperCase()}</div>
        </div>
        <div class="mr-side"><span class="mono" style="color:var(--cyan)">${i.impact}</span><div class="mr-sub">IMPACT</div></div>
      </button>`).join('');

    this.renderHonesty();
    this.renderThreatBoard();

    // animate flow bars after paint
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.querySelectorAll('#view-command .fbar-fill').forEach(f => f.style.width = f.dataset.w)));
  },

  /* ================= HONESTY PANEL (Sprint 6) ================= */
  renderHonesty(){
    Honesty.seedAlerts();
    const h = Honesty.compute();

    document.getElementById('honestyEngineTag').textContent = 'v' + JDATA.ENGINE_VERSION;
    document.getElementById('honestyCaveat').innerHTML = h.lowVolume
      ? `<div class="honesty-caveat">Only ${h.n} signal${h.n===1?'':'s'} today — ratios below are less reliable than on a normal-volume day.</div>` : '';

    const metricsEl = document.getElementById('honestyMetrics');
    metricsEl.innerHTML = h.metrics.map(m => `
      <div class="honesty-row${m.key === 'parser' ? ' provable' : ''}" ${m.key === 'parser' ? 'data-prov-parser title="Click to see where this number comes from"' : ''}>
        <span class="honesty-label">${m.label}</span>
        <span class="honesty-value"><i class="honesty-dot ${m.band}"></i>${m.display}</span>
      </div>`).join('');
    metricsEl.onclick = e => { if (e.target.closest('[data-prov-parser]')) this.openProvenance('parserHealth', Honesty.compute()); };

    const gauge = document.getElementById('quotaGauge');
    gauge.style.width = h.quotaPct + '%';
    gauge.title = `${h.quotaPct}% of the assumed 5MB localStorage floor used`;

    const alerts = Alerts.list();
    document.getElementById('honestyAlerts').innerHTML = alerts.length
      ? alerts.map(a => `
        <div class="alert-row ${a.severity}">
          <svg class="ic"><use href="#${a.severity === 'critical' ? 'i-alert' : a.severity === 'warn' ? 'i-alert' : 'i-spark'}"/></svg>
          <span>${U.esc(a.message)}</span>
        </div>`).join('')
      : '<p class="empty-state" style="padding:8px 0">No active alerts.</p>';
  },

  /* ================= THREAT BOARD (Sprint 6) ================= */
  renderThreatBoard(){
    const threats = Engine.ideas.filter(i => i.kind === 'caution');
    document.getElementById('threatBoard').innerHTML = threats.length
      ? threats.map(t => `
        <button class="mini-row" data-goto="ideas">
          <span class="senti-badge bear">▼</span>
          <div class="mr-main">
            <div class="mr-title">${U.esc(t.label)}</div>
            <div class="mr-sub">${U.esc(t.clusterName || '')}</div>
          </div>
          <div class="mr-side"><span class="mono" style="color:var(--red)">${t.conviction}%</span><div class="mr-sub">CONVICTION</div></div>
        </button>`).join('')
      : '<p class="empty-state">No bearish clusters detected — nothing on the board.</p>';
  },

  /** ORD-302: sectors with a net outflow render red and grow from the right
   *  (a "-" prefix on the value), sized by magnitude — visually distinct
   *  from the normal cyan/gold inflow bars, still one shared bar language. */
  renderFlowBars(container, limit){
    const rows = Engine.flowBySector().slice(0, limit);
    const max = Math.max(1, ...rows.map(r => Math.abs(r.total)));
    const COLORS = Charts.PALETTE;
    container.innerHTML = rows.map((r, i) => {
      const out = r.total < 0;
      return `
      <div class="fbar${out ? ' fbar-out' : ''}">
        <div class="fbar-top"><span class="fbar-label">${U.esc(r.label)}</span>
        <span class="fbar-val">${out ? '-' : ''}${U.fmtCr(Math.abs(r.total))} · ${r.count} flow${r.count>1?'s':''}</span></div>
        <div class="fbar-track"><i class="fbar-fill" style="--fc:${out ? 'var(--red)' : COLORS[i % COLORS.length]}" data-w="${Math.max(6, 100*Math.abs(r.total)/max)}%"></i></div>
      </div>`;
    }).join('') || '<p class="empty-state">No flows tracked yet.</p>';
  },

  /* ================= LIVE STOCKS MONITOR ================= */
  stockRegion: 'india',
  stockSearchQuery: '',
  _stockQuotesCache: {},

  wireStocks(){
    const regionToggle = document.getElementById('stockRegionToggle');
    if (regionToggle){
      regionToggle.addEventListener('click', e => {
        const btn = e.target.closest('.region-btn'); if (!btn) return;
        regionToggle.querySelectorAll('.region-btn').forEach(x => {
          const active = x === btn;
          x.classList.toggle('active', active);
          x.setAttribute('aria-selected', String(active));
        });
        this.stockRegion = btn.dataset.sregion;
        this.renderStocks();
      });
    }

    const searchInput = document.getElementById('stockSearch');
    if (searchInput){
      let deb;
      searchInput.addEventListener('input', e => {
        clearTimeout(deb);
        deb = setTimeout(() => {
          this.stockSearchQuery = e.target.value.trim().toLowerCase();
          this.renderStocks();
        }, 250);
      });
    }

    const btnRefresh = document.getElementById('btnStockRefresh');
    if (btnRefresh){
      btnRefresh.addEventListener('click', () => {
        this._stockQuotesCache = {};
        this.renderStocks(true);
      });
    }

    const grid = document.getElementById('stockCardsGrid');
    if (grid){
      grid.addEventListener('click', e => {
        const az = e.target.closest('[data-analyze-stock]');
        if (az){
          this.openChat();
          Jarvis.handle(`how is ${az.dataset.analyzeStock} doing`);
        }
      });
    }
  },

  async renderStocks(forceRefresh = false){
    const container = document.getElementById('stockCardsGrid');
    if (!container) return;

    let baseList = this.stockRegion === 'india' ? Market.INDIAN_STOCKS : Market.US_STOCKS;
    
    let symbolsToFetch = baseList.map(s => s.sym);
    if (this.stockSearchQuery) {
      const isCustomSymbol = !baseList.some(s => s.sym.toLowerCase().includes(this.stockSearchQuery) || s.label.toLowerCase().includes(this.stockSearchQuery) || s.name.toLowerCase().includes(this.stockSearchQuery));
      if (isCustomSymbol && this.stockSearchQuery.length >= 2) {
        const customSym = this.stockSearchQuery.toUpperCase();
        if (!symbolsToFetch.includes(customSym)) symbolsToFetch.unshift(customSym);
        const customSymNs = customSym + '.NS';
        if (!symbolsToFetch.includes(customSymNs)) symbolsToFetch.unshift(customSymNs);
      }
    }

    const missingSymbols = symbolsToFetch.filter(s => !this._stockQuotesCache[s] || forceRefresh);
    if (missingSymbols.length > 0) {
      const fetched = await Market.fetchQuotes(missingSymbols);
      Object.assign(this._stockQuotesCache, fetched);
    }

    let items = baseList.map(item => {
      const q = this._stockQuotesCache[item.sym];
      return {
        sym: item.sym,
        label: item.label,
        name: q?.shortName || item.name,
        price: q?.price ?? item.fallbackPrice,
        changePct: q?.changePct ?? item.fallbackChange,
        currency: q?.currency || (item.sym.endsWith('.NS') ? 'INR' : 'USD'),
        live: !!q && typeof q.price === 'number',
        dayHigh: q?.dayHigh,
        dayLow: q?.dayLow
      };
    });

    if (this.stockSearchQuery) {
      const query = this.stockSearchQuery.toLowerCase();
      let filtered = items.filter(i => i.sym.toLowerCase().includes(query) || i.label.toLowerCase().includes(query) || i.name.toLowerCase().includes(query));
      
      if (filtered.length === 0) {
        const customSym = this.stockSearchQuery.toUpperCase();
        const customQuote = this._stockQuotesCache[customSym] || this._stockQuotesCache[customSym + '.NS'];
        if (customQuote && typeof customQuote.price === 'number') {
          filtered = [{
            sym: customSym,
            label: customSym,
            name: customQuote.shortName || customSym,
            price: customQuote.price,
            changePct: customQuote.changePct,
            currency: customQuote.currency || 'USD',
            live: true,
            dayHigh: customQuote.dayHigh,
            dayLow: customQuote.dayLow
          }];
        }
      }
      items = filtered;
    }

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state glass" style="padding:24px;grid-column:1/-1;text-align:center">
          <p style="color:var(--txt-2);font-family:var(--f-mono);font-size:.8rem">No stocks matching "${U.esc(this.stockSearchQuery)}", Sir.</p>
        </div>`;
      return;
    }

    const fmtMoney = (val, curr) => {
      const symbol = curr === 'INR' ? '₹' : '$';
      return `${symbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    container.innerHTML = items.map(stock => {
      const isUp = stock.changePct >= 0;
      const sign = isUp ? '▲ +' : '▼ ';
      const changeCls = isUp ? 'up' : 'dn';

      return `
        <article class="stock-card glass">
          <div class="stock-card-top">
            <div>
              <div class="stock-sym">${U.esc(stock.label)}</div>
              <div class="stock-name" title="${U.esc(stock.name)}">${U.esc(stock.name)}</div>
            </div>
            <span class="src-chip ${stock.live ? '' : 'sim'}" style="${stock.live ? 'color:var(--green);border-color:rgba(61,220,151,.35);background:rgba(61,220,151,.07)' : 'color:var(--gold);border-color:rgba(255,209,102,.4);background:rgba(255,209,102,.1)'}">
              ${stock.live ? 'LIVE' : 'SIM'}
            </span>
          </div>
          <div class="stock-price-row">
            <span class="stock-price">${fmtMoney(stock.price, stock.currency)}</span>
            <span class="stock-change ${changeCls}">${sign}${Math.abs(stock.changePct).toFixed(2)}%</span>
          </div>
          ${(stock.dayHigh != null && stock.dayLow != null) ? `
          <div class="stock-range">
            <span>LOW: ${fmtMoney(stock.dayLow, stock.currency)}</span>
            <span>HIGH: ${fmtMoney(stock.dayHigh, stock.currency)}</span>
          </div>` : ''}
          <div class="stock-card-foot">
            <button class="link-btn mono" data-analyze-stock="${stock.label}">
              <svg class="ic"><use href="#i-spark"/></svg> JARVIS, ANALYZE
            </button>
          </div>
        </article>`;
    }).join('');
  },

  /* ================= INTEL FEED ================= */
  wireIntel(){
    const FILTERS = [['all','ALL WIRES'],['gov','GOVERNMENT'],['global','FOREIGN'],['markets','MARKETS'],['corporate','CORPORATE']];
    const box = document.getElementById('intelFilters');
    box.innerHTML = FILTERS.map(([k, l]) =>
      `<button class="chip ${k === 'all' ? 'active' : ''}" data-f="${k}" role="tab" aria-selected="${k === 'all'}">${l}</button>`).join('');
    box.addEventListener('click', e => {
      const c = e.target.closest('.chip'); if (!c) return;
      box.querySelectorAll('.chip').forEach(x => { x.classList.toggle('active', x === c); x.setAttribute('aria-selected', String(x === c)); });
      this.intelFilter = c.dataset.f;
      this.renderIntel();
    });

    /* ---- region toggle (India / Global) ---- */
    const regionBox = document.getElementById('regionToggle');
    regionBox.addEventListener('click', e => {
      const btn = e.target.closest('.region-btn'); if (!btn) return;
      regionBox.querySelectorAll('.region-btn').forEach(x => { x.classList.toggle('active', x === btn); x.setAttribute('aria-selected', String(x === btn)); });
      this.regionFilter = btn.dataset.region;
      this.renderIntel();
    });

    let deb;
    document.getElementById('intelSearch').addEventListener('input', e => {
      clearTimeout(deb);
      deb = setTimeout(() => { this.intelQuery = e.target.value.toLowerCase(); this.renderIntel(); }, 220);
    });
    document.getElementById('btnLive').addEventListener('click', () => this.fetchLive());
    document.getElementById('intelList').addEventListener('click', e => {
      const az = e.target.closest('[data-analyze]');
      if (az){ this.openChat(); this.analyzeItem(az.dataset.analyze); }
      const pr = e.target.closest('[data-prov-impact]');
      if (pr){ const item = Engine.items.find(x => x.id === pr.dataset.provImpact); if (item) this.openProvenance('impact', item); }
      const tg = e.target.closest('[data-tag]');
      if (tg){ document.getElementById('intelSearch').value = tg.dataset.tag; this.intelQuery = tg.dataset.tag.toLowerCase(); this.renderIntel(); }
      if (e.target.closest('[data-clear-filters]')){
        this.intelFilter = 'all'; this.regionFilter = 'all'; this.intelQuery = '';
        document.getElementById('intelSearch').value = '';
        box.querySelectorAll('.chip').forEach(x => { const isAll = x.dataset.f === 'all'; x.classList.toggle('active', isAll); x.setAttribute('aria-selected', String(isAll)); });
        regionBox.querySelectorAll('.region-btn').forEach(x => { const isAll = x.dataset.region === 'all'; x.classList.toggle('active', isAll); x.setAttribute('aria-selected', String(isAll)); });
        this.renderIntel();
      }
    });
  },

  renderIntel(){
    let items = [...Engine.items];
    /* ---- region filter: India = gov/markets/corporate, Global = global ---- */
    const INDIA_CATS = new Set(['gov', 'markets', 'corporate']);
    if (this.regionFilter === 'india')  items = items.filter(i => INDIA_CATS.has(i.cat));
    if (this.regionFilter === 'global') items = items.filter(i => i.cat === 'global');
    if (this.intelFilter !== 'all') items = items.filter(i => i.cat === this.intelFilter);
    if (this.intelQuery) items = items.filter(i =>
      (i.t + ' ' + i.b + ' ' + i.entities.map(e => e.tag).join(' ')).toLowerCase().includes(this.intelQuery));
    items.sort((a,b) => b.impact - a.impact);
    const shown = items.filter(i => !i.hype);
    const quarantined = items.filter(i => i.hype); // ORD-1701: hype-flagged items still visible, just set apart

    document.getElementById('intelMeta').textContent =
      `${items.length} SIGNALS · MODE: ${this.mode.toUpperCase()} · IMPACT-RANKED${quarantined.length ? ` · ${quarantined.length} QUARANTINED` : ''}`;

    const CAT = { gov:['gov','GOV'], global:['global','FOREIGN'], markets:['','MARKETS'], corporate:['','CORPORATE'] };
    const card = (i, n) => `
      <article class="intel-card glass tilt sheen reveal" style="--d:${Math.min(n*40, 400)}ms">
        <span class="grade-badge grade-${i.grade.toLowerCase()}" title="Evidence grade ${i.grade}: ${{A:'official/confirmed',B:'multi-source corroborated',C:'single-source claim',D:'hype-flagged'}[i.grade]}${i.live ? '' : ' — NOTE: graded against SIMULATED data. The grade describes how the engine scored an invented item; it is not evidence about the real world.'}">${i.grade}</span>
        <div class="ic-top">
          <span class="src-chip ${CAT[i.cat]?.[0] || ''}">${CAT[i.cat]?.[1] || i.cat.toUpperCase()}</span>
          <span class="src-chip" style="color:var(--txt-2);border-color:var(--glass-line-soft);background:transparent">${U.esc(i.s)}</span>
          ${i.live
            ? '<span class="src-chip" style="color:var(--green);border-color:rgba(61,220,151,.35);background:rgba(61,220,151,.07)">LIVE</span>'
            : `<span class="src-chip" style="color:var(--amber,#bd8a16);border-color:rgba(189,138,22,.45);background:rgba(189,138,22,.10);font-weight:700" title="INVENTED DEMONSTRATION DATA. This headline was never published — the source name, the figures and the grade below are all fabricated to exercise the engine. Click FETCH LIVE for real wires.">SIMULATED</span>`}
          ${Store.isNew(i) ? '<span class="src-chip" style="color:var(--gold);border-color:rgba(255,209,102,.4);background:rgba(255,209,102,.08)" title="First time this signal has been archived">NEW</span>' : ''}
          ${i.confirmed ? `<span class="src-chip confirmed-badge" title="Same story from ${i.groupSources.length} distinct sources">CONFIRMED ×${i.groupSize}</span>` : ''}
          ${i.hype ? `<span class="src-chip hype-badge" title="WHO BENEFITS FROM YOU BELIEVING THIS? Hedge/superlative/unnamed-sourcing/untiered-outlet heuristics (score ${i.hypeScore}/100). Excluded from flows &amp; ideas.">⚠ HYPE</span>` : ''}
          ${i.novel === false ? '<span class="echo-chip" title="Closely echoes something archived around yesterday — same underlying story, reworded">↺ ECHO</span>' : ''}
          <span class="when" title="${i.pub ? 'Published ' + U.esc(new Date(i.pub).toLocaleString('en-IN', { dateStyle:'full', timeStyle:'short' })) : 'No publication timestamp on this item — age is relative to when it was ingested.'}">${U.ago(i.h)}${i.pub ? ` · ${U.esc(new Date(i.pub).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }))}` : ''}</span>
        </div>
        <h4 class="ic-title">${i.url ? `<a href="${U.esc(i.url)}" target="_blank" rel="noopener noreferrer" style="color:inherit">${U.esc(i.t)}</a>` : U.esc(i.t)}</h4>
        ${i.b ? `<p class="ic-sum">${U.esc(i.b)}</p>` : ''}
        <div class="chip-row">${i.entities.slice(0, 5).map(e =>
          `<button class="tag" data-tag="${U.esc(e.tag)}">${U.esc(e.tag)}</button>`).join('')}</div>
        <div class="impact">
          <span class="senti-badge ${i.senti}">${i.senti === 'bull' ? '▲ BULLISH' : i.senti === 'bear' ? '▼ BEARISH' : '● NEUTRAL'}</span>
          <div class="impact-track"><i data-w="${i.impact}%"></i></div>
          <span class="impact-num provable" data-prov-impact="${i.id}" title="Click to see where this number comes from">${i.impact}</span>
          ${i.amountCr ? `<span class="amount-chip">${U.fmtCr(i.amountCr)}</span>` : ''}
        </div>
        <div class="ic-actions">
          <button class="link-btn mono" data-analyze="${i.id}"><svg class="ic"><use href="#i-spark"/></svg> JARVIS, ANALYZE</button>
        </div>
      </article>`;

    // Two genuinely different empty states. "No signals match / clear
    // filters" is a lie when the corpus itself is empty — it implies data
    // exists and a filter is hiding it. With nothing loaded, say that, and
    // point at the actual remedy.
    const corpusEmpty = Engine.items.length === 0;
    document.getElementById('intelList').innerHTML = shown.map(card).join('') || (corpusEmpty
      ? `<div class="empty-state glass" style="padding:40px;text-align:center">
        <p style="font-size:1.05rem;margin-bottom:6px">No real wires loaded yet, Sir.</p>
        <p style="color:var(--txt-3);font-size:.82rem;max-width:46ch;margin:0 auto 14px">
          This screen stays empty rather than showing invented headlines. Live news is
          fetched automatically at startup — if nothing arrived, the uplink is unreachable.
          Run <code>node relay.js</code> for the reliable path.
        </p>
        <button class="btn" id="btnEmptyFetch">FETCH LIVE NEWS</button>
      </div>`
      : `<div class="empty-state glass" style="padding:40px">
        <p>No signals match, Sir.</p>
        <button class="btn btn-ghost" data-clear-filters>CLEAR FILTERS</button>
      </div>`);
    const emptyFetch = document.getElementById('btnEmptyFetch');
    if (emptyFetch) emptyFetch.addEventListener('click', () => this.fetchLive());

    // ORD-1701: filtered items stay auditable in a collapsible quarantine list,
    // never silently dropped — filters must be checkable (Art. 5/6).
    let qBox = document.getElementById('intelQuarantine');
    if (quarantined.length){
      const rows = quarantined.map(i => `<div class="story-item"><span class="mono">${i.hypeScore}/100</span>${U.esc(i.t.slice(0, 110))}</div>`).join('');
      qBox.hidden = false;
      qBox.innerHTML = `<summary>⚠ HYPE QUARANTINE — ${quarantined.length} signal${quarantined.length>1?'s':''} filtered (manufacture-shaped profile)</summary>
        <div class="pc-story">${rows}</div>`;
    } else if (qBox) {
      qBox.hidden = true; qBox.innerHTML = '';
    }

    FX.observeReveals(document.getElementById('intelList'));
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.querySelectorAll('#intelList .impact-track i').forEach(f => f.style.width = f.dataset.w)));
  },

  analyzeItem(id){
    const i = Engine.items.find(x => x.id === id);
    if (!i) return;
    let out = `Analysis of: <b>${U.esc(i.t.slice(0, 110))}</b>\n`;
    out += `▸ Read: <b>${i.senti === 'bull' ? 'bullish' : i.senti === 'bear' ? 'bearish' : 'neutral'}</b> · impact ${i.impact}/100 · source: ${U.esc(i.s)}\n`;
    if (i.entities.length) out += `▸ Entities: ${i.entities.map(e => e.tag).slice(0, 6).join(', ')}\n`;
    if (i.amountCr) out += `▸ Disclosed capital: <span class="hl-gold">${U.fmtCr(i.amountCr)}</span>${i.flow ? ' flowing ' + JDATA.FLOW_SOURCES[i.flow.from].label + ' → ' + (JDATA.SECTORS[i.flow.to]?.label || i.flow.to) : ''}\n`;
    const cluster = Engine.clusters.find(c => i.sectors.includes(c.sector));
    if (cluster) out += `▸ Feeds pattern: <b>${U.esc(cluster.name)}</b> (momentum ${cluster.score}/100)\n`;
    const sec = i.sectors[0];
    if (sec && JDATA.SECTORS[sec]) out += `▸ Research names: ${U.esc(JDATA.SECTORS[sec].watch.slice(0, 3).join(', '))} — verify fundamentals first, Sir.`;
    Jarvis.say(out);
  },

  async fetchLive(){
    const btn = document.getElementById('btnLive');
    if (btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    const label = btn.querySelector('span');
    const old = label.textContent;
    label.textContent = 'UPLINKING…';
    try {
      const raw = await Live.fetch(msg => { label.textContent = msg.toUpperCase().slice(0, 18); });
      // dropSimulated: a live uplink RETIRES the invented demo corpus. Once
      // real wires exist there is no honest reason for fabricated headlines
      // to keep voting in momentum, corroboration and conviction maths.
      const added = Engine.ingest(raw, { dropSimulated: true }); // emits 'data:updated' itself when it finds fresh items — the Bus.on in init() handles the re-render
      this.mode = 'live';
      const chip = document.getElementById('modeChip');
      chip.textContent = 'LIVE FEED'; chip.classList.add('live');
      chip.title = Live._relayUp ? 'Live via local relay (jarvis/relay.js)' : 'Live via public CORS proxies (start the relay for reliability)';
      this.toast(`Uplink complete — ${added} new signals ingested`, 'ok');
      Jarvis.say(`Uplink complete, Sir. <b>${added} fresh signals</b> ingested and folded into the pattern engine. ${added ? 'Patterns and flows have been recomputed.' : 'Nothing new on the wires — the board stands.'}`, { speak: false });
    } catch(e){
      this.toast('Live uplink unreachable — running simulation feed', 'err');
      Jarvis.say('The live relays are unreachable from this network, Sir. I shall continue on the simulation feed — the analysis pipeline is identical.', { speak: false });
    } finally {
      btn.classList.remove('loading');
      label.textContent = old;
    }
  },

  /* ================= PATTERNS ================= */
  /** ORD-203: momentum vs the same sector 1 day / 7 days ago, once the
   *  archive has that history — empty string (not a fake 0%) until it does. */
  patternDelta(c){
    const todayImpact = c.items.reduce((s, i) => s + i.impact, 0);
    const y = Store.sectorImpactDaysAgo(c.sector, 1);
    if (y === null || y <= 0) return '';
    const pct = Math.round(100 * (todayImpact - y) / y);
    if (!isFinite(pct) || pct === 0) return '';
    return `<span class="kpi-sub ${pct > 0 ? 'up' : 'dn'}" style="margin-left:10px" title="vs the same sector yesterday">${pct > 0 ? '▲ +' : '▼ '}${pct}% vs yesterday</span>`;
  },

  /* ================= CROSS-CURRENTS (Sprint 6) ================= */
  /** ORD-6xx (Session #12 UX language, Article 5): disagreement inside a
   *  sector is shown as a split bar, never averaged into one sentiment
   *  number. Picks the sector with the strongest genuine tug-of-war
   *  (highest min(bull, bear)), not just the busiest sector. */
  renderCrossCurrents(){
    const panel = document.getElementById('crossCurrentPanel');
    const contested = Engine.clusters
      .filter(c => c.bull > 0 && c.bear > 0)
      .sort((a, b) => Math.min(b.bull, b.bear) - Math.min(a.bull, a.bear))[0];

    if (!contested){ panel.hidden = true; return; }
    panel.hidden = false;
    const total = contested.bull + contested.neut + contested.bear;
    document.getElementById('crossCurrentBody').innerHTML = `
      <div class="crosscurrent-label"><span>${U.esc(contested.label)}</span><span>${contested.bull} BULL · ${contested.neut} NEUT · ${contested.bear} BEAR</span></div>
      <div class="crosscurrent-bar" role="img" aria-label="${contested.bull} bullish, ${contested.neut} neutral, ${contested.bear} bearish signals in ${U.esc(contested.label)}">
        <i class="b" style="flex:${contested.bull}"></i><i class="n" style="flex:${contested.neut}"></i><i class="r" style="flex:${contested.bear}"></i>
      </div>
      <p class="crosscurrent-note">This sector's coverage is genuinely split — ${Math.round(100*contested.bull/total)}% bullish and ${Math.round(100*contested.bear/total)}% bearish signals are both active at once. That disagreement is the finding; it is not averaged into a single neutral read.</p>`;
  },

  /* ================= ANOMALY SONAR (Sprint 9) ================= */
  renderSonar(){
    const body = document.getElementById('sonarBody');
    const spikeResult = Sonar.termSpikes(Engine.items);
    const pumpFlags = Sonar.pumpDumpGuard(Engine.items);

    let html = '';
    if (!spikeResult.ready){
      html += `<p class="empty-state">Term-frequency baseline needs ${Sonar.BASELINE_MIN_DAYS} days of history — ${spikeResult.daysAvailable} so far. Check back as the archive accumulates.</p>`;
    } else if (!spikeResult.spikes.length){
      html += `<p class="empty-state">No term-frequency spikes today (baseline: ${spikeResult.daysAvailable} prior days).</p>`;
    } else {
      html += spikeResult.spikes.slice(0, 5).map(s => `
        <div class="alert-row warn">
          <svg class="ic"><use href="#i-alert"/></svg>
          <span>"<b>${U.esc(s.term)}</b>" mentioned ${s.today}× today vs a ${s.borrowed ? 'borrowed (cold-start)' : 'own'} baseline of ${s.median} ± ${s.mad} MAD (${spikeResult.daysAvailable}-day median/MAD)${s.borrowed ? ' — never mentioned before today, so this uses a conservative baseline borrowed from other terms' : ''}</span>
        </div>`).join('');
    }

    if (pumpFlags.length){
      html += pumpFlags.map(f => `
        <div class="alert-row critical">
          <svg class="ic"><use href="#i-alert"/></svg>
          <span>${U.esc(f.label)} — ${f.reason === 'coordinated-low-tier-burst'
            ? `"confirmed" by ${f.count} sources, none tiered (official/wire)`
            : `${f.count} mentions within ${Sonar.PUMP_VELOCITY_WINDOW_H}h — coordinated-burst velocity`}</span>
        </div>`).join('');
    }

    body.innerHTML = html || '<p class="empty-state">Nothing flagged this session.</p>';
  },

  /* ================= CAUSAL GRAPH (Sprint 14) ================= */
  /** Static data render — Session #3's edge list loaded as-is, not yet
   *  propagated into scenario stress cards (explicitly deferred). */
  renderCausalGraph(){
    const edges = JDATA.CAUSAL_EDGES;
    document.getElementById('causalCountTag').textContent = `${edges.length} EDGES`;
    document.getElementById('causalBody').innerHTML = edges.map(e => `
      <tr>
        <td>${U.esc(e.from)}</td>
        <td>${U.esc(e.to)}</td>
        <td><span class="causal-sign ${e.sign > 0 ? 'pos' : 'neg'}">${e.sign > 0 ? '+' : '−'}</span></td>
        <td class="num">${e.lagDays}d</td>
        <td class="why">${U.esc(e.why)}</td>
      </tr>`).join('');

    // scenario dropdown (populated once; re-render leaves current selection intact)
    const sel = document.getElementById('scenarioSelect');
    if (sel && !sel.options.length){
      sel.innerHTML = Scenario.catalog().map(c => `<option value="${U.esc(c.label)}">${U.esc(c.label)} (${c.count})</option>`).join('');
    }
  },

  /* ================= SCENARIO STRESS CARDS (causal-graph propagation) ================= */
  wireScenario(){
    document.getElementById('btnRunScenario').addEventListener('click', () => {
      const shock = document.getElementById('scenarioSelect').value;
      if (shock) this.renderScenario(shock);
    });
  },

  /** @param {string} shock canonical shock label */
  renderScenario(shock){
    const rows = Scenario.propagate(shock);
    const imp = Scenario.portfolioImpact(rows);
    const box = document.getElementById('scenarioResult');

    let summary = `<div class="scenario-summary"><b>${U.esc(shock)}</b> → ${rows.length} affected sector${rows.length === 1 ? '' : 's'}, single-step propagation. `;
    if (imp.anyExposure){
      const bits = [];
      if (imp.helped.length) bits.push(`<span class="green">${U.fmtCompact(imp.helpedCr)} helped</span>`);
      if (imp.hurt.length) bits.push(`<span class="red">${U.fmtCompact(imp.hurtCr)} hurt</span>`);
      summary += `Your book: ${bits.join(' · ')}. Direction only — the edges carry no magnitude.`;
    } else {
      summary += `None of your holdings map to the affected sectors.`;
    }
    summary += `</div>`;

    const cards = rows.map(r => {
      const cls = r.sign > 0 ? 'pos' : 'neg';
      return `<div class="scenario-card ${cls}">
        <div class="sc-head"><span class="sc-to">${U.esc(r.to)}</span><span class="sc-dir">${r.sign > 0 ? '▲ favours' : '▼ pressures'}</span></div>
        <div class="sc-lag">~${r.lagDays}d lag${r.sectorKey ? '' : ' · no held sector'}</div>
        <div class="sc-why">${U.esc(r.why)}</div>
        ${r.exposure > 0 ? `<div class="sc-held">Your ${U.esc(r.held.map(h => h.name).join(', '))}: ${U.fmtCompact(r.exposure)}</div>` : ''}
      </div>`;
    }).join('');

    box.innerHTML = summary + `<div class="scenario-cards">${cards}</div>`;
  },

  renderPatterns(){
    this.renderCrossCurrents();
    this.renderSonar();
    this.renderCausalGraph();
    const box = document.getElementById('patternList');
    box.innerHTML = Engine.clusters.map((c, n) => `
      <article class="pattern-card glass tilt sheen reveal" style="--d:${n*70}ms">
        <div class="pc-head">
          <h4>${U.esc(c.name)}</h4>
          <span class="momentum"><span class="bars"><i></i><i></i><i></i><i></i></span>${c.score}/100</span>${this.patternDelta(c)}
        </div>
        <canvas class="pc-net" id="net-${c.sector}" role="img" aria-label="Entity network for ${U.esc(c.label)}"></canvas>
        <p class="pc-narrative">${U.esc(c.narrative)}</p>
        <div class="senti-mix" title="${c.bull} bullish · ${c.neut} neutral · ${c.bear} bearish" role="img"
          aria-label="${c.bull} bullish, ${c.neut} neutral, ${c.bear} bearish signals">
          <i class="b" style="flex:${c.bull}"></i><i class="n" style="flex:${c.neut}"></i><i class="r" style="flex:${c.bear}"></i>
        </div>
        <div class="pc-story">
          ${c.items.slice(0, 4).map(i => `<div class="story-item"><span class="mono">${U.ago(i.h)}</span>${U.esc(i.t.slice(0, 95))}</div>`).join('')}
        </div>
        <div class="idea-foot">
          <span class="tag">${U.esc(c.label)}</span>
          ${c.topTag ? `<span class="tag">${U.esc(c.topTag)}</span>` : ''}
          <span class="tag">${c.sources} sources</span>
          <button class="link-btn mono" data-goto="ideas" style="margin-left:auto">SEE THESIS <svg class="ic"><use href="#i-chev"/></svg></button>
        </div>
      </article>`).join('') || '<p class="empty-state glass" style="padding:40px">No patterns yet — need at least 2 signals per sector.</p>';

    // networks after layout (skip when view is off screen)
    if (this.view !== 'patterns'){ FX.observeReveals(box); return; }
    requestAnimationFrame(() => {
      if (this.view !== 'patterns') return; // ORD-902a: view may have changed before this frame fired
      Engine.clusters.forEach(c => {
        const canvas = document.getElementById('net-' + c.sector);
        if (!canvas) return;
        const tags = {};
        c.items.forEach(i => i.entities.forEach(e => { if (e.tag !== JDATA.SECTORS[c.sector]?.label) tags[e.tag] = (tags[e.tag]||0)+1; }));
        const top = Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0, 6);
        const maxW = Math.max(1, ...top.map(t => t[1]));
        const nodes = [{ id:'hub', label: c.label, type:'hub' },
          ...top.map(([tag, w]) => ({ id: tag, label: tag, type: JDATA.KEYWORDS.find(k => k.tag === tag && k.sector) ? 'sector' : 'macro', w: w/maxW }))];
        const edges = top.map((_, i) => [0, i+1]);
        // light cross-links
        for (let i = 1; i < nodes.length - 1; i += 2) edges.push([i, i+1]);
        this._stops.push(Charts.network(canvas, nodes, edges));
      });
    });
    FX.observeReveals(box);
  },

  /* ================= FLOWS ================= */
  renderFlows(){
    const sectors = Engine.flowBySector();
    const sources = Engine.flowBySource();
    const total = Engine.totalTracked(); // magnitude KPI (see DECISIONS.md) — always >= 0

    // ORD-302: per-sector/source aggregates are now NET signed values, so a
    // stat here can legitimately be negative (net outflow) — render with a
    // "-" prefix on the magnitude rather than feeding fmtCr a negative number.
    const fmtSigned = v => (v < 0 ? '-' : '') + U.fmtCr(Math.abs(v));
    const stats = [
      { label:'TOTAL TRACKED', icon:'i-flow', value: total, fmt: v => U.fmtCr(v), sub: `${Engine.flows.length} disclosed flows` },
      { label:'GOVERNMENT', icon:'i-bank', value: sources.find(s => s.key === 'gov')?.total || 0, fmt: fmtSigned, sub:'budgets · schemes · orders' },
      { label:'FOREIGN CAPITAL', icon:'i-globe', value: sources.find(s => s.key === 'foreign')?.total || 0, fmt: fmtSigned, sub:'FII · MNC capex · subsidies' },
      { label:'TOP MAGNET', icon:'i-target', value: sectors[0]?.total || 0, fmt: fmtSigned, sub: sectors[0]?.label || '—' }
    ];
    document.getElementById('flowStats').innerHTML = stats.map((k, i) => `
      <div class="kpi glass tilt sheen reveal" style="--d:${i*70}ms">
        <span class="kpi-label"><svg class="ic"><use href="#${k.icon}"/></svg>${k.label}</span>
        <span class="kpi-value" id="fkV${i}">0</span>
        <span class="kpi-sub">${U.esc(k.sub)}</span>
      </div>`).join('');
    stats.forEach((k, i) => FX.countUp(document.getElementById('fkV' + i), k.value, { fmt: k.fmt }));

    this.renderFlowBars(document.getElementById('flowChart'), 8);

    // donut of sources (ORD-106: explicit empty state instead of a blank ring)
    // — magnitude only; a pie slice can't be negative, so this reads as
    // "how much activity", same convention as totalTracked().
    const segs = sources.map(s => ({ label: s.label, value: Math.abs(s.total), color: s.hex, fmt: fmtSigned(s.total) }));
    const donut = document.getElementById('flowDonut');
    if (segs.length){
      requestAnimationFrame(() => Charts.donut(donut, segs, { name:'Capital sources' }));
      document.getElementById('flowDonutCenter').innerHTML = `<b>${U.fmtCr(total)}</b><span>IN MOTION</span>`;
      document.getElementById('flowDonutLegend').innerHTML = segs.map(s =>
        `<span class="li"><i class="swatch" style="--sw:${s.color}"></i>${U.esc(s.label)} <span class="lv">${s.fmt}</span></span>`).join('');
    } else {
      const { ctx, w, h } = Charts.size(donut); ctx.clearRect(0, 0, w, h);
      document.getElementById('flowDonutCenter').innerHTML = `<span>NO FLOWS YET</span>`;
      document.getElementById('flowDonutLegend').innerHTML = '';
    }

    // ledger table — ORD-302: outflows render red with a "-" prefix; ORD-901:
    // deduped-from-N reports get a small note instead of silently vanishing.
    document.getElementById('flowTableBody').innerHTML = Engine.flows.slice(0, 14).map(f => `
      <tr>
        <td><span class="src-cell"><i class="src-dot" style="--sw:${JDATA.FLOW_SOURCES[f.from].hex}"></i>${JDATA.FLOW_SOURCES[f.from].label}</span></td>
        <td><b>${U.esc(JDATA.SECTORS[f.to]?.label || f.to)}</b></td>
        <td class="num" style="color:${f.amountCr < 0 ? 'var(--red)' : 'var(--gold)'}">${f.amountCr < 0 ? '-' : ''}${U.fmtCr(Math.abs(f.amountCr))}</td>
        <td style="max-width:420px">${U.esc(f.title.slice(0, 90))}${f.title.length > 90 ? '…' : ''}${f.dedupedFrom > 1 ? ` <span class="mono" style="color:var(--txt-3);font-size:.68rem">· deduped from ${f.dedupedFrom} reports</span>` : ''}</td>
      </tr>`).join('');
    document.getElementById('flowRateNote').textContent = `ASSUMED FX: $1 = ₹${Engine.USD_INR} · EDIT IN SETTINGS`;

    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.querySelectorAll('#view-flows .fbar-fill').forEach(f => f.style.width = f.dataset.w)));
    FX.observeReveals(document.getElementById('view-flows'));
  },

  /* ================= IDEAS ================= */
  /* ================= MIRROR: PREDICTION BOOK + JOURNAL (Sprint 6 skeleton, Sprint 11 full build) ================= */
  wireMirror(){
    document.getElementById('btnNewPrediction').addEventListener('click', () => this.openNewPrediction());
    document.getElementById('btnNewJournal').addEventListener('click', () => this.openNewJournal());
    document.getElementById('predictionsList').addEventListener('click', e => {
      const btn = e.target.closest('[data-resolve]');
      if (!btn) return;
      Mirror.resolvePrediction(btn.dataset.resolve, btn.dataset.outcome === '1');
      this.renderPredictions();
      this.toast('Prediction resolved, Sir', 'ok');
    });
    this.renderPredictions();
    this.renderJournal();
  },

  renderPredictions(){
    const list = Mirror.loadPredictions();
    const open = list.filter(p => !p.resolved).sort((a, b) => String(a.resolveBy).localeCompare(String(b.resolveBy)));
    const brier = Mirror.brierScore(list);

    const brierEl = document.getElementById('brierSummary');
    brierEl.innerHTML = brier.ready
      ? `<span class="provable" data-prov-brier title="Click to see where this number comes from">Brier score: ${brier.score}</span> (N=${brier.n} resolved) — 0.25 is the "always 50/50" baseline to beat, not zero.`
      : `${brier.n} resolved prediction${brier.n === 1 ? '' : 's'} — need ${Mirror.BRIER_MIN_N} to show a Brier score.`;
    brierEl.onclick = e => { if (e.target.closest('[data-prov-brier]')) this.openProvenance('brier', Mirror.brierScore(Mirror.loadPredictions())); };

    const today = U.todayKey();
    document.getElementById('predictionsList').innerHTML = open.length ? open.map(p => {
      const overdue = String(p.resolveBy) < today;
      return `
      <div class="mini-row" style="cursor:default${overdue ? ';border-color:rgba(255,209,102,.4)' : ''}">
        <div class="mr-main">
          <div class="mr-title">${U.esc(p.title)}</div>
          <div class="mr-sub">${p.probability}% probability · due ${U.esc(p.resolveBy)}${overdue ? ' · <span style="color:var(--gold)">OVERDUE</span>' : ''}</div>
        </div>
        <div class="mr-side">
          ${overdue
            ? `<button class="btn btn-ghost" data-resolve="${p.id}" data-outcome="1" style="margin-bottom:4px;padding:5px 10px">YES</button>
               <button class="btn btn-ghost" data-resolve="${p.id}" data-outcome="0" style="padding:5px 10px">NO</button>`
            : `<span class="mono" style="color:var(--txt-3)">OPEN</span>`}
        </div>
      </div>`;
    }).join('') : '<p class="empty-state">No open predictions — add one above.</p>';
  },

  renderJournal(){
    const list = [...Mirror.loadJournal()].sort((a, b) => b.createdAt - a.createdAt);
    document.getElementById('journalList').innerHTML = list.length ? list.map(e => `
      <div class="mini-row" style="cursor:default">
        <div class="mr-main">
          <div class="mr-sub">${new Date(e.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
          <div class="mr-title" style="margin-top:4px;font-weight:400;font-size:.86rem">${U.esc(e.text)}</div>
        </div>
      </div>`).join('') : '<p class="empty-state">No journal entries yet — add one above.</p>';
  },

  openNewPrediction(){
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>NEW PREDICTION</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <form id="fPred">
        <div class="field"><label>What are you predicting? <input required id="pTitle" placeholder="e.g. Defence beats index by 12% by EOY" maxlength="140"></label></div>
        <div class="field-row">
          <div class="field"><label>Probability (%) <input required id="pProb" type="number" min="1" max="99" step="1" placeholder="70"></label></div>
          <div class="field"><label>Resolve by <input required id="pDate" type="date"></label></div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>CANCEL</button>
          <button type="submit" class="btn btn-primary">LOG PREDICTION</button>
        </div>
      </form>`);
    root.querySelector('#pTitle').focus();
    root.querySelector('#fPred').addEventListener('submit', e => {
      e.preventDefault();
      const g = id => root.querySelector(id);
      Mirror.addPrediction({ title: g('#pTitle').value.trim(), probability: +g('#pProb').value, resolveBy: g('#pDate').value });
      close();
      this.renderPredictions();
      this.toast('Prediction logged, Sir', 'ok');
    });
  },

  openNewJournal(){
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>NEW JOURNAL ENTRY</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <form id="fJournal">
        <div class="field"><label>What's the thinking behind this decision? <textarea required id="jText" rows="5" maxlength="2000" style="width:100%;resize:vertical"></textarea></label></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>CANCEL</button>
          <button type="submit" class="btn btn-primary">SAVE ENTRY</button>
        </div>
      </form>`);
    root.querySelector('#jText').focus();
    root.querySelector('#fJournal').addEventListener('submit', e => {
      e.preventDefault();
      Mirror.addJournalEntry({ text: root.querySelector('#jText').value.trim() });
      close();
      this.renderJournal();
      this.toast('Journal entry saved, Sir', 'ok');
    });
  },

  renderIdeas(){
    // watchlist strip
    const strip = document.getElementById('watchStrip');
    const wl = Portfolio.state.watchlist;
    strip.hidden = !wl.length;
    document.getElementById('watchChips').innerHTML = wl.map(w =>
      `<button class="chip" data-unwatch="${U.esc(w)}" title="Remove from watchlist">${U.esc(w)} ✕</button>`).join('');
    this.renderPredictions();
    this.renderJournal();

    const grid = document.getElementById('ideaGrid');
    grid.innerHTML = Engine.ideas.map((idea, n) => `
      <article class="idea-card glass tilt sheen reveal" style="--d:${n*70}ms">
        <div class="idea-head">
          <div>
            <h4>${U.esc(idea.title)}</h4>
            <div class="chip-row" style="margin-top:8px">
              <span class="horizon">◔ ${idea.horizon}</span>
              <span class="tag">${U.esc(idea.clusterName)}</span>
            </div>
          </div>
          <div class="conv-ring" data-p="${idea.conviction}" role="img" aria-label="Conviction ${idea.conviction} percent">
            <b class="provable" data-prov-conviction="${n}" title="Click to see where this number comes from">${idea.conviction}%</b><span>CONVICTION</span>
          </div>
        </div>
        <p class="idea-thesis">${U.esc(idea.thesis)}</p>
        <div class="idea-sec">
          <h5><svg class="ic"><use href="#i-spark"/></svg>CATALYSTS IN THE FEED</h5>
          <ul>${idea.catalysts.map(c => `<li>${U.esc(c.slice(0, 110))}</li>`).join('')}</ul>
        </div>
        <div class="idea-sec risk">
          <h5><svg class="ic" style="color:var(--red)"><use href="#i-alert"/></svg>RISK REGISTER</h5>
          <ul>${idea.risks.map(r => `<li>${U.esc(r)}</li>`).join('')}</ul>
        </div>
        <div class="idea-foot">
          ${idea.watch.slice(0, 4).map(w => `<button class="tag" data-watch="${U.esc(w)}" title="Add to watchlist">+ ${U.esc(w)}</button>`).join('')}
        </div>
      </article>`).join('');

    // animate conviction rings
    requestAnimationFrame(() => {
      grid.querySelectorAll('.conv-ring').forEach(ring => {
        const target = +ring.dataset.p;
        if (FX.reduced){ ring.style.setProperty('--p', target); return; }
        let p = 0;
        const step = () => { p = Math.min(target, p + 2.2); ring.style.setProperty('--p', p); if (p < target) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    });

    grid.onclick = e => {
      const pr = e.target.closest('[data-prov-conviction]');
      if (pr){ const idea = Engine.ideas[+pr.dataset.provConviction]; if (idea) this.openProvenance('conviction', idea); }
      const w = e.target.closest('[data-watch]');
      if (w){
        const added = Portfolio.toggleWatch(w.dataset.watch);
        this.toast(added ? `${w.dataset.watch} added to watchlist` : `${w.dataset.watch} removed`, 'ok');
        if (added && FX.enabled) FX.confetti(24);
        this.renderIdeas();
      }
    };
    document.getElementById('watchChips').onclick = e => {
      const c = e.target.closest('[data-unwatch]');
      if (c){ Portfolio.toggleWatch(c.dataset.unwatch); this.renderIdeas(); }
    };
    FX.observeReveals(grid);
  },

  /* ================= DEMO DATA (Sprint 13) ================= */
  /** Loads the frozen demo portfolio + demo ledger (JDATA.DEMO_BOOK /
   *  JDATA.DEMO_LEDGER) — the news feed is already the simulated
   *  JDATA.FEED by default, so nothing extra is needed there. Used by
   *  both the manual "LOAD DEMO BOOK" button and the `?demo=true` URL
   *  param at boot. */
  loadDemoData(){
    Portfolio.loadDemo();
    Schema.save(Ledger.KEY, Ledger.VERSION, JDATA.DEMO_LEDGER.map(e => ({ ...e, importedAt: Date.now() })));
    this.renderPortfolio();
  },

  /** Is this an explicit demo session? The ONLY thing that may put
   *  fabricated signals on screen. Read at boot (before any await) so the
   *  very first paint is already honest — there is no window in which
   *  invented headlines are shown to someone who did not ask for them. */
  demoRequested(){
    try { return new URLSearchParams(location.search).get('demo') === 'true'; }
    catch(e){ return false; }
  },

  /** `?demo=true` at boot: stages the demo data automatically. Confirms
   *  first if real data already exists — this must never silently
   *  overwrite a user's actual portfolio/ledger just because a link
   *  happened to carry that query param. */
  async maybeLoadDemoFromUrl(){
    if (new URLSearchParams(location.search).get('demo') !== 'true') return;
    const hasRealData = Portfolio.state.holdings.length > 0 || Ledger.load().length > 0;
    if (hasRealData){
      const ok = await this.confirm('This link requests staged demo data. Load it? This will replace your current portfolio and trade ledger.', { confirmLabel:'LOAD DEMO DATA' });
      if (!ok) return;
    }
    this.loadDemoData();
    this.toast('Staged demo data loaded — 8 holdings, 7 ledger events', 'ok');
  },

  /** Sprint 16 hardening, Threat Model Boundary 1: a browser extension
   *  with "read/write on all sites" can read every localStorage key this
   *  app writes — no client-side encryption meaningfully changes that
   *  (the decryption key would need to live somewhere the same extension
   *  can also read). The only real mitigation is a dedicated, extension-
   *  free browser profile, so it's surfaced here once rather than left
   *  as a line in a doc nobody reads. Marked seen the moment it's shown,
   *  not on a specific dismiss action — this is informational, not a
   *  gate, so there's no "right way" to close it that matters. */
  notifyBrowserProfile(){
    if (this.settings.seenBrowserProfileNotice) return;
    this.settings.seenBrowserProfileNotice = true;
    this.saveSettings();
    this.modal(`
      <div class="modal-head"><h3>A NOTE ON PRIVACY</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <p class="review-line">JARVIS stores your portfolio, trades, and journal in this browser's local storage. Any browser extension granted "read/write on all sites" can read that data — this isn't specific to JARVIS, it's how browser extensions work everywhere.</p>
      <p class="review-line">Recommended: use a dedicated, extension-free browser profile for JARVIS. It costs nothing and closes the one privacy boundary this tool can't close on its own. See THREAT-MODEL.md, Boundary 1.</p>
      <div class="modal-foot"><button type="button" class="btn btn-primary" data-close>GOT IT</button></div>`);
  },

  /* ================= PROVENANCE DRILL-DOWN (Sprint 17) ================= */
  /** Constitution Article 6, made clickable: opens a modal showing the
   *  formula, the real inputs that produced it, and any caveat — for
   *  whichever number the user clicked. @param {string} type @param {any} data */
  openProvenance(type, data){
    const p = Provenance.compute(type, data);
    if (!p) return;
    this.modal(`
      <div class="modal-head"><h3>WHERE THIS NUMBER COMES FROM</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="prov-formula">${U.esc(p.formula)}</div>
      <div>${p.inputs.map(i => `<div class="prov-row"><span class="prov-label">${U.esc(i.label)}</span><span class="prov-value">${U.esc(String(i.value))}</span></div>`).join('')}</div>
      ${p.note ? `<p class="crosscurrent-note" style="margin-top:12px">${U.esc(p.note)}</p>` : ''}`);
  },

  /* ================= TOUR MODE (Sprint 17) ================= */
  /** Hardcoded, scripted walkthrough — deliberately not user-paced
   *  (that's the "interactive tour" optional extension, deferred).
   *  Loads Sprint 13's staged demo data if the book is empty, so the
   *  tour always has something real to show rather than an empty
   *  state. Can be exited at any point — never traps the user
   *  (Article 13, same principle as the Sunday review's "blocking"
   *  screens). */
  TOUR_STEPS: [
    { view: 'command', say: 'Welcome to the Command Center, Sir — the situation room. Sector radar, capital flows, and top patterns at a glance.' },
    { view: 'intel', say: 'The Intel Feed — every signal ranked by impact, graded A through D for evidence quality. Click any impact number to see exactly how it was computed.' },
    { view: 'patterns', say: 'Patterns connects the dots — corroborated clusters, cross-currents where coverage genuinely disagrees, an anomaly sonar, and the causal graph behind it all.' },
    { view: 'flows', say: 'Money Flow traces every disclosed rupee from source to destination.' },
    { view: 'ideas', say: 'Ideas Lab drafts research theses from the patterns — plus your own prediction book, with a real Brier score once you have resolved enough calls, and a journal.' },
    { view: 'portfolio', say: 'And My Money keeps the books — holdings, a real ledger-derived XIRR, goals, tax estimates, and a counterfactual against Nifty. That concludes the tour, Sir.' }
  ],
  TOUR_STEP_MS: 5000,

  async startTour(){
    if (this._touring) return;
    this._touring = true;
    document.getElementById('tourBar').hidden = false;
    if (!Portfolio.state.holdings.length && !Ledger.load().length) this.loadDemoData();
    this.openChat();
    for (const step of this.TOUR_STEPS){
      if (!this._touring) break;
      this.gotoView(step.view);
      Jarvis.say(step.say, { speak: false });
      await new Promise(r => setTimeout(r, this.TOUR_STEP_MS));
    }
    this._touring = false;
    document.getElementById('tourBar').hidden = true;
  },

  stopTour(){ this._touring = false; document.getElementById('tourBar').hidden = true; },

  /* ================= PORTFOLIO ================= */
  wirePortfolio(){
    document.getElementById('btnAddHolding').addEventListener('click', () => this.openAddHolding());
    document.getElementById('btnDemoPf').addEventListener('click', () => {
      this.loadDemoData();
      this.toast('Demo book loaded — 8 holdings, 7 ledger events', 'ok');
    });

    // ================= LEDGER IMPORT (Sprint 7) =================
    document.getElementById('btnImportLedger').addEventListener('click', () => document.getElementById('ledgerFileInput').click());
    document.getElementById('ledgerFileInput').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const statusEl = document.getElementById('ledgerImportStatus');
      try {
        const text = await file.text();
        const { imported, duplicates, skipped } = Ledger.importZerodhaCsv(text);
        statusEl.textContent = `${imported} imported${duplicates ? `, ${duplicates} already in ledger` : ''}${skipped ? `, ${skipped} rows unrecognised` : ''}`;
        this.toast(`Ledger import complete — ${imported} new trade${imported===1?'':'s'}`, imported ? 'ok' : 'err');
        this.renderPortfolio();
      } catch(err){
        statusEl.textContent = '';
        this.toast(err.message || 'Could not parse that CSV', 'err');
      }
    });

    // ================= EOD QUOTES + COUNTERFACTUAL (Sprint 12) =================
    document.getElementById('btnImportBhavcopy').addEventListener('click', () => document.getElementById('bhavcopyFileInput').click());
    document.getElementById('bhavcopyFileInput').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const { date, symbolsImported } = Quotes.importBhavcopy(text);
        const applied = Quotes.applyToPortfolio();
        this.toast(`EOD import complete — ${symbolsImported} symbols, ${applied.matched} holding${applied.matched===1?'':'s'} marked`, 'ok');
        this.renderPortfolio();
        this.renderCounterfactual();
      } catch(err){
        this.toast(err.message || 'Could not parse that bhavcopy CSV', 'err');
      }
    });

    document.getElementById('btnSyncLivePrices').addEventListener('click', async () => {
      const btn = document.getElementById('btnSyncLivePrices');
      const statusEl = document.getElementById('livePriceStatus');
      btn.disabled = true;
      statusEl.textContent = 'Syncing live quotes…';
      try {
        const { ready, matched, unmatched } = await Quotes.syncLivePrices();
        if (!ready){
          statusEl.textContent = 'Live sync: relay not detected — run node relay.js for real-time quotes.';
          this.toast('Relay unreachable — live sync needs node relay.js running', 'err');
        } else {
          const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          statusEl.textContent = `Live sync: ${matched} holding${matched === 1 ? '' : 's'} updated as of ${stamp}` +
            (unmatched.length ? ` — ${unmatched.length} unmatched (${unmatched.slice(0, 3).map(U.esc).join(', ')}${unmatched.length > 3 ? '…' : ''})` : '');
          this.toast(`Live prices synced — ${matched} holding${matched === 1 ? '' : 's'} updated`, matched ? 'ok' : 'err');
          this.renderPortfolio();
        }
      } catch(err){
        statusEl.textContent = 'Live sync: relay not detected — run node relay.js for real-time quotes.';
        this.toast(err.message || 'Live sync failed', 'err');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnLogNifty').addEventListener('click', () => {
      const level = parseFloat(document.getElementById('niftyLevelInput').value);
      if (!isFinite(level) || level <= 0){ this.toast('Enter a valid Nifty level, Sir', 'err'); return; }
      Counterfactual.logLevel(level);
      document.getElementById('niftyLevelInput').value = '';
      this.toast('Nifty level logged', 'ok');
      this.renderCounterfactual();
    });

    // SIP sliders
    const amt = document.getElementById('sipAmt'), yrs = document.getElementById('sipYrs'), rate = document.getElementById('sipRate');
    const update = () => {
      const a = +amt.value, y = +yrs.value, r = +rate.value;
      [[amt], [yrs], [rate]].forEach(([el]) => el.style.setProperty('--fill', (100 * (el.value - el.min) / (el.max - el.min)) + '%'));
      document.getElementById('sipAmtOut').textContent = U.fmtINR(a);
      document.getElementById('sipYrsOut').textContent = String(y);
      document.getElementById('sipRateOut').textContent = r + '%';
      const { fv, invested, gain } = Portfolio.sipFV(a, y, r);
      document.getElementById('sipInvested').textContent = U.fmtCompact(invested);
      document.getElementById('sipFuture').textContent = U.fmtCompact(fv);
      document.getElementById('sipGain').textContent = '+' + U.fmtCompact(gain);
      Charts.sipArea(document.getElementById('sipChart'), a, y, r);
    };
    [amt, yrs, rate].forEach(el => el.addEventListener('input', update));
    this._sipUpdate = update;

    // budget
    const inc = document.getElementById('bIncome'), exp = document.getElementById('bExpense');
    const budget = () => {
      Portfolio.state.budget = { income: +inc.value || 0, expense: +exp.value || 0 };
      Portfolio.save();
      const { income, expense } = Portfolio.state.budget;
      const g = document.getElementById('savingsGauge'), l = document.getElementById('savingsLabel');
      if (income > 0){
        const rate = U.clamp(100 * (income - expense) / income, 0, 100);
        g.style.width = rate + '%';
        l.textContent = `Savings rate ${rate.toFixed(0)}% — ${rate >= 40 ? 'excellent. Wealth velocity engaged.' : rate >= 20 ? 'solid. Push toward 40% for acceleration.' : 'thin, Sir. Attack the expense line.'}`;
      } else { g.style.width = '0%'; l.textContent = 'Enter your cash flows, Sir.'; }
      this.renderInsights();
    };
    [inc, exp].forEach(el => el.addEventListener('change', budget));
    this._budgetUpdate = budget;

    document.getElementById('holdingsBody').addEventListener('click', async e => {
      const del = e.target.closest('[data-del]');
      if (!del) return;
      const ok = await this.confirm('Remove this holding from the ledger?', { confirmLabel:'REMOVE' });
      if (!ok) return;
      Portfolio.remove(del.dataset.del);
      this.renderPortfolio();
      this.toast('Holding removed', 'ok');
    });

    // ================= GOALS (Sprint 8) =================
    document.getElementById('btnAddGoal').addEventListener('click', () => this.openAddGoal());
    document.getElementById('goalsList').addEventListener('click', async e => {
      const edit = e.target.closest('[data-edit-goal]');
      if (edit){ this.openEditGoal(edit.dataset.editGoal); return; }
      const del = e.target.closest('[data-del-goal]');
      if (!del) return;
      const ok = await this.confirm('Remove this goal?', { confirmLabel:'REMOVE' });
      if (!ok) return;
      Goals.remove(del.dataset.delGoal);
      this.renderGoals();
      this.toast('Goal removed', 'ok');
    });

    // ================= TAX ESTIMATOR (Sprint 8) =================
    const taxSelect = document.getElementById('taxAssetClass');
    taxSelect.innerHTML = Object.entries(Tax.RATES).map(([k, r]) => `<option value="${k}">${U.esc(r.label)}</option>`).join('');
    document.getElementById('taxAsOfTag').textContent = Tax.AS_OF;
    document.getElementById('btnComputeTax').addEventListener('click', () => {
      const assetClass = taxSelect.value;
      const gain = parseFloat(document.getElementById('taxGain').value);
      const holdingMonths = parseFloat(document.getElementById('taxHoldingMonths').value);
      const resultEl = document.getElementById('taxResult');
      if (!isFinite(gain) || gain <= 0 || !isFinite(holdingMonths) || holdingMonths < 0){
        resultEl.textContent = 'Enter a positive gain and a holding period, Sir.';
        return;
      }
      const r = Tax.computeGain({ assetClass, gain, holdingMonths });
      if (!r){ resultEl.textContent = 'Could not estimate — check the inputs.'; return; }
      resultEl.innerHTML = r.slabTaxed
        ? `${r.bucket} — taxed at your income slab rate, not a flat rate. ${U.esc(r.note)}`
        : `${r.bucket} @ ${(r.rate*100).toFixed(1)}% → estimated tax <span class="hl-gold">${U.fmtINR(r.tax)}</span>`;
    });
  },

  /* ================= GOALS (Sprint 8) ================= */
  openAddGoal(){
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>NEW GOAL</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <form id="fGoal">
        <div class="field"><label>Goal name <input required id="gName" placeholder="e.g. Home down payment" maxlength="60"></label></div>
        <div class="field-row">
          <div class="field"><label>Current value ₹ <input required id="gCurrent" type="number" min="0" step="any" placeholder="200000"></label></div>
          <div class="field"><label>Target value ₹ <input required id="gTarget" type="number" min="0.01" step="any" placeholder="2000000"></label></div>
        </div>
        <div class="field"><label>Target date <input required id="gDate" type="date"></label></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>CANCEL</button>
          <button type="submit" class="btn btn-primary">SAVE GOAL</button>
        </div>
      </form>`);
    root.querySelector('#gName').focus();
    root.querySelector('#fGoal').addEventListener('submit', e => {
      e.preventDefault();
      const g = id => root.querySelector(id);
      Goals.add({
        name: g('#gName').value.trim(),
        currentValue: parseFloat(g('#gCurrent').value) || 0,
        targetValue: parseFloat(g('#gTarget').value),
        targetDate: g('#gDate').value
      });
      close();
      this.renderGoals();
      this.toast('Goal saved, Sir', 'ok');
    });
  },

  /** The missing half of Goals' CRUD (Sprint 8 explicitly deferred
   *  editing) — without this, tracking progress toward a goal meant
   *  deleting and re-adding it every update, losing createdAt each time.
   *  @param {string} id */
  openEditGoal(id){
    const goal = Goals.load().find(g => g.id === id);
    if (!goal) return;
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>UPDATE GOAL</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <form id="fGoalEdit">
        <div class="field"><label>Goal name <input required id="egName" placeholder="e.g. Home down payment" maxlength="60" value="${U.esc(goal.name)}"></label></div>
        <div class="field-row">
          <div class="field"><label>Current value ₹ <input required id="egCurrent" type="number" min="0" step="any" value="${goal.currentValue}"></label></div>
          <div class="field"><label>Target value ₹ <input required id="egTarget" type="number" min="0.01" step="any" value="${goal.targetValue}"></label></div>
        </div>
        <div class="field"><label>Target date <input required id="egDate" type="date" value="${U.esc(goal.targetDate)}"></label></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>CANCEL</button>
          <button type="submit" class="btn btn-primary">UPDATE GOAL</button>
        </div>
      </form>`);
    root.querySelector('#egCurrent').focus();
    root.querySelector('#fGoalEdit').addEventListener('submit', e => {
      e.preventDefault();
      const g = sel => root.querySelector(sel);
      Goals.update(id, {
        name: g('#egName').value.trim(),
        currentValue: parseFloat(g('#egCurrent').value) || 0,
        targetValue: parseFloat(g('#egTarget').value),
        targetDate: g('#egDate').value
      });
      close();
      this.renderGoals();
      this.toast('Goal updated, Sir', 'ok');
    });
  },

  renderGoals(){
    const list = Goals.load();
    document.getElementById('goalsList').innerHTML = list.length ? list.map(g => {
      const pct = Goals.progressPct(g);
      const months = Goals.monthsRemaining(g.targetDate);
      const monthsTxt = months === null ? '' : months === 0 ? 'due date passed' : `${months} month${months===1?'':'s'} left`;
      return `
      <div class="mini-row" style="cursor:default">
        <div class="mr-main">
          <div class="mr-title">${U.esc(g.name)}</div>
          <div class="mr-sub money">${U.fmtCompact(g.currentValue)} / ${U.fmtCompact(g.targetValue)} · ${monthsTxt}</div>
          <div class="impact-track" style="margin-top:6px"><i style="width:${pct}%"></i></div>
        </div>
        <div class="mr-side">
          <span class="mono" style="color:var(--cyan)">${pct}%</span>
          <button class="icon-btn" data-edit-goal="${g.id}" aria-label="Update progress" style="margin-top:4px"><svg class="ic"><use href="#i-refresh"/></svg></button>
          <button class="icon-btn" data-del-goal="${g.id}" aria-label="Remove goal" style="margin-top:4px"><svg class="ic"><use href="#i-x"/></svg></button>
        </div>
      </div>`;
    }).join('') : '<p class="empty-state">No goals yet — add one to track progress toward it.</p>';
  },

  openAddHolding(){
    const { root, close } = this.modal(`
      <div class="modal-head"><h3>NEW LEDGER ENTRY</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <form id="fAdd">
        <div class="field"><label>Asset name <input required id="fName" placeholder="e.g. HDFC Bank" maxlength="40"></label></div>
        <div class="field"><label>Asset class
          <select id="fType"><option>Equity</option><option>MF</option><option>Gold</option><option>Crypto</option><option>Cash</option></select></label></div>
        <div class="field-row">
          <div class="field"><label>Quantity <input required id="fQty" type="number" min="0.0001" step="any" placeholder="10"></label></div>
          <div class="field"><label>Avg buy price ₹ <input required id="fBuy" type="number" min="0.01" step="any" placeholder="1650"></label></div>
        </div>
        <div class="field"><label>Current price ₹ <small style="color:var(--txt-3)">(defaults to buy price)</small> <input id="fCur" type="number" min="0" step="any" placeholder="1712"></label></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>CANCEL</button>
          <button type="submit" class="btn btn-primary">ADD TO LEDGER</button>
        </div>
      </form>`);
    root.querySelector('#fName').focus();
    root.querySelector('#fAdd').addEventListener('submit', e => {
      e.preventDefault();
      const g = id => root.querySelector(id);
      const buy = parseFloat(g('#fBuy').value);
      Portfolio.add({
        name: g('#fName').value.trim(), type: g('#fType').value,
        qty: parseFloat(g('#fQty').value), buy, cur: parseFloat(g('#fCur').value) || buy
      });
      close();
      this.renderPortfolio();
      this.toast('Holding logged, Sir', 'ok');
    });
  },

  /* ================= LEDGER SUMMARY (Sprint 7) ================= */
  renderLedgerSummary(){
    const events = Ledger.load();
    const el = document.getElementById('ledgerSummary');
    if (!events.length){
      el.textContent = 'No trades imported yet — import a Zerodha tradebook CSV to compute real XIRR.';
      return;
    }
    const s = Ledger.summary(events);
    const xirrTxt = s.xirr === null ? 'XIRR: not solvable from this history yet'
      : `XIRR: ${(s.xirr * 100).toFixed(1)}%`;
    const plTxt = `${s.unrealizedPL >= 0 ? '+' : '−'}${U.fmtCompact(Math.abs(s.unrealizedPL))}`;
    el.innerHTML = `${s.n} trade${s.n===1?'':'s'} · HOLDINGS VALUE <span class="money">${U.fmtCompact(s.holdingsValue)}</span> ` +
      `· UNREALISED P&L <span class="money ${s.unrealizedPL >= 0 ? 'green' : 'red'}">${plTxt}</span> · ` +
      `<span class="provable" data-prov-xirr title="Click to see where this number comes from">${xirrTxt}</span> ` +
      `<span style="color:var(--txt-3)" title="Open positions are marked at the last traded price in your imported ledger, not a live quote">(marked at last traded price)</span>`;
    el.onclick = e => { if (e.target.closest('[data-prov-xirr]')) this.openProvenance('xirr', Ledger.summary()); };
  },

  /* ================= EOD QUOTES + COUNTERFACTUAL (Sprint 12) ================= */
  renderEodStatus(){
    const snap = Quotes.latest();
    const el = document.getElementById('eodStatus');
    if (!snap){ el.textContent = 'No EOD prices imported yet.'; return; }
    const n = Object.keys(snap.prices).length;
    el.textContent = `Latest EOD: ${U.esc(snap.date)} · ${n} symbols on file.`;
  },

  renderCounterfactual(){
    const el = document.getElementById('counterfactualResult');
    const portfolio = Ledger.load().length ? Ledger.xirr() : null;
    const idx = Counterfactual.indexXirr();

    const fmt = v => v === null ? 'not solvable yet' : (v * 100).toFixed(1) + '%';
    if (!Ledger.load().length){
      el.textContent = 'Import your trade ledger first (Trade Ledger panel above) to compare against Nifty.';
      return;
    }
    if (!idx.ready){
      el.textContent = `Real trades XIRR: ${fmt(portfolio)}. Log at least 2 Nifty levels (ideally spanning your trade history) to unlock the index comparison.`;
      return;
    }
    el.innerHTML = `Real trades: <b>${fmt(portfolio)}</b> vs synthetic Nifty: <b>${fmt(idx.xirr)}</b> ` +
      `<span style="color:var(--txt-3)">(${idx.niftyDaysLogged} levels logged, ${idx.tradesUsed} trade${idx.tradesUsed===1?'':'s'} priced against the nearest logged level)</span>`;
  },

  renderPortfolio(){
    this.renderLedgerSummary();
    this.renderEodStatus();
    this.renderCounterfactual();
    this.renderGoals();
    const hs = Portfolio.state.holdings;
    const nw = Portfolio.netWorth();
    const pl = Portfolio.totalPL();
    const cost = Portfolio.totalCost();

    FX.countUp(document.getElementById('nwValue'), nw, { fmt: v => U.fmtCompact(v) });
    document.getElementById('nwDelta').innerHTML = hs.length
      ? `UNREALISED P&L: <span class="money ${pl >= 0 ? 'green' : 'red'}">${pl >= 0 ? '+' : '−'}${U.fmtCompact(Math.abs(pl)).slice(1)} (${cost ? (100*Math.abs(pl)/cost).toFixed(1) : 0}%)</span> · ${hs.length} POSITIONS`
      : 'Add holdings and I shall keep the books, Sir.';
    document.getElementById('pfCount').textContent = hs.length ? hs.length + ' POSITIONS' : '';
    document.getElementById('pfEmpty').hidden = !!hs.length;

    document.getElementById('holdingsBody').innerHTML = hs.map(h => {
      const v = Portfolio.value(h), c = Portfolio.cost(h);
      const plPct = c ? 100 * (v - c) / c : 0;
      return `<tr>
        <td><b>${U.esc(h.name)}</b></td>
        <td><span class="tag">${U.esc(h.type)}</span></td>
        <td class="num money">${h.qty}</td>
        <td class="num money">${U.fmtINR(h.buy)}</td>
        <td class="num money">${U.fmtINR(h.cur)}</td>
        <td class="num money"><b>${U.fmtCompact(v)}</b></td>
        <td class="num ${plPct >= 0 ? 'pl-pos' : 'pl-neg'}">${plPct >= 0 ? '+' : ''}${plPct.toFixed(1)}%</td>
        <td><button class="icon-btn row-del" data-del="${h.id}" aria-label="Remove ${U.esc(h.name)}" style="width:30px;height:30px"><svg class="ic" style="width:14px;height:14px"><use href="#i-trash"/></svg></button></td>
      </tr>`;
    }).join('');

    // allocation donut
    const alloc = Portfolio.allocation();
    const donut = document.getElementById('allocDonut');
    const segs = alloc.map((a, i) => ({ ...a, color: Charts.PALETTE[i % Charts.PALETTE.length], fmt: U.fmtCompact(a.value) }));
    requestAnimationFrame(() => {
      if (segs.length) Charts.donut(donut, segs, { name:'Portfolio allocation' });
      else { const { ctx, w, h } = Charts.size(donut); ctx.clearRect(0,0,w,h); }
    });
    document.getElementById('allocDonutCenter').innerHTML = hs.length ? `<b class="money">${U.fmtCompact(nw)}</b><span>TOTAL</span>` : '<span>NO DATA</span>';
    document.getElementById('allocLegend').innerHTML = segs.map(s =>
      `<span class="li"><i class="swatch" style="--sw:${s.color}"></i>${U.esc(s.label)} <span class="lv">${((100*s.value/(nw||1))).toFixed(0)}%</span></span>`).join('');

    // restore budget inputs
    document.getElementById('bIncome').value = Portfolio.state.budget.income || '';
    document.getElementById('bExpense').value = Portfolio.state.budget.expense || '';
    this._budgetUpdate?.();
    this._sipUpdate?.();
    this.renderInsights();
    FX.observeReveals(document.getElementById('view-portfolio'));
  },

  renderInsights(){
    document.getElementById('pfInsights').innerHTML = Portfolio.insights().map(i =>
      `<div class="insight"><svg class="ic"><use href="#i-spark"/></svg><span>${U.esc(i)}</span></div>`).join('');
  },

  /* ================= CHAT ================= */
  wireChat(){
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      Jarvis.handle(t);
    });

    // Brain v3 teach loop: clicking a "did you mean" chip teaches the
    // missed phrasing permanently, then re-asks it — which now routes
    // through the taught table and produces the real grounded answer.
    document.getElementById('chatLog').addEventListener('click', e => {
      const b = e.target.closest('[data-teach-intent]');
      if (!b) return;
      Brain.teach(b.dataset.teachPhrase, b.dataset.teachIntent);
      this.toast('Learned — that phrasing now routes there permanently', 'ok');
      Jarvis.handle(b.dataset.teachPhrase);
    });

    // quick chips
    const chips = ['Brief me', 'Where is the money?', 'Top ideas', 'Help'];
    const qc = document.getElementById('quickChips');
    qc.innerHTML = chips.map(c => `<button class="chip" type="button">${c}</button>`).join('');
    qc.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (c) Jarvis.handle(c.textContent);
    });

    // mic
    const mic = document.getElementById('btnMic');
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec){ rec.stop(); rec = null; return; }
      rec = Jarvis.listen(
        (text, final) => {
          input.value = text;
          if (final){ input.value = ''; Jarvis.handle(text); rec = null; }
        },
        state => {
          mic.classList.toggle('rec', state === 'listening');
          if (state === 'unsupported'){
            this.toast('Voice input needs Chrome or Edge, Sir', 'err');
            rec = null;
          }
          if (state === 'idle') mic.classList.remove('rec');
        }
      );
    });

    // collapse / open
    const app = document.getElementById('app');
    const fab = document.getElementById('chatFab');
    const sync = () => {
      const overlay = matchMedia('(max-width:1240px)').matches;
      if (overlay){
        fab.hidden = app.classList.contains('chat-open');
      } else {
        fab.hidden = !app.classList.contains('chat-collapsed');
      }
    };
    document.getElementById('btnChatClose').addEventListener('click', () => {
      app.classList.add('chat-collapsed'); app.classList.remove('chat-open'); sync();
    });
    document.getElementById('btnChatClear').addEventListener('click', async () => {
      const ok = await this.confirm('Clear the chat conversation with JARVIS? This only clears the chat log, not your portfolio or settings.', { confirmLabel:'CLEAR' });
      if (!ok) return;
      Jarvis.clearHistory();
      this.toast('Chat history cleared', 'ok');
    });
    const open = () => { app.classList.remove('chat-collapsed'); app.classList.add('chat-open'); sync(); document.getElementById('chatInput').focus(); };
    fab.addEventListener('click', open);
    document.getElementById('btnChatToggle').addEventListener('click', () => {
      const overlay = matchMedia('(max-width:1240px)').matches;
      const isOpen = overlay ? app.classList.contains('chat-open') : !app.classList.contains('chat-collapsed');
      if (isOpen){ app.classList.add('chat-collapsed'); app.classList.remove('chat-open'); }
      else open();
      sync();
    });
    addEventListener('resize', sync);
    // default: open on desktop, closed overlay on smaller screens
    if (matchMedia('(max-width:1240px)').matches) app.classList.remove('chat-open');
    sync();
  },

  /* ================= SUNDAY REVIEW (Sprint 15) ================= */
  /** "Witnesses, not gates" (Article 13): the two blocking screens
   *  (predictions due, closing commitment) only block moving FORWARD
   *  within the ritual — closing the modal and walking away always
   *  works, same as anywhere else. Steps: 0 opening, 1 numbers,
   *  2 reconciliation, 3 predictions due [blocks], 4 blind spots,
   *  5 alerts, 6 calibration, 7 commitment [blocks] + memo export. */
  SUNDAY_STEPS: 8,

  openSundayReview(){
    this._reviewStep = 0;
    this._reviewData = {
      numbers: SundayReview.weekNumbers(),
      reconciliation: SundayReview.reconciliation(),
      blindSpots: SundayReview.blindSpots(),
      alerts: SundayReview.activeAlerts(),
      calibration: SundayReview.calibration(),
      predictionsResolvedCount: 0,
      ifText: '', willText: '', committed: false
    };
    this.renderSundayStep();
  },

  sundayGoTo(step){ this._reviewStep = step; this.renderSundayStep(); },

  renderSundayStep(){
    const step = this._reviewStep, d = this._reviewData;
    const progress = Array.from({ length: this.SUNDAY_STEPS }, (_, i) =>
      `<i class="${i <= step ? 'done' : ''}"></i>`).join('');
    let body = '', foot = '';
    const continueBtn = (label = 'CONTINUE →') => `<button type="button" class="btn btn-primary" data-review-next>${label}</button>`;

    if (step === 0){
      body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">SUNDAY REVIEW</h3>
        <p class="review-line">This is a calibration check, not a performance review. The goal is a more accurate model of yourself, not a score.</p>`;
      foot = continueBtn('BEGIN →');

    } else if (step === 1){
      const n = d.numbers;
      body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">THIS WEEK</h3>
        <p class="review-line">Trades: <b>${n.trades}</b> (${n.buys} buy, ${n.sells} sell)</p>
        <p class="review-line">${n.turnoverPct !== null ? `Turnover: <b>${n.turnoverPct}%</b> of current portfolio value` : 'Turnover: no holdings on file to compare against yet'}</p>`;
      foot = continueBtn();

    } else if (step === 2){
      const r = d.reconciliation;
      if (!r.total){
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">RULE-FOLLOWING CHECK</h3>
          <p class="review-line review-clean">No trades this week — nothing to reconcile. ✓</p>`;
      } else {
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">RULE-FOLLOWING CHECK</h3>
          <p class="review-line">${r.total} trade${r.total===1?'':'s'} this week.</p>
          <p class="review-line ${r.withThesis===r.total ? 'review-clean' : ''}">${r.withThesis===r.total ? '✓' : ''} ${r.withThesis}/${r.total} had a journal entry within ${SundayReview.RECONCILE_WINDOW_DAYS} days beforehand.</p>
          ${r.flagged.length ? `<p class="review-line review-flag">⚠ No prior entry found: ${r.flagged.map(t => U.esc(t.symbol) + ' (' + U.esc(t.date) + ')').join(', ')}</p>` : ''}
          <p class="feed-meta mono" style="margin-top:6px">Presence-only check — a journal entry existing nearby, not a semantic match to the trade.</p>`;
      }
      foot = continueBtn();

    } else if (step === 3){
      const due = SundayReview.predictionsDue();
      if (!due.length){
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">PREDICTIONS DUE</h3>
          <p class="review-line review-clean">✓ Nothing overdue.</p>`;
        foot = continueBtn();
      } else {
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">PREDICTIONS DUE (${due.length})</h3>
          <p class="review-line">Resolve every overdue prediction to continue — this is the one place the ritual has real teeth.</p>
          <div class="stack">${due.map(p => `
            <div class="mini-row" style="cursor:default">
              <div class="mr-main">
                <div class="mr-title">${U.esc(p.title)}</div>
                <div class="mr-sub">${p.probability}% probability · was due ${U.esc(p.resolveBy)}</div>
              </div>
              <div class="mr-side">
                <button class="btn btn-ghost" data-resolve-review="${p.id}" data-outcome="1" style="margin-bottom:4px;padding:5px 10px">YES</button>
                <button class="btn btn-ghost" data-resolve-review="${p.id}" data-outcome="0" style="padding:5px 10px">NO</button>
              </div>
            </div>`).join('')}</div>`;
        foot = ''; // no continue until all resolved
      }

    } else if (step === 4){
      const bs = d.blindSpots;
      body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">BLIND SPOTS</h3>
        <p class="feed-meta mono" style="margin-bottom:8px">Active clusters with zero portfolio exposure — a proxy for attention, not a literal view log (that infrastructure doesn't exist yet).</p>
        ${bs.length ? bs.slice(0, 5).map(c => `<p class="review-line">• ${U.esc(c.label)} — momentum ${c.score}/100, ${c.items.length} signals</p>`).join('')
          : '<p class="review-line review-clean">✓ Every active cluster has some exposure in your book.</p>'}`;
      foot = continueBtn();

    } else if (step === 5){
      const al = d.alerts;
      const weekMisses = Brain.loadMisses().filter(m => Date.now() - m.t < 7 * 86400000);
      body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">ALERT HEALTH</h3>
        <p class="feed-meta mono" style="margin-bottom:8px">Currently active only — fired-vs-acted outcome history isn't tracked yet.</p>
        ${al.length ? al.map(a => `<p class="review-line">• [${a.severity.toUpperCase()}] ${U.esc(a.message)}</p>`).join('')
          : '<p class="review-line review-clean">✓ No active alerts.</p>'}
        <h3 style="font-family:var(--f-display);letter-spacing:.1em;margin:16px 0 8px">QUERIES I COULDN'T ANSWER (${weekMisses.length} this week)</h3>
        ${weekMisses.length
          ? weekMisses.slice(-5).map(m => `<p class="review-line">• "${U.esc(m.q)}"</p>`).join('') +
            '<p class="feed-meta mono" style="margin-top:6px">These decide which intent gets built next — data, not guesswork.</p>'
          : '<p class="review-line review-clean">✓ Every question this week was answered.</p>'}`;
      foot = continueBtn();

    } else if (step === 6){
      const c = d.calibration;
      body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">CALIBRATION</h3>
        ${c.ready
          ? `<p class="review-line">Brier score: <b>${c.score}</b> (N=${c.n} resolved). 0.25 is the "always 50/50" baseline to beat.</p>`
          : `<p class="review-line">${c.n} resolved prediction${c.n===1?'':'s'} — need ${Mirror.BRIER_MIN_N} before a Brier score means anything.</p>`}`;
      foot = continueBtn();

    } else if (step === 7){
      if (!d.committed){
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">ONE COMMITMENT FOR NEXT WEEK</h3>
          <p class="review-line">Complete this: "If ___, I will ___." One commitment, never a list.</p>
          <div class="field"><label>If <input id="reviewIf" placeholder="e.g. I feel FOMO on a headline" value="${U.esc(d.ifText)}"></label></div>
          <div class="field"><label>I will <input id="reviewWill" placeholder="e.g. wait until the next trading day" value="${U.esc(d.willText)}"></label></div>`;
        foot = `<button type="button" class="btn btn-primary" data-review-commit>SAVE & FINISH</button>`;
      } else {
        const memo = SundayReview.generateMemo(d);
        body = `<h3 style="font-family:var(--f-display);letter-spacing:.1em;margin-bottom:10px">REVIEW COMPLETE</h3>
          <p class="review-line review-clean">✓ Commitment saved.</p>
          <div class="review-memo">${U.esc(memo)}</div>`;
        foot = `<button type="button" class="btn btn-ghost" data-review-download>DOWNLOAD MEMO</button>
                <button type="button" class="btn btn-primary" data-close>CLOSE</button>`;
      }
    }

    const { root } = this.modal(`
      <div class="modal-head"><h3 style="font-size:.7rem">STEP ${step+1} OF ${this.SUNDAY_STEPS}</h3><button class="icon-btn" data-close aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="review-progress">${progress}</div>
      ${body}
      <div class="modal-foot">${foot}</div>`);

    root.querySelectorAll('[data-review-next]').forEach(b => b.addEventListener('click', () => this.sundayGoTo(step + 1)));
    root.querySelectorAll('[data-resolve-review]').forEach(b => b.addEventListener('click', () => {
      Mirror.resolvePrediction(b.dataset.resolveReview, b.dataset.outcome === '1');
      this._reviewData.predictionsResolvedCount++;
      this.renderSundayStep();
    }));
    const commitBtn = root.querySelector('[data-review-commit]');
    if (commitBtn) commitBtn.addEventListener('click', () => {
      const ifText = root.querySelector('#reviewIf').value.trim();
      const willText = root.querySelector('#reviewWill').value.trim();
      if (!ifText || !willText){ this.toast('Both fields are required to close the ritual, Sir', 'err'); return; }
      d.ifText = ifText; d.willText = willText;
      SundayReview.saveCommitment({ ifText, willText });
      d.committed = true;
      this.renderSundayStep();
    });
    const dlBtn = root.querySelector('[data-review-download]');
    if (dlBtn) dlBtn.addEventListener('click', () => {
      const blob = new Blob([SundayReview.generateMemo(d)], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `sunday-review-${U.todayKey()}.md`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.toast('Memo downloaded', 'ok');
    });
  },

  openChat(){
    const app = document.getElementById('app');
    app.classList.remove('chat-collapsed');
    if (matchMedia('(max-width:1240px)').matches) app.classList.add('chat-open');
    document.getElementById('chatFab').hidden = true;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
