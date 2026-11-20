// DamselflyDB.jsx
import { WildlifeDB } from "./WildlifeDB";
import { DAMSELFLY_FAMILIES } from "../../data/damselflyFamilies";
import { loadParkSites } from "../../utils/odonataSites";

export function DamselflyDB() {
  return (
    <WildlifeDB
      type="dragonflies"
      label="Damselfly"
      heroImage="/dragonfly-hero.JPG"
      heroPosition="0% 50%"
      title="Damselflies of Boulder County"
      extraLinks={[{ name: "Flight Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      flightSites={loadParkSites}
      offlineDownload
      moreFamilies={DAMSELFLY_FAMILIES}
      moreLabel="Damselflies"
      backLabel="Dragonflies"
      moreView
    />
  );
}
