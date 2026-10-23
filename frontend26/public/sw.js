/**
 * sw.js is the service worker that lets the site keep working with no
 * internet connection (e.g. out on a trail), much like a maps app's
 * downloaded regions.
 *
 * Caches:
 *   - SHELL_CACHE: the app itself (index.html, the built JS/CSS bundles,
 *     fonts, logos), refreshed in the background whenever it's online.
 *   - RUNTIME_CACHE: API JSON responses seen while browsing normally, so
 *     recently visited pages still open offline.
 *   - "offline-<dataset>": a whole dataset saved on purpose with the
 *     "Save for offline use" button (see src/services/offline.js), which
 *     fills these caches itself; this worker only reads from them, and keeps
 *     their JSON fresh whenever the same request succeeds online.
 *
 * Strategy: API JSON is network-first (falling back to the caches after a
 * short timeout, so a weak trail signal doesn't leave pages hanging); photos
 * are cache-first from a saved dataset, since they rarely change and are
 * the bulk of the data; page navigations fall back to the cached index.html.
 *
 * Bump CACHE_VERSION to throw away the shell/runtime caches on the next
 * visit. Saved datasets are never touched here — only the button removes them.
 */
const CACHE_VERSION = "v1";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `api-runtime-${CACHE_VERSION}`;
const OFFLINE_PREFIX = "offline-";
const NETWORK_TIMEOUT_MS = 4000;

// API paths that return image files rather than JSON.
const IMAGE_PATHS = ["/api/get-image/", "/api/get-image-by-image-id/", "/api/get-location-photo-image/"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(cache => cache.add("/index.html"))
      .catch(() => {})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, RUNTIME_CACHE];
      for (const name of await caches.keys()) {
        if (!keep.includes(name) && !name.startsWith(OFFLINE_PREFIX)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(IMAGE_PATHS.some(p => url.pathname.startsWith(p)) ? handleImage(req, url) : handleApiJson(req, url));
  } else if (req.mode === "navigate") {
    event.respondWith(handleNavigate(req));
  } else if (
    url.origin === self.location.origin ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

// cacheKey normalizes an API URL so the same request matches however it was
// written (with or without a trailing slash, params in any order). Keep in
// sync with cacheKey in src/services/offline.js.
function cacheKey(url) {
  const u = new URL(url);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return `${u.origin}${path}${query ? `?${query}` : ""}`;
}

async function offlineCacheNames() {
  return (await caches.keys()).filter(name => name.startsWith(OFFLINE_PREFIX));
}

// matchSaved looks a key up in the saved datasets, then the runtime cache.
async function matchSaved(key) {
  for (const name of await offlineCacheNames()) {
    const hit = await (await caches.open(name)).match(key, { ignoreVary: true });
    if (hit) return { response: hit, cacheName: name };
  }
  const hit = await (await caches.open(RUNTIME_CACHE)).match(key, { ignoreVary: true });
  return hit ? { response: hit, cacheName: RUNTIME_CACHE } : null;
}

async function handleImage(req, url) {
  const saved = await matchSaved(cacheKey(url));
  if (saved) return saved.response;
  return fetch(req);
}

// handleApiJson is network-first. If the network hasn't answered within
// NETWORK_TIMEOUT_MS and there's a cached copy, the cached copy is used;
// otherwise it keeps waiting for the network.
async function handleApiJson(req, url) {
  const key = cacheKey(url);
  const network = fetch(req).then(async res => {
    if (res.ok) {
      // Refresh a saved dataset's copy in place; anything else goes to the runtime cache.
      const saved = await matchSaved(key);
      const cacheName = saved && saved.cacheName !== RUNTIME_CACHE ? saved.cacheName : RUNTIME_CACHE;
      await (await caches.open(cacheName)).put(key, res.clone());
    }
    return res;
  });
  network.catch(() => {});

  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, "timeout"));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    const cached = await offlineFallback(url, key);
    return cached || (await network);
  } catch {
    const cached = await offlineFallback(url, key);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function offlineFallback(url, key) {
  const saved = await matchSaved(key);
  if (saved) return saved.response;
  if (url.pathname.replace(/\/+$/, "") === "/api/expected-wildlife") return expectedWildlifeFallback(url);
  return null;
}

// expectedWildlifeFallback answers a flight-times lookup for any date from
// the per-day, all-zone answers that offline.js saved under synthetic keys,
// patching in the requested date and, for zoned datasets, narrowing the
// species to the requested life zone (as the API would).
async function expectedWildlifeFallback(url) {
  const dataset = url.searchParams.get("dataset");
  const date = url.searchParams.get("date") || todayIso();
  const zoneParam = (url.searchParams.get("zone") || "All").trim();
  const zone = zoneParam.charAt(0).toUpperCase() + zoneParam.slice(1).toLowerCase();
  const [, month, day] = date.split("-");
  const key = cacheKey(`${url.origin}/api/expected-wildlife?dataset=${dataset}&offline_day=${month}-${day}`);
  const saved = await matchSaved(key);
  if (!saved) return null;
  const data = await saved.response.json();
  if (data.zoned && zone !== "All") {
    data.zone = zone;
    data.species = data.species
      .filter(s => s.zones.includes(zone))
      .map(s => ({
        ...s,
        zones: [zone],
        zone_periods: { [zone]: s.zone_periods[zone] },
        flight_period: s.zone_periods[zone]
      }));
  }
  return new Response(JSON.stringify({ ...data, date }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function todayIso() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// handleNavigate serves the SPA's index.html for every page. It's
// network-first so new deploys show up right away, and each fresh copy
// prunes built bundles the new index.html no longer references.
async function handleNavigate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(req).then(async res => {
    if (res.ok) {
      await cache.put("/index.html", res.clone());
      pruneOldBundles(cache, await res.clone().text());
    }
    return res;
  });
  network.catch(() => {});

  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS, "timeout"));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    return (await cache.match("/index.html")) || (await network);
  } catch {
    return (await cache.match("/index.html")) || Response.error();
  }
}

async function pruneOldBundles(cache, html) {
  const current = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]));
  if (current.size === 0) return;
  for (const req of await cache.keys()) {
    const { origin, pathname } = new URL(req.url);
    // Only top-level bundles are listed in index.html; their CSS's own
    // assets (fonts, Leaflet's marker images) are kept.
    if (origin === self.location.origin && /^\/assets\/index-[^/]+\.(js|css)$/.test(pathname) && !current.has(pathname)) {
      await cache.delete(req);
    }
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req, { ignoreVary: true });
  const network = fetch(req)
    .then(res => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
