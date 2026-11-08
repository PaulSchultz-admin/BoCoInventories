/**
 * Parks is the main page for the Parks section, entered from its home page
 * tile: a grid of sign cards, one per park (the parks dataset). Parks has
 * no species database, so it sits under HomeLayout next to the
 * site-wide About/Contact pages rather than under the /:category dataset routes.
 * Like a dataset, it's closed to visitors while disabled on the home page (see
 * Home.jsx); admins still see it.
 */
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { AdminContext } from "../services/adminContext";
import apiService from "../services/apiService";
import { ParkCards } from "../components/ParkCards";

export const Parks = () => {
  const { admin, loading: adminLoading } = useContext(AdminContext);
  // disabledIds is null until loaded, so the content never flashes into view.
  const [disabledIds, setDisabledIds] = useState(null);

  useEffect(() => {
    apiService
      .getHomeDatasets()
      .then(data => setDisabledIds(data?.disabled ?? []))
      .catch(() => setDisabledIds([]));
  }, []);

  const ready = disabledIds !== null && !adminLoading;
  const closed = ready && !admin && disabledIds.includes("parks");

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
            Boulder County Parks and Open Spaces
          </h1>
        </div>
      </section>

      {/* Main Content */}
      {ready &&
        (closed ? (
          <section className="px-5 py-20 text-center">
            <p className="mb-4 font-serif text-lg text-sand-600">This guide isn't available right now.</p>
            <Link to="/" className="font-serif italic text-sand-400 hover:text-sand-600">
              ← Back to Boulder County Inventories
            </Link>
          </section>
        ) : (
          <section className="px-5 py-14">
            <ParkCards />
          </section>
        ))}
    </>
  );
};
