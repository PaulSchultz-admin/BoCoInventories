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

// The grids' "Expected on a date" filter offers only the MAX_SITES parks with
// the most sightings within NEAR_KM (with All, that's seven choices).
export const MAX_SITES = 6;

// loadParkSites resolves to {parkName: {taxa, zone}} for the MAX_SITES parks
// with the most sightings near their pins: taxa is the Set of iNaturalist
// taxon IDs seen within NEAR_KM of the park, and zone is the life zone of the
// median elevation of those sightings (whose flight calendar the park uses).
export async function loadParkSites() {
  const [data, parks] = await Promise.all([loadOdonataSightings(), loadParks()]);
  const counted = parks
    .filter(park => park.latitude != null)
    .map(park => ({
      park,
      near: data.sightings.filter(s => kmBetween(park.latitude, park.longitude, s[LAT], s[LNG]) <= NEAR_KM)
    }))
    .filter(({ near }) => near.length > 0)
    .sort((a, b) => b.near.length - a.near.length || a.park.name.localeCompare(b.park.name))
    .slice(0, MAX_SITES);
  const sites = {};
  for (const { park, near } of counted) {
    const ft = median(near.map(s => s[FT]));
    sites[park.name] = {
      taxa: new Set(near.map(s => s[SPECIES]).filter(Boolean)),
      zone: ZONE_FLOORS_FT.find(([, floor]) => ft >= floor)[0]
    };
  }
  return sites;
}
