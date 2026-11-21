/**
 * installPrompt.js catches the browser's "beforeinstallprompt" event (Chrome,
 * Edge, Android) so the home page's "Install this app" button can show the
 * native install dialog later. The event can fire before React renders, so
 * this module is imported from main.jsx to start listening right away.
 * Browsers without the event (Safari, Firefox) get written instructions from
 * the InstallApp component instead.
 */
let deferredPrompt = null;
let installed = false;
const listeners = new Set();

const notify = () => listeners.forEach(fn => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); // keep the event so our button can show it
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

// isStandalone is true when the site is already running as an installed app.
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const canPrompt = () => deferredPrompt !== null;
export const wasInstalled = () => installed;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// promptInstall shows the native dialog. The event can only be used once.
export async function promptInstall() {
  if (!deferredPrompt) return null;
  const event = deferredPrompt;
  deferredPrompt = null;
  event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}
