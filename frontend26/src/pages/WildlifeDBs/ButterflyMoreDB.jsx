// ButterflyMoreDB.jsx
import { WildlifeDB } from "./WildlifeDB";

export function ButterflyMoreDB() {
  return (
    <WildlifeDB
      type="butterflies"
      label="Butterfly"
      heroImage="/butterfly-hero.png"
      heroPosition="25% 65%"
      title="More Butterflies of Boulder County"
      extraLinks={[{ name: "Flight Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      useDisplayList
      offlineDownload
      moreView
    />
  );
}