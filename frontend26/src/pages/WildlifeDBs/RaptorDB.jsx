// RaptorDB.jsx
import { WildlifeDB } from "./WildlifeDB";

export function RaptorDB() {
  return (
    <WildlifeDB
      type="raptors"
      label="Raptor"
      heroImage="/raptor-hero.JPG"
      heroPosition="50% 50%"
      heroQr="/raptors-qr.png"
      title="Raptors of Boulder County"
      useDisplayList
    />
  );
}
