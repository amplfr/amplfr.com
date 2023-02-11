importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');
const { registerRoute } = workbox.routing
const { CacheFirst, StaleWhileRevalidate } = workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { RangeRequestsPlugin } = workbox.rangeRequests;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { BackgroundSyncPlugin, Queue } = workbox.backgroundSync;


const MsgQueue = new Queue('APISyncQueue');


const apiRE = /\/api\/.+\.(?:\.files|\.json|\.xml)$/
const api = new StaleWhileRevalidate({
    "cacheName": "api",
    plugins: [
        new ExpirationPlugin({
            maxEntries: 100000,
            maxAgeSeconds: 31536000
        })
    ]
});
const assets = new StaleWhileRevalidate({
    "cacheName": "assets",
    plugins: [
        new ExpirationPlugin({
            maxEntries: 10000,
            maxAgeSeconds: 31536000
        })
    ]
});
const media = new CacheFirst({
    cacheName: 'media',
    plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new RangeRequestsPlugin(),
    ],
});
const images = new CacheFirst({
    "cacheName": "images",
    plugins: [
        new ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 31536000
        })
    ]
});

registerRoute('/', assets);
registerRoute('/manifest.json', assets);
registerRoute(/\/api\/.+\.(?:flac|mp3|oga)$/, media, 'GET');
registerRoute(apiRE, api);
registerRoute('/api/queue', api);  // /api/*
registerRoute(/\.(?:css|eot|html|js|woff)$/, assets);
registerRoute(/\.(?:ico|jpg|png|svg)$/, images);
registerRoute(({ request }) => {
    const { destination } = request;
    return destination === 'video' || destination === 'audio'
}, media);


// trigger the activate event and tell the Service Worker to start working immediately without waiting for the user to navigate or reload the page [https://livebook.manning.com/book/progressive-web-apps/chapter-4/ch04ex06]
self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting()) // skipWaiting() forces the waiting Service Worker to become the active Service Worker
})
// activate Service Worker immediately [https://livebook.manning.com/book/progressive-web-apps/chapter-4/ch04ex07]
self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim())
})
self.addEventListener("fetch", (event) => {
    console.log(`Handling fetch event for ${event.request.url}`);

    if (event.request.method === 'POST') {
        const bgSyncLogic = async () => {
            try {
                const response = await fetch(event.request.clone());
                return response;
            } catch (error) {
                await MsgQueue.pushRequest({ request: event.request });
                return error;
            }
        };

        event.respondWith(bgSyncLogic());
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                console.log("Found response in cache:", response);
                return response;
            }
            console.log("No response found in cache. About to fetch from network...");

            return fetch(event.request)
                .then((response) => {
                    console.log("Response from network is:", response);

                    if (event.request.url.match(apiRE) && event.request.method === 'GET') {
                        // Since we can use the response only once, put the clone into the cache and serve the original response
                        const responseClone = response.clone()
                        caches.open(api.cacheName).then(cache => {
                            console.log('Response ', responseClone, ' cached in ', api.cacheName);
                            cache.put(event.request, responseClone)
                        })
                    }
                    return response;
                })
                .catch((error) => {
                    console.error(`Fetching failed: ${error}`);
                    throw error;
                });
        })
    );
});
