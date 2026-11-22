/* Result charts (inline SVG). Colors follow the method, never the rank. */
(function () {
  const C = { beliefact: '#2a78d6', naive: '#eb6834', bsg: '#1baf7a', pce: '#eda100', hume: '#e87ba4' };
  const N = { beliefact: 'BeliefAct', naive: 'Naive', bsg: 'BSG', pce: 'PCE', hume: 'HUME' };
  const ORDER = ['beliefact', 'naive', 'bsg', 'pce', 'hume'];
  const INK = '#1d1d1f', INK2 = '#424245', INK3 = '#6e6e73', GRID = 'rgba(0,0,0,.07)', AXIS = 'rgba(0,0,0,.25)';
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgFor(host, W, H, label) {
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
    host.appendChild(s); return s;
  }
  function tipFor(host) { const t = document.createElement('div'); t.className = 'tip'; host.appendChild(t); return t; }
  function placeTip(host, tip, px, py) {
    const r = host.getBoundingClientRect();
    let x = px + 14, y = py - 10;
    if (x + tip.offsetWidth > r.width) x = px - tip.offsetWidth - 14;
    tip.style.left = x + 'px'; tip.style.top = Math.max(0, y) + 'px';
  }

  // ---- 1. completion within a round budget (cumulative step curves) ----
  function budget(host, curves) {
    const narrow = host.clientWidth < 560;
    const W = Math.max(320, host.clientWidth || 760), H = narrow ? 300 : 380, m = { l: 40, r: narrow ? 100 : 112, t: 16, b: 40 };
    const s = svgFor(host, W, H, 'Share of episodes completed within a round budget, by method');
    const x = (h) => m.l + (W - m.l - m.r) * h / 200;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - v / 100);
    for (const v of [0, 20, 40, 60, 80, 100]) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v ? GRID : AXIS, 'stroke-width': 1 }, s);
      el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: INK3 }, s, v + '%');
    }
    for (const h of (narrow ? [0, 60, 100, 200] : [0, 40, 60, 100, 150, 200])) el('text', { x: x(h), y: H - m.b + 20, 'text-anchor': 'middle', 'font-size': 12, fill: INK3 }, s, h);
    el('text', { x: (m.l + W - m.r) / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': 12, fill: INK3 }, s, 'Round budget H′');
    // H' = 60 guide
    el('line', { x1: x(60), x2: x(60), y1: m.t, y2: H - m.b, stroke: 'rgba(0,0,0,.18)', 'stroke-dasharray': '3 4' }, s);
    el('text', { x: x(60) + 6, y: m.t + 12, 'font-size': 12, fill: INK2 }, s, narrow ? '75.0% vs. ≤67.5%' : '60 rounds: 75.0% vs. ≤67.5%');
    const paths = {};
    for (const k of ORDER.slice().reverse()) {
      const c = curves[k];
      let d = `M${x(0)},${y(c[0])}`;
      for (let h = 1; h <= 200; h++) d += `H${x(h)}V${y(c[h])}`;
      paths[k] = el('path', { d, fill: 'none', stroke: C[k], 'stroke-width': k === 'beliefact' ? 2.5 : 2, 'stroke-linejoin': 'round' }, s);
    }
    // direct labels at the right end, de-overlapped
    const ends = ORDER.map((k) => ({ k, v: curves[k][200], y: y(curves[k][200]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    for (const e of ends) {
      el('circle', { cx: W - m.r + 8, cy: e.y - 4, r: 4, fill: C[e.k] }, s);
      el('text', { x: W - m.r + 16, y: e.y, 'font-size': 12, fill: INK, 'font-weight': e.k === 'beliefact' ? 600 : 400 }, s, `${N[e.k]} ${e.v.toFixed(1)}%`);
    }
    // hover crosshair
    const tip = tipFor(host);
    const cross = el('line', { y1: m.t, y2: H - m.b, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1, opacity: 0 }, s);
    const dots = ORDER.map((k) => el('circle', { r: 4.5, fill: C[k], stroke: '#fff', 'stroke-width': 2, opacity: 0 }, s));
    const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, s);
    const move = (ev) => {
      const r = s.getBoundingClientRect(); const sx = (ev.clientX - r.left) * W / r.width;
      const h = Math.max(0, Math.min(200, Math.round((sx - m.l) / (W - m.l - m.r) * 200)));
      cross.setAttribute('x1', x(h)); cross.setAttribute('x2', x(h)); cross.setAttribute('opacity', 1);
      ORDER.forEach((k, i) => { dots[i].setAttribute('cx', x(h)); dots[i].setAttribute('cy', y(curves[k][h])); dots[i].setAttribute('opacity', 1); });
      tip.innerHTML = `<div style="font-weight:600;margin-bottom:2px">Within ${h} rounds</div>` + ORDER.map((k) => `<div class="row"><i style="background:${C[k]}"></i>${N[k]}<b>${curves[k][h].toFixed(1)}%</b></div>`).join('');
      tip.classList.add('on'); placeTip(host, tip, (ev.clientX - r.left), (ev.clientY - r.top));
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => { tip.classList.remove('on'); cross.setAttribute('opacity', 0); dots.forEach((d) => d.setAttribute('opacity', 0)); });
  }

  // ---- 2. rounds before / after the first observed change (two small multiples) ----
  function onset(host, data) {
    const narrow = host.clientWidth < 560;
    const W = Math.max(320, host.clientWidth || 760), m = { l: 84, r: 30, t: 34, b: 30 }, gap = narrow ? 0 : 40;
    const PH = 230, H = narrow ? 2 * PH : PH;
    const s = svgFor(host, W, H, 'Rounds before and after the first observed change');
    const pw = narrow ? W - m.l - m.r : (W - m.l - m.r - gap) / 2, max = 35;
    const panels = [['before', 'Before the first observed change'], ['after', 'From the change to completion']];
    const keys = ORDER.filter((k) => data[k]);  // the methods this analysis covers
    const rowH = (PH - m.t - m.b) / keys.length;
    const tip = tipFor(host);
    panels.forEach(([key, title], pi) => {
      const x0 = narrow ? m.l : m.l + pi * (pw + gap);
      const yo = narrow ? pi * PH : 0;
      const x = (v) => x0 + pw * v / max;
      el('text', { x: x0, y: yo + 16, 'font-size': 13, 'font-weight': 600, fill: INK }, s, title);
      for (const v of [0, 10, 20, 30]) {
        el('line', { x1: x(v), x2: x(v), y1: yo + m.t - 4, y2: yo + PH - m.b, stroke: v ? GRID : AXIS }, s);
        el('text', { x: x(v), y: yo + PH - m.b + 16, 'text-anchor': 'middle', 'font-size': 11, fill: INK3 }, s, v);
      }
      keys.forEach((k, i) => {
        const yc = yo + m.t + rowH * i + rowH / 2, v = data[k][key];
        if (pi === 0 || narrow) el('text', { x: m.l - 10, y: yc + 4, 'text-anchor': 'end', 'font-size': 12, fill: INK2, 'font-weight': k === 'beliefact' ? 600 : 400 }, s, N[k]);
        const w = x(v) - x(0);
        el('path', { d: `M${x(0)},${yc - 8}H${x(0) + w - 4}a4,4 0 0 1 4,4V${yc + 4}a4,4 0 0 1 -4,4H${x(0)}Z`, fill: C[k] }, s);
        el('text', { x: x(v) + 6, y: yc + 4, 'font-size': 12, fill: INK, 'font-variant-numeric': 'tabular-nums' }, s, v.toFixed(1));
        const hit = el('rect', { x: x(0), y: yc - rowH / 2, width: pw, height: rowH, fill: 'transparent' }, s);
        hit.addEventListener('mousemove', (ev) => {
          const r = host.getBoundingClientRect();
          tip.innerHTML = `<div class="row"><i style="background:${C[k]}"></i>${N[k]} · ${title.toLowerCase()}<b>${v.toFixed(1)} rounds</b></div>`;
          tip.classList.add('on'); placeTip(host, tip, ev.clientX - r.left, ev.clientY - r.top);
        });
        hit.addEventListener('mouseleave', () => tip.classList.remove('on'));
      });
    });
  }

  // ---- 3. probability on the true answer, before -> after the first relevant evidence ----
  function slope(host, rows) {
    const W = Math.max(320, Math.min(host.clientWidth || 500, 560)), H = 300, m = { l: Math.round(W * 0.34), r: Math.round(W * 0.34), t: 30, b: 16 };
    const s = svgFor(host, W, H, 'Probability BeliefAct assigns to the true answer, before and after the first relevant evidence');
    const xa = m.l, xb = W - m.r, max = 0.8;
    const y = (v) => m.t + (H - m.t - m.b) * (1 - v / max);
    el('text', { x: xa, y: 16, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: INK3 }, s, 'Before');
    el('text', { x: xb, y: 16, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: INK3 }, s, 'After');
    el('line', { x1: xa, x2: xa, y1: m.t - 6, y2: H - m.b, stroke: AXIS }, s);
    el('line', { x1: xb, x2: xb, y1: m.t - 6, y2: H - m.b, stroke: AXIS }, s);
    const place = (arr, key) => {
      const L = arr.map((r) => ({ r, y: y(r[key]) })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < L.length; i++) if (L[i].y - L[i - 1].y < 15) L[i].y = L[i - 1].y + 15;
      return new Map(L.map((o) => [o.r, o.y]));
    };
    const la = place(rows, 'before'), lb = place(rows, 'after');
    for (const r of rows) {
      const down = r.after < r.before;
      const col = down ? '#86868b' : C.beliefact;
      el('line', { x1: xa, y1: y(r.before), x2: xb, y2: y(r.after), stroke: col, 'stroke-width': r.bold ? 3 : 2, 'stroke-dasharray': r.bold ? '' : '' }, s);
      el('circle', { cx: xa, cy: y(r.before), r: 4.5, fill: col, stroke: '#fff', 'stroke-width': 2 }, s);
      el('circle', { cx: xb, cy: y(r.after), r: 4.5, fill: col, stroke: '#fff', 'stroke-width': 2 }, s);
      el('text', { x: xa - 12, y: la.get(r) + 4, 'text-anchor': 'end', 'font-size': 12, fill: INK2, 'font-weight': r.bold ? 600 : 400 }, s, `${r.task}  ${r.before.toFixed(2)}`);
      el('text', { x: xb + 12, y: lb.get(r) + 4, 'font-size': 12, fill: INK, 'font-weight': r.bold ? 600 : 400 }, s, `${r.after.toFixed(2)}  ${r.task}`);
    }
  }

  // re-draw on width changes
  function mount(fn, host, ...args) {
    let w = 0;
    const draw = () => { if (Math.abs(host.clientWidth - w) < 2) return; w = host.clientWidth; host.innerHTML = ''; fn(host, ...args); };
    draw(); new ResizeObserver(draw).observe(host);
  }
  window.BACharts = { budget: (h, ...a) => mount(budget, h, ...a), onset: (h, ...a) => mount(onset, h, ...a), slope: (h, ...a) => mount(slope, h, ...a) };
})();
