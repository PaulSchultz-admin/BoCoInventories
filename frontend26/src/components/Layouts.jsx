import { useEffect } from "react";
import { Outlet, useParams, Link, NavLink, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { NavBar } from "./NavBar";
import { sites } from "../data/sites";
import { ButterflyDB } from "../pages/WildlifeDBs/ButterflyDB";
import { DragonflyDB } from "../pages/WildlifeDBs/DragonflyDB";
import { WildflowerDB } from "../pages/WildlifeDBs/WildflowerDB";
import { LichenDB } from "../pages/WildlifeDBs/LichenDB";
import { BatDB } from "../pages/WildlifeDBs/BatDB";
import { RaptorDB } from "../pages/WildlifeDBs/RaptorDB";
import { ButterflyMoreDB } from "../pages/WildlifeDBs/ButterflyMoreDB";
import { RaptorMoreDB } from "../pages/WildlifeDBs/RaptorMoreDB";

const DEFAULT_TITLE = "BCNA Wildlife Database";

export const Layout = () => {
  const { category } = useParams();
  const currentSite = sites.find(s => s.id === category);

  // A hideBcna site (see sites.js) also gets a browser-tab title with no
  // BCNA mention, instead of the shared static one from index.html.
  useEffect(() => {
    document.title = currentSite?.hideBcna
      ? `${currentSite.label} of Boulder County`
      : DEFAULT_TITLE;
  }, [currentSite]);

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

// HomeLayout wraps the site landing page and its own About/Contact pages.
// It has no NavBar: About and Contact sit in the hero's upper-right corner
// instead (plus a Home link when not already on the home page).
export const HomeLayout = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "Boulder County Inventories";
  }, []);

  const linkClass = "font-sans text-sm tracking-wide uppercase transition-colors text-sand-50 hover:text-sand-200 text-shadow-[1px_1px_4px_rgba(0,0,0,0.9)]";

  return (
    <div className="flex flex-col min-h-screen">
      <main className="relative flex-1">
        <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-[4%] py-5">
          {pathname !== "/" ? <Link to="/" className={linkClass}>Home</Link> : <span />}
          <div className="flex gap-8">
            <NavLink to="/about" className={linkClass}>About</NavLink>
            <NavLink to="/contact" className={linkClass}>Contact</NavLink>
          </div>
        </nav>
        <Outlet />
      </main>
      <Footer hideBcna />
    </div>
  );
};

export const WildlifeLayout = () => <Outlet />;

export const DynamicDBRouter = () => {
  const { category } = useParams();

  // Map the URL string to your specific components
  const components = {
    butterflies: <ButterflyDB />,
    dragonflies: <DragonflyDB />,
    wildflowers: <WildflowerDB />,
    lichens: <LichenDB />,
    bats: <BatDB />,
    raptors: <RaptorDB />,
  };

  // Return the correct component, or a 404/Fallback if the category doesn't exist
  return components[category] || <div className="p-10">Category not found.</div>;
}

// DynamicMoreDBRouter renders a category's "More" page — the less-common
// species grid linked from the main page's "More" link. Only categories that
// opt into the display-list split (butterflies and raptors) have one.
export const DynamicMoreDBRouter = () => {
  const { category } = useParams();

  const components = {
    butterflies: <ButterflyMoreDB />,
    raptors: <RaptorMoreDB />
  };

  return components[category] || <div className="p-10">This category has no "More" page.</div>;
};