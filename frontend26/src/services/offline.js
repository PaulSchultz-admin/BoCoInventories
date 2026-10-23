/**
 * offline.js saves a whole dataset (species, photos, glossary, pages, flight
 * times) into the browser's Cache Storage so the site works with no internet
 * connection, like a maps app's downloaded region. public/sw.js answers
 * requests from these caches when the network is unavailable.
 *
 * Each dataset gets its own cache, "offline-<dataset>", holding responses
 * under the same normalized keys the service worker looks up (cacheKey), plus
 * a small metadata entry recording when it was saved and how big it is.
 */
import { sites } from "../data/sites";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
const SHELL_CACHE = "shell-v1"; // keep in sync with public/sw.js
const META_KEY = "/__offline_meta__";
const CONCURRENCY = 6;
// Pages each dataset has (EditableContent's `page` values), plus the home ones.
const DATASET_PAGES = ["about", "resources", "info", "glossary"];
const HOME_PAGES = ["about", "contact"];

export const offlineSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;

// registerServiceWorker installs public/sw.js. Production only: in dev it
// would cache Vite's live-reloading modules and serve stale code.
export function registerServiceWorker() {
  if (!offlineSupported || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => console.error("Service worker registration failed:", error));
  });
}

const cacheName = dataset => `offline-${dataset}`;

// cacheKey normalizes an API URL so the same request matches however it was
// written. Keep in sync with cacheKey in public/sw.js.
function cacheKey(url) {
  const u = new URL(url, window.location.origin);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return `${u.origin}${path}${query ? `?${query}` : ""}`;
}

const apiUrl = path => `${BASE_URL}${path}`;

// getOfflineStatus returns { savedAt, bytes, photos, failed } for a saved
// dataset, or null if it hasn't been saved (or the browser cleared it).
export async function getOfflineStatus(dataset) {
  if (!offlineSupported || !(await caches.has(cacheName(dataset)))) return null;
  const cache = await caches.open(cacheName(dataset));
  const meta = await cache.match(META_KEY);
  return meta ? meta.json() : null;
}

export async function removeOfflineDataset(dataset) {
  await caches.delete(cacheName(dataset));
}

// runPool runs task(item) for every item with at most CONCURRENCY in flight.
async function runPool(items, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}

const responseSize = async res => Number(res.headers.get("Content-Length")) || (await res.clone().blob()).size;

// saveShell caches the app itself — index.html, the built bundles this page
// loaded (and the fonts/images their CSS points at), and the site logos and
// hero images — so the site can start up offline even on a phone that never
// browsed it with the service worker active.
async function saveShell() {
  const cache = await caches.open(SHELL_CACHE);
  const urls = new Set(["/index.html", "/favicon.png", "/site.webmanifest", "/home-hero.jpg"]);
  sites.forEach(site => {
    urls.add(site.logo);
    urls.add(site.heroImage);
  });
  const stylesheets = [];
  document.querySelectorAll("script[src], link[rel=stylesheet][href], link[rel=modulepreload][href]").forEach(el => {
    const url = el.src || el.href;
    urls.add(url);
    if (el.tagName === "LINK" && el.rel === "stylesheet") stylesheets.push(url);
  });

  // Pull font files and images referenced from the stylesheets.
  for (const sheet of stylesheets) {
    try {
      const css = await (await fetch(sheet)).text();
      for (const [, ref] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (!ref.startsWith("data:") && !ref.startsWith("#")) urls.add(new URL(ref, sheet).href);
      }
    } catch {
      // A stylesheet that can't be read just means its fonts/images stay uncached.
    }
  }

  await runPool([...urls], async url => {
    try {
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    } catch {
      // Optional asset; the page still works without it.
    }
  });
}

/**
 * downloadOfflineDataset saves everything a dataset's pages request. On an
 * update, photos already saved are skipped (they're stored under unique
 * filenames, so they never change); everything else is fetched again.
 *
 * onProgress({ done, total }) is called as files finish. Resolves to the
 * saved status (see getOfflineStatus). Throws if the core species data can't
 * be fetched; individual photos that fail are only counted.
 */
