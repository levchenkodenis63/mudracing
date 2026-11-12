'use strict';
/* ===== MUD RACING — отрисовка (canvas 2D) ===== */
const RN = (function () {
  const C = MR.C, clamp = MR.clamp, lerp = MR.lerp;
  let cv, ctx, W = 0, H = 0, DPR = 1, ppm = 40, yFar = 0, yNear = 0, U = 1;
  const LG = 3.6; // расстояние между дорожками на экране, м
  const view = { cam: 0, T: 0, shake: 0, lo: 0.55, hi: 1 };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const FONT = '"Arial Black","Segoe UI Black","Roboto Black","Helvetica Neue",Arial,sans-serif';

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); }
  function resize() {
    W = cv.clientWidth || window.innerWidth; H = cv.clientHeight || window.innerHeight;
    const raw = window.devicePixelRatio || 1;
    DPR = Math.min(raw, (W < 700) ? 1.6 : 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ppm = clamp(H / 11.2, W / 30, W / 11);
    yFar = Math.round(H * 0.47); yNear = Math.round(yFar + LG * ppm);
    U = clamp(Math.min(W, H) / 720, 0.6, 1.35);
    skyGrad = bankGrad = vigGrad = null; sandGrad = [];
  }
  const sx = (x) => (x - view.cam) * ppm + W * 0.3;
  const xl = () => view.cam - (W * 0.3) / ppm - 1.5;
  const xr = () => view.cam + (W * 0.7) / ppm + 1.5;

  function line(pts, w, col, cap) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = cap || 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function poly(pts, col) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function circ(x, y, r, col) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = col; ctx.fill(); }
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function text(s, x, y, px, col, align, stroke, italic) {
    ctx.font = (italic ? 'italic ' : '') + '900 ' + Math.round(px) + 'px ' + FONT;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = Math.max(2, px * 0.16); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  /* ---------- фон ---------- */
  let skyGrad = null, bankGrad = null, sandGrad = [], vigGrad = null;
  function drawSky() {
    let g = skyGrad;
    if (!g) {
      g = skyGrad = ctx.createLinearGradient(0, 0, 0, yFar);
      g.addColorStop(0, '#5f9dd6'); g.addColorStop(0.7, '#cfe4f3'); g.addColorStop(1, '#e9f2f4');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, yFar + 2);
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    const span = 560 * U, off = view.cam * ppm * 0.04 + view.T * 5;
    const i0 = Math.floor(off / span) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / span) + 3; i++) {
      const cx = i * span - off + hash(i) * span * 0.6, cy = H * (0.04 + hash(i + 50) * 0.12), s = (0.6 + hash(i + 9) * 0.7) * 58 * U;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 1.6, s * 0.5, 0, 0, 6.2832);
      ctx.ellipse(cx - s * 0.7, cy + s * 0.12, s * 0.9, s * 0.4, 0, 0, 6.2832);
      ctx.ellipse(cx + s * 0.6, cy - s * 0.25, s * 0.8, s * 0.45, 0, 0, 6.2832);
      ctx.fill();
    }
  }
  function drawForest(par, baseY, scale, cols, seed) {
    const sp = 1.7 * scale * ppm, off = view.cam * ppm * par;
    const i0 = Math.floor(off / sp) - 2, n = Math.ceil(W / sp) + 5;
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const x = i * sp - off + hash(i * 3 + seed) * sp * 0.7;
      const h = (2.5 + hash(i + seed * 7) * 2.6) * scale * ppm;
      const w = h * (0.2 + hash(i * 5 + seed) * 0.08);
      ctx.fillStyle = cols[Math.floor(hash(i * 11 + seed) * cols.length)];
      if (hash(i * 13 + seed) > 0.32) {
        ctx.beginPath();
        for (let t = 0; t < 4; t++) {
          const yb = baseY - h * (0.1 + t * 0.2), yt = baseY - h * (0.48 + t * 0.175), ww = w * (1 - t * 0.2);
          ctx.moveTo(x - ww, yb); ctx.lineTo(x, yt); ctx.lineTo(x + ww, yb); ctx.closePath();
        }
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(x, baseY - h * 0.5, w * 1.5, h * 0.36, 0, 0, 6.2832);
        ctx.ellipse(x - w, baseY - h * 0.34, w * 1.2, h * 0.26, 0, 0, 6.2832);
        ctx.ellipse(x + w * 0.9, baseY - h * 0.38, w * 1.1, h * 0.25, 0, 0, 6.2832);
        ctx.fill();
      }
    }
  }
  const ridge = (x) => 1.45 + 0.4 * Math.sin(x * 0.19) + 0.22 * Math.sin(x * 0.47 + 1.3) + 0.08 * Math.sin(x * 1.3);
  function drawBank() {
    const a = xl(), b = xr();
    ctx.beginPath(); ctx.moveTo(sx(a), yFar + 4);
    for (let x = a; x <= b; x += 0.5) ctx.lineTo(sx(x), yFar - ridge(x) * ppm);
    ctx.lineTo(sx(b), yFar + 4); ctx.closePath();
    let g = bankGrad;
    if (!g) {
      g = bankGrad = ctx.createLinearGradient(0, yFar - 2 * ppm, 0, yFar);
      g.addColorStop(0, '#efe5c8'); g.addColorStop(1, '#d3c298');
    }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,60,.13)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = a; x <= b; x += 0.6) {
        const y = yFar - (ridge(x) * (0.72 - k * 0.22) + 0.06 * Math.sin(x * 2.1 + k * 2)) * ppm;
        if (x === a) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
      }
      ctx.stroke();
    }
  }
  function drawArch(x0, x1, label, base) {
    const X0 = sx(x0), X1 = sx(x1);
    if (X1 < -50 || X0 > W + 50) return;
    const hgt = 5.2 * ppm, lw = 1.05 * ppm, ch = 1.1 * ppm, top = base - hgt;
    ctx.fillStyle = '#17171b';
    ctx.beginPath();
    ctx.moveTo(X0, base); ctx.lineTo(X0, top + ch); ctx.lineTo(X0 + ch, top); ctx.lineTo(X1 - ch, top); ctx.lineTo(X1, top + ch); ctx.lineTo(X1, base);
    ctx.lineTo(X1 - lw, base); ctx.lineTo(X1 - lw, top + ch + lw * 0.55); ctx.lineTo(X1 - ch - lw * 0.45, top + lw);
    ctx.lineTo(X0 + ch + lw * 0.45, top + lw); ctx.lineTo(X0 + lw, top + ch + lw * 0.55); ctx.lineTo(X0 + lw, base);
    ctx.closePath(); ctx.fill();
    // следы протектора на стойках
    for (let s = 0; s < 2; s++) {
      const px = s ? X1 - lw : X0;
      for (let k = 0; k < 7; k++) {
        const y = base - (0.35 + k * 0.42) * ppm;
        ctx.fillStyle = k < 3 ? '#e8742a' : '#c9c9c4';
        ctx.globalAlpha = k < 3 ? 0.95 : 0.55;
        poly([px + lw * 0.14, y, px + lw * 0.46, y - 0.2 * ppm, px + lw * 0.46, y - 0.05 * ppm, px + lw * 0.14, y + 0.15 * ppm], ctx.fillStyle);
        poly([px + lw * 0.86, y, px + lw * 0.54, y - 0.2 * ppm, px + lw * 0.54, y - 0.05 * ppm, px + lw * 0.86, y + 0.15 * ppm], ctx.fillStyle);
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#e8742a';
    ctx.fillRect(X0 + ch + lw * 0.3, top + lw * 0.86, 0.9 * ppm, lw * 0.14);
    ctx.fillRect(X1 - ch - lw * 0.3 - 0.9 * ppm, top + lw * 0.86, 0.9 * ppm, lw * 0.14);
    text(label, (X0 + X1) / 2, top + lw * 0.5, lw * 0.6, '#ffffff', 'center', null, true);
  }
  const FLAGS = [['#f3f1ea', '#18181c', 'MUD RACING'], ['#d6312a', '#fff', 'КВАДРО'], ['#1c3d8c', '#fff', '4x4 КЛУБ'], ['#2f9a48', '#fff', 'БОЛОТО'], ['#17171b', '#e8742a', 'ГРЯЗЬ']];
  function drawFlags(base, track) {
    const a = xl(), b = xr();
    const k0 = Math.floor((a - 4) / 12.5), k1 = Math.ceil(b / 12.5);
    for (let k = k0; k <= k1; k++) {
      const x = 11 + k * 12.5 + hash(k) * 4;
      if (x > track.finish - 1 && x < track.finish + 10) continue;
      if (x < 2) continue;
      const f = FLAGS[((k % 5) + 5) % 5], X = sx(x), sway = Math.sin(view.T * 1.6 + k) * 0.08 * ppm;
      const top = base - 4.7 * ppm;
      ctx.strokeStyle = '#3b3b40'; ctx.lineWidth = Math.max(1.5, 0.05 * ppm);
      ctx.beginPath(); ctx.moveTo(X, base); ctx.lineTo(X, top); ctx.stroke();
      ctx.fillStyle = f[0];
      ctx.beginPath(); ctx.moveTo(X, top);
      ctx.quadraticCurveTo(X + 0.95 * ppm + sway, top + 0.05 * ppm, X + 1.0 * ppm + sway, top + 1.0 * ppm);
      ctx.lineTo(X + 0.85 * ppm + sway * 0.5, base - 1.25 * ppm); ctx.lineTo(X, base - 1.05 * ppm); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(X + 0.45 * ppm + sway * 0.4, top + 2.05 * ppm); ctx.rotate(Math.PI / 2);
      text(f[2], 0, 0, 0.4 * ppm, f[1], 'center'); ctx.restore();
    }
  }
  const SKIN = ['#f1c9a5', '#e2b48c', '#c99872', '#f6d6b8'];
  const CLOTH = ['#c0392b', '#2c3e50', '#ecf0f1', '#27ae60', '#2980b9', '#f1c40f', '#8e44ad', '#d35400', '#16a085', '#7f8c8d', '#f5f0e1', '#1f1f24'];
  function drawCrowd(base, riders) {
    const a = xl(), b = xr(), sp = 0.62;
    const i0 = Math.floor(a / sp), i1 = Math.ceil(b / sp);
    for (let i = i0; i <= i1; i++) {
      const px = i * sp + hash(i) * 0.3;
      if (px < 4) continue;
      if (hash(Math.floor(px / 10) + 77) < 0.3) continue;
      if (hash(i + 5) < 0.22) continue;
      let ex = 0;
      for (const r of riders) if (r) ex = Math.max(ex, 1 - Math.abs(r.x - px) / 11);
      ex = clamp(ex, 0, 1);
      const hgt = (1.5 + hash(i + 9) * 0.32) * ppm, X = sx(px);
      const bob = Math.abs(Math.sin(view.T * 7 + i * 1.7)) * 0.1 * ppm * ex;
      const y0 = base - bob, w = 0.4 * ppm;
      const col = CLOTH[Math.floor(hash(i * 3 + 1) * CLOTH.length)];
      ctx.fillStyle = '#2b2d36'; ctx.fillRect(X - w * 0.38, y0 - hgt * 0.47, w * 0.76, hgt * 0.47);
      ctx.fillStyle = col; rrect(X - w * 0.5, y0 - hgt * 0.84, w, hgt * 0.42, w * 0.25); ctx.fill();
      if (hash(i * 7 + 3) > 0.55 && ex > 0.25) {
        ctx.strokeStyle = col; ctx.lineWidth = w * 0.24; ctx.lineCap = 'round';
        const sw = Math.sin(view.T * 9 + i) * 0.1 * ppm;
        ctx.beginPath(); ctx.moveTo(X - w * 0.4, y0 - hgt * 0.78); ctx.lineTo(X - w * 0.75 + sw, y0 - hgt * 1.08);
        ctx.moveTo(X + w * 0.4, y0 - hgt * 0.78); ctx.lineTo(X + w * 0.75 + sw, y0 - hgt * 1.08); ctx.stroke();
      }
      circ(X, y0 - hgt * 0.93, w * 0.34, SKIN[Math.floor(hash(i * 5 + 2) * 4)]);
      const hh = hash(i * 17 + 4);
      if (hh > 0.45) {
        ctx.fillStyle = hh > 0.75 ? '#22232a' : CLOTH[Math.floor(hash(i * 19) * CLOTH.length)];
        ctx.beginPath(); ctx.arc(X, y0 - hgt * 0.95, w * 0.36, Math.PI, 0); ctx.fill();
      }
    }
    // ограждения
    ctx.strokeStyle = 'rgba(176,182,188,.95)';
    const s0 = Math.floor(a / 2.4), s1 = Math.ceil(b / 2.4);
    for (let s = s0; s <= s1; s++) {
      const x0 = s * 2.4;
      if (x0 < 3.5) continue;
      if (hash(Math.floor((x0 + 1.2) / 10) + 77) < 0.3) continue;
      const X0 = sx(x0) + 2, X1 = sx(x0 + 2.4) - 2, top = base - 1.1 * ppm, bot = base - 0.12 * ppm;
      ctx.lineWidth = Math.max(1.5, 0.05 * ppm);
      ctx.beginPath(); ctx.moveTo(X0, base); ctx.lineTo(X0, top); ctx.lineTo(X1, top); ctx.lineTo(X1, base); ctx.moveTo(X0, bot); ctx.lineTo(X1, bot); ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.022 * ppm);
      ctx.beginPath();
      for (let k = 1; k < 12; k++) { const xx = X0 + ((X1 - X0) * k) / 12; ctx.moveTo(xx, top); ctx.lineTo(xx, bot); }
      ctx.stroke();
    }
  }
  function tape(x0, x1, yFn, postH, every) {
    // стойки с красно-белой лентой
    const a = Math.max(x0, xl()), b = Math.min(x1, xr());
    if (a >= b) return;
    const k0 = Math.ceil(a / every), k1 = Math.floor(b / every);
    ctx.strokeStyle = '#d9d2bd'; ctx.lineWidth = Math.max(1.5, 0.045 * ppm); ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let k = k0; k <= k1; k++) { const x = k * every, X = sx(x), y = yFn(x); ctx.moveTo(X, y + 0.3 * ppm); ctx.lineTo(X, y - postH * ppm); }
    ctx.stroke();
    const d = 0.28 * ppm;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let x = a; x <= b + 0.01; x += 0.5) {
        const ph = ((x / every) % 1 + 1) % 1, sag = Math.sin(ph * Math.PI) * 0.12 * ppm;
        const y = yFn(x) - postH * ppm * 0.92 + sag;
        if (x === a) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
      }
      ctx.lineWidth = Math.max(2, 0.07 * ppm);
      if (pass === 0) { ctx.setLineDash([]); ctx.strokeStyle = '#f4f1ea'; }
      else { ctx.setLineDash([d, d]); ctx.lineDashOffset = view.cam * ppm; ctx.strokeStyle = '#d93a2e'; }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  function cone(x, y, s) {
    const X = sx(x), w = 0.22 * ppm * s, h = 0.62 * ppm * s;
    poly([X - w, y, X + w, y, X + w * 0.22, y - h, X - w * 0.22, y - h], '#f2641f');
    poly([X - w * 0.72, y - h * 0.3, X + w * 0.72, y - h * 0.3, X + w * 0.56, y - h * 0.5, X - w * 0.56, y - h * 0.5], '#f6f3ea');
    ctx.fillStyle = '#d9541a'; ctx.fillRect(X - w * 1.25, y - 0.03 * ppm, w * 2.5, 0.06 * ppm);
  }
  function drawLightPole(x, base, lights) {
    const X = sx(x);
    if (X < -80 || X > W + 80) return;
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(X - 0.05 * ppm, base - 3.0 * ppm, 0.1 * ppm, 3.0 * ppm);
    ctx.fillStyle = '#121214'; rrect(X - 0.3 * ppm, base - 4.3 * ppm, 0.6 * ppm, 1.5 * ppm, 0.1 * ppm); ctx.fill();
    const cols = [['#ff3b2f', '#4a1512'], ['#ffc928', '#4a3b10'], ['#3be35a', '#113d1a']];
    for (let i = 0; i < 3; i++) {
      const on = (i === 0 && (lights === 1 || lights === 2)) || (i === 1 && lights === 2) || (i === 2 && lights === 3);
      if (on) { ctx.shadowColor = cols[i][0]; ctx.shadowBlur = 14; }
      circ(X, base - (4.0 - i * 0.45) * ppm, 0.17 * ppm, on ? cols[i][0] : cols[i][1]);
      ctx.shadowBlur = 0;
    }
  }

  /* ---------- квадроцикл ---------- */
  function wheel(cx, cy, ang, rim, far) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ang);
    const tc = far ? '#0a0a0c' : '#141417';
    circ(0, 0, 0.4, tc);
    ctx.strokeStyle = tc; ctx.lineWidth = 0.11; ctx.lineCap = 'butt'; ctx.setLineDash([0.1, 0.084]);
    ctx.beginPath(); ctx.arc(0, 0, 0.41, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    if (!far) {
      ctx.strokeStyle = '#2a2a31'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0, 0, 0.31, 0, 6.2832); ctx.stroke();
      circ(0, 0, 0.225, rim); circ(0, 0, 0.17, '#0c0c0e');
      ctx.strokeStyle = '#34343c'; ctx.lineWidth = 0.04; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = (k * 6.2832) / 5; ctx.moveTo(Math.cos(a) * 0.04, Math.sin(a) * 0.04); ctx.lineTo(Math.cos(a) * 0.155, Math.sin(a) * 0.155); }
      ctx.stroke();
      circ(0, 0, 0.05, '#6a6a72');
    }
    ctx.restore();
  }
  function drawQuad(r, base, look) {
    const v = r._v || { sus: 0, stand: 0 };
    const hw = C.WB / 2, wr = C.WR;
    ctx.save();
    ctx.translate(sx(r.x), base - r.y * ppm); ctx.scale(ppm, -ppm); ctx.rotate(r.pitch);
    const bc = look.body, ac = look.accent, s = v.sus;
    wheel(-hw + 0.07, wr + 0.04, r.wheel, ac, true); wheel(hw + 0.07, wr + 0.04, r.wheel, ac, true);
    // рычаги и амортизаторы
    line([-0.3, 0.62 + s, -hw, wr], 0.06, '#0e0e10'); line([0.3, 0.62 + s, hw, wr], 0.06, '#0e0e10');
    line([-0.48, 1.0 + s, -hw + 0.04, wr + 0.08], 0.075, ac); line([0.5, 1.0 + s, hw - 0.04, wr + 0.08], 0.075, ac);
    ctx.setLineDash([0.035, 0.035]); line([-0.48, 1.0 + s, -hw + 0.04, wr + 0.08], 0.08, 'rgba(0,0,0,.45)', 'butt'); line([0.5, 1.0 + s, hw - 0.04, wr + 0.08], 0.08, 'rgba(0,0,0,.45)', 'butt'); ctx.setLineDash([]);
    ctx.save(); ctx.translate(0, s);
    poly([-0.92, 0.58, 0.86, 0.58, 1.02, 0.76, 0.9, 0.9, -0.96, 0.9], '#131316');
    poly([-0.3, 0.62, 0.34, 0.62, 0.3, 0.9, -0.26, 0.9], '#2a2a30');
    poly([-0.4, 0.56, 0.36, 0.56, 0.38, 0.66, -0.42, 0.66], '#0b0b0d');
    // бампер и багажник
    line([0.86, 0.62, 1.27, 0.68, 1.31, 0.99, 1.04, 1.1], 0.07, ac);
    line([1.0, 0.86, 1.3, 0.86], 0.05, ac);
    line([-1.2, 1.0, -1.27, 1.14, -0.72, 1.15], 0.055, look.rack || ac);
    // пластик
    ctx.beginPath(); ctx.moveTo(-1.22, 0.86); ctx.quadraticCurveTo(-1.26, 1.06, -0.86, 1.1); ctx.lineTo(-0.24, 1.05); ctx.lineTo(-0.2, 0.86); ctx.closePath(); ctx.fillStyle = bc; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.26, 0.86); ctx.lineTo(0.34, 1.12); ctx.lineTo(0.92, 1.12); ctx.quadraticCurveTo(1.2, 1.06, 1.24, 0.86); ctx.closePath(); ctx.fill();
    poly([-0.22, 0.86, -0.02, 1.12, 0.36, 1.14, 0.3, 0.86], look.body2 || bc);
    line([-1.16, 0.9, -0.3, 0.9], 0.035, look.stripe || ac, 'butt'); line([0.34, 0.9, 1.18, 0.9], 0.035, look.stripe || ac, 'butt');
    // сиденье
    ctx.beginPath(); ctx.moveTo(-0.74, 1.07); ctx.quadraticCurveTo(-0.4, 1.19, 0.0, 1.12); ctx.lineTo(0.28, 1.16); ctx.lineTo(0.28, 1.02); ctx.lineTo(-0.74, 1.0); ctx.closePath(); ctx.fillStyle = '#0f0f12'; ctx.fill();
    // вынесенный радиатор и «люстра»
    poly([0.5, 1.13, 1.03, 1.13, 1.05, 1.31, 0.56, 1.37], '#17171b');
    line([0.62, 1.2, 0.98, 1.18], 0.02, '#3a3a42', 'butt'); line([0.62, 1.27, 0.98, 1.24], 0.02, '#3a3a42', 'butt');
    ctx.shadowColor = '#fff3b0'; ctx.shadowBlur = 10; poly([1.02, 1.16, 1.09, 1.16, 1.09, 1.28, 1.03, 1.28], '#fff8d2'); ctx.shadowBlur = 0;
    // шноркели
    const sn = look.snorkel || '#2b2b31';
    line([0.36, 1.12, 0.36, 1.5, 0.44, 1.58], 0.1, sn); line([0.48, 1.14, 0.48, 1.44, 0.56, 1.52], 0.1, sn);
    // руль
    line([0.52, 1.1, 0.22, 1.43], 0.045, '#1c1c20');
    // райдер
    const st = v.stand;
    const hip = [lerp(-0.3, -0.2, st), lerp(1.2, 1.38, st)];
    const sh = [hip[0] + lerp(0.3, 0.36, st), hip[1] + lerp(0.5, 0.46, st)];
    const hand = [0.2, 1.45], knee = [lerp(0.14, 0.1, st), lerp(1.12, 1.04, st)], foot = [-0.02, 0.72];
    const elb = [(sh[0] + hand[0]) / 2 - 0.07, (sh[1] + hand[1]) / 2 - 0.1];
    const head = [sh[0] + 0.1, sh[1] + 0.2];
    line([knee[0], knee[1], foot[0], foot[1]], 0.15, look.pants || '#20222b');
    poly([foot[0] - 0.1, foot[1] - 0.08, foot[0] + 0.2, foot[1] - 0.08, foot[0] + 0.2, foot[1] + 0.02, foot[0] + 0.04, foot[1] + 0.12, foot[0] - 0.1, foot[1] + 0.12], '#0d0d10');
    line([hip[0], hip[1], knee[0], knee[1]], 0.2, look.pants || '#20222b');
    line([hip[0], hip[1] + 0.02, sh[0], sh[1]], 0.33, look.jersey);
    line([hip[0] + 0.05, hip[1] + 0.12, sh[0] - 0.02, sh[1] - 0.1], 0.1, look.jersey2);
    line([sh[0], sh[1], elb[0], elb[1], hand[0], hand[1]], 0.125, look.jersey2);
    circ(hand[0], hand[1], 0.07, '#1b1b1f');
    poly([hand[0] - 0.02, hand[1] + 0.09, hand[0] + 0.16, hand[1] + 0.05, hand[0] + 0.17, hand[1] - 0.08, hand[0] + 0.02, hand[1] - 0.1], '#101013');
    // шлем
    circ(head[0], head[1], 0.175, look.helmet);
    poly([head[0] + 0.02, head[1] + 0.13, head[0] + 0.33, head[1] + 0.2, head[0] + 0.14, head[1] + 0.03], look.helmet2);
    poly([head[0] + 0.05, head[1] - 0.06, head[0] + 0.25, head[1] - 0.1, head[0] + 0.2, head[1] - 0.2, head[0] + 0.0, head[1] - 0.17], look.helmet2);
    poly([head[0] + 0.07, head[1] + 0.06, head[0] + 0.19, head[1] + 0.04, head[0] + 0.19, head[1] - 0.05, head[0] + 0.07, head[1] - 0.05], '#0c0c10');
    ctx.restore();
    wheel(-hw, wr, r.wheel, ac, false); wheel(hw, wr, r.wheel, ac, false);
    ctx.restore();
  }
  function drawTag(r, base, e, lane) {
    const X = sx(r.x), Y = base - (r.y + 2.45) * ppm;
    const px = 13 * U;
    if (e.player) {
      const lo = view.lo, hi = view.hi, w = 1.9 * ppm, h = Math.max(6, 0.17 * ppm), x0 = X - w / 2, y0 = Y - h - 2;
      ctx.fillStyle = 'rgba(10,10,12,.75)'; rrect(x0 - 2, y0 - 2, w + 4, h + 4, 3); ctx.fill();
      ctx.fillStyle = '#4b4d55'; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = '#35d657'; ctx.fillRect(x0 + w * lo, y0, w * (hi - lo), h);
      if (hi < 0.995) { ctx.fillStyle = '#e5382b'; ctx.fillRect(x0 + w * hi, y0, w * (1 - hi), h); }
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 + w * r.rpm - 2, y0 - 3, 4, h + 6);
      text('▼ ' + e.name, X, y0 - px * 0.95, px, '#ffd23e', 'center', 'rgba(0,0,0,.75)');
    } else {
      text(e.name, X, Y - px * 0.4, px, '#ffffff', 'center', 'rgba(0,0,0,.7)');
    }
  }

  /* ---------- дорожка ---------- */
  function waveAt(x, riders, b) {
    let w = 0.022 * Math.sin(x * 2.1 + view.T * 2.3) + 0.013 * Math.sin(x * 5.3 - view.T * 3.4);
    for (const r of riders) {
      if (!r || r.air || r.depth < 0.06) continue;
      const A = Math.min(0.3, (0.03 + 0.028 * r.v) * Math.min(1, r.depth * 2.5));
      const dx = x - r.x;
      w += A * Math.exp(-((dx - 1.15) ** 2) / 0.35);
      w -= A * 0.5 * Math.exp(-((dx + 1.0) ** 2) / 0.9);
      if (dx < -0.8 && dx > -9) w += A * 0.4 * Math.sin(dx * 3.2 + view.T * 9) * Math.exp(dx / 3.5);
    }
    const edge = Math.min(1, (x - b.x0) / 1.2, (b.x1 - x) / 1.2);
    return w * Math.max(0, edge);
  }
  function drawLane(l, base, S) {
    const track = S.track, lane = track.lanes[l], a = xl(), b = xr();
    const e = S.lanes[l], r = e ? e.r : null, rs = r ? [r] : [];
    const st = 0.2;
    // разделительная лента на песке
    const yF = (x) => base - Math.max(0, MR.hAt(lane, x)) * ppm - 0.02 * ppm;
    tape(-8, track.baths[0].x0 - 0.2, yF, 0.95, 2);
    for (const g of track.gaps) tape(g.x0 + 0.4, g.x1 - 0.2, yF, 0.95, 1.2);
    tape(track.baths[2].x1 + 0.6, track.end, yF, 0.95, 2);
    // песок
    ctx.beginPath(); ctx.moveTo(sx(a), H + 6);
    for (let x = a; x <= b; x += st) ctx.lineTo(sx(x), base - MR.hAt(lane, x) * ppm);
    ctx.lineTo(sx(b), H + 6); ctx.closePath();
    // у каждой дорожки своя базовая линия, поэтому и градиент свой
    let g = sandGrad[l];
    if (!g) {
      g = sandGrad[l] = ctx.createLinearGradient(0, base - 0.4 * ppm, 0, base + 4.2 * ppm);
      g.addColorStop(0, '#e6dab6'); g.addColorStop(0.35, '#cdb98c'); g.addColorStop(1, '#a58b5a');
    }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#f3ead0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(95,72,36,.12)'; ctx.lineWidth = Math.max(1.5, 0.05 * ppm);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let x = a; x <= b; x += 0.6) {
        const y = base + (1.45 + k * 0.55 + 0.12 * Math.sin(x * 0.7 + k * 1.9) + 0.05 * Math.sin(x * 2.3 + k)) * ppm;
        if (x === a) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,70,40,.22)';
    const j0 = Math.floor(a / 0.9), j1 = Math.ceil(b / 0.9);
    for (let j = j0; j <= j1; j++) {
      const x = j * 0.9 + hash(j + l * 99) * 0.8, y = base + (1.35 + hash(j * 3 + l) * 2.4) * ppm;
      ctx.beginPath(); ctx.ellipse(sx(x), y, 0.05 * ppm * (1 + hash(j)), 0.03 * ppm, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    // разметка старта и финиша
    const mark = (x, checker) => {
      const X = sx(x); if (X < -40 || X > W + 40) return;
      const y = base - MR.hAt(lane, x) * ppm, w = 0.16 * ppm, n = 5, hh = 0.11 * ppm;
      for (let k = 0; k < n; k++) for (let c = 0; c < 2; c++) {
        ctx.fillStyle = checker ? ((k + c) % 2 ? '#111' : '#fff') : '#fff';
        ctx.fillRect(X - w + c * w, y + 1 + k * hh, w, hh);
      }
    };
    mark(0, false); mark(track.finish, true);
    cone(-0.15, base - 0.02 * ppm, 1);
    cone(track.finish, base - MR.hAt(lane, track.finish) * ppm, 1);
    for (const gp of track.gaps) { const c = (gp.x0 + gp.x1) / 2; if (l === 0) cone(c, base - MR.hAt(lane, c) * ppm - 0.02 * ppm, 0.9); }
    // поплавки-разделители в ваннах
    for (const bt of track.baths) {
      const k0 = Math.ceil(Math.max(bt.x0 + 2, a) / 1.6), k1 = Math.floor(Math.min(bt.x1 - 2, b) / 1.6);
      ctx.strokeStyle = 'rgba(240,240,235,.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = k0; k <= k1; k++) {
        const x = k * 1.6, y = base - (C.WATER + waveAt(x, rs, bt)) * ppm;
        if (k === k0) ctx.moveTo(sx(x), y); else ctx.lineTo(sx(x), y);
      }
      ctx.stroke();
      for (let k = k0; k <= k1; k++) {
        const x = k * 1.6, y = base - (C.WATER + waveAt(x, rs, bt)) * ppm;
        ctx.fillStyle = k % 2 ? '#f0b9a8' : '#f6f2ea';
        ctx.fillRect(sx(x) - 0.17 * ppm, y - 0.13 * ppm, 0.34 * ppm, 0.17 * ppm);
      }
    }
    // квадроцикл
    if (e) drawQuad(r, base, e.look);
    // бурун у корпуса
    if (r && r.depth > 0.12 && !r.air) {
      const X = sx(r.x), Y = base - (C.WATER + waveAt(r.x, rs, { x0: r.x - 3, x1: r.x + 3 })) * ppm;
      const foam = Math.min(1, r.depth * 1.4) * Math.min(1, 0.35 + r.v * 0.06);
      ctx.globalAlpha = 0.55 * foam;
      ctx.fillStyle = '#f2f1e6';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(X + (k - 1) * 0.55 * ppm, Y - 0.06 * ppm, 0.42 * ppm, 0.13 * ppm, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // вода
    for (const bt of track.baths) {
      const x0 = Math.max(bt.x0, a), x1 = Math.min(bt.x1, b);
      if (x0 >= x1) continue;
      const tops = [];
      ctx.beginPath();
      let first = true;
      for (let x = x0; x <= x1 + 0.001; x += st) {
        const wy = C.WATER + waveAt(x, rs, bt), hy = MR.hAt(lane, x), top = Math.max(wy, hy);
        tops.push(x, wy, hy);
        const Y = base - top * ppm;
        if (first) { ctx.moveTo(sx(x), Y); first = false; } else ctx.lineTo(sx(x), Y);
      }
      for (let i = tops.length - 3; i >= 0; i -= 3) ctx.lineTo(sx(tops[i]), base - tops[i + 2] * ppm);
      ctx.closePath();
      const wg = ctx.createLinearGradient(0, base + 0.2 * ppm, 0, base + 1.3 * ppm);
      wg.addColorStop(0, 'rgba(171,175,155,.46)'); wg.addColorStop(0.55, 'rgba(126,124,96,.6)'); wg.addColorStop(1, 'rgba(84,78,58,.78)');
      ctx.fillStyle = wg; ctx.fill();
      ctx.beginPath(); first = true;
      for (let i = 0; i < tops.length; i += 3) {
        if (tops[i + 1] < tops[i + 2]) { first = true; continue; }
        const X = sx(tops[i]), Y = base - tops[i + 1] * ppm;
        if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = 'rgba(244,244,232,.85)'; ctx.lineWidth = Math.max(1.5, 0.05 * ppm); ctx.lineJoin = 'round'; ctx.stroke();
    }
    // брызги
    for (const p of S.particles) {
      if (p.l !== l) continue;
      const X = sx(p.x); if (X < -20 || X > W + 20) continue;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.8);
      ctx.fillStyle = p.c;
      const sz = Math.max(1.2, p.s * ppm);
      ctx.beginPath(); ctx.arc(X, base - p.y * ppm, sz, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (e && S.tags) drawTag(r, base, e, l);
  }
  function drawFinishFlag(x, base) {
    const X = sx(x); if (X < -60 || X > W + 60) return;
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(X - 0.04 * ppm, base - 3.2 * ppm, 0.08 * ppm, 3.2 * ppm);
    const cw = 0.24 * ppm;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const wv = Math.sin(view.T * 5 + i * 0.8) * 0.05 * ppm * (i / 4);
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(X + i * cw, base - 3.2 * ppm + j * cw + wv, cw + 0.5, cw + 0.5);
    }
  }

  /* ---------- HUD ---------- */
  function drawGauge(r, cx, cy, R) {
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, A = (v) => a0 + (a1 - a0) * v;
    circ(cx, cy, R * 1.16, 'rgba(12,12,15,.82)');
    ctx.lineCap = 'butt';
    const arc = (v0, v1, col, w) => { ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, A(v0), A(v1)); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); };
    arc(0, 1, '#3d3f47', R * 0.2);
    const inZone = r.rpm >= view.lo && r.rpm <= view.hi;
    arc(view.lo, view.hi, inZone ? '#48f06c' : '#2bb84a', R * 0.2);
    if (view.hi < 0.995) arc(view.hi, 1, '#e5382b', R * 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) { const a = A(k / 10); ctx.moveTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7); ctx.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); }
    ctx.stroke();
    const an = A(r.rpm);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, R * 0.06); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * R * 0.12, cy - Math.sin(an) * R * 0.12); ctx.lineTo(cx + Math.cos(an) * R * 1.02, cy + Math.sin(an) * R * 1.02); ctx.stroke();
    circ(cx, cy, R * 0.1, '#ff6a1a');
    text(String(Math.round(r.v * 3.6)), cx, cy + R * 0.42, R * 0.4, '#fff', 'center');
    text('км/ч', cx, cy + R * 0.76, R * 0.17, '#b9bcc4', 'center');
    // температура
    const bx = cx + R * 1.32, bw = R * 0.22, bh = R * 1.7, by = cy - bh / 2 + R * 0.05;
    ctx.fillStyle = 'rgba(12,12,15,.82)'; rrect(bx - 4, by - 4, bw + 8, bh + 8 + R * 0.3, 6); ctx.fill();
    ctx.fillStyle = '#3d3f47'; ctx.fillRect(bx, by, bw, bh);
    const hv = clamp(r.heat, 0, 1), blink = r.cut > 0 && Math.sin(view.T * 20) > 0;
    ctx.fillStyle = r.cut > 0 ? (blink ? '#fff' : '#e5382b') : hv > 0.75 ? '#e5382b' : hv > 0.45 ? '#ffb020' : '#48c6f0';
    ctx.fillRect(bx, by + bh * (1 - hv), bw, bh * hv);
    text('t°', bx + bw / 2, by + bh + R * 0.2, R * 0.2, '#fff', 'center');
  }
  function fmt(t) { return (t < 0 ? 0 : t).toFixed(2); }
  function drawHUD(S) {
    const pe = S.lanes[S.pl], pr = pe ? pe.r : null;
    const k = Math.min(1, view.dt * 10 || 1);
    if (pr) { view.lo += (pr.lo - view.lo) * k; view.hi += (pr.hi - view.hi) * k; }
    // таймер
    const tw = 190 * U, th = 54 * U;
    ctx.fillStyle = 'rgba(12,12,15,.8)'; rrect(W / 2 - tw / 2, 10 * U, tw, th, 10 * U); ctx.fill();
    const tt = pr && pr.fin ? pr.time : Math.max(0, S.t);
    text(fmt(tt), W / 2, 10 * U + th / 2 + 1, 36 * U, pr && pr.fin ? '#48f06c' : '#fff', 'center', null, true);
    if (S.pen) text('+' + S.pen.toFixed(1) + ' фальстарт', W / 2, 10 * U + th + 12 * U, 14 * U, '#ff5a4a', 'center', 'rgba(0,0,0,.7)');
    text(S.label || '', 62 * U, 26 * U, 15 * U, '#fff', 'left', 'rgba(0,0,0,.7)');
    if (S.place) {
      text('МЕСТО', 62 * U, 52 * U, 11 * U, '#9aa1ad', 'left', 'rgba(0,0,0,.7)');
      text(S.place + '/' + S.rivals, 62 * U, 76 * U, 25 * U, S.place === 1 ? '#7dffa8' : '#fff', 'left', 'rgba(0,0,0,.75)', true);
    }
    if (S.split !== null && S.split !== undefined) {
      const abs = Math.abs(S.split), ahead = S.split < 0;
      text((ahead ? '▲ ' : '▼ ') + abs.toFixed(1) + ' м', W - 16 * U, 66 * U, 16 * U, ahead ? '#7dffa8' : '#ff9a7a', 'right', 'rgba(0,0,0,.75)', true);
    }
    // мини-карта
    const mw = Math.min(W * 0.62, 560 * U), mx = W / 2 - mw / 2, my = 10 * U + th + (S.pen ? 26 : 10) * U, mh = 9 * U;
    const fx = (x) => mx + clamp(x / S.track.finish, 0, 1) * mw;
    ctx.fillStyle = 'rgba(12,12,15,.8)'; rrect(mx - 5, my - 5, mw + 10, mh + 10, 6); ctx.fill();
    ctx.fillStyle = '#d9cba3'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#6d8590';
    for (const b of S.track.baths) ctx.fillRect(fx(b.x0), my, fx(b.x1) - fx(b.x0), mh);
    for (let l = 0; l < 2; l++) {
      const e = S.lanes[l]; if (!e) continue;
      const X = fx(e.r.x), Y = my + mh / 2;
      circ(X, Y, (e.player ? 8 : 6) * U, e.player ? '#fff' : '#111');
      circ(X, Y, (e.player ? 5.5 : 4.5) * U, e.look.accent);
    }
    // тахометр
    if (pr) {
      const R = 58 * U;
      drawGauge(pr, 20 * U + R * 1.16, H - 18 * U - R * 1.16, R);
      const inWater = pr.d > 0.02;
      text(inWater ? 'ВОДА · глубина ' + pr.depth.toFixed(1) + ' м' : 'ПЕСОК · газ в пол!', 20 * U, H - 30 * U - R * 2.5, 13 * U, inWater ? '#9fe0ff' : '#ffe08a', 'left', 'rgba(0,0,0,.75)');
    }
    // светофор
    if (S.lights > 0 && S.lightA > 0) {
      ctx.globalAlpha = S.lightA;
      const lr = 26 * U, bw2 = lr * 8.2, bh2 = lr * 3, bx2 = W / 2 - bw2 / 2, by2 = H * 0.2;
      ctx.fillStyle = '#101013'; rrect(bx2, by2, bw2, bh2, lr * 0.7); ctx.fill();
      ctx.strokeStyle = '#34343b'; ctx.lineWidth = 3; ctx.stroke();
      const cols = [['#ff3b2f', '#3d1411'], ['#ffc928', '#3d300e'], ['#3be35a', '#0f3317']];
      for (let i = 0; i < 3; i++) {
        const on = (i === 0 && (S.lights === 1 || S.lights === 2)) || (i === 1 && S.lights === 2) || (i === 2 && S.lights === 3);
        if (on) { ctx.shadowColor = cols[i][0]; ctx.shadowBlur = 30 * U; }
        circ(W / 2 + (i - 1) * lr * 2.6, by2 + bh2 / 2, lr, on ? cols[i][0] : cols[i][1]);
        ctx.shadowBlur = 0;
      }
      const cap = S.lights === 1 ? 'НА СТАРТ' : S.lights === 2 ? 'ВНИМАНИЕ' : 'МАРШ!';
      text(cap, W / 2, by2 + bh2 + 22 * U, 22 * U, '#fff', 'center', 'rgba(0,0,0,.8)', true);
      ctx.globalAlpha = 1;
    }
    if (S.hint) text(S.hint, W / 2, H - 22 * U, 14 * U, '#fff', 'center', 'rgba(0,0,0,.75)');
  }
  function drawOverlayFx(S) {
    for (const s of S.splats) {
      ctx.globalAlpha = clamp(s.a, 0, 1) * 0.9; ctx.fillStyle = s.c;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const an = (i / 10) * 6.2832, rr = s.r * U * (0.75 + 0.35 * hash(s.seed + (i % 10)));
        const px = s.x * W + Math.cos(an) * rr, py = s.y * H + Math.sin(an) * rr * (1 + s.drip * (Math.sin(an) > 0.5 ? 1 : 0));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    let row = 0;
    for (let i = S.msgs.length - 1; i >= 0; i--) {
      const m = S.msgs[i], p = 1 - m.life / m.max;
      ctx.globalAlpha = clamp(m.life / 0.35, 0, 1);
      const sc = 1 + Math.max(0, 0.25 - p * 2.5);
      text(m.text, W / 2, H * 0.36 - row * 40 * U - p * 26 * U, (m.big ? 40 : 28) * U * sc, m.col, 'center', 'rgba(0,0,0,.82)', true);
      row++;
    }
    ctx.globalAlpha = 1;
  }

  function render(S) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (view.shake > 0.01) ctx.translate((Math.random() - 0.5) * view.shake * 14 * U, (Math.random() - 0.5) * view.shake * 14 * U);
    const track = S.track, rs = [S.lanes[0] ? S.lanes[0].r : null, S.lanes[1] ? S.lanes[1].r : null];
    drawSky();
    const fb = yFar - 1.2 * ppm;
    drawForest(0.1, fb, 0.85, ['#3f7357', '#4a7d5e', '#356249'], 3);
    ctx.fillStyle = '#3a6b4d'; ctx.fillRect(0, fb - 1.3 * ppm, W, 1.4 * ppm);
    drawForest(0.3, fb + 0.2 * ppm, 0.8, ['#2c5c3c', '#3a6d45', '#487d50', '#315f41'], 11);
    drawBank();
    const sb = yFar - 0.34 * ppm;
    drawArch(-9.5, -2.2, 'СТАРТ', sb);
    drawArch(track.finish + 1.2, track.finish + 8.5, 'ФИНИШ', sb);
    drawFlags(sb, track);
    drawCrowd(sb, rs);
    drawLightPole(1.0, sb, S.lights);
    drawFinishFlag(track.finish, yFar);
    drawLane(0, yFar, S);
    drawFinishFlag(track.finish, yNear);
    drawLane(1, yNear, S);
    // лента на переднем плане
    const fy = Math.max(yNear + 2.2 * ppm, H - 26 * U);
    if (fy < H + 10) {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 13 * U; ctx.strokeStyle = '#f4f1ea'; ctx.beginPath(); ctx.moveTo(-10, fy + 8 * U); ctx.lineTo(W + 10, fy - 6 * U); ctx.stroke();
      ctx.setLineDash([34 * U, 34 * U]); ctx.lineDashOffset = view.cam * ppm * 1.5; ctx.strokeStyle = '#d93a2e';
      ctx.beginPath(); ctx.moveTo(-10, fy + 8 * U); ctx.lineTo(W + 10, fy - 6 * U); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    let vg = vigGrad;
    if (!vg) {
      vg = vigGrad = ctx.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.42, W * 0.5, H * 0.52, Math.max(W, H) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
    }
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (S.hud) drawHUD(S);
    drawOverlayFx(S);
  }

  function debugQuad(canvas, look, opts) {
    init(canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = (opts && opts.bg) || '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ppm = (opts && opts.ppm) || 120; W = canvas.width; H = canvas.height;
    view.cam = 0;
    const r = MR.newRider(); r.x = 0; r.y = 0; r._v = { sus: 0, stand: (opts && opts.stand) || 0 }; r.wheel = 0.6;
    drawQuad(r, H * 0.75, look);
  }
  return { init, resize, render, view, debugQuad, get W() { return W; }, get H() { return H; }, get ppm() { return ppm; } };
})();
