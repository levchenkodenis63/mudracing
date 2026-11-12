'use strict';
/* ===== MUD RACING — хранилище: имя игрока и таблица рекордов =====
   Данные лежат в localStorage браузера. Если он недоступен
   (приватный режим, запрет cookies) — работаем в памяти,
   игра не падает, просто рекорды не переживут перезагрузку. */
const STORE = (function () {
  const KEY = 'mudracing.v1';
  const MAX = 20;
  const mem = { name: '', records: [] };
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
      d: (r.d === 'easy' || r.d === 'hard') ? r.d : 'normal',
      b: isFinite(Number(r.b)) ? Math.round(Number(r.b) * 100) / 100 : null,
      p: isFinite(Number(r.p)) ? Math.max(1, Math.min(99, Math.round(Number(r.p)))) : null,
      ts: isFinite(Number(r.ts)) ? Number(r.ts) : Date.now()
    };
  }
  function sorted(list) {
    return list.map(sane).filter(Boolean).sort((a, b) => a.t - b.t).slice(0, MAX);
  }

  return {
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
