/**
 * ExpectedOnDate is the home page's "Expected on a date" search: one date
 * (default today) and life zone, looked up across several datasets at once
 * via each one's flight_times.csv (see apiService.getExpectedWildlife).
 * Results are shown per dataset, using the Flight Calendar's species cards.
 * Datasets whose flight times aren't broken out by life zone (the API reports
 * zoned: false) ignore the zone picker.
 */
import { useState, useEffect } from "react";
import apiService from "../services/apiService";
import { sites } from "../data/sites";
import { SpeciesCard } from "../pages/FlightCalendar";

const ZONES = ["All", "Alpine", "Montane", "Foothills", "Plains"];

function todayIso() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// zonePhrase is " in the Alpine zone" etc., or "" for All zones.
const zonePhrase = result => (result.zone && result.zone !== "All" ? ` in the ${result.zone} zone` : "");

export function ExpectedOnDate({ datasets }) {
  const [date, setDate] = useState(todayIso());
  // Defaults to Foothills here; the per-dataset calendars default to "All".
  const [zone, setZone] = useState("Foothills");
  // results maps dataset id -> API response, or null if that lookup failed.
  // It's null only until the first lookup finishes; later lookups keep the
  // previous results on screen until the new ones arrive.
  const [results, setResults] = useState(null);

  const datasetsKey = datasets.join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      datasets.map(id =>
        apiService
          .getExpectedWildlife(id, date, zone)
          .then(data => [id, data])
          .catch(() => [id, null])
      )
    ).then(entries => {
      if (!cancelled) setResults(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // datasetsKey stands in for datasets, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetsKey, date, zone]);

  if (datasets.length === 0) return null;

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const anyZoned = results && Object.values(results).some(r => r?.zoned);

  return (
    <section className="px-5 pb-16">
      <div className="mx-auto max-w-375">
        <h2 className="font-[Cormorant_Garamond] italic text-4xl font-semibold text-sand-600 mb-1">
          Expected on a date
        </h2>
        <p className="mb-6 font-serif text-sand-400">
          See which {datasets.map(id => sites.find(s => s.id === id)?.label.toLowerCase() ?? id).join(" and ")} are
          expected on a given date.
        </p>

        <div className="flex flex-wrap items-end gap-4 p-4 mb-8 border rounded bg-sand-100 border-sand-200">
          <label className="flex flex-col gap-1">
            <span className="font-['Montserrat',sans-serif] text-xs uppercase tracking-widest text-sand-400">Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 font-serif bg-white border rounded outline-none border-sand-200 focus:ring-2 focus:ring-sand-400 focus:ring-opacity-30"
            />
          </label>
          {anyZoned && (
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
          )}
          {date !== todayIso() && (
            <button
              onClick={() => setDate(todayIso())}
              className="pb-2 text-sm italic transition-colors font-serif text-sand-400 hover:text-sand-600"
            >
              Reset to today
            </button>
          )}
        </div>

        {!results && <p className="italic font-serif text-sand-400">Loading…</p>}

        {results &&
          datasets.map(id => {
            const site = sites.find(s => s.id === id);
            const result = results[id];
            const species = result?.species ?? [];
            return (
              <div key={id} className="mb-10">
                <h3 className="pb-1 mb-4 font-serif text-xl font-semibold border-b text-sand-600 border-sand-200">
                  {site?.label ?? id}
                </h3>
                {!result ? (
                  <p className="italic font-serif text-sand-400">No flight-time data available yet.</p>
                ) : species.length === 0 ? (
                  <p className="italic font-serif text-sand-400">
                    {`None expected${zonePhrase(result)} on ${dateLabel}.`}
                  </p>
                ) : (
                  <>
                    <p className="mb-4 font-serif text-sand-500">
                      {`${species.length} expected${zonePhrase(result)} on ${dateLabel}.`}
                    </p>
                    <div className="flex flex-wrap gap-5">
                      {species.map(s => (
                        <SpeciesCard
                          key={s.name}
                          dataset={id}
                          name={s.name}
                          scientificName={s.scientific_name}
                          wildlifeId={s.wildlife_id}
                          thumbnailId={s.thumbnail_id}
                          zones={s.zones}
                          showZones={result.zoned && zone === "All"}
                          flightPeriod={s.flight_period}
                          zonePeriods={s.zone_periods}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
