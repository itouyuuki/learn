// 旅のしおり PWA - Service Worker
// ====================================

const CACHE_NAME = 'travel-v4';
const STATIC_ASSETS = [
    './home.html',
    './schedule.html',
    './seat.html',
    './common.css',
    './home.css',
    './schedule.css',
    './seat.css',
    './app.js',
    './seat.js',
    './data.json',
    './manifest.json',
    './images/kazoku.jpg',
    './images/pwa.jpg',
    // Google Fonts
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
    // Amcharts 天気アイコン（使用するものを事前キャッシュ）
    'https://cdn.amcharts.com/lib/4/images/weather/animated/day.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/cloudy-day-1.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/cloudy-day-3.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/fog.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/rainy-1.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/snowy-1.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/rainy-3.svg',
    'https://cdn.amcharts.com/lib/4/images/weather/animated/thunder.svg'
];

// ====================================
// インストールイベント
// ====================================

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// ====================================
// アクティベートイベント
// ====================================

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ====================================
// フェッチイベント
// ====================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Open-Meteo API - ネットワークファースト
    if (url.hostname === 'api.open-meteo.com') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // レスポンスをキャッシュ
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    // オフライン時はキャッシュを使用
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 国土地理院API - ネットワークファースト
    if (url.hostname.includes('cyberjapandata2.gsi.go.jp')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // 失敗時はnullを返す（app.jsで'--m'表示）
                    return new Response('null', { status: 200 });
                })
        );
        return;
    }

    // 静的アセット - キャッシュファースト
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((response) => {
                // レスポンスをキャッシュ
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        })
    );
});
