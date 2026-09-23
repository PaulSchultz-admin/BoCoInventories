// RaptorMoreDB.jsx
import { WildlifeDB } from "./WildlifeDB";

export function RaptorMoreDB() {
  return (
    <WildlifeDB
      type="raptors"
      label="Raptor"
      heroImage="/raptor-hero.JPG"
      heroPosition="50% 50%"
      title="More Raptors of Boulder County"
      useDisplayList
      moreView
    />
  );
}
