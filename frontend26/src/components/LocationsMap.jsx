/**
 * Inset map shown in the wildlife database sidebar, below the filter box.
 * Plots one pin per LocationPhotos row for the dataset — standalone geotagged
 * photos (e.g. a boulder covered in lichen), each with a comment. These are
 * unrelated to species Images; the location comes from the photo's own EXIF
 * GPS data. Admins get an inline form to add a new one and a delete button
 * in the fullscreen viewer.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";

// Vite doesn't resolve Leaflet's default marker icon URLs the way Leaflet
// expects (they're built for a plain <img>-relative path), so the default
// icon shows up broken unless we point it at the bundled asset URLs directly.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Boulder County's actual boundary, fit with zero padding so the county
// fills the whole box rather than leaving dead space around it.
const BOULDER_COUNTY_BOUNDS = [
  [39.8794, -105.6871],
  [40.2614, -105.1785]
];

// LocationPhotoModal shows a location photo full-size over a dark backdrop,
// matching the species-photo fullscreen viewer's look (WildlifeDetails.jsx's
// FullscreenModal): full-bleed contained image, a caption bar with the
// comment, and a close button. There's no prev/next here since each pin is
// just the one photo.
function LocationPhotoModal({ photo, type, admin, onClose, onDelete }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/95"
      onClick={onClose}
    >
      <img
        src={apiService.locationPhotoImageUrl(photo.id, type)}
        alt={photo.comment || "Location photo"}
        draggable={false}
        className="object-contain max-w-full max-h-full rounded-xl select-none [-webkit-touch-callout:none]"
        onClick={e => e.stopPropagation()}
        onContextMenu={e => e.preventDefault()}
        onDragStart={e => e.preventDefault()}
      />

      <div className="absolute bottom-0 w-full p-4 text-center text-white bg-black/50">
        {photo.comment && <p className="italic">{photo.comment}</p>}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${photo.latitude},${photo.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-block mt-1.5 text-sm font-semibold text-sky-300 hover:underline"
        >
          Get Directions
        </a>
        {admin && (
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete(photo.id);
            }}
            className="mt-1 text-sm text-red-400 hover:underline"
          >
            Delete
          </button>
        )}
      </div>
      <button className="absolute text-3xl text-white top-5 right-5" onClick={onClose}>
        &times;
      </button>
    </div>
  );
}

export function LocationsMap({ type }) {
  const { admin } = useContext(AdminContext);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const loadPhotos = () => {
    apiService.getLocationPhotos(type).then(data => setPhotos(data || []));
  };

  useEffect(() => {
    loadPhotos();
  }, [type]);

  const handleSubmit = async e => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert("Please choose a photo.");
      return;
    }
    setSubmitting(true);
    try {
      await apiService.createLocationPhoto(file, comment, type);
      setComment("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowAddForm(false);
      loadPhotos();
    } catch (error) {
      const backendMessage =
        error.response?.data?.error || error.response?.data?.message || error.message;
      alert("Upload failed: " + backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async id => {
    if (!confirm("Delete this photo?")) return;
    try {
      await apiService.deleteLocationPhoto(id, type);
      setSelectedPhoto(null);
      loadPhotos();
    } catch (error) {
      const backendMessage =
        error.response?.data?.error || error.response?.data?.message || error.message;
      alert("Delete failed: " + backendMessage);
    }
  };

  return (
    <div>
      <div className="overflow-hidden border rounded border-sand-200 h-56">
        <MapContainer
          bounds={BOULDER_COUNTY_BOUNDS}
          boundsOptions={{ padding: [0, 0] }}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {photos.map(photo => (
            <Marker
              key={photo.id}
              position={[photo.latitude, photo.longitude]}
              eventHandlers={{ click: () => setSelectedPhoto(photo) }}
            />
          ))}
        </MapContainer>
      </div>

      {admin && (
        <div className="mt-2.5">
          {showAddForm ? (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-2 p-3 font-serif border rounded border-sand-200 bg-sand-100"
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="text-sm" />
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Comment"
                rows={2}
                className="px-2 py-1 text-sm bg-white border rounded resize-none border-sand-200"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 text-sm text-white transition-colors rounded bg-sand-400 hover:bg-sand-500 disabled:opacity-50"
                >
                  {submitting ? "Uploading…" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 text-sm transition-colors border rounded border-sand-200 text-sand-600 hover:bg-sand-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 text-sm transition-colors border border-dashed rounded border-sand-300 text-sand-500 hover:bg-sand-50"
            >
              + Add location photo
            </button>
          )}
        </div>
      )}

      {selectedPhoto && (
        <LocationPhotoModal
          photo={selectedPhoto}
          type={type}
          admin={admin}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
