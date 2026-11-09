import { useContext } from "react";
import { EditableContent } from "../components/EditableContent";
import { AdminContext } from "../services/adminContext";
import { ContributorAgreement } from "../components/ContributorAgreement";
import { SubmissionsReview } from "../components/SubmissionsReview";

// On the Submissions and permissions page, the Contributor License Agreement
// section becomes a form that leads to the photo upload popup.
const AGREEMENT_SECTION = {
  heading: "Contributor License Agreement",
  render: (html, markdown) => <ContributorAgreement html={html} markdown={markdown} />
};

// One of the site-wide copyright pages listed in data/copyrightPages.js.
// An adminOnly page is only readable by a logged-in admin; the backend
// enforces the same rule.
export const Copyright = ({ page, label, adminOnly = false }) => {
  const { admin, loading } = useContext(AdminContext);

  return (
    <div className="font-sans">
      {/* Hero Banner */}
      <div
        className="relative h-[300px] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('/home-hero.jpg')" }}
      >
        <div className="absolute inset-0 bg-black opacity-40" />
        <h1 className="relative z-10 p-5 font-serif text-5xl font-bold tracking-wide text-center text-white drop-shadow-lg md:text-6xl">
          {label}
        </h1>
      </div>

      {/* Main Content */}
      <div className="max-w-[1183px] px-5 mt-14 mb-20 mx-auto">
        {loading ? null : adminOnly && !admin ? (
          <p className="font-serif text-lg text-sand-600">
            This page requires admin login. Use “Admin Login” at the bottom of the page.
          </p>
        ) : (
          <>
            <EditableContent
              page={page}
              dataset="home"
              specialSection={page === "copyright-submissions" ? AGREEMENT_SECTION : null}
            />
            {/* Admin review of submitted photos lives on the admin-only info page. */}
            {page === "copyright-info" && admin && <SubmissionsReview />}
          </>
        )}
      </div>
    </div>
  );
};
