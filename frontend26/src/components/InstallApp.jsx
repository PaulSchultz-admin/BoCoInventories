/**
 * InstallApp is the home hero's "Install this app" button, under the QR code.
 * Where the browser supports it (Chrome, Edge, Android) it opens the native
 * install dialog; elsewhere (iPhone Safari, Firefox) it shows how to add the
 * site to the home screen by hand. Hidden when already running as the app.
 * See services/installPrompt.js and public/site.webmanifest.
 */
import { useState, useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import { canPrompt, isIOS, isStandalone, promptInstall, subscribe, wasInstalled } from "../services/installPrompt";

export const InstallApp = ({ className = "" }) => {
  const [, rerender] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => subscribe(() => rerender(n => n + 1)), []);

  // Close the instructions when tapping elsewhere.
  useEffect(() => {
    if (!showHelp) return;
    const onDown = e => wrapperRef.current && !wrapperRef.current.contains(e.target) && setShowHelp(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showHelp]);

  if (isStandalone() || wasInstalled()) return null;

  const handleClick = async () => {
    if (canPrompt()) {
      await promptInstall();
    } else {
      setShowHelp(open => !open);
    }
  };

  return (
    <div ref={wrapperRef} className={className}>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={showHelp}
        className="flex items-center justify-center w-full gap-1 px-2 py-1.5 text-xs font-semibold leading-tight transition-colors bg-white rounded-lg shadow-lg md:text-sm text-stone-800 hover:bg-sand-50"
      >
        <Download size={14} className="shrink-0" />
        {/* The QR-width button is too narrow on phones for the full label. */}
        <span className="whitespace-nowrap">
          Install <span className="hidden md:inline">this </span>app
        </span>
      </button>

      {showHelp && (
        <div
          role="dialog"
          aria-label="How to install this app"
          className="absolute right-0 p-4 mt-2 text-sm text-left bg-white shadow-xl w-72 rounded-xl text-stone-800"
        >
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            aria-label="Close"
            className="absolute top-2 right-2 text-stone-500 hover:text-stone-800"
          >
            <X size={16} />
          </button>
          <p className="mb-2 font-semibold">Add this site to your home screen</p>
          {isIOS() ? (
            <ol className="pl-5 space-y-1 list-decimal">
              <li>Open this page in Safari.</li>
              <li>Tap the <strong>Share</strong> button (square with an up arrow).</li>
              <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            </ol>
          ) : (
            <ol className="pl-5 space-y-1 list-decimal">
              <li>Open this page in Chrome or Edge.</li>
              <li>Open the browser menu (<strong>⋮</strong> or <strong>…</strong>).</li>
              <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            </ol>
          )}
          <p className="mt-2 text-xs text-stone-500">It opens in its own window and always shows the latest version.</p>
        </div>
      )}
    </div>
  );
};
