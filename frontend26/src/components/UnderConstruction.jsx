/**
 * UnderConstruction is the home page's temporary tilted "Under Construction"
 * road sign. Clicking it opens a panel with the construction progress notes:
 * the "construction" page in the "home" dataset, which an admin edits in place
 * like the About page. To take the sign down, remove <UnderConstruction /> from
 * Home.jsx (and this file).
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { EditableContent } from "./EditableContent";

// Black-and-yellow hazard stripes for the sign's top and bottom edges.
const stripes = "repeating-linear-gradient(-45deg, #111 0 12px, #facc15 12px 24px)";

export function UnderConstruction({ className = "" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`group -rotate-6 transition-transform duration-200 hover:-rotate-3 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200 ${className}`}
      >
        <span className="block overflow-hidden border-4 border-black rounded-lg shadow-[6px_8px_0_rgba(0,0,0,0.45)] bg-yellow-400">
          <span className="block h-3" style={{ background: stripes }} />
          <span className="block px-5 py-3 text-center md:px-7 md:py-4">
            <span className="block font-sans text-2xl font-black leading-none tracking-tight text-black uppercase md:text-4xl">
              Under
              <br />
              Construction
            </span>
            <span className="block mt-2 font-sans text-xs font-bold tracking-widest text-black uppercase md:text-sm">
              Click for progress
            </span>
          </span>
          <span className="block h-3" style={{ background: stripes }} />
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="construction-title"
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border-4 border-black shadow-2xl rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-3" style={{ background: stripes }} />
            <div className="p-6 md:p-8">
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute p-1 transition-colors rounded-full top-5 right-4 text-sand-500 hover:text-sand-800 hover:bg-sand-100"
              >
                <X size={22} />
              </button>
              <h2
                id="construction-title"
                className="mb-5 pr-10 font-sans text-2xl font-black tracking-tight text-black uppercase md:text-3xl"
              >
                Under Construction
              </h2>
              <EditableContent page="construction" dataset="home" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
