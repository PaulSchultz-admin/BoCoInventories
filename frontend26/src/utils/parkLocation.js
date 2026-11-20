// Helpers for a park's sign photo and map location, shared by the Parks page's
// cards and map (components/ParkCards.jsx), a park's own page
// (components/ParkDetails.jsx), and the Dragonflies Science page's heat map
// (components/OdonataHeatMap.jsx).
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import apiService from "../services/apiService";

const IMAGE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/get-image/`;

// numberedPin is Leaflet's usual blue pin, with the number on a matching blue
// circle that covers the white dot in the pin's head.
export const numberedPin = number =>
  L.divIcon({
    className: "",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    tooltipAnchor: [12, -28],
    html: `<div style="position:relative;width:25px;height:41px">
      <img src="${markerIcon2x}" alt="" style="width:25px;height:41px" />
      <span style="position:absolute;top:3px;left:3.5px;width:18px;height:18px;border-radius:50%;background:#2a7fc4;text-align:center;font:bold 12px/18px sans-serif;color:#fff">${number}</span>
    </div>`
  });

// signPhoto is the park's sign: its thumbnail photo, or its first photo.
export const signPhoto = (images, thumbnailId) =>
  images.find(img => img.id == thumbnailId) || images[0];

// exifDegrees turns EXIF GPS [degrees, minutes, seconds] plus its N/S/E/W
// reference into signed decimal degrees, or null if the photo has none.
const exifDegrees = (dms, ref) => {
  if (!Array.isArray(dms) || dms.length !== 3 || dms.some(n => typeof n !== "number")) return null;
  const degrees = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === "S" || ref === "W" ? -degrees : degrees;
};

// photoLocation is where the sign photo was taken, from its EXIF GPS, or nulls.
export const photoLocation = photo => ({
  latitude: exifDegrees(photo?.metadata?.gps_latitude, photo?.metadata?.gps_latitude_ref),
  longitude: exifDegrees(photo?.metadata?.gps_longitude, photo?.metadata?.gps_longitude_ref)
});

// parkLocation is the park's pin: its Latitude/Longitude fields when both are
// filled in, otherwise the sign photo's EXIF GPS.
export const parkLocation = (fields, photo) => {
  const lat = parseFloat(fields.Latitude);
  const lng = parseFloat(fields.Longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  return photoLocation(photo);
};

// loadParks builds the park list from the parks dataset, sorted by name (the
// order the Parks page numbers them in): each entry with its sign photo and
// map location.
export async function loadParks() {
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
