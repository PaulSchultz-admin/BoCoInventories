// WildflowerMoreDB.jsx
import { Navigate } from "react-router-dom";
import { WildlifeDB } from "./WildlifeDB";
import { WILDFLOWER_LISTS } from "../../data/wildflowerLists";

export function WildflowerMoreDB({ list }) {
  const current = WILDFLOWER_LISTS.find(l => l.key === list);
  if (!current) return <Navigate to="/wildflowers" replace />;

  return (
    <WildlifeDB
      key={current.key}
      type="wildflowers"
      label="Wildflower"
      heroImage="/wildflower-hero.jpg"
      heroPosition="25% 50%"
      title={current.title}
      extraLinks={[{ name: "Bloom Calendar", path: "flight-calendar" }]}
      showFlightTimeFilter
      useDisplayList
      moreLists={WILDFLOWER_LISTS}
      moreList={current.key}
      offlineDownload
    />
  );
}
