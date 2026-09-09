// sites defines the dataset home pages shared across NavBar, Footer, and the
// per-dataset About/Resources/Glossary/Contact pages. A site with `hidden: true`
// still resolves correctly on its own pages (self-lookups fall through to it by
// id) but is left out of the switcher dropdown shown on other datasets' pages.
export const sites = [
  {
    id: "butterflies",
    path: "/butterflies",
    logo: "/butterfly-logo.png",
    heroImage: "/butterfly-hero.png",
    label: "Butterflies",
    hoverBg: "hover:bg-[#e2f2e7]"
  },
  {
    id: "dragonflies",
    path: "/dragonflies",
    logo: "/dragonfly-logo.png",
    heroImage: "/dragonfly-hero.JPG",
    label: "Dragonflies",
    hoverBg: "hover:bg-blue-50"
  },
  {
    id: "wildflowers",
    path: "/wildflowers",
    logo: "/wildflower-logo.png",
    heroImage: "/wildflower-hero.jpg",
    label: "Wildflowers",
    hoverBg: "hover:bg-orange-50"
  },
  {
    id: "lichens",
    path: "/lichens",
    logo: "/lichen-logo.png",
    heroImage: "/lichen-hero.jpg",
    label: "Lichens",
    hoverBg: "hover:bg-teal-50",
    hidden: true
  },
  {
    id: "bats",
    path: "/bats",
    logo: "/bat-logo.png",
    heroImage: "/bat-hero.jpg",
    label: "Bats",
    hoverBg: "hover:bg-slate-100",
    hidden: true
  }
];
