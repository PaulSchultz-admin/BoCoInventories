/**
 * FlightCalendar shows a grid of species expected to be seen on a chosen date
 * (default today), in a chosen life zone (default All), based on the
 * dataset's flight_times.csv. Currently only the butterflies dataset has that
 * file; other datasets show a friendly "no data yet" message.
 */
import { useState, useEffect } from "react";
import { useParams, NavLink } from "react-router-dom";
import apiService from "../services/apiService";

const ZONES = ["All", "Alpine", "Montane", "Foothills", "Plains"];

function todayIso() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// SpeciesCard mirrors WildlifeDB's card styling. Species without a matching
// Wildlife record (wildlifeId is null) render as a plain, non-clickable card.
function SpeciesCard({ dataset, name, scientificName, wildlifeId, thumbnailId, zones, showZones }) {
  const content = (
    <>
      <div className="overflow-hidden aspect-square bg-sand-100">
        {thumbnailId ? (
          <img
            src={`${import.meta.env.VITE_BACKEND_URL}/api/get-image-by-image-id/${thumbnailId}?dataset=${dataset}`}
            alt={name}
            className="object-contain w-full h-full transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full px-2 text-xs italic text-center font-serif text-sand-300">
            No photo yet
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-serif text-sm font-semibold leading-tight truncate text-sand-600">{name}</p>
        {scientificName && (
          <p className="mt-0.5 font-serif text-xs italic truncate text-sand-400">{scientificName}</p>
        )}
        {showZones && zones?.length > 0 && (
          <p className="mt-1 font-['Montserrat',sans-serif] text-[10px] uppercase tracking-wide text-sand-400 truncate">
            {zones.join(", ")}
          </p>
        )}
      </div>
    </>
  );

  const className =
    "group flex flex-col w-full sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)] rounded-lg overflow-hidden border border-sand-200 bg-white";

  return wildlifeId ? (
    <NavLink className={`${className} hover:shadow-lg transition-shadow duration-200`} to={`/${dataset}/${wildlifeId}`}>
      {content}
    </NavLink>
  ) : (
    <div className={`${className} opacity-70`} title="Not yet in the database">
      {content}
    </div>
  );
}

export function FlightCalendar() {
  const { category } = useParams();
  const [date, setDate] = useState(todayIso());
  const [zone, setZone] = useState("All");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService
      .getExpectedWildlife(category, date, zone)
      .then(data => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setError("No flight-time data available for this dataset yet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, date, zone]);

  const grouped = new Map();
  for (const s of result?.species ?? []) {
    if (!grouped.has(s.family)) grouped.set(s.family, []);
    grouped.get(s.family).push(s);
  }

  return (
    <div className="p-5">
      <div className="mx-auto max-w-375">
        <NavLink
          to={`/${category}`}
          className="inline-block mb-2 text-sm italic transition-colors font-serif text-sand-400 hover:text-sand-600"
        >
          ← Back to {category}
        </NavLink>

        <h1 className="font-[Cormorant_Garamond] italic text-4xl font-semibold text-sand-600 mb-1">
          Flight Calendar
        </h1>
        <p className="mb-6 font-serif text-sand-400">
          See which species are expected on a given date, at a given elevation.
        </p>

        <div className="flex flex-wrap items-end gap-4 p-4 mb-8 border rounded bg-sand-100 border-sand-200">
          <label className="flex flex-col gap-1">
            <span className="font-['Montserrat',sans-serif] text-xs uppercase tracking-widest text-sand-400">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 font-serif bg-white border rounded outline-none border-sand-200 focus:ring-2 focus:ring-sand-400 focus:ring-opacity-30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-['Montserrat',sans-serif] text-xs uppercase tracking-widest text-sand-400">
              Life zone
            </span>
            <select
              value={zone}
              onChange={e => setZone(e.target.value)}
              className="px-3 py-2 font-serif bg-white border rounded outline-none border-sand-200 focus:ring-2 focus:ring-sand-400 focus:ring-opacity-30"
            >
              {ZONES.map(z => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setDate(todayIso())}
            className="pb-2 text-sm italic transition-colors font-serif text-sand-400 hover:text-sand-600"
          >
            Reset to today
          </button>
        </div>

        {loading && <p className="italic font-serif text-sand-400">Loading…</p>}
        {error && <p className="italic font-serif text-sand-400">{error}</p>}

        {!loading && !error && result && (
          <>
            <p className="mb-6 font-serif text-sand-500">
              {result.species.length === 0
                ? `No species are expected in the ${result.zone} zone in ${result.month}.`
                : `${result.species.length} species expected in the ${result.zone} zone in ${result.month}.`}
            </p>

            {[...grouped.entries()].map(([family, list]) => (
              <div key={family} className="mb-8">
                <h2 className="pb-1 mb-4 font-serif text-lg font-semibold border-b text-sand-600 border-sand-200">
                  {family}
                </h2>
                <div className="flex flex-wrap gap-5">
                  {list.map(s => (
                    <SpeciesCard
                      key={s.name}
                      dataset={category}
                      name={s.name}
                      scientificName={s.scientific_name}
                      wildlifeId={s.wildlife_id}
                      thumbnailId={s.thumbnail_id}
                      zones={s.zones}
                      showZones={zone === "All"}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
