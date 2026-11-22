/**
 * language.js runs the home page's Español/English switch (see
 * LanguageSwitch.jsx). Spanish is machine translation by Google's website
 * translator, so it covers everything on screen, database text and admin
 * edits included, with no translations to maintain here.
 *
 * The translator reads its target language from the "googtrans" cookie
 * ("/en/es" = English page shown in Spanish), so that cookie is the saved
 * choice: it lasts across pages and visits. Google's script is only loaded
 * while Spanish is on, so nothing goes to Google for English visitors.
 * Switching back to English clears the cookie and reloads, which is the one
 * reliable way to get the original text back.
 *
 * Anything that shouldn't be translated (scientific names, the switch
 * itself) carries translate="no".
 */

const SPANISH = "/en/es";

export function isSpanish() {
  return document.cookie.split("; ").includes(`googtrans=${SPANISH}`);
}

// Google may also set the cookie on the bare and dotted domain, so clearing
// covers all three.
function clearCookie() {
  const host = window.location.hostname;
  for (const domain of ["", `; domain=${host}`, `; domain=.${host}`]) {
    document.cookie = `googtrans=; path=/${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

// Google's translator swaps React's text nodes for its own <font> wrappers,
// so React's later removeChild/insertBefore calls can name a node that is no
// longer where React left it, which throws and blanks the page. These guards
// skip those calls instead (the usual fix, see facebook/react#11538).
function guardDomForTranslator() {
  if (Node.prototype.__translateGuarded) return;
  Node.prototype.__translateGuarded = true;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  };
  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return insertBefore.call(this, newNode, referenceNode);
  };
}

let loaded = false;

// loadTranslator starts Google's translator, which translates the page into
// the cookie's language as soon as it loads and keeps translating whatever
// React renders afterward.
export function loadTranslator() {
  if (loaded) return;
  loaded = true;
  guardDomForTranslator();
  const holder = document.createElement("div");
  holder.id = "google_translate_element";
  holder.style.display = "none";
  document.body.appendChild(holder);
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: "es", autoDisplay: false },
      "google_translate_element"
    );
  };
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

export function setSpanish(on) {
  if (on) {
    document.cookie = `googtrans=${SPANISH}; path=/`;
    loadTranslator();
  } else {
    clearCookie();
    window.location.reload();
  }
}
