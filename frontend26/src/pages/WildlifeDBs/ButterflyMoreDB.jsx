// ButterflyMoreDB.jsx
import { Navigate } from "react-router-dom";
import { WildlifeDB } from "./WildlifeDB";
import { BUTTERFLY_SIZE_LISTS } from "../../data/butterflySizes";

export function ButterflyMoreDB({ list }) {
  const current = BUTTERFLY_SIZE_LISTS.find(l => l.key === list);
  if (!current) return <Navigate to="/butterflies" replace />;

  return (
    <WildlifeDB
      key={current.key}
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
      moreList={current.key}
      listsBySize
      offlineDownload
    />
  );
}
