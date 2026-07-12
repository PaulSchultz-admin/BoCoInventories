/**
 * GlossaryTerm wraps a piece of text with a dotted underline and a hover
 * tooltip showing its glossary definition.
 */
export function GlossaryTerm({ definition, children }) {
  return (
    <span className="group/glossary relative inline-block cursor-help border-b border-dotted border-pink-400/70">
      {children}
      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-56 max-w-[80vw] rounded-lg bg-sand-700 px-3 py-2 text-left text-xs font-sans font-normal normal-case leading-snug text-sand-50 shadow-lg group-hover/glossary:block">
        {definition}
      </span>
    </span>
  );
}
