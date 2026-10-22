/* TMW タネ帳: cache the app and the bundled inference code; WebLLM caches model data separately. */
const VERSION = "tane-2026-10-22-v7";
const SCOPE = new URL(self.registration.scope);
const PREFIX = "tane:" + SCOPE.pathname + ":";
const SHELL = PREFIX + VERSION + ":shell";
const FONTS = PREFIX + "fonts";
const at = path => new URL(path, SCOPE).href;
const ENTRY = at("index.html");
const STATIC = [at("icon.png"), at("webllm.js"), at("worker.js")];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll([ENTRY, ...STATIC].map(url => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Limit cleanup to this app's path; preserve WebLLM model caches and other sites' data.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && ![SHELL, FONTS].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
async function warnClients() {
  for (const client of await self.clients.matchAll()) client.postMessage({ type: "TANE_CACHE_WARNING" });
}
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.protocol !== "https:" && url.protocol !== "http:") return;
  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith(SCOPE.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          if (url.pathname === new URL(ENTRY).pathname || url.pathname === SCOPE.pathname) {
            try { await (await caches.open(SHELL)).put(ENTRY, response.clone()); }
            catch { await warnClients(); }
          }
          return response;
        }
      }
      catch { /* The install step saved the entry point. */ }
      return await (await caches.open(SHELL)).match(ENTRY) || Response.error();
    })());
    return;
  }
  // Icon, WebLLM bundle and worker: versioned with this file, so serve the saved copy first.
  const href = url.origin + url.pathname;
  if (STATIC.includes(href)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL), saved = await cache.match(href);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(href, response.clone()); }
        catch { await warnClients(); }
      }
      return response;
    })());
    return;
  }
  if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS), saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok || response.type === "opaque") {
        try { await cache.put(request, response.clone()); } catch { /* Optional fonts have system-font fallbacks. */ }
      }
      return response;
    })());
  }
});
