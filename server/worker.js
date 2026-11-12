/* ===== MUD RACING — сервер общей таблицы рекордов (Cloudflare Worker + D1) =====

   GET    /scores?diff=<easy|normal|hard|all>&me=<cid>   топ-20 + место самого игрока
   POST   /scores                                        прислать лучший результат игрока на уровне
   DELETE /scores/<id>                                   удалить запись (модерация, нужен ADMIN_TOKEN)

   На каждого игрока (cid) хранится лучший результат на каждом уровне соперников.
   diff=all — «Абсолют»: по одной строке на игрока, его лучший результат на любом уровне.
   Секрет (npx wrangler secret put ADMIN_TOKEN) нужен только для удаления.
*/

const TOP = 20;
// простая проверка на корректность (не защита от накрутки):
// 4 заезда по 15–92 с — быстрее 16.7 с за заезд проехать нельзя, лимит заезда 90 с + штраф 2 с
const MIN_TOTAL = 60, MAX_TOTAL = 368;
const DIFFS = ['easy', 'normal', 'hard'];

const CORS = {
  'Access-Control-Allow-Origin': '*',          // игра открывается и с file://, и с любого хостинга
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS }
  });
}
const fail = (status, error) => json({ ok: false, error }, status);

/* то же правило, что в src/store.js — имена видят все, HTML не пропускаем */
function cleanName(raw, fallback) {
  const src = String(raw == null ? '' : raw);
  if (/[<>"'`]/.test(src)) return fallback;
  let s = src.replace(/[^\w\s\-.Ѐ-ӿ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().slice(0, 14).trim();
  if (s.replace(/[^\wЀ-ӿ]/g, '').length < 2) return fallback;
  return s;
}
const r2 = (v) => Math.round(v * 100) / 100;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* нормализованная запись или текст ошибки */
function validate(body) {
  if (!body || typeof body !== 'object') return 'bad body';
  const { cid, name, total, diff, bestLap, place, ts } = body;
  if (typeof cid !== 'string' || !/^[a-zA-Z0-9-]{8,40}$/.test(cid)) return 'bad cid';
  if (!DIFFS.includes(diff)) return 'bad diff';
  if (!isNum(total) || total < MIN_TOTAL || total > MAX_TOTAL) return 'bad total';
  const now = Date.now();
  return {
    cid, diff,
    name: cleanName(name, 'Гонщик'),
    total: r2(total),
    bestLap: isNum(bestLap) && bestLap > 0 && bestLap < 100 ? r2(bestLap) : null,
    place: isNum(place) ? Math.max(1, Math.min(99, Math.round(place))) : null,
    ts: isNum(ts) && ts > 1.6e12 && ts <= now + 864e5 ? Math.round(ts) : now
  };
}

/* лучшая запись каждого игрока по всем уровням («Абсолют») */
const ABS = `
  SELECT s.* FROM scores s
  WHERE s.id = (SELECT s2.id FROM scores s2 WHERE s2.cid = s.cid ORDER BY s2.total ASC, s2.ts ASC LIMIT 1)`;

/* место результата total: на уровне diff или в абсолюте (diff = 'all') */
async function rankOf(env, diff, total) {
  const row = diff === 'all'
    ? await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT MIN(total) AS m FROM scores GROUP BY cid) WHERE m < ?').bind(total).first()
    : await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE diff = ? AND total < ?').bind(diff, total).first();
  return (row ? row.n : 0) + 1;
}

async function getScores(url, env) {
  const diff = url.searchParams.get('diff') || 'all';
  if (diff !== 'all' && !DIFFS.includes(diff)) return fail(400, 'bad diff');
  const me = url.searchParams.get('me') || '';
  const { results } = diff === 'all'
    ? await env.DB.prepare(ABS + ' ORDER BY s.total ASC, s.ts ASC LIMIT ?').bind(TOP).all()
    : await env.DB.prepare('SELECT * FROM scores WHERE diff = ? ORDER BY total ASC, ts ASC LIMIT ?').bind(diff, TOP).all();
  const top = results.map((r) => ({
    id: r.id, n: r.name, t: r.total, d: r.diff, b: r.best_lap, p: r.place, ts: r.ts,
    me: !!me && r.cid === me
  }));
  let mine = null;
  if (me && !top.some((r) => r.me)) {
    const own = diff === 'all'
      ? await env.DB.prepare('SELECT name, total, diff FROM scores WHERE cid = ? ORDER BY total ASC LIMIT 1').bind(me).first()
      : await env.DB.prepare('SELECT name, total, diff FROM scores WHERE cid = ? AND diff = ?').bind(me, diff).first();
    if (own) mine = { n: own.name, t: own.total, d: own.diff, rank: await rankOf(env, diff, own.total) };
  }
  const cnt = diff === 'all'
    ? await env.DB.prepare('SELECT COUNT(DISTINCT cid) AS n FROM scores').first()
    : await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE diff = ?').bind(diff).first();
  return json({ ok: true, diff, top, mine, count: cnt ? cnt.n : 0 });
}

async function postScore(request, env) {
  const text = await request.text();
  if (text.length > 2000) return fail(413, 'too large');
  let body;
  try { body = JSON.parse(text); } catch (e) { return fail(400, 'bad json'); }
  const rec = validate(body);
  if (typeof rec === 'string') return fail(422, rec);

  // результат на уровне заменяется, только если он лучше; имя обновляется во всех записях игрока
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO scores (cid, diff, name, total, best_lap, place, ts) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (cid, diff) DO UPDATE SET
        name     = excluded.name,
        best_lap = CASE WHEN excluded.total < scores.total THEN excluded.best_lap ELSE scores.best_lap END,
        place    = CASE WHEN excluded.total < scores.total THEN excluded.place    ELSE scores.place    END,
        ts       = CASE WHEN excluded.total < scores.total THEN excluded.ts       ELSE scores.ts       END,
        total    = MIN(scores.total, excluded.total)
    `).bind(rec.cid, rec.diff, rec.name, rec.total, rec.bestLap, rec.place, rec.ts),
    env.DB.prepare('UPDATE scores SET name = ? WHERE cid = ?').bind(rec.name, rec.cid)
  ]);

  const own = await env.DB.prepare('SELECT total FROM scores WHERE cid = ? AND diff = ?').bind(rec.cid, rec.diff).first();
  const abs = await env.DB.prepare('SELECT MIN(total) AS m FROM scores WHERE cid = ?').bind(rec.cid).first();
  const best = own ? own.total : rec.total;
  const absBest = abs && abs.m != null ? abs.m : best;
  return json({
    ok: true,
    best, rank: await rankOf(env, rec.diff, best),               // место на уровне
    absBest, absRank: await rankOf(env, 'all', absBest)          // место в абсолюте
  });
}

async function deleteScore(request, env, id) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || auth !== 'Bearer ' + env.ADMIN_TOKEN) return fail(401, 'unauthorized');
  const res = await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
  return json({ ok: true, deleted: res.meta ? res.meta.changes : 0 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/scores' && request.method === 'GET') return await getScores(url, env);
      if (url.pathname === '/scores' && request.method === 'POST') return await postScore(request, env);
      const m = url.pathname.match(/^\/scores\/(\d+)$/);
      if (m && request.method === 'DELETE') return await deleteScore(request, env, Number(m[1]));
      if (url.pathname === '/') return json({ ok: true, service: 'mudracing-scores' });
      return fail(404, 'not found');
    } catch (e) {
      return fail(500, 'server error');
    }
  }
};
