// RaptorDB.jsx
import { WildlifeDB } from "./WildlifeDB";

export function RaptorDB() {
  return (
    <WildlifeDB
      type="raptors"
      label="Raptor"
      heroImage="/raptor-hero.JPG"
      heroPosition="50% 50%"
      title="Raptors of Boulder County"
      useDisplayList
    />
  );
}
