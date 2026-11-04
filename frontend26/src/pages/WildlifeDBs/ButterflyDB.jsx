// ButterflyDB.jsx
import { WildlifeDB } from "./WildlifeDB";
import { BUTTERFLY_SIZE_LISTS } from "../../data/butterflySizes";

export function ButterflyDB() {
  return (
    <WildlifeDB
      type="butterflies"
      label="Butterfly"
      heroImage="/butterfly-hero.png"
      heroPosition="25% 65%"
      title="Butterflies of Boulder County"
      extraLinks={[{ name: "Flight Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      useDisplayList
      mainLabel="Large"
      moreLists={BUTTERFLY_SIZE_LISTS}
      listsBySize
      offlineDownload
    />
  );
}
