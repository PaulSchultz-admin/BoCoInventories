// Helpers for a park's sign photo and map location, shared by the Parks page's
// cards and map (components/ParkCards.jsx) and a park's own page
// (components/ParkDetails.jsx).

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
