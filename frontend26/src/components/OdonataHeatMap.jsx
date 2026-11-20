/**
 * OdonataHeatMap is the "Where and when they're seen" section at the bottom of
 * the Dragonflies Science page (pages/Info.jsx): a heat map of every
 * iNaturalist sighting of a dragonfly or damselfly in Boulder County, with the
 * Parks page's numbered park pins, a count of sightings and species near each
 * park, and a grid of sightings by week and elevation.
 *
 * The sightings come from public/data/odonata-sightings.json, built by
 * backend/scripts/build_odonata_heatmap.py (rerun it to refresh). The parks
 * load live from the parks dataset, so new parks appear on their own. Like the
 * Parks page, they're left off for visitors while Parks is disabled.
 */
import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Tooltip, ImageOverlay, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";
import { FitOnResize, BOULDER_COUNTY_BOUNDS } from "./LocationsMap";
import { loadParks, numberedPin } from "../utils/parkLocation";
import { NEAR_KM, kmBetween, loadOdonataSightings } from "../utils/odonataSites";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROUPS = [
  ["all", "All"],
  ["A", "Dragonflies"],
  ["Z", "Damselflies"]
];
const BAND_FT = 500;
const fmt = n => n.toLocaleString();

// Sightings are [lat, lng, month, dayOfYear, elevationFt, year, group, speciesId].
const LAT = 0, LNG = 1, MONTH = 2, DOY = 3, FT = 4, YEAR = 5, GROUP = 6, SPECIES = 7;

// Amber (a meadowhawk's wing band) to deep red.
const STOPS = [
  [0, [255, 214, 102]],
  [0.45, [244, 140, 40]],
  [0.75, [214, 64, 30]],
  [1, [140, 20, 30]]
];
function ramp(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const f = (t - a) / (b - a);
      return ca.map((v, k) => Math.round(v + (cb[k] - v) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const rgb = c => `rgb(${c.join(",")})`;

const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// heatImage draws a kernel density of the sightings (Gaussian, sigma 0.6 km) onto a Web Mercator canvas covering the county, clipped to its
// boundary, and returns it as a data URL plus its bounds for an ImageOverlay.
function heatImage(sightings, boundary) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  boundary.forEach(p => p.forEach(r => r.forEach(([x, y]) => {
    west = Math.min(west, x); east = Math.max(east, x);
    south = Math.min(south, y); north = Math.max(north, y);
  })));
  const W = 1000;
  const H = Math.round((W * (mercY(north) - mercY(south))) / (((east - west) * Math.PI) / 180));
  const px = lng => ((lng - west) / (east - west)) * W;
  const py = lat => ((mercY(north) - mercY(lat)) / (mercY(north) - mercY(south))) * H;
  const kmPerPx = ((east - west) * 111.32 * Math.cos((((north + south) / 2) * Math.PI) / 180)) / W;

  const sigma = 0.6 / kmPerPx, R = Math.ceil(sigma * 3);
  const kernel = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= R * R) kernel.push([dx, dy, Math.exp(-d2 / (2 * sigma * sigma))]);
    }
  const grid = new Float32Array(W * H);
  for (const s of sightings) {
    const cx = Math.round(px(s[LNG])), cy = Math.round(py(s[LAT]));
    for (const [dx, dy, w] of kernel) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] += w;
    }
  }
  let max = 0;
  for (const v of grid) if (v > max) max = v;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (max > 0) {
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v < 0.05) continue;
      // Color on a compressed scale, so lone mountain sightings still show
      // beside busy ponds. Opacity also follows the local count (a lone
      // sighting peaks at 1), so the faint edges fade into the basemap.
      const t = Math.pow(v / max, 0.4), c = ramp(t);
      img.data.set([c[0], c[1], c[2], Math.round(255 * Math.min(0.9, 0.9 * t + 0.25 * Math.min(1, v)))], i * 4);
    }
    const heat = document.createElement("canvas");
    heat.width = W;
    heat.height = H;
    heat.getContext("2d").putImageData(img, 0, 0);
    const clip = new Path2D();
    boundary.forEach(p => p.forEach(r => {
      r.forEach(([x, y], i) => (i ? clip.lineTo(px(x), py(y)) : clip.moveTo(px(x), py(y))));
      clip.closePath();
    }));
    ctx.clip(clip);
    ctx.drawImage(heat, 0, 0);
  }
  return { url: canvas.toDataURL(), bounds: [[south, west], [north, east]] };
}

