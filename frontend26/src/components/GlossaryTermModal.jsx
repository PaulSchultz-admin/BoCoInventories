/**
 * GlossaryTermModal shows the add/edit form for a single glossary term.
 * Passing `term: null` renders it in "add new term" mode.
 */
import { useState } from "react";

export function GlossaryTermModal({ term, onClose, onSave, onDelete }) {
  const [termText, setTermText] = useState(term?.term || "");
  const [description, setDescription] = useState(term?.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ term: termText.trim(), description: description.trim() });
    } catch (error) {
      alert("Save failed: " + (error.response?.data?.error || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete the term "${term.term}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      alert("Delete failed: " + (error.response?.data?.error || error.message));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md p-6 shadow-2xl bg-white rounded-2xl">
        <h2 className="mb-4 text-xl font-bold text-center text-sand-700">
          {term ? "Edit Term" : "Add Term"}
        </h2>

        <div className="mb-3">
          <label className="block mb-1 font-bold text-sand-700">Term</label>
          <input
            type="text"
            value={termText}
            onChange={e => setTermText(e.target.value)}
            className="w-full px-3 py-2 text-gray-700 border rounded-lg border-sand-200 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="mb-5">
          <label className="block mb-1 font-bold text-sand-700">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-gray-700 border rounded-lg resize-none border-sand-200 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {term && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-5 py-2 text-red-600 transition-colors border border-red-300 rounded-full hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2 transition-colors border rounded-full border-sand-300 text-sand-600 hover:bg-sand-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !termText.trim() || !description.trim()}
              className="px-5 py-2 font-bold text-white transition-colors bg-pink-700 rounded-full hover:bg-pink-800 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
