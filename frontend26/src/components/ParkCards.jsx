/**
 * ParkCards is the Parks page's grid of sign cards, one per park, with a map
 * of the parks below. A card or a map pin opens that park's own page
 * (WildlifeDetails, at /parks/<id>), which holds its photos and details.
 *
 * The parks are the entries in the backend's parks dataset, sorted by name and
 * numbered in that order, so adding or deleting one renumbers the rest. As
 * with species, admins add a park at /parks/new and delete one here or on its
 * page. A park's sign is its thumbnail photo (or its first photo).
 */
import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";
import { parkLocation, signPhoto } from "../utils/parkLocation";
import { ParksMap } from "./ParksMap";

const IMAGE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/get-image/`;

// loadParks builds the list from the parks dataset: each entry with its sign
// photo and map location.
async function loadParks() {
  const entries = (await apiService.getAllWildlife("parks")) || [];
  const parks = await Promise.all(
    entries.map(async entry => {
      const images = (await apiService.getImagesByWildlifeId(entry.id, "parks")) || [];
      const sign = signPhoto(images, entry.thumbnail_id);
      const fields = {};
      ["Latitude", "Longitude"].forEach(name => {
        fields[name] = entry.field_values?.find(f => f.name === name)?.value ?? "";
      });
      return {
        id: entry.id,
        name: entry.name,
        image: sign ? `${IMAGE_URL}${sign.image_path}` : null,
        ...parkLocation(fields, sign)
      };
    })
  );
  return parks.sort((a, b) => a.name.localeCompare(b.name));
}

export const ParkCards = () => {
  const navigate = useNavigate();
  const { admin } = useContext(AdminContext);
  // parks is null until loaded.
  const [parks, setParks] = useState(null);

  useEffect(() => {
    loadParks()
      .then(setParks)
      .catch(error => {
        console.error("Error fetching parks:", error);
        setParks([]);
      });
  }, []);

  if (parks === null) return null;

  const deletePark = async park => {
    if (!window.confirm(`Delete "${park.name}" and all of its photos? This cannot be undone.`)) return;
    try {
      await apiService.deleteWildlife(park.id, "parks");
      setParks(prev => prev.filter(p => p.id !== park.id));
    } catch (error) {
      alert("Delete failed: " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="mx-auto max-w-375">
      {parks.length === 0 && !admin && (
        <p className="font-serif text-lg text-center text-sand-600">No parks yet.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {parks.map((park, i) => (
          <Link
            key={park.id}
            to={`/parks/${park.id}`}
            onClick={() => window.scrollTo(0, 0)}
            className="relative flex flex-col overflow-hidden transition-shadow bg-white shadow-md rounded-2xl hover:shadow-lg"
          >
            <div className="flex items-center justify-center p-3 h-80 bg-sand-100">
              {/* Shrink-wrapped to the photo so the number sits on the photo's corner. */}
              <div className="relative min-w-0">
                {park.image ? (
                  <img
                    src={park.image}
                    alt={`Sign at ${park.name}`}
                    loading="lazy"
                    draggable={false}
                    className="block w-auto h-auto max-w-full rounded-lg max-h-74"
                  />
                ) : (
                  <p className="px-10 py-16 font-serif italic text-sand-500">No sign photo yet</p>
                )}
                <span className="absolute flex items-center justify-center w-8 h-8 font-sans text-sm font-semibold text-white rounded-full pointer-events-none bottom-2 right-2 bg-black/70">
                  {i + 1}
                </span>
              </div>
            </div>
            <h2 className="px-5 py-4 font-[Cormorant_Garamond] italic text-2xl font-semibold tracking-wide text-sand-800">
              {park.name}
            </h2>
            {admin && (
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  deletePark(park);
                }}
                className="absolute z-10 px-3 py-1.5 text-sm font-semibold text-red-600 bg-white border border-red-300 rounded-full shadow top-3 right-3 hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </Link>
        ))}

        {admin && (
          <Link
            to="/parks/new"
            className="flex flex-col items-center justify-center min-h-80 rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/30 hover:bg-pink-50 transition-colors"
          >
            <span className="text-6xl font-light text-pink-300">+</span>
            <span className="mt-2 font-serif text-sm font-semibold text-pink-700">Add park</span>
          </Link>
        )}
      </div>

      {/* Map: a pin opens that park's page */}
      {parks.length > 0 && (
        <div className="mt-12">
          <ParksMap
            parks={parks}
            onSelect={i => {
              navigate(`/parks/${parks[i].id}`);
              window.scrollTo(0, 0);
            }}
          />
        </div>
      )}
    </div>
  );
};
