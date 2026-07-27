// @ts-check
/* ============================================================
   J.A.R.V.I.S — chart renderers (canvas, DPR aware)
   Data marks use the validated categorical palette in fixed order.
   ============================================================ */

const Charts = {
  PALETTE: ['#0096b8','#bd8a16','#8a63f0','#e0489a','#3b82f6','#0da271'],
  SURFACE: '#0a1020',
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,

  size(canvas){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (canvas.width !== w*dpr || canvas.height !== h*dpr){
      canvas.width = w*dpr; canvas.height = h*dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  },

  tip(html, x, y){
    const el = document.getElementById('chartTip');
    if (html == null){ el.hidden = true; return; }
    el.innerHTML = html; el.hidden = false;
    const pad = 14, vw = innerWidth, r = el.getBoundingClientRect();
    el.style.left = Math.min(x + pad, vw - r.width - 8) + 'px';
    el.style.top = Math.max(8, y - r.height - pad) + 'px';
  },

  /* ---------------- donut ---------------- */
  donut(canvas, segments, opts = {}){
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const state = { t: this.reduced ? 1 : 0, hover: -1 };
    canvas.setAttribute('aria-label', (opts.name || 'Donut chart') + ': ' +
      segments.map(s => `${s.label} ${(100*s.value/total).toFixed(0)}%`).join(', '));

    const draw = () => {
      const { ctx, w, h } = this.size(canvas);
      ctx.clearRect(0, 0, w, h);
      const cx = w/2, cy = h/2, R = Math.min(w,h)/2 - 8, ir = R * .62;
      let a0 = -Math.PI/2;
      segments.forEach((s, i) => {
        const frac = (s.value/total) * state.t;
        const a1 = a0 + frac * Math.PI * 2;
        const grow = state.hover === i ? 5 : 0;
        ctx.beginPath();
        ctx.arc(cx, cy, R + grow, a0, a1);
        ctx.arc(cx, cy, ir - (grow ? 2 : 0), a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = s.color || this.PALETTE[i % this.PALETTE.length];
        ctx.globalAlpha = state.hover === -1 || state.hover === i ? 1 : .35;
        ctx.fill();
        ctx.globalAlpha = 1;
        // 2px surface gap between segments
        ctx.strokeStyle = this.SURFACE; ctx.lineWidth = 2; ctx.stroke();
        s._a0 = a0; s._a1 = a1;
        a0 = a1;
      });
    };

    const animate = () => {
      state.t = Math.min(1, state.t + 0.035);
      draw();
      if (state.t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    canvas.onmousemove = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2, y = e.clientY - r.top - r.height/2;
      const R = Math.min(r.width, r.height)/2 - 8;
      const d = Math.hypot(x, y);
      let hover = -1;
      if (d < R + 6 && d > R * .55){
        let ang = Math.atan2(y, x);
        if (ang < -Math.PI/2) ang += Math.PI * 2;
        hover = segments.findIndex(s => ang >= s._a0 && ang < s._a1);
      }
      if (hover !== state.hover){ state.hover = hover; draw(); }
      if (hover >= 0){
        const s = segments[hover];
        this.tip(`<b style="color:${s.color}">●</b> ${U.esc(s.label)} — <b>${U.esc(s.fmt || String(s.value))}</b> (${(100*s.value/total).toFixed(1)}%)`, e.clientX, e.clientY);
      } else this.tip(null);
    };
    canvas.onmouseleave = () => { state.hover = -1; draw(); this.tip(null); };
    return { redraw: draw };
  },

  /* ---------------- sparkline ---------------- */
  spark(canvas, series, color = '#38e1ff'){
    const { ctx, w, h } = this.size(canvas);
    ctx.clearRect(0, 0, w, h);
    if (series.length < 2) return;
    const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
    const pts = series.map((v, i) => [ (i/(series.length-1)) * (w-6) + 3, h - 4 - ((v-min)/span) * (h-10) ]);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(pts[0][0], h); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[pts.length-1][0], h);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    const last = pts[pts.length-1];
    ctx.beginPath(); ctx.arc(last[0], last[1], 3, 0, 7);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  },

  /* ---------------- sector radar ---------------- */
  radar(canvas, blips, tipEl){
    // blips: {label, angle(deg), strength 0-1, senti}
    let sweep = 0, raf, hover = null;
    const SENTI = { bull:'#0da271', bear:'#e0489a', neut:'#3b82f6' };

    const draw = () => {
      const { ctx, w, h } = this.size(canvas);
      ctx.clearRect(0, 0, w, h);
      const cx = w/2, cy = h/2, R = Math.min(w,h)/2 - 14;

      // rings + cross
      ctx.strokeStyle = 'rgba(56,225,255,.14)'; ctx.lineWidth = 1;
      [.28, .55, .8, 1].forEach(f => { ctx.beginPath(); ctx.arc(cx, cy, R*f, 0, 7); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(cx-R, cy); ctx.lineTo(cx+R, cy); ctx.moveTo(cx, cy-R); ctx.lineTo(cx, cy+R); ctx.stroke();
      ctx.strokeStyle = 'rgba(56,225,255,.06)';
      for (let a = 45; a < 360; a += 90){
        const rad = a * Math.PI/180;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rad)*R, cy + Math.sin(rad)*R); ctx.stroke();
      }

      // sweep beam
      if (!this.reduced){
        const g = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
        if (g){
          g.addColorStop(0, 'rgba(56,225,255,.30)'); g.addColorStop(.12, 'rgba(56,225,255,.05)'); g.addColorStop(.2, 'transparent'); g.addColorStop(1, 'transparent');
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, 7); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep)*R, cy + Math.sin(sweep)*R);
        ctx.strokeStyle = 'rgba(56,225,255,.7)'; ctx.lineWidth = 1.4; ctx.stroke();
      }

      // blips
      blips.forEach(b => {
        const rad = (b.angle - 90) * Math.PI/180;
        const r = R * (0.3 + b.strength * 0.65);
        const x = cx + Math.cos(rad)*r, y = cy + Math.sin(rad)*r;
        b._x = x; b._y = y;
        const pulse = this.reduced ? 1 : (0.75 + 0.25 * Math.sin(Date.now()/420 + b.angle));
        const size = (3.2 + b.strength * 4.5) * pulse;
        ctx.beginPath(); ctx.arc(x, y, size, 0, 7);
        ctx.fillStyle = SENTI[b.senti] || SENTI.neut;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        // 2px surface ring so overlapping blips separate
        ctx.strokeStyle = this.SURFACE; ctx.lineWidth = 2; ctx.stroke();
        if (hover === b){
          ctx.beginPath(); ctx.arc(x, y, size + 5, 0, 7);
          ctx.strokeStyle = 'rgba(234,243,255,.8)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      });

      // center
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fillStyle = '#38e1ff';
      ctx.shadowColor = '#38e1ff'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;

      sweep += 0.016;
      if (!this.reduced) raf = requestAnimationFrame(draw);
    };
    draw();

    canvas.onmousemove = (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      hover = blips.find(b => Math.hypot(b._x - mx, b._y - my) < 14) || null;
      if (hover && tipEl){
        tipEl.hidden = false;
        tipEl.textContent = `${hover.label} · activity ${(hover.strength*100).toFixed(0)} · ${hover.senti === 'bull' ? 'bullish' : hover.senti === 'bear' ? 'bearish' : 'neutral'}`;
        tipEl.style.left = U.clamp(mx + 12, 0, r.width - 160) + 'px';
        tipEl.style.top = (my - 34) + 'px';
        canvas.style.cursor = 'pointer';
      } else if (tipEl){ tipEl.hidden = true; canvas.style.cursor = 'crosshair'; }
      if (this.reduced) draw();
    };
    canvas.onmouseleave = () => { hover = null; if (tipEl) tipEl.hidden = true; };
    return () => cancelAnimationFrame(raf);
  },

  /* ---------------- entity network ---------------- */
  network(canvas, nodes, edges){
    // nodes: {id,label,type(hub|sector|macro),w} — gentle float animation
    let raf, hover = null;
    const TYPE = { hub:'#38e1ff', sector:'#0096b8', macro:'#bd8a16' };
    const init = () => {
      const r = canvas.getBoundingClientRect();
      nodes.forEach((n, i) => {
        if (n.type === 'hub'){ n.x = r.width/2; n.y = r.height/2; }
        else {
          const ang = (i / (nodes.length-1)) * Math.PI * 2;
          n.x = r.width/2 + Math.cos(ang) * (r.width * .32);
          n.y = r.height/2 + Math.sin(ang) * (r.height * .3);
        }
        n.ph = Math.random() * 6.28;
      });
    };
    init();

    const draw = () => {
      const { ctx, w, h } = this.size(canvas);
      ctx.clearRect(0, 0, w, h);
      const t = Date.now()/900;
      nodes.forEach(n => {
        n._x = n.x + (n.type === 'hub' || this.reduced ? 0 : Math.sin(t + n.ph) * 4);
        n._y = n.y + (n.type === 'hub' || this.reduced ? 0 : Math.cos(t*.8 + n.ph) * 4);
      });
      // edges
      edges.forEach(([a, b]) => {
        const na = nodes[a], nb = nodes[b];
        const grad = ctx.createLinearGradient(na._x, na._y, nb._x, nb._y);
        grad.addColorStop(0, 'rgba(56,225,255,.35)'); grad.addColorStop(1, 'rgba(56,225,255,.06)');
        ctx.beginPath(); ctx.moveTo(na._x, na._y); ctx.lineTo(nb._x, nb._y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.stroke();
        if (!this.reduced){
          const f = (Math.sin(t*1.6 + a + b) + 1) / 2;
          const px = na._x + (nb._x - na._x) * f, py = na._y + (nb._y - na._y) * f;
          ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fillStyle = 'rgba(125,234,255,.8)'; ctx.fill();
        }
      });
      // nodes
      const showLabels = w >= 200; // ORD-107: skip labels on tight canvases, hover still works
      nodes.forEach(n => {
        const R = n.type === 'hub' ? 9 : 4.5 + (n.w || 0) * 3;
        ctx.beginPath(); ctx.arc(n._x, n._y, R, 0, 7);
        ctx.fillStyle = TYPE[n.type] || TYPE.macro;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = n === hover ? 18 : 9; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = this.SURFACE; ctx.lineWidth = 2; ctx.stroke();
        if (showLabels || n === hover){
          ctx.font = (n.type === 'hub' ? '600 10px' : '9px') + ' "JetBrains Mono", monospace';
          ctx.fillStyle = n === hover ? '#eaf3ff' : 'rgba(169,188,214,.85)';
          ctx.textAlign = 'center';
          const lx = U.clamp(n._x, 20, w - 20);
          ctx.fillText(n.label.slice(0, 20), lx, n._y + R + 12);
        }
      });
      if (!this.reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    canvas.onmousemove = (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      hover = nodes.find(n => Math.hypot(n._x - mx, n._y - my) < 13) || null;
      if (this.reduced) draw();
    };
    canvas.onmouseleave = () => { hover = null; };
    return () => cancelAnimationFrame(raf);
  },

  /* ---------------- SIP growth area ---------------- */
  sipArea(canvas, monthly, years, ratePct){
    const { ctx, w, h } = this.size(canvas);
    ctx.clearRect(0, 0, w, h);
    const r = ratePct / 100 / 12, n = years * 12;
    const invested = [], value = [];
    let v = 0;
    for (let m = 1; m <= n; m++){
      v = (v + monthly) * (1 + r);
      if (m % Math.max(1, Math.round(n/60)) === 0 || m === n){
        invested.push(monthly * m); value.push(v);
      }
    }
    const max = value[value.length-1] || 1;
    const px = i => 4 + (i/(value.length-1)) * (w-8);
    const py = val => h - 16 - (val/max) * (h - 26);

    // grid
    ctx.strokeStyle = 'rgba(148,184,255,.08)'; ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(f => { ctx.beginPath(); ctx.moveTo(4, py(max*f)); ctx.lineTo(w-4, py(max*f)); ctx.stroke(); });

    // invested line (muted)
    ctx.beginPath(); invested.forEach((val, i) => i ? ctx.lineTo(px(i), py(val)) : ctx.moveTo(px(i), py(val)));
    ctx.strokeStyle = 'rgba(169,188,214,.5)'; ctx.setLineDash([4,4]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);

    // value area
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0,150,184,.4)'); grad.addColorStop(1, 'rgba(0,150,184,0)');
    ctx.beginPath(); ctx.moveTo(px(0), h-16);
    value.forEach((val, i) => ctx.lineTo(px(i), py(val)));
    ctx.lineTo(px(value.length-1), h-16); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); value.forEach((val, i) => i ? ctx.lineTo(px(i), py(val)) : ctx.moveTo(px(i), py(val)));
    ctx.strokeStyle = '#38e1ff'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // axis labels
    ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(126,145,173,.9)';
    ctx.textAlign = 'left'; ctx.fillText('NOW', 4, h - 4);
    ctx.textAlign = 'right'; ctx.fillText(years + 'Y', w - 4, h - 4);
    ctx.textAlign = 'left'; ctx.fillText(U.fmtCompact(value[value.length-1]), 4, 10);

    canvas.setAttribute('aria-label', `SIP projection: investing ${U.fmtINR(monthly)} monthly for ${years} years at ${ratePct}% grows to about ${U.fmtCompact(value[value.length-1])}, versus ${U.fmtCompact(invested[invested.length-1])} invested.`);
  }
};

/* compact ₹ formatter used by charts + portfolio */
U.fmtCompact = function(n){
  if (n >= 1e7) return '₹' + (n/1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n/1e5).toFixed(1) + ' L';
  if (n >= 1e3) return '₹' + (n/1e3).toFixed(0) + 'K';
  return '₹' + Math.round(n);
};
