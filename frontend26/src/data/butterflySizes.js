// The butterflies dataset's size pages. Large is the main page (/butterflies);
// these are its named "More" pages (/butterflies/more/:key). An admin assigns
// each species to one page in the Edit display list.
export const BUTTERFLY_SIZE_LISTS = [
  { key: "medium", label: "Medium" },
  { key: "small", label: "Small" }
];

export function wingspanText(wildlife) {
  return (wildlife.field_values || []).find(fv => fv.name === "Wingspan")?.value ?? "";
}

const toInches = number =>
  number
    .trim()
    .split(/\s+/)
    .reduce((total, part) => {
      const [top, bottom] = part.split("/").map(Number);
      return total + (bottom ? top / bottom : top);
    }, 0);

// wingspanInches is the midpoint of a Wingspan field's range, e.g.
// "Large; 3 3/8 to 4 7/8 inches." -> 4.125, or 0 if it names no size. A lone
// "less than 1 1/2 inches" counts as the top of a range a half inch wide.
export function wingspanInches(wildlife) {
  const text = wingspanText(wildlife);
  const numbers = (text.match(/\d+\s+\d+\/\d+|\d+\/\d+|\d+/g) ?? []).map(toInches);
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return /less than/i.test(text) ? numbers[0] - 0.25 : numbers[0];
  return (numbers[0] + numbers[1]) / 2;
}

// sortBySize orders species largest first, by name within the same size.
export function sortBySize(wildlife) {
  return [...wildlife].sort(
    (a, b) => wingspanInches(b) - wingspanInches(a) || (a.name || "").localeCompare(b.name || "")
  );
}

// splitBySize divides species into `count` groups of equal size (any remainder
// goes to the earlier groups), largest species first.
export function splitBySize(wildlife, count) {
  const sorted = sortBySize(wildlife);
  const groups = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((sorted.length - start) / (count - i));
    groups.push(sorted.slice(start, start + size));
    start += size;
  }
  return groups;
}
