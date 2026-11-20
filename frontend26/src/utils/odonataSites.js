// Dragonfly and damselfly sightings near Boulder County parks, shared by the
// Dragonflies Science page's heat map (components/OdonataHeatMap.jsx) and the
// dragonfly and damselfly grids' "Expected on a date" filter
// (pages/WildlifeDBs/WildlifeDB.jsx).
//
// The sightings are every iNaturalist record in Boulder County, from
// public/data/odonata-sightings.json (built by
// backend/scripts/build_odonata_heatmap.py). A park's species are the ones
// seen within NEAR_KM of its pin (see utils/parkLocation.js), and the parks
// come live from the parks dataset, so new parks join the filter on their own.
import { loadParks } from "./parkLocation";

export const NEAR_KM = 1;

// A sighting is [lat, lng, month, dayOfYear, elevationFt, year, group, speciesId],
// where speciesId is the iNaturalist taxon ID (0 if not identified to species).
const LAT = 0, LNG = 1, FT = 4, SPECIES = 7;

// Life zones by elevation, as in backend/scripts/build_flight_times.py.
const ZONE_FLOORS_FT = [
  ["Alpine", 11000],
  ["Montane", 8000],
  ["Foothills", 6000],
  ["Plains", 0]
];

export function kmBetween(lat1, lng1, lat2, lng2) {
  const dx = (lng2 - lng1) * 111.32 * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat2 - lat1) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

export const loadOdonataSightings = () =>
  fetch("/data/odonata-sightings.json").then(r => (r.ok ? r.json() : Promise.reject(r.status)));

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// loadParkSites resolves to {parkName: {taxa, zone}} for every park with a
// pin: taxa is the Set of iNaturalist taxon IDs seen within NEAR_KM of it, and
// zone is the life zone of the median elevation of those sightings (whose
// flight calendar the park uses), or "All" if nothing has been seen there.
export async function loadParkSites() {
  const [data, parks] = await Promise.all([loadOdonataSightings(), loadParks()]);
  const sites = {};
  for (const park of parks) {
    if (park.latitude == null) continue;
    const near = data.sightings.filter(s => kmBetween(park.latitude, park.longitude, s[LAT], s[LNG]) <= NEAR_KM);
    const ft = near.length ? median(near.map(s => s[FT])) : null;
    sites[park.name] = {
      taxa: new Set(near.map(s => s[SPECIES]).filter(Boolean)),
      zone: ft == null ? "All" : ZONE_FLOORS_FT.find(([, floor]) => ft >= floor)[0]
    };
  }
  return sites;
}