export async function downloadOfflineDataset(dataset, onProgress = () => {}) {
  if (!offlineSupported) throw new Error("This browser can't save pages for offline use.");
  // Ask the browser not to clear the download when storage runs low.
  navigator.storage?.persist?.().catch(() => {});

  const cache = await caches.open(cacheName(dataset));
  let bytes = 0;
  let failed = 0;
  let done = 0;
  let total = 0;
  const progress = () => onProgress({ done, total });

  // save fetches one URL into the dataset cache. Returns the parsed JSON
  // when asked (json: true), so later steps can find the photos.
  const save = async (url, { json = false, key = cacheKey(url), skipIfCached = false, required = false } = {}) => {
    try {
      if (skipIfCached) {
        const existing = await cache.match(key);
        if (existing) {
          bytes += await responseSize(existing);
          return null;
        }
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      bytes += await responseSize(res);
      const data = json ? await res.clone().json() : null;
      await cache.put(key, res);
      return data;
    } catch (error) {
      if (required) throw error;
      failed++;
      return null;
    } finally {
      done++;
      progress();
    }
  };

  // 1. The app shell and the dataset's core JSON.
  total = 3;
  progress();
  await saveShell();
  done++;
  const wildlifeData = await save(apiUrl(`/api/get-wildlife/?dataset=${dataset}`), { json: true, required: true });
  await save(apiUrl(`/api/get-categories-and-fields/?dataset=${dataset}`), { required: true });
  const wildlife = Object.values(wildlifeData || {});

  // 2. Per-species records and their photo lists, plus the smaller extras.
  const pageUrls = [
    ...DATASET_PAGES.map(page => apiUrl(`/api/page-content/${page}?dataset=${dataset}`)),
    ...HOME_PAGES.map(page => apiUrl(`/api/page-content/${page}?dataset=home`))
  ];
  const extraUrls = [
    apiUrl(`/api/display-list/?dataset=${dataset}`),
    apiUrl(`/api/glossary/?dataset=${dataset}`),
    apiUrl("/api/home-datasets/")
  ];
  total += wildlife.length * 2 + pageUrls.length + extraUrls.length + 1;
  progress();

  const imagesBySpecies = [];
  const pages = [];
  let locationPhotos = [];
  await runPool(
    [
      ...wildlife.flatMap(w => [
        { url: apiUrl(`/api/get-wildlife-by-id/${w.id}?dataset=${dataset}`) },
        { url: apiUrl(`/api/get-images-by-wildlife-id/${w.id}?dataset=${dataset}`), onData: d => imagesBySpecies.push(d) }
      ]),
      ...pageUrls.map(url => ({ url, onData: d => pages.push(d) })),
      ...extraUrls.map(url => ({ url })),
      { url: apiUrl(`/api/get-location-photos/?dataset=${dataset}`), onData: d => (locationPhotos = d || []) }
    ],
    async ({ url, onData }) => {
      const data = await save(url, { json: Boolean(onData) });
      if (data && onData) onData(data);
    }
  );

  // 3. Flight times, one answer per day of the year for all zones. The
  // service worker maps any requested date onto these, and narrows them to a
  // single life zone for zoned datasets.
  const expectedUrl = params => apiUrl(`/api/expected-wildlife/?dataset=${dataset}&${params}`);
  const flightJobs = [];
  try {
    const probe = await fetch(expectedUrl("zone=All"));
    if (probe.ok) {
      const pad = n => String(n).padStart(2, "0");
      // 2024 is a leap year, so Feb 29 is covered too.
      for (let d = new Date(2024, 0, 1); d.getFullYear() === 2024; d.setDate(d.getDate() + 1)) {
        const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        flightJobs.push({
          url: expectedUrl(`date=2024-${md}&zone=All`),
          key: cacheKey(expectedUrl(`offline_day=${md}`))
        });
      }
    }
  } catch {
    // No flight times for this dataset (or offline); nothing to save.
  }

  // 4. Photos: every species photo, grid thumbnails (by image ID), location
  // map photos, and images embedded in the dataset's pages.
  const photoUrls = new Set();
  imagesBySpecies.flat().forEach(img => img?.image_path && photoUrls.add(apiUrl(`/api/get-image/${img.image_path}`)));
  pages.forEach(page => {
    for (const [, path] of (page.content || "").matchAll(/\/api\/get-image\/([^)\s"']+)/g)) {
      photoUrls.add(apiUrl(`/api/get-image/${path}`));
    }
  });
  const thumbnailUrls = wildlife
    .filter(w => w.thumbnail_id)
    .map(w => apiUrl(`/api/get-image-by-image-id/${w.thumbnail_id}?dataset=${dataset}`));
  const locationUrls = locationPhotos.map(p => apiUrl(`/api/get-location-photo-image/${p.id}?dataset=${dataset}`));

  total += flightJobs.length + photoUrls.size + thumbnailUrls.length + locationUrls.length;
  progress();
  await runPool(
    [
      ...flightJobs.map(job => () => save(job.url, { key: job.key })),
      ...[...photoUrls].map(url => () => save(url, { skipIfCached: true })),
      // Thumbnails and location photos are looked up by ID, and an ID's file
      // can be replaced, so they're always fetched fresh.
      ...thumbnailUrls.map(url => () => save(url)),
      ...locationUrls.map(url => () => save(url))
    ],
    job => job()
  );

  const status = {
    savedAt: new Date().toISOString(),
    bytes,
    species: wildlife.length,
    photos: photoUrls.size,
    failed
  };
  await cache.put(META_KEY, new Response(JSON.stringify(status), { headers: { "Content-Type": "application/json" } }));
  return status;
}
