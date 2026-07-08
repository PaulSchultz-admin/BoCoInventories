import { useParams } from "react-router-dom";
import { EditableContent } from "../components/EditableContent";
import { sites } from "../data/sites";

export const Contact = () => {
  const { category } = useParams();
  const site = sites.find(s => s.id === category) || sites[0];

  return (
    <div className="font-sans">
      {/* Hero Banner */}
      <div
        className="relative h-[300px] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url('${site.heroImage}')` }}
      >
        <div className="absolute inset-0 bg-black opacity-40" />
        <h1 className="relative z-10 font-serif text-white text-6xl font-bold tracking-wide drop-shadow-lg">Contact</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-[1183px] px-5 mt-14 mb-20 mx-auto">
        <EditableContent page="contact" dataset={category} />
      </div>
    </div>
  );
};
