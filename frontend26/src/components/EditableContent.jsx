/**
 * EditableContent renders the markdown body of a static page (About/Resources/Contact)
 * and, for logged-in admins, lets it be edited and saved in place.
 */
import { useState, useEffect, useContext } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Pencil } from "lucide-react";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";

export function EditableContent({ page, dataset }) {
  const { admin } = useContext(AdminContext);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    apiService.getPageContent(page, dataset).then(data => {
      if (cancelled) return;
      setContent(data?.content || "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [page, dataset]);

  const handleEdit = () => {
    setDraft(content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiService.updatePageContent(page, draft, dataset);
      setContent(draft);
      setIsEditing(false);
    } catch (error) {
      alert("Save failed: " + (error.response?.data?.error || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  if (!loaded) return null;

  if (isEditing) {
    return (
      <div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={20}
          className="w-full p-4 font-mono text-sm text-gray-800 bg-white border-2 border-pink-200 rounded-xl resize-y focus:outline-none focus:border-pink-500"
        />
        <p className="mt-2 text-sm text-sand-400">
          Supports markdown: <code>## Heading</code>, <code>[link text](url)</code>, <code>**bold**</code>,{" "}
          <code>- list item</code>, <code>---</code> for a divider.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => setIsEditing(false)}
            className="px-5 py-2 transition-colors border rounded-full border-sand-300 text-sand-600 hover:bg-sand-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 font-bold text-white transition-colors bg-pink-700 rounded-full hover:bg-pink-800 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {admin && (
        <button
          onClick={handleEdit}
          className="absolute z-10 flex items-center gap-1 px-3 py-1.5 -top-2 -right-2 text-sm font-semibold text-pink-700 transition-colors bg-white border border-pink-300 rounded-full shadow hover:bg-pink-50"
        >
          <Pencil size={14} /> Edit
        </button>
      )}
      <div
        className="max-w-none prose prose-headings:font-serif"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content)) }}
      />
    </div>
  );
}
