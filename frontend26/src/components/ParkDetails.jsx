/**
 * A park's details on its own page (WildlifeDetails at /parks/<id>), from the
 * fields on its entry in the parks dataset. Above the photos, ParkInfo shows
 * Get Directions, and admins edit the life zone and pin location there. Below
 * the photos come ParkNotes, then ParkExpected, the home page's "Expected on a
 * date" search fixed to the park's life zone. Admin edits are saved with the
 * page's Save Changes.
 */
import { useEffect, useState } from "react";
import apiService from "../services/apiService";
import { ExpectedOnDate, EXPECTED_DATASETS } from "./ExpectedOnDate";
import { parkLocation, photoLocation } from "../utils/parkLocation";

const LIFE_ZONES = ["Plains", "Foothills", "Montane", "Alpine"];

const labelClass = "font-['Montserrat',sans-serif] text-xs uppercase tracking-widest text-sand-400";
const inputClass =
  "w-full p-3 mt-1 font-sans text-gray-800 bg-white border-2 border-pink-200 rounded-xl focus:outline-none focus:border-pink-500";

// fields are the entry's field values by name; sign is its sign photo (for EXIF
// GPS); onChange(name, value) updates the page's unsaved field values.
export function ParkInfo({ fields, sign, admin, onChange }) {
  const value = name => fields[name] ?? "";
  const location = parkLocation(fields, sign);
  const fromPhoto = photoLocation(sign);

  if (admin) {
    return (
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Life zone</span>
            <select value={value("Life zone")} onChange={e => onChange("Life zone", e.target.value)} className={inputClass}>
              <option value="">Not set</option>
              {LIFE_ZONES.map(zone => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          {["Latitude", "Longitude"].map(name => {
            const photoValue = name === "Latitude" ? fromPhoto.latitude : fromPhoto.longitude;
            return (
              <label key={name} className="block">
                <span className={labelClass}>{name}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value(name)}
                  placeholder={photoValue != null ? `${photoValue.toFixed(6)} (from photo)` : "Not in photo"}
                  onChange={e => onChange(name, e.target.value)}
                  className={inputClass}
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (location.latitude == null) return null;

  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className="self-start mb-6 font-serif text-lg font-semibold text-sky-700 hover:underline"
    >
      Get Directions
    </a>
  );
}

// ParkNotes goes below the park's photos, above Expected on a date.
export function ParkNotes({ fields, admin, onChange }) {
  const notes = fields["Park notes"] ?? "";

  if (admin) {
    return (
      <label className="block mt-8">
        <span className={labelClass}>Park notes</span>
        <textarea
          value={notes}
          onChange={e => onChange("Park notes", e.target.value)}
          rows={5}
          className={`${inputClass} resize-y`}
        />
      </label>
    );
  }

  if (!notes) return null;

  return (
    <div className="mt-8">
      <h3 className={labelClass}>Park notes</h3>
      <p className="mt-1 font-serif text-lg leading-relaxed whitespace-pre-line text-sand-700">{notes}</p>
    </div>
  );
}

// ParkExpected leaves out datasets disabled on the home page, like the home
// page's own search.
export function ParkExpected({ lifeZone }) {
  const [disabledIds, setDisabledIds] = useState(null);

  useEffect(() => {
    apiService
      .getHomeDatasets()
      .then(data => setDisabledIds(data?.disabled ?? []))
      .catch(() => setDisabledIds([]));
  }, []);

  if (disabledIds === null) return null;

  return (
    <div className="mt-10 -mx-5">
      <ExpectedOnDate
        datasets={EXPECTED_DATASETS.filter(id => !disabledIds.includes(id))}
        fixedZone={lifeZone || undefined}
      />
    </div>
  );
}
