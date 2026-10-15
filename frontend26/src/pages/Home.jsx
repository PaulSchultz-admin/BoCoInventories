/**
 * Home is the site landing page: a full-width hero titled "Boulder County
 * Inventories" followed by one tile per dataset, each using that dataset's
 * own hero image. Admins can disable any dataset here (saved server-side,
 * see apiService.getHomeDatasets); a disabled dataset's tile stays visible
 * but faded and unclickable, and it's also left out of the NavBar's site
 * switcher. This is independent of sites.js's `hidden` flag, which only
 * affects the switcher.
 */
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";
import { sites } from "../data/sites";

export const Home = () => {
  const { admin } = useContext(AdminContext);
  // disabled is null until loaded, so tiles don't flash as enabled first.
  const [disabled, setDisabled] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    apiService
      .getHomeDatasets()
      .then(data => setDisabled(data?.disabled ?? []))
      .catch(() => setDisabled([]));
  }, []);

  const toggleSite = async siteId => {
    const previous = disabled;
    const next = disabled.includes(siteId) ? disabled.filter(id => id !== siteId) : [...disabled, siteId];
    setDisabled(next);
    setSavingId(siteId);
    try {
      await apiService.updateHomeDatasets(next);
    } catch (error) {
      setDisabled(previous);
      alert("Save failed: " + (error.response?.data?.error || error.message));
    } finally {
      setSavingId(null);
    }
  };

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
          {disabled &&
            sites.map(site => {
              const isDisabled = disabled.includes(site.id);
              const tileContent = (
                <>
                  <div
                    className={`absolute inset-0 bg-center bg-cover transition-transform duration-500 ${isDisabled ? "" : "group-hover:scale-105"}`}
                    style={{ backgroundImage: `url('${site.heroImage}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <h2 className="absolute bottom-5 left-6 font-[Cormorant_Garamond] italic text-4xl font-semibold tracking-wide text-shadow-[2px_2px_6px_rgba(0,0,0,1)] text-sand-50">
                    {site.label}
                  </h2>
                </>
              );

              return (
                <div key={site.id} className="relative h-64">
                  {isDisabled ? (
                    <div
                      aria-disabled="true"
                      title={`${site.label} is not available yet`}
                      className="relative block h-full overflow-hidden rounded-2xl shadow-md cursor-not-allowed opacity-40 grayscale"
                    >
                      {tileContent}
                    </div>
                  ) : (
                    <Link to={site.path} className="relative block h-full overflow-hidden rounded-2xl shadow-md group">
                      {tileContent}
                    </Link>
                  )}

                  {admin && (
                    <button
                      onClick={() => toggleSite(site.id)}
                      disabled={savingId === site.id}
                      className="absolute z-10 flex items-center gap-1 px-3 py-1.5 top-3 right-3 text-sm font-semibold text-pink-700 transition-colors bg-white border border-pink-300 rounded-full shadow hover:bg-pink-50 disabled:opacity-50"
                    >
                      {isDisabled ? <><EyeOff size={14} /> Disabled</> : <><Eye size={14} /> Enabled</>}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </>
  );
};