const Chips = ({ label, options, value, onChange }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-16 font-['Montserrat',sans-serif] text-xs uppercase tracking-widest text-sand-400">{label}</span>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        aria-pressed={value === v}
        onClick={() => onChange(v)}
        className={`px-3 py-1 text-sm border rounded-full tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-sand-500 ${
          value === v
            ? "bg-sand-600 border-sand-600 text-sand-50"
            : "bg-white border-sand-200 text-sand-600 hover:bg-sand-50"
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

// PhenologyGrid counts sightings per week and 500-ft elevation band. The weeks
// shown hold 99.5% of sightings, so stray winter records don't stretch it.
function PhenologyGrid({ sightings }) {
  const grid = useMemo(() => {
    if (!sightings.length) return null;
    const days = sightings.map(s => s[DOY]).sort((a, b) => a - b);
    const q = p => days[Math.min(days.length - 1, Math.floor(p * days.length))];
    const start = Math.floor((q(0.0025) - 1) / 7) * 7 + 1;
    const weeks = Math.ceil((q(0.9975) - start + 1) / 7);
    const feet = sightings.map(s => s[FT]);
    const lo = Math.floor(Math.min(...feet) / BAND_FT) * BAND_FT;
    const hi = Math.ceil((Math.max(...feet) + 1) / BAND_FT) * BAND_FT;
    const bands = (hi - lo) / BAND_FT;
    const counts = Array.from({ length: bands }, () => new Array(weeks).fill(0));
    let shown = 0;
    sightings.forEach(s => {
      const w = Math.floor((s[DOY] - start) / 7);
      if (w < 0 || w >= weeks) return;
      counts[bands - 1 - Math.floor((s[FT] - lo) / BAND_FT)][w]++;
      shown++;
    });
    return { start, weeks, hi, counts, shown, max: Math.max(...counts.flat()) };
  }, [sightings]);
  if (!grid) return null;

  const dateOf = d => {
    const t = new Date(Date.UTC(2025, 0, d));
    return { month: t.getUTCMonth(), label: `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}` };
  };
  let lastMonth = -1;
  return (
    <>
      <p className="mb-3 text-sm text-sand-500">
        Sightings per week and 500-ft elevation band, all years combined ({fmt(grid.shown)} of {fmt(sightings.length)};
        a few very early or late records fall outside the weeks shown).
      </p>
      <div className="overflow-x-auto">
        <div
          className="grid gap-0.5 font-mono text-[11px]"
          style={{ gridTemplateColumns: `92px repeat(${grid.weeks}, minmax(13px, 1fr))`, minWidth: 92 + grid.weeks * 15 }}
        >
          {grid.counts.map((row, i) => {
            const top = grid.hi - i * BAND_FT;
            const range = `${fmt(top - BAND_FT)}–${fmt(top)}`;
            return [
              <div key={`y${i}`} className="self-center pr-1.5 text-right whitespace-nowrap tabular-nums text-sand-400">
                {range}
              </div>,
              ...row.map((v, w) => {
                const label = `${v} sighting${v === 1 ? "" : "s"}, week of ${dateOf(grid.start + w * 7).label}, ${range} ft`;
                return (
                  <div
                    key={`c${i}-${w}`}
                    title={label}
                    aria-label={label}
                    className="rounded-sm aspect-square bg-sand-100"
                    style={v ? { background: rgb(ramp(Math.pow(v / grid.max, 0.4))) } : undefined}
                  />
                );
              })
            ];
          })}
          <div />
          {Array.from({ length: grid.weeks }, (_, w) => {
            const { month } = dateOf(grid.start + w * 7);
            const text = month !== lastMonth ? MONTHS[month] : "";
            lastMonth = month;
            return (
              <div key={`x${w}`} className="text-[10px] whitespace-nowrap text-sand-400">
                {text}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export const OdonataHeatMap = () => {
  const navigate = useNavigate();
  const { admin } = useContext(AdminContext);
  const [data, setData] = useState(null);
  const [parks, setParks] = useState([]);
  const [group, setGroup] = useState("all");
  const [month, setMonth] = useState(0);

  useEffect(() => {
    loadOdonataSightings()
      .then(setData)
      .catch(error => console.error("Error loading Odonata sightings:", error));
  }, []);

  useEffect(() => {
    Promise.all([apiService.getHomeDatasets(), loadParks()])
      .then(([home, list]) => {
        const closed = !admin && (home?.disabled ?? []).includes("parks");
        setParks(closed ? [] : list);
      })
      .catch(error => console.error("Error fetching parks:", error));
  }, [admin]);

  const inGroup = useMemo(
    () => (data ? data.sightings.filter(s => group === "all" || s[GROUP] === group) : []),
    [data, group]
  );
  const shown = useMemo(() => inGroup.filter(s => !month || s[MONTH] === month), [inGroup, month]);
  const heat = useMemo(() => (data ? heatImage(shown, data.boundary) : null), [data, shown]);
  const outline = useMemo(
    () => data && { type: "Feature", geometry: { type: "MultiPolygon", coordinates: data.boundary } },
    [data]
  );

  const nearParks = useMemo(
    () =>
      parks
        .map((park, i) => {
          if (park.latitude == null) return null;
          const near = shown.filter(s => kmBetween(park.latitude, park.longitude, s[LAT], s[LNG]) <= NEAR_KM);
          return { ...park, number: i + 1, count: near.length, species: new Set(near.map(s => s[SPECIES]).filter(Boolean)).size };
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [parks, shown]
  );

  if (!data) return null;

  const all = data.sightings;
  const years = inGroup.map(s => s[YEAR]);
  const feet = inGroup.map(s => s[FT]);
  const stats = [
    [fmt(inGroup.length), "sightings"],
    [new Set(inGroup.map(s => s[SPECIES]).filter(Boolean)).size, "species"],
    [`${Math.min(...years)}–${Math.max(...years)}`, "years"],
    [`${fmt(Math.min(...feet))}–${fmt(Math.max(...feet))} ft`, "elevation"]
  ];
  const monthCounts = {};
  inGroup.forEach(s => (monthCounts[s[MONTH]] = (monthCounts[s[MONTH]] || 0) + 1));
  const monthOptions = [
    [0, `All ${fmt(inGroup.length)}`],
    ...Object.keys(monthCounts)
      .map(Number)
      .sort((a, b) => a - b)
      .map(m => [m, `${MONTHS[m - 1]} ${fmt(monthCounts[m])}`])
  ];
  const groupOptions = GROUPS.map(([k, l]) => [k, `${l} ${fmt(k === "all" ? all.length : all.filter(s => s[GROUP] === k).length)}`]);
  const highShare = Math.round((100 * shown.filter(s => s[FT] >= 6000).length) / Math.max(1, shown.length));
  const topCount = Math.max(1, ...nearParks.map(p => p.count));
  const filterName = [group !== "all" && GROUPS.find(g => g[0] === group)[1].toLowerCase(), month && MONTHS[month - 1]]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="pt-12 mt-16 border-t border-sand-200">
      <h2 className="mb-2 font-serif text-3xl font-bold text-sand-700">Where and when they're seen</h2>
      <p className="max-w-2xl mb-5 text-sand-600">
        Every dragonfly and damselfly sighting in Boulder County on iNaturalist, with the parks from our Parks page.
        Brighter colors mean more sightings close together.
      </p>

      <div className="flex flex-wrap mb-6 gap-x-8 gap-y-2">
        {stats.map(([value, label]) => (
          <div key={label}>
            <div className="font-mono text-lg tabular-nums text-sand-700">{value}</div>
            <div className="text-xs text-sand-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 mb-4">
        <Chips label="Group" options={groupOptions} value={group} onChange={setGroup} />
        <Chips label="Month" options={monthOptions} value={month} onChange={setMonth} />
      </div>

      {/* isolate keeps Leaflet's high z-indexes under the nav bar. Dragging is
          off on phones so a finger on the map still scrolls the page. */}
      <div className="isolate overflow-hidden border rounded-2xl border-sand-200 h-96 md:h-[550px]">
        <MapContainer
          bounds={BOULDER_COUNTY_BOUNDS}
          boundsOptions={{ padding: [0, 0] }}
          scrollWheelZoom={false}
          dragging={!L.Browser.mobile}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitOnResize />
          <ImageOverlay url={heat.url} bounds={heat.bounds} opacity={0.8} />
          <GeoJSON data={outline} style={{ color: "#5a4535", weight: 2, fill: false }} interactive={false} />
          {nearParks.map(park => (
            <Marker
              key={park.id}
              position={[park.latitude, park.longitude]}
              icon={numberedPin(park.number)}
              title={park.name}
              eventHandlers={{ click: () => navigate(`/parks/${park.id}`) }}
            >
              <Tooltip>{`${park.number}. ${park.name}: ${fmt(park.count)} sightings, ${park.species} species`}</Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-sand-500">
        <p>
          {fmt(shown.length)} sightings shown. {highShare}% are at 6,000 ft or higher (foothills and up).
        </p>
        <div className="flex items-center gap-2 text-xs">
          fewer
          <span
            className="inline-block w-36 h-2.5 rounded-sm"
            style={{ background: `linear-gradient(to right, ${STOPS.map(([t, c]) => `${rgb(c)} ${t * 100}%`).join(", ")})` }}
          />
          more
        </div>
      </div>

      {nearParks.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="mb-2 font-serif text-lg font-semibold text-left text-sand-700">
              Within {NEAR_KM} km of each park sign{filterName && `: ${filterName}`}
            </caption>
            <thead>
              <tr className="text-xs text-left border-b text-sand-400 border-sand-200">
                <th scope="col" className="py-1 pr-2 font-medium">Park</th>
                <th scope="col" className="px-2 py-1 font-medium text-right">Sightings</th>
                <th scope="col" className="px-2 py-1 font-medium text-right">Species</th>
                <th scope="col" className="w-2/5 py-1 pl-2">
                  <span className="sr-only">Share of sightings</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {nearParks.map(park => (
                <tr key={park.id} className={`border-b border-sand-100 ${park.count ? "text-sand-700" : "text-sand-400"}`}>
                  <td className="py-1.5 pr-2">
                    <Link to={`/parks/${park.id}`} className="hover:underline">
                      {park.number}. {park.name}
                    </Link>
                  </td>
                  <td className="px-2 font-mono text-right tabular-nums">{fmt(park.count)}</td>
                  <td className="px-2 font-mono text-right tabular-nums">{park.species}</td>
                  <td className="pl-2">
                    {park.count > 0 && (
                      <div className="h-2 rounded-sm bg-[#d6401e]" style={{ width: `${(park.count / topCount) * 100}%` }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-10 mb-1 font-serif text-xl font-semibold text-sand-700">When, by elevation</h3>
      <PhenologyGrid sightings={inGroup} />

      <p className="mt-6 text-xs text-sand-400">
        Verifiable (research-grade and needs-ID) iNaturalist observations, with obscured locations left out. Species
        counts include only sightings identified to species. Elevations from USGS 10 m data via OpenTopoData.
        Updated {data.pulled}.
      </p>
    </section>
  );
};
