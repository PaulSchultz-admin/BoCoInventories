import { useSyncExternalStore } from "react";

// useMediaQuery reports whether a CSS media query currently matches, and
// re-renders when it starts or stops matching (e.g. an iPad rotating). It
// also listens for plain resizes, since not every browser/emulator fires the
// media query's own change event.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      window.addEventListener("resize", onChange);
      return () => {
        mql.removeEventListener("change", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => window.matchMedia(query).matches
  );
}
