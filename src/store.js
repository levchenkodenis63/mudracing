'use strict';
/* ===== MUD RACING — хранилище: имя игрока и таблица рекордов =====
   Данные лежат в localStorage браузера. Если он недоступен
   (приватный режим, запрет cookies) — работаем в памяти,
   игра не падает, просто рекорды не переживут перезагрузку. */
const STORE = (function () {
  const KEY = 'mudracing.v1';
  const CID_KEY = 'mudracing.cid';
  const MAX = 20;
  /* адрес сервера общей таблицы (server/worker.js); пусто — только локальные рекорды */
  const API_URL = 'https://mudracing-scores.levchenkodenis63.workers.dev';
  const TIMEOUT = 7000;
  const mem = { name: '', records: [], cid: '' };
  let persistent = false;

  try {
    const probe = '__mr_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    persistent = true;
  } catch (e) { persistent = false; }

  /* имя: только буквы, цифры, пробел, дефис, точка, подчёркивание */
  function cleanName(raw, fallback) {
    const src = String(raw == null ? '' : raw);
    // HTML/кавычки — не пытаемся «спасти» такое имя, берём запасное
    if (/[<>"'`]/.test(src)) return fallback;
    // остальное недопустимое превращаем в пробел, а не выбрасываем:
    // так «Вася!!!» -> «Вася», но мусор не склеивается в новое слово
    let s = src.replace(/[^\w\s\-.\u0400-\u04FF]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim().slice(0, 14).trim();
    if (s.replace(/[^\w\u0400-\u04FF]/g, '').length < 2) return fallback;
    return s;
  }

  function readRaw() {
    if (!persistent) return mem;
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return { name: '', records: [] };
      const d = JSON.parse(s);
      return {
        name: typeof d.name === 'string' ? d.name : '',
        records: Array.isArray(d.records) ? d.records : []
      };
    } catch (e) { return { name: '', records: [] }; }
  }
  function writeRaw(d) {
    if (!persistent) { mem.name = d.name; mem.records = d.records; return; }
    try { localStorage.setItem(KEY, JSON.stringify(d)); }
    catch (e) { mem.name = d.name; mem.records = d.records; }
  }

  /* нормализуем запись, чтобы битые данные не ломали верстку */
  function sane(r) {
    if (!r || typeof r !== 'object') return null;
    const t = Number(r.t);
    if (!isFinite(t) || t <= 0 || t > 900) return null;
    return {
      n: cleanName(r.n, 'Гонщик'),
      t: Math.round(t * 100) / 100,
      d: (r.d === 'easy' || r.d === 'hard' || r.d === 'extreme') ? r.d : 'normal',
      b: isFinite(Number(r.b)) ? Math.round(Number(r.b) * 100) / 100 : null,
      p: isFinite(Number(r.p)) ? Math.max(1, Math.min(99, Math.round(Number(r.p)))) : null,
      ts: isFinite(Number(r.ts)) ? Number(r.ts) : Date.now()
    };
  }
  function sorted(list) {
    return list.map(sane).filter(Boolean).sort((a, b) => a.t - b.t).slice(0, MAX);
  }

  /* случайный id браузера: по нему сервер хранит лучший результат игрока */
  function cid() {
    let id = '';
    try { id = persistent ? (localStorage.getItem(CID_KEY) || '') : mem.cid; } catch (e) { id = mem.cid; }
    if (/^[a-zA-Z0-9-]{8,40}$/.test(id)) return id;
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()
      : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    mem.cid = id;
    try { if (persistent) localStorage.setItem(CID_KEY, id); } catch (e) { /* остаётся в памяти */ }
    return id;
  }

  /* какие результаты уже отправлены на сервер: { easy|normal|hard|extreme: "ts|время|имя" } */
  const SYNC_KEY = 'mudracing.synced';
  const DIFFS = ['easy', 'normal', 'hard', 'extreme'];
  let syncing = null;
  function readSynced() {
    let raw = '';
    try { raw = persistent ? (localStorage.getItem(SYNC_KEY) || '') : (mem.synced || ''); } catch (e) { raw = mem.synced || ''; }
    try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function writeSynced(o) {
    const v = JSON.stringify(o);
    mem.synced = v;
    try { if (persistent) localStorage.setItem(SYNC_KEY, v); } catch (e) { /* остаётся в памяти */ }
  }

  /* запрос к серверу с таймаутом; всегда резолвится объектом {ok, ...} */
  async function api(path, opts) {
    if (!API_URL) return { ok: false, error: 'offline' };
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
    try {
      const res = await fetch(API_URL.replace(/\/+$/, '') + path, Object.assign({ signal: ctl ? ctl.signal : undefined }, opts));
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { ok: false, error: data.error || ('http ' + res.status), status: res.status };
      return data;
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    } finally { if (timer) clearTimeout(timer); }
  }

  return {
    get online() { return !!API_URL; },
    /* досылает в общую таблицу лучший локальный результат на каждом уровне, если он ещё
       не отправлен (или с тех пор сменилось имя).
       Ответ: { ok, results: { easy|normal|hard|extreme: ответ сервера } } — только по отправленным уровням */
    syncBest() {
      if (!API_URL) return Promise.resolve({ ok: false, error: 'offline', results: {} });
      if (syncing) return syncing;
      syncing = (async () => {
        const data = readRaw();
        const list = sorted(data.records);
        const own = cleanName(data.name, '');
        const synced = readSynced();
        const results = {};
        let ok = true;
        for (const d of DIFFS) {
          const top = list.find((r) => r.d === d);
          if (!top) continue;
          const name = own || cleanName(top.n === 'ВЫ' ? '' : top.n, 'Гонщик');
          const key = [top.ts, top.t, name].join('|');
          if (synced[d] === key) continue;
          const res = await api('/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cid: cid(), name, diff: d, total: top.t, bestLap: top.b, place: top.p, ts: top.ts })
          });
          results[d] = res;
          if (res.ok) { synced[d] = key; writeSynced(synced); } else { ok = false; if (!res.status) break; }   // нет связи — дальше не пробуем
        }
        return { ok, results };
      })().finally(() => { syncing = null; });
      return syncing;
    },
    /* общий топ уровня (diff = easy|normal|hard|extreme|all), 20 строк с offset + место самого игрока */
    globalTop(diff, offset) {
      return api('/scores?diff=' + encodeURIComponent(diff || 'all') + '&me=' + encodeURIComponent(cid()) +
        (offset ? '&offset=' + Math.max(0, offset | 0) : ''), { method: 'GET' });
    },
    get name() { return cleanName(readRaw().name, ''); },
    set name(v) {
      const d = readRaw(); d.name = cleanName(v, ''); writeRaw(d);
    },
    get records() { return sorted(readRaw().records); },
    get persistent() { return persistent; },
    /* добавить результат; вернуть место в таблице (1..N) или 0 */
    add(entry) {
      const rec = sane(entry);
      if (!rec) return 0;
      const d = readRaw();
      const list = sorted(d.records.concat([rec]));
      const idx = list.findIndex((r) => r.ts === rec.ts && r.t === rec.t && r.n === rec.n);
      writeRaw({ name: d.name, records: list });
      return idx >= 0 ? idx + 1 : 0;
    },
    best() { const l = sorted(readRaw().records); return l.length ? l[0].t : null; },
    clear() { writeRaw({ name: readRaw().name, records: [] }); },
    cleanName
  };
})();
if (typeof module !== 'undefined') module.exports = STORE;
