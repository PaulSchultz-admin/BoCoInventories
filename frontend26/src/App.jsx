import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

// Pages importing
import { Layout, HomeLayout, WildlifeLayout, DynamicDBRouter, DynamicMoreDBRouter } from "./components/Layouts";

import WildlifeDetails from "./pages/WildlifeDetails";
import { FlightCalendar } from "./pages/FlightCalendar";
import { Info } from "./pages/Info";
import { About } from "./pages/About";
import { Resources } from "./pages/Resources";
import { Contact } from "./pages/Contact";
import { Glossary } from "./pages/Glossary";
import { Home } from "./pages/Home";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "about", element: <About dataset="home" heroImage="/home-hero.jpg" /> },
      { path: "contact", element: <Contact dataset="home" heroImage="/home-hero.jpg" /> }
    ]
  },
  {
    path: "/",
    element: <Layout />, // Layout wraps all children below
    children: [
      {
        path: ":category", // This will match 'butterflies', 'dragonflies', or 'wildflowers'
        element: <WildlifeLayout />,
        children: [
          {
            index: true,
            element: <DynamicDBRouter /> // A simple wrapper to show the right DB component
          },
          {
            path: "more",
            element: <DynamicMoreDBRouter />
          },
          {
            path: "info",
            element: <Info />
          },
          {
            path: "about",
            element: <About />
          },
          {
            path: "resources",
            element: <Resources />
          },
          {
            // Categories no longer have their own Contact page; the site-wide
            // one on the home page replaces it.
            path: "contact",
            element: <Navigate to="/contact" replace />
          },
          {
            path: "glossary",
            element: <Glossary />
          },
          {
            path: "flight-calendar",
            element: <FlightCalendar />
          },
          {
            path: ":wildlifeId",
            element: <WildlifeDetails />
          }
        ]
      }
    ]
  }
]);

export const App = () => {
  return (
    <div className="App bg-sand-50">
      <RouterProvider router={router} />
    </div>
  );
};
