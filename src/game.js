'use strict';
/* ===== MUD RACING — игра, состояния, интерфейс ===== */
(function () {
  const C = MR.C, clamp = MR.clamp;
  const cv = document.getElementById('game'), ov = document.getElementById('overlay');
  RN.init(cv);
  window.addEventListener('resize', () => RN.resize());

  /* ---------- ввод ---------- */
  const input = { gas: false };
  const dbg = { auto: false };
  window.__auto = (v) => { dbg.auto = v; };
  const GASKEYS = ['ArrowUp', 'KeyW', 'Space', 'KeyD', 'ArrowRight'];
  addEventListener('keydown', (e) => {
    if (GASKEYS.includes(e.code) || e.code === 'ArrowDown' || e.code === 'KeyS') e.preventDefault();
    if (GASKEYS.includes(e.code)) input.gas = true;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { const b = ov.querySelector('.btn.primary'); if (b) b.click(); }
  });
  addEventListener('keyup', (e) => { if (GASKEYS.includes(e.code)) input.gas = false; });
  addEventListener('blur', () => { input.gas = false; });
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); input.gas = true; });
  addEventListener('pointerup', () => { input.gas = false; });
  addEventListener('pointercancel', () => { input.gas = false; });
  if (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches) {
    document.body.classList.add('touch');
  }
  const sndBtn = document.getElementById('snd');
  sndBtn.classList.add('on');
  function firstTouch() { SFX.resume(); }
  addEventListener('pointerdown', firstTouch, { once: false });
  addEventListener('keydown', firstTouch);
  sndBtn.addEventListener('click', (e) => { e.stopPropagation(); SFX.resume(); const on = SFX.toggle(); sndBtn.classList.toggle('muted', !on); });
  const ped = document.getElementById('gasped');
  ped.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); input.gas = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => ped.addEventListener(t, () => { input.gas = false; }));

  /* ---------- данные гонщиков ---------- */
  const LOOKS = [
    { body: '#e2661c', body2: '#f2913c', accent: '#ff8a3d', rack: '#2a2a30', stripe: '#f4f1e6', jersey: '#f4f1e6', jersey2: '#e2661c', pants: '#1d1f27', helmet: '#1c1c22', helmet2: '#ff7a1f', snorkel: '#2b2b31' },
    { body: '#1f3f7a', body2: '#2e59a8', accent: '#4f7fe0', rack: '#24262e', stripe: '#eae7dd', jersey: '#2e59a8', jersey2: '#eae7dd', pants: '#1b1d24', helmet: '#15161b', helmet2: '#4f7fe0', snorkel: '#232328' },
    { body: '#9d1f22', body2: '#c22b2f', accent: '#e0393c', rack: '#2a2a30', stripe: '#1a1a1f', jersey: '#c22b2f', jersey2: '#1a1a1f', pants: '#20222a', helmet: '#121216', helmet2: '#e0393c', snorkel: '#2b2b31' },
    { body: '#5d6b3a', body2: '#78894b', accent: '#a8bf63', rack: '#24261f', stripe: '#2a2c24', jersey: '#78894b', jersey2: '#d8d3b6', pants: '#23251d', helmet: '#1a1c17', helmet2: '#a8bf63', snorkel: '#282a22' },
    { body: '#e0b418', body2: '#f2cf46', accent: '#ffd94a', rack: '#2a2a30', stripe: '#1b1b20', jersey: '#f2cf46', jersey2: '#1b1b20', pants: '#1e1f26', helmet: '#17171b', helmet2: '#ffd94a', snorkel: '#2b2b31' },
    { body: '#e3e0d5', body2: '#f6f4ec', accent: '#ff6a1f', rack: '#2a2a30', stripe: '#ff6a1f', jersey: '#f6f4ec', jersey2: '#ff6a1f', pants: '#1c1e26', helmet: '#17171b', helmet2: '#ff6a1f', snorkel: '#e3e0d5' },
    { body: '#26413c', body2: '#37635a', accent: '#52a396', rack: '#202423', stripe: '#d6d2c2', jersey: '#37635a', jersey2: '#d6d2c2', pants: '#1c2220', helmet: '#151917', helmet2: '#52a396', snorkel: '#232827' },
    { body: '#6c2a72', body2: '#8d3a95', accent: '#c063cb', rack: '#262130', stripe: '#e8dceb', jersey: '#8d3a95', jersey2: '#e8dceb', pants: '#221d28', helmet: '#191420', helmet2: '#c063cb', snorkel: '#2a2331' },
    { body: '#7b4a20', body2: '#9c6129', accent: '#d18a44', rack: '#2a2620', stripe: '#efe6d4', jersey: '#9c6129', jersey2: '#efe6d4', pants: '#23201b', helmet: '#191510', helmet2: '#d18a44', snorkel: '#2b2823' },
    { body: '#2b2f38', body2: '#3d434f', accent: '#f04f28', rack: '#22252c', stripe: '#f04f28', jersey: '#3d434f', jersey2: '#f04f28', pants: '#1a1d23', helmet: '#121316', helmet2: '#f04f28', snorkel: '#22252c' }
  ];
  const NAMES = ['Болотный', 'Дизель', 'Профессор', 'Барс', 'Механик', 'Шторм', 'Тапок', 'Кувалда', 'Вихрь', 'Гряземес', 'Сапёр', 'Боцман'];
  const DIFF = { easy: [0.10, 0.40], normal: [0.36, 0.72], hard: [0.66, 1.0] };

  const G = {
    screen: 'menu', riders: [], track: null, rnd: null, seed: 1,
    series: [], si: 0, hi: 0, lanes: [null, null], playerLane: -1,
    t: 0, pre: 0, lights: 0, lightA: 0, started: false, pen: 0, fs: false,
    particles: [], splats: [], msgs: [], label: '', nRiders: 8, diff: 'normal',
    heatRnd: null, ended: false, camTarget: null
  };
  window.__MRG = G;

  /* ---------- утилиты интерфейса ---------- */
  function show(html) { ov.innerHTML = '<div class="panel">' + html + '</div>'; ov.classList.add('on'); }
  function hide() { ov.classList.remove('on'); if (ov.innerHTML) setTimeout(() => { if (!ov.classList.contains('on')) ov.innerHTML = ''; }, 220); }
  const fmt = (t) => (t === null || t === undefined || !isFinite(t) ? '—' : t.toFixed(2));
  function msg(text, col, big) {
    G.msgs.push({ text, col, big: big !== false, life: 1.5, max: 1.5 });
    if (G.msgs.length > 4) G.msgs.shift();
  }

  /* ---------- меню ---------- */
  function menu() {
    G.screen = 'menu'; G.lights = 0;
    G.track = MR.makeTrack(1);
    G.lanes = [null, null];
    RN.view.cam = -1.3;
    show(`
      <h1 class="logo">MUD<span>RACING</span></h1>
      <div class="sub">квадроспорт · гонки с водными препятствиями</div>
      <div class="rules">
        <div class="rule"><b>3 грязевые ванны</b> по 30–40 м, между ними короткие перемычки для разгона.</div>
        <div class="rule"><b>4 серии заездов</b> по жеребьёвке: 2 раза по одной дорожке, 2 — по другой. Победителя определяет <b>сумма четырёх времён</b>.</div>
        <div class="rule"><b>В воде — тяга, а не скорость.</b> Газ в зелёной зоне: перельёшь — гидроудар и потеря хода, недодашь — утонешь в колее.</div>
      </div>
      <div class="opts">
        <div class="opt"><span>Участников</span>
          <div class="seg" data-opt="n"><button data-v="8" class="on">8</button><button data-v="7">7 <i>кто-то без пары</i></button></div>
        </div>
        <div class="opt"><span>Соперники</span>
          <div class="seg" data-opt="d"><button data-v="easy">Новички</button><button data-v="normal" class="on">Любители</button><button data-v="hard">Профи</button></div>
        </div>
      </div>
      <button class="btn primary" id="btn-draw">ЖЕРЕБЬЁВКА</button>
      <div class="keys">Газ: <kbd>↑</kbd> <kbd>W</kbd> или <kbd>Space</kbd> (удерживай) · тап/палец по экрану на телефоне · <kbd>Enter</kbd> — далее</div>
    `);
    ov.querySelectorAll('.seg').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        if (seg.dataset.opt === 'n') G.nRiders = +b.dataset.v; else G.diff = b.dataset.v;
      }));
    });
    document.getElementById('btn-draw').addEventListener('click', newChampionship);
  }

  /* ---------- жеребьёвка ---------- */
  function newChampionship() {
    G.seed = (Date.now() % 100000) + 7;
    G.rnd = MR.rng(G.seed);
    G.track = MR.makeTrack(1 + Math.floor(G.rnd() * 5));
    G.riders = [];
    const pool = MR.shuffle(NAMES.slice(), G.rnd);
    const looks = MR.shuffle(LOOKS.slice(), G.rnd);
    const d = DIFF[G.diff], used = [];
    G.riders.push({ name: 'ВЫ', isPlayer: true, look: LOOKS[0], skill: 0, runs: [], total: 0, num: 0 });
    for (let i = 1; i < G.nRiders; i++) {
      let lk, tries = 0;
      do { lk = looks[Math.floor(G.rnd() * looks.length)]; tries++; } while (used.includes(lk) && tries < 30);
      used.push(lk);
      G.riders.push({
        name: pool[(i - 1) % pool.length], isPlayer: false, look: lk,
        skill: d[0] + (d[1] - d[0]) * G.rnd(), runs: [], total: 0, num: i
      });
    }
    G.series = MR.makeDraw(G.nRiders, G.rnd);
    G.si = 0; G.hi = 0;
    // индексы заездов, где едет игрок (по одному в серии)
    G.playerHeat = G.series.map((s) => {
      const i = s.findIndex((h) => h.lanes.includes(0));
      return i < 0 ? 0 : i;
    });
    drawScreen();
  }
  function drawScreen() {
    G.screen = 'draw';
    let rows = '';
    G.series.forEach((s, i) => {
      const cells = s.map((h) => {
        const a = h.lanes[0] === null ? null : G.riders[h.lanes[0]];
        const b = h.lanes[1] === null ? null : G.riders[h.lanes[1]];
        const nm = (e, lane) => e ? `<span class="who ${e.isPlayer ? 'me' : ''}">${e.name}</span><i>д${lane}</i>` : '<span class="free">без пары</span>';
        return `<div class="pair">${nm(a, 1)}<em>×</em>${nm(b, 2)}</div>`;
      }).join('');
      rows += `<div class="series"><div class="stitle">Серия ${i + 1}</div>${cells}</div>`;
    });
    show(`
      <h2>Жеребьёвка</h2>
      <div class="sub">каждый едет 2 раза по дорожке 1 и 2 раза по дорожке 2${G.nRiders % 2 ? ' · в каждой серии кто-то едет без пары' : ''}</div>
      <div class="grid4">${rows}</div>
      <div class="sub small">Ты едешь по одному заезду в каждой серии; остальные пары едут параллельно — их времена засчитываются автоматически.</div>
      <button class="btn primary" id="btn-go">НА СТАРТ · серия 1</button>
    `);
    document.getElementById('btn-go').addEventListener('click', () => playSeries(0));
  }

  /* ---------- серия: симулируем заезды без игрока, затем едем свой ---------- */
  function playSeries(s) {
    G.si = s;
    const series = G.series[s];
    series.forEach((heat, i) => {
      if (i === G.playerHeat[s]) return;
      heat.lanes.forEach((id, l) => {
        if (id === null || id === undefined) return;
        const e = G.riders[id];
        if (e.isPlayer) return;
        const rnd = MR.rng(G.seed * 977 + s * 131 + i * 17 + l * 7);
        const res = MR.simRun(G.track, l, e.skill, rnd);
        e.runs.push(res);
        e.total += res.total;
      });
    });
    G.hi = G.playerHeat[s];
    startHeat();
  }

  /* ---------- заезд ---------- */
  function startHeat() {
    const heat = G.series[G.si][G.hi];
    G.heatRnd = MR.rng(G.seed * 31 + G.si * 7 + G.hi * 3 + 1);
    G.lanes = [null, null]; G.playerLane = -1;
    G.pen = 0; G.fs = false; G.t = 0; G.pre = 0; G.lights = 1; G.lightA = 1;
    G.started = false; G.ended = false;
    G.particles = []; G.splats = []; G.msgs = [];
    G.label = `Серия ${G.si + 1}/4 · твой заезд ${G.hi + 1} из ${G.series[G.si].length}`;
    for (let l = 0; l < 2; l++) {
      const id = heat.lanes[l];
      if (id === null || id === undefined) continue;
      const e = G.riders[id];
      G.lanes[l] = {
        entry: e, r: MR.newRider(), look: e.look, name: e.name, player: !!e.isPlayer,
        ai: e.isPlayer ? null : MR.makeAIRun(e.skill, G.heatRnd)
      };
      if (e.isPlayer) G.playerLane = l;
    }
    const laneTxt = G.playerLane === 0 ? 'дорожка 1 (ближняя)' : 'дорожка 2 (дальняя)';
    let rows = '';
    for (let l = 0; l < 2; l++) {
      const e = G.lanes[l];
      rows += `<div class="lane-row ${e && e.player ? 'me' : ''}"><span class="ln">дорожка ${l + 1}</span>${e ? `<b>${e.name}</b>` : '<b class="free">— без пары —</b>'}</div>`;
    }
    show(`
      <div class="kicker">${G.label}</div>
      ${rows}
      <div class="sub">Ты стартуешь на <b>${laneTxt}</b>. Держи газ <b>только после зелёного</b>: фальстарт — +2.00 с.<br>
      В воде следи за зелёной зоной тахометра: перельёшь — гидроудар и потеря хода, недодашь — тонешь в колее.</div>
      <button class="btn primary" id="btn-start">ГОТОВ</button>
    `);
    G.screen = 'heatIntro';
    RN.view.cam = -1.3;
    document.getElementById('btn-start').addEventListener('click', () => {
      hide(); G.screen = 'countdown'; G.pre = 0; G.lights = 1; G.lightA = 1; G.t = 0;
    });
  }

  function startRace() {
    G.started = true; G.t = 0; G.lights = 3; SFX.light(3);
    for (let l = 0; l < 2; l++) if (G.lanes[l]) G.lanes[l].r.go = true;
    if (G.fs) {
      G.pen = C.PENALTY;
      msg('ФАЛЬСТАРТ +2.00', '#ff5a4a', true);
      RN.view.shake = 0.6;
    }
    G.screen = 'racing';
  }

  function handleEvents(e, l) {
    const r = e.r;
    for (const ev of r.ev) {
      if (ev.t === 'entry') {
        if (ev.kind === 'clean') {
          SFX.clean();
          if (e.player) msg('ЧИСТО!', '#7dffa8', false);
          burst(l, r, 16, 'light');
        } else if (ev.kind === 'flood') {
          SFX.flood();
          if (e.player) { msg('ПЕРЕЛИВ! −25% хода', '#ff7a5a', false); RN.view.shake = 0.45; }
          burst(l, r, 26, 'mud');
          if (e.player) splat();
        } else {
          if (e.player) { msg('малый газ — тонет', '#ffd23e', false); SFX.splash(r.v); }
          burst(l, r, 8, 'light');
        }
      } else if (ev.t === 'overheat') {
        if (e.player) { msg('ЗАГЛОХ! −1.6 с', '#ff5a4a', false); RN.view.shake = 0.55; splat(); SFX.overheat(); }
        burst(l, r, 10, 'dark');
      } else if (ev.t === 'land') {
        burst(l, r, 8, 'light');
      }
    }
    r.ev.length = 0;
  }
  function burst(l, r, n, kind) {
    for (let i = 0; i < n; i++) {
      const sp = kind === 'mud' ? 5.5 : kind === 'dark' ? 4 : 3.2;
      G.particles.push({
        l, x: r.x + (Math.random() - 0.4) * 0.5, y: 0.15 + Math.random() * 0.5,
        vx: -r.v * 0.35 - Math.random() * sp, vy: 1.5 + Math.random() * sp,
        life: 0.45 + Math.random() * 0.55, max: 1, s: 0.025 + Math.random() * 0.06,
        c: kind === 'light' ? 'rgba(238,236,226,.9)' : kind === 'dark' ? 'rgba(70,60,42,.95)' : 'rgba(112,96,62,.95)'
      });
    }
  }
  function splat() {
    G.splats.push({
      x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.55, r: 70 + Math.random() * 110,
      a: 1, c: 'rgba(96,80,52,.92)', seed: Math.random() * 99, drip: 0.9
    });
    if (G.splats.length > 6) G.splats.shift();
  }

  function endHeat() {
    if (G.ended) return;
    G.ended = true;
    let best = null;
    const rows = [];
    const tots = [];
    for (let l = 0; l < 2; l++) {
      const e = G.lanes[l];
      if (!e) { rows.push({ none: true, lane: l }); continue; }
      const raw = e.r.fin ? e.r.time : C.TLIMIT;
      const pen = e.player ? G.pen : (e.ai.fs ? C.PENALTY : 0);
      const total = raw + pen;
      e.entry.runs.push({ raw, pen, total, lane: l });
      e.entry.total += total;
      tots.push(total);
      if (!best || total < best.total) best = { total, e };
      rows.push({ e, raw, pen, total, lane: l, react: e.r.react });
    }
    let html = `<div class="kicker">${G.label} — финиш</div>`;
    for (const row of rows) {
      if (row.none) { html += `<div class="res-row"><span class="ln">дорожка ${row.lane + 1}</span><b class="free">без пары</b></div>`; continue; }
      const w = best && Math.abs(row.total - best.total) < 1e-6;
      html += `<div class="res-row ${row.e.player ? 'me' : ''} ${w ? 'win' : ''}">
        <span class="ln">дорожка ${row.lane + 1}</span>
        <b>${row.e.name}</b>
        <span class="rt">${fmt(row.raw)}${row.pen ? `<i class="pen">+${row.pen.toFixed(2)}</i>` : ''}</span>
        <span class="tot">${fmt(row.total)}</span>
        <span class="diff">${best && row.total > best.total + 0.001 ? '+' + (row.total - best.total).toFixed(2) : 'лучший'}</span>
      </div>`;
    }
    const pr = G.playerLane >= 0 ? G.lanes[G.playerLane] : null;
    if (pr) {
      const react = (G.fs || pr.ai && pr.ai.fs) ? 'фальстарт' : (pr.r.react !== null && pr.r.react !== undefined ? pr.r.react.toFixed(2) + ' с' : '—');
      const clean = pr.r.clean;
      html += `<div class="sub small">Реакция: <b>${react}</b> · макс. <b>${(pr.r.top * 3.6).toFixed(0)} км/ч</b> · чистых входов в воду: <b>${clean}/3</b>${pr.r.heats ? ' · перегревов: <b>' + pr.r.heats + '</b>' : ''}</div>`;
    }
    const last = G.si === 3;
    html += `<button class="btn primary" id="btn-next">${last ? 'ИТОГИ ЧЕМПИОНАТА' : 'ИТОГИ СЕРИИ'}</button>`;
    show(html);
    G.screen = 'heatResult';
    document.getElementById('btn-next').addEventListener('click', () => {
      hide();
      if (G.si >= 3) { finalScreen(); return; }
      seriesScreen();
    });
  }

  function seriesScreen() {
    G.screen = 'seriesResult';
    const sorted = G.riders.slice().sort((a, b) => a.total - b.total);
    let rows = '';
    sorted.forEach((e, i) => {
      const done = e.runs.length;
      rows += `<div class="res-row ${e.isPlayer ? 'me' : ''}">
        <span class="pl">${i + 1}</span><b>${e.name}</b>
        <span class="tot">${done ? fmt(e.total) : '—'}</span>
        <span class="diff">${done}/${4}</span></div>`;
    });
    const soloNote = G.nRiders % 2 ? '<div class="sub small">Нечётное число участников: в каждой серии один гонщик едет без пары — так задумано.</div>' : '';
    show(`<h2>После серии ${G.si + 1}</h2><div class="sub">сумма времени по всем заездам · осталось серий: ${3 - G.si}</div>
      <div class="table">${rows}</div>${soloNote}
      <button class="btn primary" id="btn-s">СЕРИЯ ${G.si + 2} · ТВОЙ ЗАЕЗД</button>`);
    document.getElementById('btn-s').addEventListener('click', () => { hide(); playSeries(G.si + 1); });
  }

  function finalScreen() {
    G.screen = 'final';
    const sorted = G.riders.slice().sort((a, b) => a.total - b.total);
    const win = sorted[0];
    const me = G.riders[0], place = sorted.indexOf(me) + 1;
    let rows = '';
    sorted.forEach((e, i) => {
      const bestLap = Math.min(...e.runs.map((r) => r.total));
      rows += `<div class="res-row ${e.isPlayer ? 'me' : ''} ${i === 0 ? 'win' : ''}">
        <span class="pl">${i + 1}</span><b>${e.name}</b>
        <span class="tot">${fmt(e.total)}</span>
        <span class="diff">${i === 0 ? '🏆' : '+' + (e.total - win.total).toFixed(2)}</span>
        <span class="lap">лучший ${fmt(bestLap)}</span></div>`;
    });
    const title = place === 1 ? 'ПОБЕДА!' : place <= 3 ? 'ПОДИУМ' : 'НЕ ПРОШЁЛ';
    const col = place === 1 ? '#7dffa8' : place <= 3 ? '#ffd23e' : '#ff8a6a';
    show(`<div class="kicker" style="color:${col}">${title} · ${place} место</div>
      <h2>Итоги чемпионата</h2>
      <div class="sub">сумма четырёх заездов — это и есть результат</div>
      <div class="table final">${rows}</div>
      <button class="btn primary" id="btn-again">ЕЩЁ РАЗ</button>`);
    document.getElementById('btn-again').addEventListener('click', menu);
  }

  /* ---------- обновление ---------- */
  function update(dt) {
    if (G.screen === 'countdown') {
      G.pre += dt;
      const L = G.pre < 0.9 ? 1 : G.pre < 1.9 ? 2 : 3;
      if (L !== G.lights) { G.lights = L; SFX.light(L); }
      if (input.gas && !G.started && G.pre > 0.35) G.fs = true;
      if (G.pre >= 1.9) startRace();
      for (let l = 0; l < 2; l++) {
        const e = G.lanes[l]; if (!e) continue;
        MR.stepRider(e.r, G.track, l, input.gas && e.player ? true : false, dt, 0);
        e.r.ev.length = 0;
      }
    } else if (G.screen === 'racing') {
      G.t += dt;
      for (let l = 0; l < 2; l++) {
        const e = G.lanes[l]; if (!e) continue;
        const r = e.r;
        let gas;
        if (e.player) {
          gas = dbg.auto ? (r.rpm < r.lo + (r.hi - r.lo) * 0.9) : input.gas;
          if (gas && r.react === null && !r.fin) r.react = G.t;
        } else {
          gas = MR.aiGas(e.ai, r, G.track, G.t, dt, G.heatRnd);
        }
        MR.stepRider(r, G.track, l, gas, dt, G.t);
        handleEvents(e, l);
        if (e.player && r.fin && !e._saidFin) {
          e._saidFin = true;
          msg('ФИНИШ ' + r.time.toFixed(2), '#7dffa8', true);
          SFX.finish();
        }
        if (!r.air && r.depth > 0.05 && r.v > 3 && Math.random() < 0.7) {
          burst(l, r, 1, 'light');
        }
      }
      if (G.lightA > 0) G.lightA = Math.max(0, G.lightA - dt * 0.7);
      const allDone = G.lanes.every((e) => !e || e.r.fin || G.t > 60);
      if (allDone) endHeat();
    }
    // звук двигателя игрока
    const pLane = G.playerLane >= 0 ? G.lanes[G.playerLane] : null;
    if (pLane && (G.screen === 'racing' || G.screen === 'countdown')) {
      SFX.engine(pLane.r.rpm, pLane.r.gas, pLane.r.d > 0.02);
    } else SFX.engineOff();
    if (ov.classList.contains('on')) ped.classList.remove('show');
    else ped.classList.add('show');
    // камера
    if (G.playerLane >= 0 && G.lanes[G.playerLane]) {
      const px = G.lanes[G.playerLane].r.x;
      RN.view.cam += (px - RN.view.cam) * Math.min(1, dt * 7);
    }
    // частицы
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.life -= dt; if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99;
      if (p.y < -0.1) p.life = 0;
    }
    const capP = RN.ppm < 55 ? 220 : 500;
    if (G.particles.length > capP) G.particles.splice(0, G.particles.length - capP);
    for (let i = G.splats.length - 1; i >= 0; i--) { G.splats[i].a -= dt * 0.55; if (G.splats[i].a <= 0) G.splats.splice(i, 1); }
    for (let i = G.msgs.length - 1; i >= 0; i--) { G.msgs[i].life -= dt; if (G.msgs[i].life <= 0) G.msgs.splice(i, 1); }
    RN.view.shake = Math.max(0, RN.view.shake - dt * 2.2);
  }

  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    dt = Math.min(dt, 0.05);
    RN.view.dt = dt;
    update(dt);
    const pr = G.playerLane >= 0 && G.lanes[G.playerLane] ? G.lanes[G.playerLane].r : null;
    let hint = '';
    if (G.screen === 'racing' && pr && !pr.fin) {
      const nearWater = MR.nextBathDist(G.track, pr.x) < 9;
      if (pr.cut > 0) hint = 'ДВИГАТЕЛЬ ЗАГЛОХ — жди';
      else if (pr.d > 0.02) hint = 'Держи газ в зелёной зоне тахометра';
      else if (nearWater && pr.rpm > pr.hi - 0.05) hint = 'Перед водой сбрось обороты!';
      else if (nearWater) hint = 'Сейчас вода — газ в зелёную зону';
      else hint = 'По песку — газ в пол';
    }
    // текущее место по проекции итоговой суммы
    let place = 0, rivals = 0, split = null;
    if (pr && G.riders.length && (G.screen === 'racing' || G.screen === 'countdown')) {
      const proj = G.riders.map((e) => {
        const done = e.runs.length;
        const avg = done ? e.total / done : 20;
        let v = e.total + (4 - done) * avg;
        if (e.isPlayer && !pr.fin) v = e.total + Math.max(0, G.t);
        return v;
      });
      const mine = proj[0];
      place = proj.filter((v) => v < mine - 1e-6).length + 1;
      rivals = G.riders.length;
      const other = G.lanes[G.playerLane ^ 1];
      if (other) split = other.r.x - pr.x;
    }
    RN.render({
      track: G.track || MR.makeTrack(1), t: G.t, lanes: G.lanes, pl: G.playerLane,
      place, rivals, split,
      particles: G.particles, splats: G.splats, msgs: G.msgs,
      lights: G.lights, lightA: G.lightA, label: G.label, pen: G.pen,
      hud: G.screen === 'racing' || G.screen === 'countdown', tags: true, hint
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  menu();
})();
