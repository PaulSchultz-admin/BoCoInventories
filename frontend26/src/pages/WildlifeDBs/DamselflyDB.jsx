// DamselflyDB.jsx
import { WildlifeDB } from "./WildlifeDB";
import { DAMSELFLY_FAMILIES } from "../../data/damselflyFamilies";

export function DamselflyDB() {
  return (
    <WildlifeDB
      type="dragonflies"
      label="Damselfly"
      heroImage="/dragonfly-hero.JPG"
      heroPosition="0% 50%"
      title="Damselflies of the Colorado Front Range"
      extraLinks={[{ name: "Flight Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      moreFamilies={DAMSELFLY_FAMILIES}
      moreLabel="Damselflies"
      backLabel="Dragonflies"
      moreView
    />
  );
}
