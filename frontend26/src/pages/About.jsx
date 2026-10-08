import { useParams } from "react-router-dom";
import { EditableContent } from "../components/EditableContent";
import { sites } from "../data/sites";

// dataset/heroImage override the URL's category — used by the home page's
// own About page, which shows the "home" content under the home hero.
export const About = ({ dataset, heroImage }) => {
  const params = useParams();
  const category = dataset ?? params.category;
  const site = sites.find(s => s.id === category) || sites[0];
  const hero = heroImage ?? site.heroImage;

  return (
    <div className="font-sans">
      {/* Hero Banner */}
      <div
        className="relative h-[300px] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url('${hero}')` }}
      >
        <div className="absolute inset-0 bg-black opacity-40" />
        <h1 className="relative z-10 p-5 font-serif text-6xl font-bold tracking-wide text-white drop-shadow-lg">
          About the Site
        </h1>
      </div>

      {/* Main Content */}
      <div className="max-w-[1183px] px-5 mt-14 mb-20 mx-auto">
        <EditableContent page="about" dataset={category} />
      </div>
    </div>
  );
};
