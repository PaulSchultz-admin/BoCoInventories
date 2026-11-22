/**
 * LanguageSwitch is the home nav's language toggle: it reads "Español" while
 * the site is in English and "English" while it's in Spanish. See
 * services/language.js for how the translation works.
 */
import { useState } from "react";
import { isSpanish, setSpanish } from "../services/language";

export const LanguageSwitch = ({ className = "" }) => {
  const [spanish, setSpanishState] = useState(isSpanish);

  const toggle = () => {
    const next = !spanish;
    setSpanishState(next);
    setSpanish(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      translate="no"
      lang={spanish ? "en" : "es"}
      className={`notranslate cursor-pointer ${className}`}
    >
      {spanish ? "English" : "Español"}
    </button>
  );
};
