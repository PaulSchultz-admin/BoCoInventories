import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { AdminProvider } from "./services/adminContext";
import { registerServiceWorker } from "./services/offline";
import { isSpanish, loadTranslator } from "./services/language";
import "./services/installPrompt"; // start listening for the install event early
// import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AdminProvider>
      <App />
    </AdminProvider>
  </React.StrictMode>
);

// Lets the site work offline; see services/offline.js and public/sw.js.
registerServiceWorker();

// Restart the Spanish translation on every visit once it has been chosen.
if (isSpanish()) loadTranslator();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
