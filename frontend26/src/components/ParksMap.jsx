/**
 * Map of Boulder County at the bottom of the Parks page, with a pin for each
 * park that has coordinates (see ParkCards). Each pin shows the park's number,
 * matching the badge on its images. Clicking a pin calls onSelect with that
 * park's index in the list.
 */
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { BOULDER_COUNTY_BOUNDS, FitOnResize } from "./LocationsMap";
import { numberedPin } from "../utils/parkLocation";

export const ParksMap = ({ parks, onSelect }) => (
  // isolate keeps Leaflet's high z-indexes from covering the fullscreen view.
  // Dragging is off on phones so a finger on the map still scrolls the page.
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
      {parks.map(
        (park, i) =>
          park.latitude != null && (
            <Marker
              key={park.id}
              position={[park.latitude, park.longitude]}
              icon={numberedPin(i + 1)}
              title={park.name}
              eventHandlers={{ click: () => onSelect(i) }}
            >
              <Tooltip>{`${i + 1}. ${park.name}`}</Tooltip>
            </Marker>
          )
      )}
    </MapContainer>
  </div>
);
