/* ===== MUD RACING — service worker: игра работает без интернета =====
   Сначала сеть (чтобы сразу получать новые версии), без сети — из кэша.
   Запросы к серверу рекордов (другой домен) не трогаем: ими управляет store.js.
   VERSION подставляет build.py — новая сборка = новый кэш. */
const VERSION = '__BUILD__';
const CACHE = 'mudracing-' + VERSION;
const FILES = ['./', './index.html', './install.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const NET_TIMEOUT = 4000;   // плохая сеть — не ждём дольше, отдаём из кэша

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mudracing-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // no-cache: перепроверить на сервере, а не брать копию из HTTP-кэша
      // (GitHub Pages отдаёт max-age=600 — иначе до 10 минут приходила бы старая версия).
      // Навигационный запрос нельзя пересоздать с параметрами — для него берём url.
      const res = await Promise.race([
        fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_TIMEOUT))
      ]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true }) ||
        (req.mode === 'navigate' ? await cache.match('./index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
