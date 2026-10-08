/**
 * Home is the site landing page: a full-width hero titled "Boulder County
 * Inventories" followed by one tile per dataset, each using that dataset's
 * own hero image. Hidden datasets (see sites.js) are left out, same as the
 * NavBar's site switcher.
 */
import { Link } from "react-router-dom";
import { sites } from "../data/sites";

const visibleSites = sites.filter(s => !s.hidden);

export const Home = () => {
  return (
    <>
      {/* Hero */}
      <section className="relative w-full overflow-hidden h-130">
        <div
          className="absolute inset-0 bg-no-repeat bg-cover"
          style={{ backgroundImage: "url('/home-hero.jpg')", backgroundPosition: "50% 40%" }}
        >
          <div className="absolute inset-0 bg-black/15" />
        </div>
        <div className="relative z-10 flex h-full items-center px-[8%]">
          <h1 className="font-[Cormorant_Garamond] italic text-5xl lg:text-7xl font-semibold tracking-wide leading-none text-shadow-[2px_2px_8px_rgba(0,0,0,1)] text-sand-50">
            Boulder County Inventories
          </h1>
        </div>
      </section>

      {/* Dataset selectors */}
      <section className="px-5 py-14">
        <div className="grid gap-6 mx-auto max-w-375 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSites.map(site => (
            <Link
              key={site.id}
              to={site.path}
              className="relative block overflow-hidden rounded-2xl shadow-md group h-64"
            >
              <div
                className="absolute inset-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${site.heroImage}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <h2 className="absolute bottom-5 left-6 font-[Cormorant_Garamond] italic text-4xl font-semibold tracking-wide text-shadow-[2px_2px_6px_rgba(0,0,0,1)] text-sand-50">
                {site.label}
              </h2>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
};
