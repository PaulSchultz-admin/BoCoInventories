/**
 * PhotoSubmitModal is the popup a contributor uploads a photo in, after
 * agreeing to the Contributor License Agreement (see ContributorAgreement).
 * Submissions go to the backend's /api/submissions/ for an admin to review.
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import apiService from "../services/apiService";

const MAX_MB = 25;

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500";

export function PhotoSubmitModal({ agreementText, onClose }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [fields, setFields] = useState({ name: "", email: "", species: "", location: "", date_taken: "", notes: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Close on Escape, unless a submission is in flight.
  useEffect(() => {
    const onKey = e => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const setField = key => e => setFields(f => ({ ...f, [key]: e.target.value }));

  const handlePhotoChange = e => {
    const file = e.target.files?.[0] ?? null;
    setError("");
    if (file && file.size > MAX_MB * 1024 * 1024) {
      setError(`That photo is too large (max ${MAX_MB} MB).`);
      e.target.value = "";
      return;
    }
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!photo) {
      setError("Please choose a photo to submit.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("photo", photo);
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append("agreed", "true");
      form.append("agreement_text", agreementText);
      await apiService.submitPhoto(form);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnother = () => {
    setPhoto(null);
    setPreview("");
    setFields(f => ({ ...f, species: "", location: "", date_taken: "", notes: "" }));
    setDone(false);
  };

  // Portaled to <body> so the modal isn't nested inside the agreement's <form>.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onMouseDown={e => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-submit-title"
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto font-sans"
      >
        <h2 id="photo-submit-title" className="mb-1 font-serif text-2xl font-bold text-sand-800">
          Submit a photo
        </h2>

        {done ? (
          <div className="py-4">
            <p className="mb-6 text-sand-700">
              Thank you! Your photo was submitted. We&apos;ll review it before it appears on the site.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={submitAnother}
                className="px-5 py-2 border border-gray-300 rounded-full text-sand-600 hover:bg-gray-50"
              >
                Submit another
              </button>
              <button onClick={onClose} className="px-5 py-2 text-white bg-pink-700 rounded-full hover:bg-pink-800">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="mb-2 text-sm text-sand-500">
              You agreed to the Contributor License Agreement. Fields marked * are required.
            </p>

            <label className="text-sm font-semibold text-sand-700">
              Photo *
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="block w-full mt-1 text-sm file:mr-3 file:px-4 file:py-1.5 file:rounded-full file:border file:border-pink-300 file:bg-white file:text-pink-700 file:font-semibold hover:file:bg-pink-50"
              />
            </label>
            {preview && <img src={preview} alt="Selected photo preview" className="object-contain w-full rounded-lg max-h-56 bg-sand-50" />}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-sand-700">
                Your name (photo credit) *
                <input required value={fields.name} onChange={setField("name")} className={`${inputClass} mt-1 font-normal`} />
              </label>
              <label className="text-sm font-semibold text-sand-700">
                Email *
                <input required type="email" value={fields.email} onChange={setField("email")} className={`${inputClass} mt-1 font-normal`} />
              </label>
              <label className="text-sm font-semibold text-sand-700">
                Species (if known)
                <input value={fields.species} onChange={setField("species")} className={`${inputClass} mt-1 font-normal`} />
              </label>
              <label className="text-sm font-semibold text-sand-700">
                Date taken
                <input type="date" value={fields.date_taken} onChange={setField("date_taken")} className={`${inputClass} mt-1 font-normal`} />
              </label>
            </div>
            <label className="text-sm font-semibold text-sand-700">
              Where it was taken
              <input value={fields.location} onChange={setField("location")} placeholder="e.g. Walker Ranch, Boulder County" className={`${inputClass} mt-1 font-normal`} />
            </label>
            <label className="text-sm font-semibold text-sand-700">
              Notes
              <textarea rows={3} value={fields.notes} onChange={setField("notes")} className={`${inputClass} mt-1 font-normal resize-y`} />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2 border border-gray-300 rounded-full text-sand-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-bold text-white bg-pink-700 rounded-full hover:bg-pink-800 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
