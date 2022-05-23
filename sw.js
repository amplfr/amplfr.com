importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/6.0.2/workbox-sw.js'
)

workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst()
)

// trigger the activate event and tell the Service Worker to start working immediately without waiting for the user to navigate or reload the page [https://livebook.manning.com/book/progressive-web-apps/chapter-4/ch04ex06]
self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting()) // skipWaiting() forces the waiting Service Worker to become the active Service Worker
})
// activate Service Worker immediately [https://livebook.manning.com/book/progressive-web-apps/chapter-4/ch04ex07]
self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim())
})
