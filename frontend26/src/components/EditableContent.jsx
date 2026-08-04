/**
 * EditableContent renders the markdown body of a static page (About/Resources/Contact)
 * and, for logged-in admins, lets it be edited and saved in place.
 */
import { useState, useEffect, useContext, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Pencil, Image as ImageIcon } from "lucide-react";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";

export function EditableContent({ page, dataset }) {
  const { admin } = useContext(AdminContext);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // A blank line before/after the inserted image markdown, so it always lands
  // in its own paragraph rather than merging into adjacent text and breaking
  // that line's markdown (e.g. turning a "## Heading" into plain text).
  const blankLineBefore = text => {
    if (!text || text.endsWith("\n\n")) return "";
    return text.endsWith("\n") ? "\n" : "\n\n";
  };
  const blankLineAfter = text => {
    if (!text || text.startsWith("\n\n")) return "";
    return text.startsWith("\n") ? "\n" : "\n\n";
  };

  // Uploads the selected file, then inserts its markdown image tag at the
  // textarea's current cursor position (or the end, if it isn't focused).
  const handleImageFileChange = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const { filename } = await apiService.uploadContentImage(dataset, file);
      // A relative path, not the resolved absolute URL: content is edited in
      // one environment (e.g. local dev) but its underlying data folder can
      // be synced to another (e.g. production via upload_data.py), so the
      // backend host must be resolved at render time, not baked in here.
      const relativePath = `/api/get-image/${filename}?dataset=${dataset}`;

      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? draft.length;
      const end = textarea?.selectionEnd ?? draft.length;
      const before = draft.slice(0, start);
      const after = draft.slice(end);
      const markdown = `${blankLineBefore(before)}![](${relativePath})${blankLineAfter(after)}`;
      const next = before + markdown + after;
      setDraft(next);

      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.focus();
        const cursor = (before + markdown).length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } catch (error) {
      alert("Image upload failed: " + (error.response?.data?.error || error.message));
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Resolve our own relative image paths against this environment's backend
  // (see handleImageFileChange) — but leave any other absolute URL untouched.
  const resolveImagePaths = text => text.replaceAll("](/api/get-image/", `](${import.meta.env.VITE_BACKEND_URL}/api/get-image/`);

  if (!loaded) return null;

  if (isEditing) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-pink-700 transition-colors bg-white border border-pink-300 rounded-full shadow-sm hover:bg-pink-50 disabled:opacity-50"
          >
            <ImageIcon size={14} /> {isUploadingImage ? "Uploading..." : "Insert Image"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={20}
          className="w-full p-4 font-mono text-sm text-gray-800 bg-white border-2 border-pink-200 rounded-xl resize-y focus:outline-none focus:border-pink-500"
        />
        <p className="mt-2 text-sm text-sand-400">
          Supports markdown: <code>## Heading</code>, <code>[link text](url)</code>, <code>**bold**</code>,{" "}
          <code>- list item</code>, <code>---</code> for a divider, or click "Insert Image" above to upload a photo.
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
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(resolveImagePaths(content))) }}
      />
    </div>
  );
}
