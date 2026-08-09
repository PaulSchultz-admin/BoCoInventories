/**
 * Applies the same glossary-term tooltip highlighting used on species account
 * pages to a rendered HTML string (e.g. the Info page's markdown output),
 * by walking its text nodes rather than matching on plain text.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { GlossaryTerm } from "../components/GlossaryTerm";
import { primaryMatchText, escapeRegExp } from "./glossaryHighlight";

// highlightGlossaryInHtml scans the text nodes of a sanitized HTML string for
// glossary term matches and wraps each one in the real GlossaryTerm markup,
// so Info-page terms get the identical hover tooltip as species accounts.
// Text inside links/scripts/styles is left untouched.
export function highlightGlossaryInHtml(html, glossaryTerms) {
  if (!html || !glossaryTerms?.length) return html;

  const entries = glossaryTerms
    .map(g => ({ ...g, match: primaryMatchText(g.term) }))
    .filter(g => g.match.length > 1)
    .sort((a, b) => b.match.length - a.match.length);
  if (!entries.length) return html;

  const pattern = entries.map(g => escapeRegExp(g.match)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
  const lowerToEntry = new Map(entries.map(g => [g.match.toLowerCase(), g]));

  const container = document.createElement("div");
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest("a, script, style")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text))) {
      const [full] = match;
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const entry = lowerToEntry.get(full.toLowerCase());
      const wrapper = document.createElement("span");
      wrapper.innerHTML = renderToStaticMarkup(
        <GlossaryTerm definition={entry.description}>{full}</GlossaryTerm>
      );
      frag.appendChild(wrapper.firstChild);
      lastIndex = match.index + full.length;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }

  return container.innerHTML;
}
