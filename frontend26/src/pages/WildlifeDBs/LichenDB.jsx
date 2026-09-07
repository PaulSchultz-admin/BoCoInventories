// LichenDB.jsx
import { WildlifeDB } from "./WildlifeDB";

export function LichenDB() {
  return (
    <WildlifeDB
      type="lichens"
      label="Lichen"
      heroImage="/lichen-hero.jpg"
      heroPosition="50% 50%"
      title="Lichens of Boulder County"
      showLocationsMap
    />
  );
}
