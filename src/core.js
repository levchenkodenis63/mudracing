'use strict';
/* ===== MUD RACING — ядро: трасса, физика, ИИ, жеребьёвка (без DOM) ===== */
const MR = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const C = {
    DT: 1 / 120,
    WATER: -0.22,   // уровень воды относительно песка, м
    FLOAT: 1.0,     // глубина, с которой квадроцикл всплывает, м
    STEP: 0.1,
    X0: -30,
    START: -1.3,    // положение центра квадроцикла на старте (линия старта x=0)
    PENALTY: 2.0,   // штраф за фальстарт, с
    IDLE: 0.12,
    WB: 1.45,       // колёсная база
    WR: 0.44,       // радиус колеса
    TLIMIT: 90,
    // «Экстрим»: заглох в воде — мотор сам не заводится
    RESTART: 0.8,   // завести снова (отпустить и нажать газ) можно не раньше, с
    DROWN: 2.0,     // мотор стоит в воде столько — квадроцикл тонет, с
    SINK_P: 0.10    // шанс бота утонуть в заезде: SINK_P × (1.15 − skill)
  };

  /* ---------- Трасса ---------- */
  function makeTrack(seed) {
    const rnd = rng(seed), R = (a, b) => a + (b - a) * rnd();
    const baths = [], gaps = [];
    let x = 5.5;
    for (let i = 0; i < 3; i++) {
      const L = Math.round(R(30, 36));
      baths.push({ x0: x, x1: x + L });
      x += L;
      if (i < 2) {
        const g = Math.round(R(3, 5) * 2) / 2;
        gaps.push({ x0: x, x1: x + g });
        x += g;
      }
    }
    const finish = x + 7;
    const end = finish + 45;
    const n = Math.ceil((end - C.X0) / C.STEP) + 1;
    const lanes = [];
    for (let l = 0; l < 2; l++) {
      const feats = [];
      baths.forEach((b) => {
        const f = { b, base: R(0.62, 0.82), g: [] };
        const np = rnd() < 0.55 ? 2 : 1;
        const used = [];
        for (let k = 0; k < np; k++) {
          let c, tries = 0;
          do { c = R(b.x0 + 7, b.x1 - 8); tries++; } while (used.some((u) => Math.abs(u - c) < 7) && tries < 30);
          used.push(c);
          f.g.push({ c, s: R(1.6, 2.8), a: R(0.5, 0.75) });      // яма
        }
        let c, tries = 0;
        do { c = R(b.x0 + 6, b.x1 - 7); tries++; } while (used.some((u) => Math.abs(u - c) < 6) && tries < 30);
        f.g.push({ c, s: R(1.8, 3.0), a: -R(0.3, 0.42) });        // отмель
        feats.push(f);
      });
      const h = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const xx = C.X0 + i * C.STEP;
        let y = 0;
        for (const f of feats) {
          const b = f.b;
          if (xx > b.x0 && xx < b.x1) {
            let dpt = f.base;
            for (const g of f.g) dpt += g.a * Math.exp(-((xx - g.c) ** 2) / (2 * g.s * g.s));
            dpt = Math.max(0.3, dpt);
            const env = Math.min(smooth((xx - b.x0) / 2.4), smooth((b.x1 - xx) / 3.2));
            y = -dpt * env;
          }
        }
        for (const g of gaps) {
          const c = (g.x0 + g.x1) / 2, s = (g.x1 - g.x0) / 3.2;
          y += 0.3 * Math.exp(-((xx - c) ** 2) / (2 * s * s));
        }
        y += 0.16 * Math.exp(-((xx - (baths[0].x0 - 1.1)) ** 2) / (2 * 0.8 * 0.8));
        h[i] = y;
      }
      lanes.push({ h, n });
    }
    return { seed, baths, gaps, finish, end, lanes };
  }

  function hAt(lane, x) {
    const f = (x - C.X0) / C.STEP;
    const i = Math.floor(f);
    if (i < 0) return lane.h[0];
    if (i >= lane.n - 1) return lane.h[lane.n - 1];
    const t = f - i;
    return lane.h[i] * (1 - t) + lane.h[i + 1] * t;
  }
  function bathAt(track, x) {
    for (let i = 0; i < 3; i++) { const b = track.baths[i]; if (x >= b.x0 && x <= b.x1) return i; }
    return -1;
  }
  function depthAt(track, l, x) {
    if (bathAt(track, x) < 0) return 0;
    return Math.max(0, C.WATER - hAt(track.lanes[l], x));
  }
  function groundAt(track, l, x) {
    const h = hAt(track.lanes[l], x);
    if (bathAt(track, x) < 0) return h;
    return Math.max(h, C.WATER - C.FLOAT);
  }
  function nextBathDist(track, x) {
    for (let i = 0; i < 3; i++) { const b = track.baths[i]; if (b.x0 >= x) return b.x0 - x; }
    return 1e9;
  }
  function zone(d) {
    if (d <= 0.02) return [0.55, 1.0];
    return [lerp(0.52, 0.36, d), lerp(0.88, 0.60, d)];
  }

  /* ---------- Гонщик / физика ---------- */
  function newRider() {
    return {
      x: C.START, v: 0, y: 0, vy: 0, fly: false, air: false,
      rpm: C.IDLE, heat: 0, dig: 0, cut: 0, go: false, fin: false, time: 0,
      lo: 0.55, hi: 1, d: 0, depth: 0, spin: false, float: false,
      wheel: 0, pitch: 0, entered: [false, false, false], ev: [],
      top: 0, react: null, clean: 0, floods: 0, heats: 0, gas: false,
      extreme: false, dead: false, deadT: 0, prevGas: false, drowned: false, sinkT: 0
    };
  }

  function stepRider(r, track, l, gas, dt, t) {
    // утонул: только медленно уходит под воду
    if (r.drowned) {
      r.sinkT += dt; r.v = 0; r.gas = false; r.spin = false;
      r.rpm = Math.max(C.IDLE, r.rpm - dt);
      if (r.sinkT < 2.5) r.y -= 0.45 * dt;
      r.pitch += (0.18 - r.pitch) * Math.min(1, dt * 2);
      return;
    }
    const pressed = gas, fresh = pressed && !r.prevGas;
    r.prevGas = pressed;
    const depth = depthAt(track, l, r.x);
    const d = clamp(depth / C.FLOAT, 0, 1);
    r.d = d; r.depth = depth; r.float = depth > C.FLOAT;
    if (r.dead) {
      // «Экстрим»: заглох в воде — завести можно только новым нажатием газа
      r.deadT += dt; r.cut = 1; gas = false;
      if (r.deadT >= C.RESTART && fresh) {
        r.dead = false; r.cut = 0; r.ev.push({ t: 'restart' });
      } else if (d > 0.02 && r.deadT >= C.DROWN) {
        r.dead = false; r.cut = 0; r.drowned = true; r.sinkT = 0; r.v = 0;
        r.ev.push({ t: 'drown' });
        return;
      } else if (d <= 0.02 && r.deadT >= 1.6) {
        r.dead = false; r.cut = 0;   // выкатился из воды — заводится как обычно
      }
    } else if (r.cut > 0) { r.cut -= dt; gas = false; }
    if (r.fin) gas = false;
    r.gas = gas;
    const z = zone(d), lo = z[0], hi = z[1];
    r.lo = lo; r.hi = hi;

    if (gas) r.rpm += (r.air ? 1.5 : 0.9) * dt; else r.rpm -= 0.8 * dt;
    r.rpm = clamp(r.rpm, C.IDLE, 1);

    if (!r.go) { r.v = 0; r.spin = false; return; }

    const over = Math.max(0, r.rpm - hi);
    let eff;
    if (r.rpm < lo) eff = 0.88 * clamp((r.rpm - C.IDLE) / (lo - C.IDLE), 0, 1);
    else if (r.rpm <= hi) eff = 0.88 + 0.12 * (r.rpm - lo) / (hi - lo);
    else eff = Math.max(0.3, 1 - over * 4.5);

    const inWater = d > 0.02;
    if (!r.air) {
      r.spin = over > 0;
      if (over > 0) {
        if (inWater) r.dig = Math.min(1, r.dig + over * 3.5 * dt);
        r.heat += (0.10 + over * 2.5) * dt;
      } else {
        r.dig = Math.max(0, r.dig - 0.9 * dt);
        r.heat = Math.max(0, r.heat - 0.11 * dt);
      }
      if (r.heat >= 1 && r.cut <= 0 && !r.dead && !r.fin) {
        r.heat = 0.6; r.heats++;
        if (r.extreme && inWater) { r.dead = true; r.deadT = 0; r.cut = 1; }
        else r.cut = 1.6;
        r.ev.push({ t: 'overheat', dead: r.dead });
      }
      const gF = groundAt(track, l, r.x + 0.6), gR = groundAt(track, l, r.x - 0.6);
      const slope = (gF - gR) / 1.2;
      let vmax = inWater ? lerp(10.5, 4.6, Math.pow(d, 0.8)) : 15;
      if (slope > 0) vmax *= 1 - 0.45 * Math.min(1, slope / 0.5);
      const vt = vmax * eff * (1 - 0.45 * r.dig);
      let a;
      if (vt > r.v) a = Math.min((vt - r.v) * (inWater ? 1.8 : 1.2), inWater ? 5.5 : 7.5);
      else a = (vt - r.v) * (inWater ? 1.0 + 1.8 * d : 0.45);
      if (!r.float) a -= 9.8 * slope / Math.hypot(1, slope) * 0.55;
      if (r.fin) a -= 7;
      r.v += a * dt;
      if (gas && r.rpm > 0.3 && r.v < 0.9) r.v = 0.9;
    } else {
      r.spin = false;
    }
    if (r.v < 0) r.v = 0;
    if (r.v > r.top) r.top = r.v;

    /* продольное и вертикальное движение */
    r.x += r.v * dt;
    const g2 = groundAt(track, l, r.x);
    if (r.fly) {
      r.vy -= 9.8 * dt;
      r.y += r.vy * dt;
      if (r.y <= g2) {
        const impact = -r.vy;
        r.y = g2; r.fly = false; r.vy = 0;
        if (impact > 1.6) r.ev.push({ t: 'land', p: impact });
      }
    } else {
      const nvy = (g2 - r.y) / dt;
      if (nvy < r.vy - 9.8 * dt * 1.6 && r.v > 2.5) {
        r.fly = true;
        r.vy = Math.min(r.vy, 6) - 9.8 * dt;
        r.y += r.vy * dt;
        if (r.y < g2) { r.y = g2; r.fly = false; r.vy = nvy; }
      } else { r.y = g2; r.vy = clamp(nvy, -12, 12); }
    }
    r.air = r.fly && (r.y - g2 > 0.05);

    /* вход в воду */
    const bi = bathAt(track, r.x);
    if (bi >= 0 && !r.entered[bi] && !r.air) {
      const dep = depthAt(track, l, r.x);
      if (dep > 0.1) {
        r.entered[bi] = true;
        const zz = zone(clamp(dep / C.FLOAT, 0, 1));
        let kind;
        if (r.rpm > zz[1] + 0.02) { kind = 'flood'; r.v *= 0.74; r.heat = Math.min(0.97, r.heat + 0.12); r.floods++; }
        else if (r.rpm >= zz[0] - 0.06) { kind = 'clean'; r.v *= 0.94; r.clean++; }
        else { kind = 'soft'; r.v *= 0.87; }
        r.ev.push({ t: 'entry', kind, p: r.v });
      }
    }

    /* наклон корпуса и вращение колёс */
    let pt;
    if (r.air) pt = clamp(r.vy * 0.05, -0.3, 0.22);
    else pt = Math.atan2(groundAt(track, l, r.x + C.WB / 2) - groundAt(track, l, r.x - C.WB / 2), C.WB);
    r.pitch += (pt - r.pitch) * Math.min(1, dt * 12);
    r.wheel += ((r.spin || r.air ? Math.max(r.v, r.rpm * 22) : r.v) / C.WR) * dt;

    if (!r.fin && r.x >= track.finish) {
      r.fin = true;
      r.time = t - (r.x - track.finish) / Math.max(r.v, 0.5);
    }
  }

  /* ---------- ИИ ---------- */
  function makeAIRun(skill, rnd, extreme) {
    const form = (rnd() - 0.5) * 0.12;             // «форма» в конкретном заезде
    const s = clamp(skill + form, 0.05, 1);
    // «Экстрим»: иногда бот перекручивает в воде, глохнет и не успевает завестись
    const sinkBath = extreme && rnd() < C.SINK_P * (1.15 - s) ? Math.floor(rnd() * 3) : -1;
    return {
      sinkBath, restartAt: extreme ? C.RESTART + 0.1 + rnd() * 0.5 : C.RESTART,
      skill: s,
      react: 0.17 + rnd() * 0.42 * (1.25 - s),
      aim: 0.42 + 0.42 * s,
      amp: 0.17 - 0.13 * s,
      n: 0, nT: 0, nt: 0,
      fs: rnd() < 0.05 * (1 - s),
      careful: rnd() < 0.35 + 0.6 * s
    };
  }
  function aiGas(ai, r, track, t, dt, rnd) {
    if (t < (ai.fs ? 0 : ai.react)) return false;
    if (r.dead) return ai.sinkBath < 0 && r.deadT >= ai.restartAt;   // заводит, если не «тонущий» заезд
    if (ai.sinkBath >= 0 && bathAt(track, r.x) === ai.sinkBath && r.d > 0.3) return true;   // перекрутил
    ai.nt -= dt;
    if (ai.nt <= 0) { ai.nt = 0.25 + rnd() * 0.5; ai.nT = (rnd() * 2 - 1) * ai.amp; }
    ai.n += (ai.nT - ai.n) * Math.min(1, dt * 6);
    let target = r.lo + (r.hi - r.lo) * ai.aim + ai.n;
    if (r.d <= 0.02 && ai.careful) {
      const dist = nextBathDist(track, r.x);
      if (dist < Math.max(2.2, r.v * 0.32)) target = Math.min(target, 0.8 + ai.n * 0.5);
    }
    if (r.air) target = Math.min(target, ai.careful ? 0.7 : 0.95);
    return r.rpm < target;
  }
  function simRun(track, l, skill, rnd, extreme) {
    const ai = makeAIRun(skill, rnd, extreme);
    const r = newRider();
    r.extreme = !!extreme;
    let t = 0;
    while (!r.fin && !r.drowned && t < C.TLIMIT) {
      t += C.DT;
      const gas = aiGas(ai, r, track, t, C.DT, rnd);
      if (gas && !r.go) { r.go = true; r.react = t; }
      stepRider(r, track, l, gas, C.DT, t);
      r.ev.length = 0;
    }
    const raw = r.fin ? r.time : C.TLIMIT;
    const pen = ai.fs ? C.PENALTY : 0;
    return { raw, pen, total: raw + pen, react: ai.fs ? 0 : r.react, top: r.top, drowned: r.drowned };
  }

  /* ---------- Жеребьёвка ---------- */
  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* 4 серии; каждый гонщик едет 2 раза по дорожке 1 и 2 раза по дорожке 2.
     При нечётном числе участников в каждой серии кто-то едет без пары. */
  function makeDraw(n, rnd) {
    const ids = []; for (let i = 0; i < n; i++) ids.push(i);
    const half = Math.ceil(n / 2);
    const splits = [];
    for (let k = 0; k < 2; k++) {
      const p = shuffle(ids.slice(), rnd);
      splits.push([p.slice(0, half), p.slice(half)]);
    }
    const solos = new Set(), pairs = new Set();
    const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
    const series = [];
    for (let s = 0; s < 4; s++) {
      const sp = splits[s % 2], swap = s >= 2;
      let best = null, bestBad = 1e9;
      for (let tries = 0; tries < 60 && bestBad > 0; tries++) {
        const A = shuffle(sp[0].slice(), rnd), B = shuffle(sp[1].slice(), rnd);
        let bad = 0;
        for (let i = 0; i < A.length; i++) {
          if (i < B.length) { if (pairs.has(key(A[i], B[i]))) bad += 1; }
          else if (solos.has(A[i])) bad += 5;
        }
        if (bad < bestBad) { bestBad = bad; best = [A, B]; }
      }
      const heats = [];
      for (let i = 0; i < best[0].length; i++) {
        const a = best[0][i], b = i < best[1].length ? best[1][i] : null;
        if (b === null) solos.add(a); else pairs.add(key(a, b));
        heats.push({ lanes: swap ? [b, a] : [a, b] });
      }
      shuffle(heats, rnd);
      series.push(heats);
    }
    return series;
  }

  return { C, clamp, lerp, smooth, rng, makeTrack, hAt, bathAt, depthAt, groundAt, nextBathDist, zone,
    newRider, stepRider, makeAIRun, aiGas, simRun, shuffle, makeDraw };
})();
if (typeof module !== 'undefined') module.exports = MR;
