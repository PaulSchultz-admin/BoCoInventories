/**
 * Glossary page displays an alphabetical index of terms and the glossary definitions.
 * Users can click a term to jump to it and briefly highlight the matching entry.
 * Admins can add, edit, and delete terms in place.
 */
import { useState, useEffect, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, Trash } from "lucide-react";
import apiService from "../services/apiService";
import { AdminContext } from "../services/adminContext";
import { GlossaryTermModal } from "../components/GlossaryTermModal";
import { sites } from "../data/sites";

// termToId converts a display term into a safe DOM id for anchor links.
function termToId(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const Glossary = () => {
  const { admin } = useContext(AdminContext);
  const { category } = useParams();
  const site = sites.find(s => s.id === category) || sites[0];
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [glossaryVisible, setGlossaryVisible] = useState(false);
  const [pendingScroll, setPendingScroll] = useState(null);
  const [highlightedTerm, setHighlightedTerm] = useState(null);
  const [buttonBottom, setButtonBottom] = useState(32);
  const [editingTerm, setEditingTerm] = useState(null); // null = closed, "new" = adding, object = editing
  const [deletingId, setDeletingId] = useState(null);
  const highlightTimeout = useRef(null);
  const indexRef = useRef(null);

  const loadTerms = () => {
    apiService.getGlossaryTerms(category).then(data => setGlossaryTerms(data || []));
  };

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // handleDeleteTerm deletes a single term directly from the list, without opening the edit modal.
  const handleDeleteTerm = async entry => {
    if (!window.confirm(`Delete the term "${entry.term}"? This cannot be undone.`)) return;
    setDeletingId(entry.id);
    try {
      await apiService.deleteGlossaryTerm(category, entry.id);
      loadTerms();
    } catch (error) {
      alert("Delete failed: " + (error.response?.data?.error || error.message));
    } finally {
      setDeletingId(null);
    }
  };

  const scrollToIndexCentered = () => {
    const el = indexRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const target = Math.max(0, top + el.offsetHeight / 2 - window.innerHeight / 2);
    const start = window.scrollY;
    const distance = target - start;
    const duration = 80;
    const startTime = performance.now();
    const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, start + distance * easeInOut(progress));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const flashHighlight = (id) => {
    clearTimeout(highlightTimeout.current);
    setHighlightedTerm(id);
    highlightTimeout.current = setTimeout(() => setHighlightedTerm(null), 1500);
  };

  useEffect(() => {
    if (glossaryVisible && pendingScroll) {
      const scrollId = pendingScroll;
      window.requestAnimationFrame(() => {
        const el = document.getElementById(scrollId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
        flashHighlight(scrollId);
        setPendingScroll(null);
      });
    }
  }, [glossaryVisible, pendingScroll]);

  useEffect(() => () => clearTimeout(highlightTimeout.current), []);

  useEffect(() => {
    if (!glossaryVisible) return;
    const updateBottom = () => {
      const footer = document.querySelector("footer");
      if (!footer) return;
      const footerTop = footer.getBoundingClientRect().top;
      const overflow = window.innerHeight - footerTop;
      setButtonBottom(overflow > 0 ? overflow + 8 : 32);
    };
    updateBottom();
    window.addEventListener("scroll", updateBottom);
    window.addEventListener("resize", updateBottom);
    return () => {
      window.removeEventListener("scroll", updateBottom);
      window.removeEventListener("resize", updateBottom);
    };
  }, [glossaryVisible]);

  // handleTermClick navigates to a glossary term and highlights it.
  // When the glossary content is hidden, it opens the section first.
  const handleTermClick = (e, term) => {
    e.preventDefault();
    const id = termToId(term);
    if (!glossaryVisible) {
      setGlossaryVisible(true);
      setPendingScroll(id);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
      flashHighlight(id);
    }
  };

  return (
    <div className="font-sans">

      {/* Banner */}
      <div
        className="relative h-[300px] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url('${site.heroImage}')` }}
      >
        <div className="absolute inset-0 bg-black opacity-40" />
        <h1 className="relative z-10 font-serif text-white text-6xl font-bold tracking-wide drop-shadow-lg">
          Glossary
        </h1>
      </div>

      {/* Index of Terms */}
      <div ref={indexRef} className="max-w-4xl mx-auto px-8 mt-8 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl font-bold text-sand-700">Index of Terms</h2>
          {admin && (
            <div className="flex items-center gap-3">
              {!glossaryVisible && (
                <button
                  onClick={() => setGlossaryVisible(true)}
                  className="text-sm font-semibold text-sand-500 hover:text-sand-700 hover:underline"
                >
                  Manage terms
                </button>
              )}
              <button
                onClick={() => setEditingTerm("new")}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-pink-700 transition-colors bg-white border border-pink-300 rounded-full shadow hover:bg-pink-50"
              >
                <Plus size={14} /> Add Term
              </button>
            </div>
          )}
        </div>
        <div className="columns-2 sm:columns-3 md:columns-4 gap-x-8">
          {glossaryTerms.map(({ term }) => (
            <a
              key={term}
              href={`#${termToId(term)}`}
              onClick={(e) => handleTermClick(e, term)}
              className="block text-sand-500 hover:text-sand-700 hover:underline transition-colors duration-200 text-sm leading-[1.4]"
            >
              {term}
            </a>
          ))}
        </div>
      </div>

      <hr className="border-sand-200 mx-auto max-w-4xl w-full px-8" />

      {/* Glossary of Terms */}
      {glossaryVisible && (
        <div className="max-w-4xl mx-auto px-8 mt-8 mb-20">
          <h2 className="font-serif text-3xl font-bold text-sand-700 mb-6">Glossary of Terms</h2>
          <dl className="space-y-4">
            {glossaryTerms.map((entry) => {
              const { id: termId, term, description } = entry;
              const anchorId = termToId(term);
              const isHighlighted = highlightedTerm === anchorId;
              return (
                <div
                  key={termId}
                  id={anchorId}
                  className="glossary-term group scroll-mt-[25vh] px-2 py-1 -mx-2 rounded transition-colors duration-[1200ms] flex items-start justify-between gap-3"
                  style={{ backgroundColor: isHighlighted ? "#f0e8d0" : "transparent" }}
                >
                  <p>
                    <dt className="inline font-sans font-semibold text-sand-700">{term}: </dt>
                    <dd className="inline font-sans text-sand-600 leading-relaxed">{description}</dd>
                  </p>
                  {admin && (
                    <div className="flex flex-shrink-0 gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setEditingTerm(entry)}
                        className="p-1 text-pink-400 hover:text-pink-700"
                        aria-label={`Edit ${term}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTerm(entry)}
                        disabled={deletingId === termId}
                        className="p-1 text-red-400 hover:text-red-700 disabled:opacity-50"
                        aria-label={`Delete ${term}`}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Floating Back to Top */}
      {glossaryVisible && (
        <button
          onClick={scrollToIndexCentered}
          style={{ bottom: buttonBottom }}
          className="fixed right-8 z-50 flex items-center gap-2 bg-sand-700 hover:bg-sand-800 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg transition-colors duration-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          Back to Top
        </button>
      )}

      {editingTerm !== null && (
        <GlossaryTermModal
          term={editingTerm === "new" ? null : editingTerm}
          onClose={() => setEditingTerm(null)}
          onSave={async ({ term, description }) => {
            if (editingTerm === "new") {
              await apiService.createGlossaryTerm(category, term, description);
            } else {
              await apiService.updateGlossaryTerm(category, editingTerm.id, term, description);
            }
            loadTerms();
            setEditingTerm(null);
          }}
          onDelete={async () => {
            await apiService.deleteGlossaryTerm(category, editingTerm.id);
            loadTerms();
            setEditingTerm(null);
          }}
        />
      )}

    </div>
  );
};
