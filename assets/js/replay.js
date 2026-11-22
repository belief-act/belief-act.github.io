/* Replay engine: draws logged episodes of several agents on one floor plan / render.
 * Time is measured in rounds. Within a round an agent first walks its route (0 .. MOVE of the
 * round), then performs its action (MOVE .. 1). Positions at the end of each round are the logged
 * robot positions; the route between two of them is a shortest walkable path drawn for display. */
(function () {
  const MOVE = 0.62;
  const COLORS = { beliefact: '#2a78d6', naive: '#eb6834', bsg: '#1baf7a', pce: '#eda100' };
  const ORDER = ['beliefact', 'naive', 'bsg', 'pce'];
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function polyLen(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return cum;
  }
  function along(pts, cum, s) {
    if (pts.length === 1 || cum[cum.length - 1] === 0) return [pts[pts.length - 1][0], pts[pts.length - 1][1], null];
    const L = cum[cum.length - 1] * clamp(s, 0, 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < L) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const f = (L - cum[i - 1]) / seg;
    const x = lerp(pts[i - 1][0], pts[i][0], f), y = lerp(pts[i - 1][1], pts[i][1], f);
    return [x, y, Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
  }

  class Agent {
    constructor(key, md) {
      this.key = key; this.md = md; this.color = COLORS[key]; this.label = md.label;
      this.R = md.track.length;
      this.rounds = md.track.map((r, i) => {
        let pts = r.route && r.route.length ? r.route : null;
        if (!pts) {
          const p = i === 0 ? md.start : null;
          pts = null;
        }
        return { pts, cum: pts ? polyLen(pts) : null, a: r.a, arg: r.arg, yaw: r.yaw };
      });
      // end position of each round (carry forward when a round has no route)
      let cur = [md.start[0], md.start[1]], yaw = md.start[2] || 0;
      this.ends = []; this.starts = [];
      for (const r of this.rounds) {
        this.starts.push(cur.slice());
        if (r.pts) cur = r.pts[r.pts.length - 1].slice();
        if (r.yaw != null) yaw = r.yaw;
        this.ends.push([cur[0], cur[1], yaw]);
      }
    }
    pose(t) {
      if (t <= 0) return [this.md.start[0], this.md.start[1], this.md.start[2] || 0, 0, null];
      if (t >= this.R) { const e = this.ends[this.R - 1]; return [e[0], e[1], e[2], 1, null]; }
      const k = Math.floor(t), f = t - k, r = this.rounds[k];
      const prevYaw = k > 0 ? this.ends[k - 1][2] : (this.md.start[2] || 0);
      if (r.pts && r.cum[r.cum.length - 1] > 0.05 && f < MOVE) {
        const [x, y, h] = along(r.pts, r.cum, ease(f / MOVE));
        return [x, y, h == null ? prevYaw : h, f, k];
      }
      const e = this.ends[k];
      let yaw = e[2];
      if (r.a === 'scan_360') yaw = prevYaw + 2 * Math.PI * ease(clamp((f - (r.pts ? MOVE : 0)) / (1 - (r.pts ? MOVE : 0)), 0, 1));
      return [e[0], e[1], yaw, f, k];
    }
    // polyline of everything walked up to time t
    trail(t, kFrom = 0) {
      kFrom = Math.max(0, kFrom);
      const s0 = kFrom > 0 && kFrom <= this.R ? this.starts[Math.min(kFrom, this.R - 1)] : this.md.start;
      const out = [[s0[0], s0[1]]];
      const kmax = Math.min(Math.floor(t), this.R);
      for (let k = kFrom; k < kmax; k++) { const r = this.rounds[k]; if (r.pts) for (const p of r.pts) out.push(p); }
      if (t < this.R && t > 0) {
        const k = Math.floor(t), r = this.rounds[k];
        if (r.pts) {
          const f = Math.min((t - k) / MOVE, 1);
          const L = r.cum[r.cum.length - 1] * ease(f);
          for (let i = 0; i < r.pts.length && r.cum[i] <= L; i++) out.push(r.pts[i]);
          const p = along(r.pts, r.cum, ease(f)); out.push([p[0], p[1]]);
        }
      }
      return out;
    }
  }

  class Replay {
    constructor(stage, opts = {}) {
      this.stage = stage;
      this.canvas = document.createElement('canvas');
      stage.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.opts = Object.assign({ secPerRound: 0.55, highlights: true, labels: true, loop: false, showEntities: true, trail: 'full', recent: 6 }, opts);
      this.t = 0; this.playing = false; this.speed = 1; this.agents = [];
      this.cam = { zoom: 1, cx: 0, cy: 0 }; this.camTarget = null; this.hold = 0;
      this.onTick = null; this.onMoment = null; this.moments = [];
      this.firedMoments = new Set();
      this._last = null;
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(stage);
      this.resize();
      requestAnimationFrame((ts) => this.frame(ts));
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = this.stage.clientWidth, h = this.stage.clientHeight;
      this.W = w; this.H = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.fit();
    }
    load(data, layerKey, agentKeys, moments) {
      this.data = data;
      this.layerKey = layerKey in data.layers ? layerKey : 'plan';
      this.layer = data.layers[this.layerKey];
      this.img = new Image();
      this.imgReady = false;
      this.img.onload = () => { this.imgReady = true; };
      this.img.src = this.layer.img;
      this.setAgents(agentKeys);
      this.moments = (moments || []).slice().sort((a, b) => a.r - b.r);
      this.firedMoments = new Set();
      this.t = 0; this.hold = 0; this.camTarget = null;
      this.fit();
      this.cam.zoom = this.base.zoom; this.cam.cx = this.base.cx; this.cam.cy = this.base.cy;
    }
    setLayer(layerKey) {
      if (!this.data || !(layerKey in this.data.layers)) return;
      this.layerKey = layerKey; this.layer = this.data.layers[layerKey];
      this.imgReady = false; this.img = new Image(); this.img.onload = () => { this.imgReady = true; }; this.img.src = this.layer.img;
      this.fit(); this.cam.zoom = this.base.zoom; this.cam.cx = this.base.cx; this.cam.cy = this.base.cy;
    }
    setAgents(keys) {
      this.agents = ORDER.filter((k) => keys.includes(k) && this.data.methods[k]).map((k) => new Agent(k, this.data.methods[k]));
      this.maxR = Math.max(...this.agents.map((a) => a.R));
    }
    // world -> layer image px
    w2i(x, y) {
      const A = this.layer.A;
      if (A.length === 9) { const w = A[6] * x + A[7] * y + A[8]; return [(A[0] * x + A[1] * y + A[2]) / w, (A[3] * x + A[4] * y + A[5]) / w]; }
      return [A[0] * x + A[1] * y + A[2], A[3] * x + A[4] * y + A[5]];
    }
    // layer image px -> screen css px
    i2s(u, v) { return [(u - this.cam.cx) * this.cam.zoom + this.W / 2, (v - this.cam.cy) * this.cam.zoom + this.H / 2]; }
    w2s(x, y) { const p = this.w2i(x, y); return this.i2s(p[0], p[1]); }
    fit() {
      if (!this.data || !this.W) return;
      const v = this.data.view;
      const cs = this.opts.fit === 'image' && this.layerKey !== 'plan'
        ? [[0, 0], [this.layer.W, 0], [0, this.layer.H], [this.layer.W, this.layer.H]]
        : [[v[0], v[2]], [v[1], v[2]], [v[0], v[3]], [v[1], v[3]]].map((p) => this.w2i(p[0], p[1]));
      const us = cs.map((p) => p[0]), vs = cs.map((p) => p[1]);
      const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
      const pad = 0.94;
      const zoom = Math.min(this.W * pad / (u1 - u0), this.H * pad / (v1 - v0));
      this.base = { zoom, cx: (u0 + u1) / 2, cy: (v0 + v1) / 2 };
      if (!this.camTarget && !this.hold) { this.cam.zoom = zoom; this.cam.cx = this.base.cx; this.cam.cy = this.base.cy; }
    }
    seek(t) { this.t = clamp(t, 0, this.maxR); this.hold = 0; this.camTarget = null; if (this.onMoment) this.onMoment(null); this.firedMoments = new Set(this.moments.filter((m) => m.r + 0.8 <= this.t).map((m) => m)); this._emit(); }
    play() { if (this.t >= this.maxR) this.seek(0); this.playing = true; }
    pause() { this.playing = false; }
    _emit() { if (this.onTick) this.onTick(this.t); }
    focusPoint(m) {
      if (m.focus && m.focus.startsWith && m.focus !== 'agent') {
        const e = (this.data.entities || []).find((x) => x.role === m.focus);
        if (e) return [e.x, e.y];
      }
      const a = this.agents.find((x) => x.key === (m.who || 'beliefact')) || this.agents[0];
      const p = a.pose(m.r + 0.99); return [p[0], p[1]];
    }
    frame(ts) {
      if (this.opts.manual) return;
      const dt = this._last == null ? 0 : Math.min((ts - this._last) / 1000, 0.1);
      this._last = ts;
      this.step(dt);
      requestAnimationFrame((x) => this.frame(x));
    }
    // advance by dt seconds and draw (used by frame(), and directly for frame-exact video export)
    step(dt) {
      if (this.data) {
        if (this.hold > 0) {
          this.hold -= dt;
          if (this.hold <= 0) { this.hold = 0; this.camTarget = null; if (this.onMoment) this.onMoment(null); }
        } else if (this.playing) {
          const prev = this.t;
          this.t = Math.min(this.t + dt * this.speed / this.opts.secPerRound, this.maxR);
          for (const m of this.moments) {
            const at = m.r + 0.8;
            if (prev < at && this.t >= at && !this.firedMoments.has(m)) {
              this.firedMoments.add(m);
              if (this.opts.highlights && m.zoom !== false) {
                this.t = at; this.hold = this.opts.holdSec || 2.6;
                const fp = this.focusPoint(m); const ip = this.w2i(fp[0], fp[1]);
                this.camTarget = { zoom: this.base.zoom * (this.opts.zoomBy || 1.9), cx: ip[0], cy: ip[1] };
              }
              if (this.onMoment) this.onMoment(m);
              break;
            }
          }
          if (this.t >= this.maxR) {
            if (this.opts.loop) { this.loopWait = (this.loopWait || 0) + dt; if (this.loopWait > 2.5) { this.loopWait = 0; this.seek(0); } }
            else this.playing = false;
          }
          this._emit();
        }
        // camera easing
        const tgt = this.camTarget || this.base;
        if (tgt) {
          const k = 1 - Math.pow(0.0015, dt);
          this.cam.zoom = lerp(this.cam.zoom, tgt.zoom, k);
          this.cam.cx = lerp(this.cam.cx, tgt.cx, k);
          this.cam.cy = lerp(this.cam.cy, tgt.cy, k);
        }
        this.draw();
      }
    }
    draw() {
      const c = this.ctx, dpr = this.dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, this.W, this.H);
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, this.W, this.H);
      if (this.imgReady) {
        const [x0, y0] = this.i2s(0, 0);
        c.imageSmoothingQuality = 'high';
        c.drawImage(this.img, x0, y0, this.layer.W * this.cam.zoom, this.layer.H * this.cam.zoom);
      }
      const zr = this.cam.zoom / this.base.zoom;
      if (this.opts.showEntities) this.drawEntities(zr);
      for (const a of this.agents) this.drawTrail(a, zr);
      for (const a of this.agents) this.drawEvents(a, zr);
      const poses = this.agents.map((a) => [a, a.pose(this.t)]);
      for (const [a, p] of poses) this.drawAction(a, p, zr);
      for (const [a, p] of poses) this.drawAgent(a, p, zr);
      if (this.opts.labels) this.drawLabels(poses, zr);
    }
    drawEntities(zr) {
      const c = this.ctx;
      c.font = `500 ${Math.round(11 * Math.min(1.25, Math.sqrt(zr)))}px -apple-system, "SF Pro Text", Inter, Helvetica, Arial`;
      const ents = (this.data.entities || []).slice().sort((a, b) => (b.role === 'dest' || b.role === 'target') - (a.role === 'dest' || a.role === 'target'));
      const boxes = [];
      const free = (r) => !boxes.some((b) => r[0] < b[0] + b[2] && b[0] < r[0] + r[2] && r[1] < b[1] + b[3] && b[1] < r[1] + r[3]);
      for (const e of ents) {
        const [x, y] = this.w2s(e.x, e.y);
        const isDest = e.role === 'dest' || e.role === 'target';
        c.beginPath(); c.arc(x, y, isDest ? 5 : 3.5, 0, 2 * Math.PI);
        c.fillStyle = isDest ? '#1d1d1f' : 'rgba(29,29,31,.45)'; c.fill();
        if (isDest) { c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); }
        const txt = isDest ? (e.role === 'target' ? e.name : e.name + ' · destination') : e.name;
        const tw = c.measureText(txt).width;
        const cands = [[x + 8, y - 9], [x - tw - 18, y - 9], [x - tw / 2 - 5, y + 8], [x - tw / 2 - 5, y - 27]];
        const pos = cands.map((p) => [p[0], p[1], tw + 10, 18]).find(free);
        if (!pos) continue;
        boxes.push(pos);
        c.fillStyle = 'rgba(255,255,255,.85)';
        roundRect(c, pos[0], pos[1], pos[2], 18, 9); c.fill();
        c.fillStyle = isDest ? '#1d1d1f' : '#6e6e73';
        c.fillText(txt, pos[0] + 5, pos[1] + 13);
      }
    }
    drawTrail(a, zr) {
      const c = this.ctx;
      c.lineJoin = 'round'; c.lineCap = 'round';
      const stroke = (pts, alpha, w) => {
        if (pts.length < 2) return;
        c.beginPath();
        pts.forEach((p, i) => { const s = this.w2s(p[0], p[1]); if (i) c.lineTo(s[0], s[1]); else c.moveTo(s[0], s[1]); });
        c.strokeStyle = hexA(a.color, alpha); c.lineWidth = w * Math.min(zr, 1.6); c.stroke();
      };
      const k = Math.min(Math.floor(this.t), a.R);
      const n = this.opts.recent;
      if (this.opts.trail === 'full') stroke(a.trail(this.t), 0.16, 1.6);
      // recent rounds, drawn as fading pieces (older = fainter)
      for (let j = Math.max(0, k - n); j <= k; j++) {
        if (j >= a.R) break;
        const age = k - j;
        const pts = a.trail(Math.min(this.t, j + 1), j);
        stroke(pts, 0.75 * (1 - age / (n + 1)), 2.8);
      }
    }
    drawEvents(a, zr) {
      const c = this.ctx;
      for (const e of a.md.events || []) {
        const age = this.t - (e.r + 0.8);
        if (age < 0 || age > 2.2) continue;
        const ent = (this.data.entities || []).find((x) => x.role === e.role_to) || (this.data.entities || []).find((x) => x.role === 'dest');
        if (!ent) continue;
        const [x, y] = this.w2s(ent.x, ent.y);
        const k = age / 2.2;
        c.beginPath(); c.arc(x, y, 8 + 34 * k, 0, 2 * Math.PI);
        c.strokeStyle = hexA(a.color, 0.75 * (1 - k)); c.lineWidth = 3; c.stroke();
      }
    }
    drawAction(a, p, zr) {
      const c = this.ctx; const [x, y] = this.w2s(p[0], p[1]);
      const k = p[4]; if (k == null) return;
      const r = a.rounds[k]; const f = p[3];
      const g = clamp((f - (r.pts ? MOVE : 0)) / (1 - (r.pts ? MOVE : 0)), 0, 1);
      if (g <= 0) return;
      if (r.a === 'scan_360') {
        const rad = 42 * Math.min(zr, 1.5);
        const yaw = this.screenYaw(p[0], p[1], p[2]);
        const grd = c.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, hexA(a.color, 0.28)); grd.addColorStop(1, hexA(a.color, 0));
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, rad, yaw - 0.55, yaw + 0.55); c.closePath(); c.fillStyle = grd; c.fill();
      } else if (['open', 'grasp', 'place', 'declare_done', 'wait'].includes(r.a)) {
        const rr = 9 + 16 * g;
        c.beginPath(); c.arc(x, y, rr, 0, 2 * Math.PI);
        c.strokeStyle = hexA(a.color, 0.55 * (1 - g)); c.lineWidth = 2; c.stroke();
      }
    }
    screenYaw(x, y, yaw) {
      const p0 = this.w2s(x, y), p1 = this.w2s(x + Math.cos(yaw) * 0.5, y + Math.sin(yaw) * 0.5);
      return Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
    drawAgent(a, p, zr) {
      const c = this.ctx; const [x, y] = this.w2s(p[0], p[1]);
      const rad = 7.5 * Math.min(1.35, Math.max(1, Math.sqrt(zr)));
      const done = this.t >= a.R;
      c.save();
      c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 8; c.shadowOffsetY = 2;
      c.beginPath(); c.arc(x, y, rad + 2.2, 0, 2 * Math.PI); c.fillStyle = '#fff'; c.fill();
      c.restore();
      c.beginPath(); c.arc(x, y, rad, 0, 2 * Math.PI); c.fillStyle = a.color; c.fill();
      if (!done) {
        const yaw = this.screenYaw(p[0], p[1], p[2]);
        c.beginPath(); c.moveTo(x + Math.cos(yaw) * (rad + 6), y + Math.sin(yaw) * (rad + 6));
        c.lineTo(x + Math.cos(yaw + 2.5) * (rad + 1), y + Math.sin(yaw + 2.5) * (rad + 1));
        c.lineTo(x + Math.cos(yaw - 2.5) * (rad + 1), y + Math.sin(yaw - 2.5) * (rad + 1));
        c.closePath(); c.fillStyle = a.color; c.fill();
      } else {
        c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath();
        if (a.md.success) { c.moveTo(x - 3.4, y + 0.2); c.lineTo(x - 0.8, y + 2.8); c.lineTo(x + 3.6, y - 2.6); }
        else { c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); }
        c.stroke();
      }
    }
    drawLabels(poses, zr) {
      const c = this.ctx;
      c.font = '600 12px -apple-system, "SF Pro Text", Inter, Helvetica, Arial';
      const placed = [];
      for (const [a, p] of poses) {
        if (this.t >= a.R && poses.some(([b, q]) => b !== a && this.t < b.R && Math.hypot(...this.w2s(q[0], q[1]).map((v, i) => v - this.w2s(p[0], p[1])[i])) < 60)) continue;
        let [x, y] = this.w2s(p[0], p[1]);
        let ly = y - 24;
        for (const q of placed) if (Math.abs(q[0] - x) < 70 && Math.abs(q[1] - ly) < 18) ly = q[1] - 20;
        placed.push([x, ly]);
        const txt = a.label; const tw = c.measureText(txt).width;
        c.fillStyle = a.color; roundRect(c, x - tw / 2 - 7, ly - 10, tw + 14, 19, 9.5); c.fill();
        c.fillStyle = '#fff'; c.fillText(txt, x - tw / 2, ly + 4);
      }
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  window.BAReplay = { Replay, COLORS, ORDER };
})();
