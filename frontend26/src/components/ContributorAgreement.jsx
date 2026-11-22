/**
 * ContributorAgreement shows the Contributor License Agreement section of the
 * Submissions and permissions page as a form: the agreement text in a card,
 * ending in an "I understand and agree" checkbox. Checking it opens
 * PhotoSubmitModal, where the contributor uploads a photo. The agreement's
 * text (markdown) is sent with each submission as a record of what was agreed to.
 */
import { useState } from "react";
import { PhotoSubmitModal } from "./PhotoSubmitModal";

// Temporarily closed: the checkbox and its text are grayed out and can't be
// checked, so the photo upload popup can't be opened. Set to true to reopen.
const SUBMISSIONS_OPEN = false;

export function ContributorAgreement({ html, markdown }) {
  const [agreed, setAgreed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleAgreeChange = e => {
    setAgreed(e.target.checked);
    setShowModal(e.target.checked);
  };

  return (
    <form
      onSubmit={e => e.preventDefault()}
      className="p-6 my-8 bg-white border shadow-sm rounded-2xl border-sand-200 md:p-8"
    >
      <div className="max-w-none prose prose-headings:font-serif" dangerouslySetInnerHTML={{ __html: html }} />

      <div className="flex flex-wrap items-center justify-between gap-4 pt-5 mt-6 border-t border-sand-200">
        <label
          title={SUBMISSIONS_OPEN ? undefined : "Photo submissions are temporarily closed"}
          className={`flex items-center gap-3 font-sans text-lg font-semibold select-none ${
            SUBMISSIONS_OPEN ? "cursor-pointer text-sand-700" : "cursor-not-allowed text-sand-300"
          }`}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={handleAgreeChange}
            disabled={!SUBMISSIONS_OPEN}
            className={`w-5 h-5 accent-pink-700 ${SUBMISSIONS_OPEN ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          />
          I understand and agree
        </label>
        {agreed && !showModal && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-5 py-2 font-bold text-white transition-colors bg-pink-700 rounded-full hover:bg-pink-800"
          >
            Submit a photo
          </button>
        )}
      </div>

      {showModal && <PhotoSubmitModal agreementText={markdown} onClose={() => setShowModal(false)} />}
    </form>
  );
}
