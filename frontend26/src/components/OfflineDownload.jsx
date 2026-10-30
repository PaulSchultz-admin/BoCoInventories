/**
 * OfflineDownload is the "Save for offline use" bar under a dataset's hero.
 * Like a maps app's downloaded region, it saves the whole dataset (species,
 * photos, glossary, pages, flight times) to the device so the site still works
 * on trails with no signal. See services/offline.js and public/sw.js.
 */
import { useEffect, useState } from "react";
import { CircleCheck, Download, RefreshCw, Trash2, WifiOff } from "lucide-react";
import {
  offlineSupported,
  getOfflineStatus,
  downloadOfflineDataset,
  removeOfflineDataset
} from "../services/offline";

const formatBytes = bytes => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(0)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
const formatDate = iso => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function OfflineDownload({ dataset, label }) {
  const online = useOnline();
  const [status, setStatus] = useState(undefined); // undefined = loading, null = not saved
  const [progress, setProgress] = useState(null); // { done, total } while saving
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!offlineSupported) return;
    getOfflineStatus(dataset).then(setStatus).catch(() => setStatus(null));
  }, [dataset]);

  if (!offlineSupported || status === undefined) return null;

  const save = async () => {
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      setStatus(await downloadOfflineDataset(dataset, setProgress));
    } catch (e) {
      console.error("Offline download failed:", e);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the saved offline copy of ${label}?`)) return;
    await removeOfflineDataset(dataset);
    setStatus(null);
  };

  const button =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sand-200 bg-white text-sand-500 hover:bg-sand-100 hover:text-sand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  let body;
  if (progress) {
    const pct = Math.round((progress.done / Math.max(progress.total, 1)) * 100);
    body = (
      <div className="flex items-center w-full max-w-xl gap-3">
        <span className="shrink-0">Saving {label} for offline use…</span>
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-sand-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full transition-all bg-sand-400" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums shrink-0">{pct}%</span>
      </div>
    );
  } else if (status) {
    body = (
      <>
        <span className="inline-flex items-center gap-1.5 text-sand-600">
          {online ? <CircleCheck size={16} strokeWidth={2} className="text-green-700" /> : <WifiOff size={16} strokeWidth={2} />}
          {online ? "Saved for offline use" : "You're offline — using your saved copy"}
          <span className="text-sand-400">
            · {formatBytes(status.bytes)}{status.lowRes && " (smaller photos)"} · {formatDate(status.savedAt)}
            {status.failed > 0 && ` · ${status.failed} item${status.failed === 1 ? "" : "s"} missing`}
          </span>
        </span>
        {online && (
          <span className="flex gap-2">
            <button onClick={save} className={button} title="Download any changes since you last saved">
              <RefreshCw size={14} /> Update
            </button>
            <button onClick={remove} className={button} title="Free up space on this device">
              <Trash2 size={14} /> Remove
            </button>
          </span>
        )}
      </>
    );
  } else if (!online) {
    body = (
      <span className="inline-flex items-center gap-1.5">
        <WifiOff size={16} strokeWidth={2} /> You're offline. Pages you've already visited may still open.
      </span>
    );
  } else {
    body = (
      <>
        <span>Heading somewhere without signal? Save this guide, photos and all, to your device.</span>
        <button onClick={save} className={button}>
          <Download size={14} /> Save for offline use
        </button>
      </>
    );
  }

  return (
    <div className="border-b border-sand-200 bg-sand-100">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5 py-2.5 mx-auto font-sans text-sm text-sand-500 max-w-375">
        {body}
        {error && <span className="text-red-700">{error}</span>}
      </div>
    </div>
  );
}
