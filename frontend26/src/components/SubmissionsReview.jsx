/**
 * SubmissionsReview, on the admin-only View copyright info page, lists the
 * photos people have submitted through the Contributor License Agreement
 * form: each photo with its contributor's details, a link to the full-size
 * file, and a Delete button.
 */
import { useEffect, useState } from "react";
import apiService from "../services/apiService";

export function SubmissionsReview() {
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiService
      .getSubmissions()
      .then(data => setSubmissions(data || []))
      .catch(() => setError("Couldn't load submissions."));
  }, []);

  const handleDelete = async s => {
    if (!window.confirm(`Delete the photo submitted by ${s.name}? This can't be undone.`)) return;
    try {
      await apiService.deleteSubmission(s.id);
      setSubmissions(list => list.filter(x => x.id !== s.id));
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <section className="p-6 mt-12 border-2 border-pink-200 border-dashed rounded-2xl">
      <h2 className="mb-1 font-serif text-2xl font-bold text-sand-800">Photo submissions</h2>
      <p className="mb-5 text-sm text-sand-500">Only admins see this list.</p>

      {error && <p className="text-red-600">{error}</p>}
      {submissions?.length === 0 && <p className="text-sand-600">No submissions yet.</p>}

      <ul className="flex flex-col gap-4">
        {submissions?.map(s => {
          const photoUrl = apiService.submissionPhotoUrl(s.id);
          return (
            <li key={s.id} className="flex flex-col gap-4 p-4 bg-white border sm:flex-row rounded-xl border-sand-200">
              <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={photoUrl} alt={s.species || "Submitted photo"} className="object-cover w-full rounded-lg sm:w-40 h-32" />
              </a>
              <div className="flex-1 min-w-0 font-sans text-sm text-sand-700">
                <p className="font-semibold text-base text-sand-800">{s.species || "Species not given"}</p>
                <p>
                  {s.name} · <a href={`mailto:${s.email}`} className="text-pink-700 hover:underline">{s.email}</a>
                </p>
                {(s.location || s.date_taken) && <p>{[s.location, s.date_taken].filter(Boolean).join(" · ")}</p>}
                {s.notes && <p className="mt-1 whitespace-pre-wrap text-sand-600">{s.notes}</p>}
                <p className="mt-1 text-xs text-sand-400">
                  Submitted {new Date(s.submitted_at).toLocaleString()} · agreed to the license · {s.original_filename}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s)}
                className="self-start px-3 py-1.5 text-sm font-semibold text-pink-700 border border-pink-300 rounded-full hover:bg-pink-50"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
