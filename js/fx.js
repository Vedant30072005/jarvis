// @ts-check
/* ============================================================
   J.A.R.V.I.S — effects engine
   Particles, cursor glow, 3D tilt, typewriter, counters, boot.
   ============================================================ */

const FX = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  get enabled(){ return !this.reduced && !document.body.classList.contains('fx-off'); },

  /* ---------------- particle field ---------------- */
  particles(){
    const canvas = document.getElementById('bgParticles');
    const ctx = canvas.getContext('2d');
    let W, H, pts = [], raf, running = true;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      W = canvas.width = innerWidth; H = canvas.height = innerHeight;
      const n = Math.min(110, Math.round(W * H / 16000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random()*W, y: Math.random()*H,
        vx: (Math.random()-.5)*.22, vy: (Math.random()-.5)*.22,
        r: Math.random()*1.6 + .4, tw: Math.random()*6.28
      }));
    };
    resize(); addEventListener('resize', resize);
    addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive:true });

    const step = () => {
      if (!this.enabled){ ctx.clearRect(0,0,W,H); raf = requestAnimationFrame(step); return; }
      ctx.clearRect(0, 0, W, H);
      const t = Date.now()/1000;
      for (const p of pts){
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const glow = .35 + .3 * Math.sin(t*2 + p.tw);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(125,210,255,${glow})`; ctx.fill();
        // connection lines near cursor
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < 160){
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(56,225,255,${.14 * (1 - d/160)})`; ctx.lineWidth = .7; ctx.stroke();
        }
      }
      // links between close particles (sampled)
      for (let i = 0; i < pts.length; i += 2){
        for (let j = i+2; j < Math.min(i+10, pts.length); j += 2){
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x-b.x, a.y-b.y);
          if (d < 110){
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(90,160,255,${.07 * (1 - d/110)})`; ctx.lineWidth = .6; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    step();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden){ cancelAnimationFrame(raf); running = false; }
      else if (!running){ running = true; step(); }
    });
  },

  /* ---------------- cursor glow ---------------- */
  cursor(){
    if (matchMedia('(pointer: coarse)').matches || this.reduced) return;
    const glow = document.getElementById('cursorGlow');
    const dot = document.getElementById('cursorDot');
    let tx = 0, ty = 0, gx = 0, gy = 0, shown = false;
    addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!shown){ document.body.classList.add('has-cursor'); shown = true; }
      dot.style.transform = `translate(${tx - 3.5}px, ${ty - 3.5}px)`;
    }, { passive:true });
    const loop = () => {
      gx += (tx - gx) * .08; gy += (ty - gy) * .08;
      glow.style.transform = `translate(${gx - 260}px, ${gy - 260}px)`;
      requestAnimationFrame(loop);
    };
    loop();
  },

  /* ---------------- 3D tilt (event delegation) ---------------- */
  tilt(){
    if (this.reduced) return;
    let el = null, raf = null;
    document.addEventListener('mousemove', e => {
      const t = e.target.closest?.('.tilt');
      if (t !== el){
        if (el){ el.classList.remove('tilting'); el.style.setProperty('--rx','0deg'); el.style.setProperty('--ry','0deg'); }
        el = t;
        if (el) el.classList.add('tilting');
      }
      if (!el || !FX.enabled) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', ((px - .5) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((.5 - py) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
    }, { passive:true });
  },

  /* ---------------- scroll reveal ---------------- */
  observeReveals(root = document){
    if (!this._io){
      this._io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); this._io.unobserve(e.target); } });
      }, { threshold: .08 });
    }
    root.querySelectorAll('.reveal:not(.in)').forEach((el, i) => {
      el.style.setProperty('--d', Math.min(i * 60, 420) + 'ms');
      this._io.observe(el);
    });
  },

  /* ---------------- count up ---------------- */
  countUp(el, to, { dur = 1200, fmt = (v) => Math.round(v).toLocaleString('en-IN') } = {}){
    if (!el) return;
    if (this.reduced){ el.textContent = fmt(to); return; }
    const from = 0, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* ---------------- typewriter ---------------- */
  async type(el, html, speed = 14){
    // types plain text but supports <b>/<span class> markers already in html
    if (this.reduced || speed <= 0){ el.innerHTML = html; return; }
    el.innerHTML = ''; el.classList.add('typing-caret');
    // tokenize: tags atomic, text char by char (typed in small chunks)
    const tokens = html.match(/<[^>]+>|./gs) || [];
    let buf = '', pending = 0;
    for (const tk of tokens){
      buf += tk;
      if (!tk.startsWith('<') && ++pending >= 3){
        pending = 0;
        el.innerHTML = buf;
        await new Promise(r => setTimeout(r, speed));
      }
    }
    el.innerHTML = buf;
    el.classList.remove('typing-caret');
  },

  /* ---------------- button ripple ---------------- */
  ripples(){
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest?.('.btn');
      if (!btn || !FX.enabled) return;
      const r = btn.getBoundingClientRect();
      const rp = document.createElement('span');
      rp.className = 'ripple';
      const size = Math.max(r.width, r.height);
      rp.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size/2}px;top:${e.clientY - r.top - size/2}px`;
      btn.appendChild(rp);
      setTimeout(() => rp.remove(), 650);
    });
  },

  /* ---------------- confetti (party protocol) ---------------- */
  confetti(n = 90){
    const colors = ['#38e1ff','#ffd166','#a78bfa','#3ddc97','#e0489a','#eaf3ff'];
    for (let i = 0; i < n; i++){
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.cssText = `left:${Math.random()*100}vw;background:${colors[i % colors.length]};--dur:${2.2 + Math.random()*2.4}s;animation-delay:${Math.random()*.6}s;transform:rotate(${Math.random()*360}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5600);
    }
  },

  /* ---------------- boot sequence ---------------- */
  async boot(){
    const boot = document.getElementById('boot');
    const app = document.getElementById('app');
    const log = document.getElementById('bootLog');
    const bar = document.getElementById('bootBar');
    const quick = sessionStorage.getItem('jarvis.booted') || this.reduced;

    const finish = () => {
      boot.classList.add('done');
      app.hidden = false;
      sessionStorage.setItem('jarvis.booted', '1');
      setTimeout(() => boot.remove(), 800);
      this.observeReveals();
      document.dispatchEvent(new CustomEvent('jarvis:booted'));
    };

    let skipped = false;
    const skip = () => { if (!skipped){ skipped = true; finish(); } };
    document.getElementById('bootSkip').addEventListener('click', skip);

    if (quick){ setTimeout(skip, 350); return; }

    const LINES = [
      ['Initialising arc reactor…', 'OK'],
      ['Loading economic protocols…', 'OK'],
      ['Calibrating pattern engine…', 'OK'],
      ['Linking market sensors…', 'SIM'],
      ['Compiling money-flow map…', 'OK'],
      ['All systems nominal. Welcome back, Sir.', '']
    ];
    for (let i = 0; i < LINES.length && !skipped; i++){
      const [txt, status] = LINES[i];
      const ln = document.createElement('div');
      ln.className = 'ln';
      ln.innerHTML = `<span style="color:var(--cyan)">▸</span> ${U.esc(txt)} ${status ? `<span class="ok">[${status}]</span>` : ''}`;
      log.appendChild(ln);
      bar.style.width = Math.round(((i+1) / LINES.length) * 100) + '%';
      await new Promise(r => setTimeout(r, 330));
    }
    await new Promise(r => setTimeout(r, 420));
    skip();
  }
};
