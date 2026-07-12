/**
 * Helpers for matching glossary terms against field labels and body text,
 * and rendering matches as GlossaryTerm tooltips.
 */
import { GlossaryTerm } from "../components/GlossaryTerm";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strip a trailing parenthetical qualifier, e.g. "Chrysalis (plural: chrysalises)" -> "Chrysalis".
export function primaryMatchText(term) {
  return term.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// findGlossaryEntry finds the glossary entry whose primary match text
// exactly equals the given label (case-insensitive).
export function findGlossaryEntry(label, glossaryTerms) {
  if (!label || !glossaryTerms?.length) return null;
  const target = label.trim().toLowerCase();
  return glossaryTerms.find(g => primaryMatchText(g.term).toLowerCase() === target) || null;
}

// highlightGlossaryTerms scans free-form text for occurrences of glossary
// terms and wraps each match in a GlossaryTerm tooltip. Returns either the
// original string (no matches/terms) or an array of strings and elements.
export function highlightGlossaryTerms(text, glossaryTerms) {
  if (!text || !glossaryTerms?.length) return text;

  const entries = glossaryTerms
    .map(g => ({ ...g, match: primaryMatchText(g.term) }))
    .filter(g => g.match.length > 1)
    .sort((a, b) => b.match.length - a.match.length);

  if (!entries.length) return text;

  const pattern = entries.map(g => escapeRegExp(g.match)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
  const lowerToEntry = new Map(entries.map(g => [g.match.toLowerCase(), g]));

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const entry = lowerToEntry.get(part?.toLowerCase());
    if (entry) {
      return (
        <GlossaryTerm key={i} definition={entry.description}>
          {part}
        </GlossaryTerm>
      );
    }
    return part;
  });
}
