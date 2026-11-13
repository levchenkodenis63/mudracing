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
  // клавиши газа не должны мешать набору текста (в русской раскладке W/D/S — это «ц», «в», «ы»)
  const typing = (e) => { const t = e.target; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
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
  // телефон: частые и долгие нажатия не должны выделять текст и открывать меню «Скопировать/Вставить»
  [ped, cv].forEach((el) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('dragstart', (e) => e.preventDefault());
  });
  document.addEventListener('selectstart', (e) => { if (!typing(e)) e.preventDefault(); });

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
  const DIFF = { easy: [0.10, 0.40], normal: [0.36, 0.72], hard: [0.66, 1.0], extreme: [0.66, 1.0] };
  const isExtreme = () => G.diff === 'extreme';

  const G = {
    screen: 'menu', riders: [], track: null, rnd: null, seed: 1,
    series: [], si: 0, hi: 0, lanes: [null, null], playerLane: -1,
    t: 0, pre: 0, lights: 0, lightA: 0, started: false, pen: 0, fs: false,
    particles: [], splats: [], msgs: [], label: '', nRiders: 8, diff: 'normal',
    heatRnd: null, ended: false, camTarget: null, playerName: '', heroText: null
  };
  window.__MRG = G;

  /* ---------- утилиты интерфейса ---------- */
  function show(html, cls) { ov.innerHTML = '<div class="panel' + (cls ? ' ' + cls : '') + '">' + html + '</div>'; ov.classList.add('on'); }
  function hide() { ov.classList.remove('on'); if (ov.innerHTML) setTimeout(() => { if (!ov.classList.contains('on')) ov.innerHTML = ''; }, 220); }
  const fmt = (t) => (t === null || t === undefined || !isFinite(t) ? '—' : t.toFixed(2));
  const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escAttr = escHtml;
  const DIFFNAME = { easy: 'Новички', normal: 'Любители', hard: 'Профи', extreme: 'Экстрим' };
  function msg(text, col, big) {
    G.msgs.push({ text, col, big: big !== false, life: 1.5, max: 1.5 });
    if (G.msgs.length > 4) G.msgs.shift();
  }

  /* ---------- таблица рекордов ---------- */
  // вкладки: «мои» (localStorage) и «все игроки» (сервер);
  // уровни: новички / любители / профи / абсолют (лучшее на любом уровне, с пометкой уровня)
  const REC = { tab: 'local', diff: null, req: 0 };
  const LEVELS = [['easy', 'Новички'], ['normal', 'Любители'], ['hard', 'Профи'], ['extreme', 'Экстрим'], ['all', 'Абсолют']];
  function recRows(list, freshTs, showLevel, start) {
    return list.map((r, i) => {
      i += start || 0;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const cls = ['top1', 'top2', 'top3'][i] || '';
      const isFresh = !!freshTs && r.ts === freshTs;
      const meta = [];
      if (showLevel && r.d) meta.push(DIFFNAME[r.d] || 'Любители');
      if (r.p) meta.push(r.p + '-е место');
      if (r.b) meta.push('лучший круг ' + Number(r.b).toFixed(2));
      const badge = r.me ? 'это ты' : isFresh ? 'новый' : '';
      return `<div class="rec-row ${cls}${r.me || isFresh ? ' fresh' : ''}">
          <span class="pl">${medal}</span>
          <span class="who"><b>${escHtml(r.n)}</b>${badge ? '<span class="badge">' + badge + '</span>' : ''}
            <span class="meta">${escHtml(meta.join(' · '))}</span></span>
          <span class="tm">${Number(r.t).toFixed(2)}</span>
        </div>`;
    }).join('');
  }
  function recordsScreen(opts) {
    opts = opts || {};
    if (opts.tab) REC.tab = opts.tab;
    if (opts.diff) REC.diff = opts.diff;
    if (!REC.diff) REC.diff = G.diff;          // по умолчанию — уровень, выбранный в меню
    if (!STORE.online) REC.tab = 'local';
    const diff = REC.diff, abs = diff === 'all', lvl = abs ? 'абсолют' : (DIFFNAME[diff] || '').toLowerCase();
    G.screen = 'records';
    const req = ++REC.req;
    const global = REC.tab === 'global';

    const tabs = `<div class="rec-tabs">${STORE.online ? `<div class="seg" data-rec="tab">
        <button data-v="local" class="${global ? '' : 'on'}">Мои</button>
        <button data-v="global" class="${global ? 'on' : ''}">Все игроки</button></div>` : ''}
      <div class="seg" data-rec="diff">${LEVELS.map(([v, t]) =>
        `<button data-v="${v}" class="${diff === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;

    let kicker, sub, body, note;
    if (!global) {
      const all = STORE.records;
      const list = abs ? all : all.filter((r) => r.d === diff);
      kicker = 'мои рекорды · ' + lvl + (list.length ? ' · лучшее ' + list[0].t.toFixed(2) : '');
      sub = 'сумма четырёх заездов · ' + (abs ? `${list.length} из 20` : `результатов: ${list.length}`);
      body = recRows(list, opts.fresh, abs) || `<div class="empty">${all.length ? 'На этом уровне пока нет результатов.' : 'Пока пусто.'}<br>Проедь чемпионат — результат попадёт сюда.</div>`;
      note = !STORE.persistent ? 'Браузер запретил локальное хранилище: рекорды не сохранятся после перезагрузки.'
        : STORE.online ? 'Твои рекорды хранятся в этом браузере. В общую таблицу уходит лучший результат на каждом уровне.'
        : 'Рекорды хранятся в этом браузере (localStorage) — у каждого игрока своя таблица.';
    } else {
      kicker = 'общая таблица · ' + lvl;
      sub = 'лучший результат каждого игрока · сумма четырёх заездов';
      body = '<div class="empty">Загружаю общую таблицу…</div>';
      note = abs ? 'Абсолют — лучший результат каждого игрока на любом уровне соперников.'
        : 'У каждого игрока здесь одна строка — его лучший результат на этом уровне.';
    }
    show(`
      <div class="kicker" id="rec-kicker">${escHtml(kicker)}</div>
      <h2>Лучшие результаты</h2>
      ${tabs}
      <div class="sub" id="rec-sub">${escHtml(sub)}</div>
      <div class="table" id="rec-table">${body}</div>
      <div class="sub small">${escHtml(note)}</div>
      <div class="rowbtns">
        ${global ? '' : '<button class="btn" id="btn-rec-clear">ОЧИСТИТЬ</button>'}
        <button class="btn primary" id="btn-rec-back">НАЗАД</button>
      </div>
    `, 'records');
    ov.querySelectorAll('[data-rec] button').forEach((b) => b.addEventListener('click', () =>
      recordsScreen(b.parentNode.dataset.rec === 'tab' ? { tab: b.dataset.v } : { diff: b.dataset.v })));
    document.getElementById('btn-rec-back').addEventListener('click', () => { REC.req++; hide(); menu(); });
    const clr = document.getElementById('btn-rec-clear');
    if (clr) clr.addEventListener('click', () => {
      if (clr.dataset.armed === '1') { STORE.clear(); hide(); setTimeout(() => recordsScreen(), 120); return; }
      clr.dataset.armed = '1'; clr.textContent = 'ТОЧНО ОЧИСТИТЬ?'; clr.style.color = '#ff8a6a';
    });

    if (global) {
      // общая таблица грузится страницами по 20 строк: «Показать ещё» внизу списка
      const rows = [];
      let mine = null, count = 0;
      const render = () => {
        const tbl = document.getElementById('rec-table'); if (!tbl) return;
        let html = recRows(rows, null, abs) || `<div class="empty">${abs ? 'Пока никто не записал результат.' : 'На этом уровне ещё никто не записал результат.'}<br>Будь первым!</div>`;
        if (rows.length < count) html += `<button class="btn more" id="btn-rec-more">ПОКАЗАТЬ ЕЩЁ · ${rows.length} из ${count}</button>`;
        if (mine && !rows.some((r) => r.me)) {
          html += `<div class="rec-row fresh"><span class="pl">${mine.rank}</span>
            <span class="who"><b>${escHtml(mine.n)}</b><span class="badge">это ты</span>
              <span class="meta">твоё место${abs && mine.d ? ' · ' + escHtml(DIFFNAME[mine.d] || '') : ''}</span></span>
            <span class="tm">${Number(mine.t).toFixed(2)}</span></div>`;
        }
        const keep = tbl.scrollTop;
        tbl.innerHTML = html;
        tbl.scrollTop = keep;
        const more = document.getElementById('btn-rec-more');
        if (more) more.addEventListener('click', () => {
          more.disabled = true; more.textContent = 'ЗАГРУЖАЮ…';
          load(rows.length);
        });
      };
      const load = (offset) => {
        const p = offset ? STORE.globalTop(diff, offset) : STORE.syncBest().then(() => STORE.globalTop(diff));
        return p.then((res) => {
          if (req !== REC.req || G.screen !== 'records') return;   // пользователь уже ушёл с экрана
          const tbl = document.getElementById('rec-table'); if (!tbl) return;
          if (!res.ok) {
            if (offset) { const more = document.getElementById('btn-rec-more'); if (more) { more.disabled = false; more.textContent = 'НЕ ЗАГРУЗИЛОСЬ · ЕЩЁ РАЗ'; } return; }
            tbl.innerHTML = `<div class="empty">Не удалось загрузить общую таблицу${res.error === 'timeout' ? ' (сервер не ответил)' : ''}.<br>Проверь интернет и попробуй ещё раз.</div>`;
            return;
          }
          if (offset && res.offset !== offset) { count = rows.length; render(); return; }   // сервер без страниц
          rows.length = offset;                 // страница встаёт ровно на своё место
          rows.push(...res.top);
          count = res.count;
          mine = res.mine || (rows.some((r) => r.me) ? null : mine);
          render();
          const sb = document.getElementById('rec-sub');
          if (sb) sb.textContent = `лучший результат каждого игрока · игроков: ${res.count}`;
          const k = document.getElementById('rec-kicker');
          if (k && rows.length) k.textContent = 'общая таблица · ' + lvl + ' · рекорд ' + Number(rows[0].t).toFixed(2);
        });
      };
      load(0);
    }
  }

  /* ---------- меню ---------- */
  function menu() {
    if (window.__mrUpdate && window.__mrReload) { window.__mrReload(); return; }   // вышла новая версия (PWA)
    G.screen = 'menu'; G.lights = 0;
    STORE.syncBest();   // дослать лучший результат, если раньше не было связи или сменилось имя
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
      <div class="namefield"><span>Твоё имя</span>
        <input id="pname" type="text" maxlength="14" autocomplete="off" spellcheck="false"
               placeholder="Гонщик" value="${escAttr(STORE.name || '')}">
        <div class="hint-line"><span>до 14 символов · попадёт в таблицу рекордов</span></div>
      </div>
      <div class="opts">
        <div class="opt"><span>Участников</span>
          <div class="seg" data-opt="n"><button data-v="8" class="on">8</button><button data-v="7">7 <i>кто-то без пары</i></button></div>
        </div>
        <div class="opt"><span>Соперники</span>
          <div class="seg" data-opt="d"><button data-v="easy">Новички</button><button data-v="normal" class="on">Любители</button><button data-v="hard">Профи</button><button data-v="extreme">Экстрим</button></div>
        </div>
      </div>
      <div class="rowbtns">
        <button class="btn" id="btn-records">РЕЗУЛЬТАТЫ</button>
        <button class="btn primary" id="btn-draw">ЖЕРЕБЬЁВКА</button>
      </div>
      <div class="install" id="install"></div>
      <div class="keys">Газ: <kbd>↑</kbd> <kbd>W</kbd> или <kbd>Space</kbd> (удерживай) · тап/палец по экрану на телефоне · <kbd>Enter</kbd> — далее</div>
    `);
    ov.querySelectorAll('.seg').forEach((seg) => {
      const cur = seg.dataset.opt === 'n' ? String(G.nRiders) : G.diff;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === cur));
      seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        if (seg.dataset.opt === 'n') G.nRiders = +b.dataset.v; else G.diff = b.dataset.v;
      }));
    });
    const nameInp = document.getElementById('pname');
    nameInp.addEventListener('input', () => { G.playerName = STORE.cleanName(nameInp.value, 'ВЫ'); });
    nameInp.addEventListener('change', () => { STORE.name = nameInp.value; nameInp.value = STORE.name; });
    nameInp.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); STORE.name = nameInp.value; nameInp.value = STORE.name; nameInp.blur(); newChampionship(); }
    });
    document.getElementById('btn-records').addEventListener('click', () => { STORE.name = nameInp.value; recordsScreen(); });
    document.getElementById('btn-draw').addEventListener('click', () => { STORE.name = nameInp.value; nameInp.value = STORE.name; newChampionship(); });
    installLine();
  }

  /* ---------- установка как приложение (PWA, только в сборке на https) ---------- */
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; installLine(); });
  addEventListener('appinstalled', () => { installEvt = null; installLine(); });
  const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function installLine() {
    const el = document.getElementById('install');
    if (!el) return;
    const pwa = !!document.querySelector('link[rel="manifest"]') && location.protocol === 'https:';
    if (!pwa || standalone() || (!installEvt && !isIOS())) { el.innerHTML = ''; return; }
    el.innerHTML = `<button class="instbtn" id="btn-install">📲 ${installEvt ? 'Установить игру как приложение' : 'Как установить игру на iPhone'}</button>`;
    document.getElementById('btn-install').addEventListener('click', () => {
      if (installEvt) {
        const ev = installEvt;
        ev.prompt();
        ev.userChoice.finally(() => { installEvt = null; installLine(); });
      } else {
        el.innerHTML = '<div class="insthint">В <b>Safari</b> нажми «Поделиться» <span class="ico">⬆︎</span> внизу экрана → ' +
          '<b>«На экран „Домой“»</b>. Игра появится иконкой и будет открываться на весь экран, даже без интернета.' +
          ' <a href="install.html#ios" target="_blank">Инструкция с картинками →</a></div>';
      }
    });
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
    const pName = STORE.name || G.playerName || 'ВЫ';
    G.riders.push({ name: pName, isPlayer: true, look: LOOKS[0], skill: 0, runs: [], total: 0, num: 0 });
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
        const nm = (e, lane) => e ? `<span class="who ${e.isPlayer ? 'me' : ''}">${escHtml(e.name)}</span><i>д${lane}</i>` : '<span class="free">без пары</span>';
        return `<div class="pair">${nm(a, 1)}<em>×</em>${nm(b, 2)}</div>`;
      }).join('');
      rows += `<div class="series"><div class="stitle">Серия ${i + 1}</div>${cells}</div>`;
    });
    show(`
      <h2>Жеребьёвка</h2>
      <div class="sub">каждый едет 2 раза по дорожке 1 и 2 раза по дорожке 2${G.nRiders % 2 ? ' · в каждой серии кто-то едет без пары' : ''}</div>
      <div class="grid4">${rows}</div>
      <div class="sub small">Ты едешь по одному заезду в каждой серии; остальные пары едут параллельно — их времена засчитываются автоматически.</div>
      <div class="rowbtns">
        <button class="btn" id="btn-draw-back">НАЗАД</button>
        <button class="btn primary" id="btn-go">НА СТАРТ · серия 1</button>
      </div>
    `);
    // передумал (уровень, число участников) — чемпионат ещё не начат, просто возвращаемся в меню
    document.getElementById('btn-draw-back').addEventListener('click', () => { hide(); menu(); });
    document.getElementById('btn-go').addEventListener('click', () => {
      if (isExtreme()) questionScreen(() => playSeries(0)); else playSeries(0);
    });
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
        const res = MR.simRun(G.track, l, e.skill, rnd, isExtreme());
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
      const r = MR.newRider();
      r.extreme = isExtreme();
      G.lanes[l] = {
        entry: e, r, look: e.look, name: e.name, player: !!e.isPlayer,
        ai: e.isPlayer ? null : MR.makeAIRun(e.skill, G.heatRnd, r.extreme)
      };
      if (e.isPlayer) G.playerLane = l;
    }
    const laneTxt = G.playerLane === 0 ? 'дорожка 1 (ближняя)' : 'дорожка 2 (дальняя)';
    let rows = '';
    for (let l = 0; l < 2; l++) {
      const e = G.lanes[l];
      rows += `<div class="lane-row ${e && e.player ? 'me' : ''}"><span class="ln">дорожка ${l + 1}</span>${e ? `<b>${escHtml(e.name)}</b>` : '<b class="free">— без пары —</b>'}</div>`;
    }
    G.heroText = {
      title: STORE.name ? STORE.name + ', готов?' : 'Готов?',
      sub: `Старт на <b>${laneTxt}</b>. Газ — только после зелёного: фальстарт +2.00 с.`
    };
    show(`
      <div class="hero-bg"></div>
      <div class="hero-in">
        <div class="hero-top"></div>
        <div class="kicker">${escHtml(G.label)}</div>
        <h2>${escHtml(G.heroText.title)}</h2>
        <div class="sub">${G.heroText.sub}</div>
        ${rows}
        <div class="sub small">${isExtreme()
          ? '<b>Экстрим:</b> заглох в воде — мотор сам не заведётся. Отпусти газ и нажми снова, иначе через ' + MR.C.DROWN + ' с утонешь (время заезда ' + MR.C.TLIMIT + ' с).'
          : 'В воде следи за зелёной зоной тахометра: перельёшь — гидроудар и потеря хода, недодашь — тонешь в колее.'}</div>
        <button class="btn primary" id="btn-start">ГОТОВ</button>
        <div class="credit">фото: MUD RACING</div>
      </div>
    `, 'hero');
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
        if (e.player) {
          msg(ev.dead ? 'ЗАГЛОХ! Отпусти газ и жми снова' : 'ЗАГЛОХ! −1.6 с', '#ff5a4a', false);
          RN.view.shake = 0.55; splat(); SFX.overheat();
        }
        burst(l, r, 10, 'dark');
      } else if (ev.t === 'restart') {
        if (e.player) msg('ЗАВЁЛСЯ!', '#7dffa8', false);
      } else if (ev.t === 'drown') {
        SFX.flood();
        if (e.player) { msg('УТОНУЛ', '#ff5a4a', true); RN.view.shake = 0.8; splat(); }
        else msg(e.name + ' утонул', '#ffd23e', false);
        burst(l, r, 30, 'mud');
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

  /* игрок утонул — соперник доезжает «за кадром» */
  function finishOthers() {
    const dt = MR.C.DT;
    for (let l = 0; l < 2; l++) {
      const e = G.lanes[l];
      if (!e || e.player) continue;
      let t = G.t;
      while (!e.r.fin && !e.r.drowned && t < MR.C.TLIMIT) {
        t += dt;
        MR.stepRider(e.r, G.track, l, MR.aiGas(e.ai, e.r, G.track, t, dt, G.heatRnd), dt, t);
        e.r.ev.length = 0;
      }
    }
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
      e.entry.runs.push({ raw, pen, total, lane: l, drowned: !!e.r.drowned });
      e.entry.total += total;
      tots.push(total);
      if (!best || total < best.total) best = { total, e };
      rows.push({ e, raw, pen, total, lane: l, react: e.r.react, drowned: !!e.r.drowned });
    }
    let html = `<div class="kicker">${G.label} — финиш</div>`;
    for (const row of rows) {
      if (row.none) { html += `<div class="res-row"><span class="ln">дорожка ${row.lane + 1}</span><b class="free">без пары</b></div>`; continue; }
      const w = best && Math.abs(row.total - best.total) < 1e-6;
      html += `<div class="res-row ${row.e.player ? 'me' : ''} ${w ? 'win' : ''}">
        <span class="ln">дорожка ${row.lane + 1}</span>
        <b>${escHtml(row.e.name)}${row.drowned ? ' <i class="pen">утонул</i>' : ''}</b>
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
    if (pr && pr.r.drowned) { drownScreen(html, last); return; }
    html += `<button class="btn primary" id="btn-next">${last ? 'ИТОГИ ЧЕМПИОНАТА' : 'ИТОГИ СЕРИИ'}</button>`;
    show(html);
    G.screen = 'heatResult';
    document.getElementById('btn-next').addEventListener('click', () => {
      hide();
      if (G.si >= 3) { finalScreen(); return; }
      seriesScreen();
    });
  }

  /* ---------- «Экстрим»: утонул ---------- */
  function drownScreen(resHtml, last) {
    show(`
      <div class="hero-bg"></div>
      <div class="hero-in">
        <div class="hero-top"></div>
        <div class="kicker">${escHtml(G.label)} · Экстрим</div>
        <h2>Утонул</h2>
        <div class="sub">Мотор заглох в воде и не завёлся за ${MR.C.DROWN} с — время заезда ${MR.C.TLIMIT.toFixed(2)} с.</div>
        <div class="heat-res">${resHtml}</div>
        <button class="btn primary" id="btn-next">${last ? 'ИТОГИ ЧЕМПИОНАТА' : 'СЛЕДУЮЩИЙ ЗАЕЗД'}</button>
      </div>
    `, 'hero fail');
    G.screen = 'heatResult';
    document.getElementById('btn-next').addEventListener('click', () => {
      hide();
      if (G.si >= 3) finalScreen(); else playSeries(G.si + 1);
    });
  }

  /* ---------- «Экстрим»: вопрос по регламенту ---------- */
  // вопросы — questions.json; в сборке встроены в <script id="mr-questions">
  let QUESTIONS = null;
  function loadQuestions() {
    if (QUESTIONS) return Promise.resolve(QUESTIONS);
    const el = document.getElementById('mr-questions');
    const ok = (list) => Array.isArray(list) ? list.filter((q) => q && q.question && Array.isArray(q.answers) &&
      q.answers.length >= 2 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.answers.length) : [];
    try {
      const txt = el ? el.textContent.trim() : '';
      if (txt) return Promise.resolve(QUESTIONS = ok(JSON.parse(txt)));
    } catch (e) { console.warn('questions: bad inline JSON', e); }
    const src = el && el.dataset.src;
    if (!src) return Promise.resolve(QUESTIONS = []);
    return fetch(src).then((r) => r.json()).then((j) => (QUESTIONS = ok(j)))
      .catch((e) => { console.warn('questions: load failed', e); return []; });
  }
  function questionScreen(onPass) {
    G.screen = 'question';
    loadQuestions().then((list) => {
      if (G.screen !== 'question') return;
      if (!list.length) { onPass(); return; }     // вопросов нет — пропускаем
      const q = list[Math.floor(Math.random() * list.length)];
      const order = MR.shuffle(q.answers.map((_, i) => i), Math.random);
      show(`
        <div class="hero-bg"></div>
        <div class="hero-in">
          <div class="hero-top"></div>
          <div class="kicker">Экстрим · допуск к старту</div>
          <h2>Вопрос по регламенту</h2>
          <div class="sub q-text">${escHtml(q.question)}</div>
          <div class="qa">${order.map((i) => `<button data-i="${i}">${escHtml(q.answers[i])}</button>`).join('')}</div>
          <div class="sub small" id="q-res">Ответишь верно — допуск к старту. Ошибёшься — снова на главную.</div>
        </div>
      `, 'hero judge');
      const btns = ov.querySelectorAll('.qa button');
      btns.forEach((b) => b.addEventListener('click', () => {
        if (G.screen !== 'question') return;
        G.screen = 'questionDone';
        const right = +b.dataset.i === q.correct;
        btns.forEach((x) => { x.disabled = true; if (+x.dataset.i === q.correct) x.classList.add('ok'); });
        const res = document.getElementById('q-res');
        if (right) {
          res.innerHTML = '<b style="color:#7dffa8">Верно! Допущен к старту.</b>';
          setTimeout(() => { hide(); setTimeout(onPass, 150); }, 900);
        } else {
          b.classList.add('bad');
          res.innerHTML = '<b style="color:#ff8a6a">Неверно — к старту не допущен.</b>';
          setTimeout(() => { hide(); setTimeout(menu, 150); }, 2200);
        }
      }));
    });
  }

  function seriesScreen() {
    G.screen = 'seriesResult';
    const sorted = G.riders.slice().sort((a, b) => a.total - b.total);
    let rows = '';
    sorted.forEach((e, i) => {
      const done = e.runs.length;
      rows += `<div class="res-row ${e.isPlayer ? 'me' : ''}">
        <span class="pl">${i + 1}</span><b>${escHtml(e.name)}</b>
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
        <span class="pl">${i + 1}</span><b>${escHtml(e.name)}</b>
        <span class="tot">${fmt(e.total)}</span>
        <span class="diff">${i === 0 ? '🏆' : '+' + (e.total - win.total).toFixed(2)}</span>
        <span class="lap">лучший ${fmt(bestLap)}</span></div>`;
    });
    // рекорд засчитываем только за пройденный чемпионат
    const bestLapMe = me.runs.length ? Math.min(...me.runs.map((r) => r.total)) : null;
    const recTs = Date.now();
    const rank = STORE.add({ n: me.name, t: me.total, d: G.diff, b: bestLapMe, p: place, ts: recTs });
    const isBest = rank === 1;

    const title = place === 1 ? 'ПОБЕДА!' : place <= 3 ? 'ПОДИУМ' : 'НЕ ПРОШЁЛ';
    const col = place === 1 ? '#7dffa8' : place <= 3 ? '#ffd23e' : '#ff8a6a';
    show(`<div class="kicker" style="color:${col}">${title} · ${place} место</div>
      <h2>Итоги чемпионата</h2>
      <div class="sub">сумма четырёх заездов — это и есть результат</div>
      <div class="table final">${rows}</div>
      ${rank ? `<div class="sub small" style="color:${isBest ? '#7dffa8' : '#ffd23e'}">
        ${isBest ? '🏆 Новый рекорд трассы!' : 'Результат записан в таблицу: ' + rank + '-е место.'}
        ${STORE.persistent ? '' : ' (не сохранится — браузер блокирует хранилище)'}</div>` : ''}
      ${STORE.online ? '<div class="sub small" id="net-status">Общая таблица…</div>' : ''}
      <div class="rowbtns">
        <button class="btn" id="btn-records2">РЕКОРДЫ</button>
        <button class="btn primary" id="btn-again">ЕЩЁ РАЗ</button>
      </div>`);
    document.getElementById('btn-again').addEventListener('click', menu);
    document.getElementById('btn-records2').addEventListener('click', () => {
      hide(); setTimeout(() => recordsScreen({ fresh: recTs, tab: 'local', diff: G.diff }), 130);
    });
    if (STORE.online) {
      const diff = G.diff, lvl = DIFFNAME[diff];
      const top = STORE.records.find((r) => r.d === diff);
      const isBest = !!top && top.ts === recTs;      // этот чемпионат — новый личный рекорд на уровне?
      STORE.syncBest().then((sync) => {
        const st = document.getElementById('net-status');
        if (!st || G.screen !== 'final') return;
        const res = sync.results[diff];
        if (isBest && res && res.ok) {
          st.style.color = res.rank === 1 || res.absRank === 1 ? '#7dffa8' : '';
          st.innerHTML = `🌍 Общая таблица · ${escHtml(lvl)}: <b>${res.rank}-е место</b>` +
            (res.rank === 1 ? ' — лучший среди всех!' : '') +
            ` · Абсолют: <b>${res.absRank}-е</b>`;
        } else if (isBest || !sync.ok) {
          st.textContent = 'Нет связи с сервером — результат отправится в общую таблицу позже.';
        } else {
          st.textContent = top ? `В общую таблицу (${lvl}) идёт только твой лучший результат на уровне — ${top.t.toFixed(2)}.` : '';
        }
      });
    }
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
      const pl = G.playerLane >= 0 ? G.lanes[G.playerLane] : null;
      if (pl && pl.r.drowned) { if (pl.r.sinkT > 1.8) { finishOthers(); endHeat(); } }
      else if (G.lanes.every((e) => !e || e.r.fin || e.r.drowned || G.t > 60)) endHeat();
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
      if (pr.drowned) hint = 'УТОНУЛ';
      else if (pr.dead) hint = pr.deadT < MR.C.RESTART ? 'ЗАГЛОХ В ВОДЕ — отпусти газ…' : 'ЖМИ ГАЗ — заводи, пока не утонул!';
      else if (pr.cut > 0) hint = 'ДВИГАТЕЛЬ ЗАГЛОХ — жди';
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
        if (e.isPlayer && !pr.fin) v = e.total + (pr.drowned ? MR.C.TLIMIT : Math.max(0, G.t));
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
