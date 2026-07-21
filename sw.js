const CACHE = 'scoretuner-v5';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'icons/icon.svg',
  'css/base.css', 'css/screens.css',
  'js/bus.js', 'js/app.js',
  'js/music/theory.js', 'js/music/arrange.js', 'js/music/chords-db.js', 'js/music/patterns.js',
  'js/audio/pitch.js', 'js/audio/chroma.js', 'js/audio/kalimba.js', 'js/audio/mic.js',
  'js/songs/parser.js', 'js/songs/store.js', 'js/songs/ai.js',
  'js/screens/tuner.js', 'js/screens/library.js', 'js/screens/addsong.js',
  'js/screens/viewer.js', 'js/screens/performance.js', 'js/screens/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.anthropic.com')) return;   // API는 캐시하지 않음
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();   // 폰트 CDN 등 런타임 캐시
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
  );
});
