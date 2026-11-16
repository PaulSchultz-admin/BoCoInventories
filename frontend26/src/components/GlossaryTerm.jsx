/**
 * GlossaryTerm wraps a piece of text with a dotted underline and a tooltip
 * showing its glossary definition, opened by hovering, tapping or tabbing to
 * it (see .glossary-hint in index.css).
 */
export function GlossaryTerm({ definition, children }) {
  return (
    <span
      tabIndex={0}
      className="glossary-hint relative inline-block cursor-help border-b border-dotted border-pink-400/70 outline-none focus-visible:ring-2 focus-visible:ring-pink-400/50 rounded-sm"
    >
      {children}
      <span className="glossary-hint-text pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-56 max-w-[80vw] rounded-lg bg-sand-700 px-3 py-2 text-left text-xs font-sans font-normal normal-case leading-snug text-sand-50 shadow-lg">
        {definition}
      </span>
    </span>
  );
}
