// DragonflyDB.jsx
import { WildlifeDB } from "./WildlifeDB";
import { DAMSELFLY_FAMILIES } from "../../data/damselflyFamilies";

export function DragonflyDB() {
  return (
    <WildlifeDB
      type="dragonflies"
      label="Dragonfly"
      heroImage="/dragonfly-hero.JPG"
      heroPosition="0% 50%"
      title="Dragonflies of the Colorado Front Range"
      extraLinks={[{ name: "Flight Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      offlineDownload
      moreFamilies={DAMSELFLY_FAMILIES}
      moreLabel="Damselflies"
    />
  );
}
