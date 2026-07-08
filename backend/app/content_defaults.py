"""
content_defaults.py

Default/seed data for each dataset's editable site content: the About/
Resources/Contact page bodies and the Glossary term list. Each dataset
(butterflies/dragonflies/wildflowers) gets its own independent copy of these
tables in its own database (see db_helpers._seed_site_content), seeded from
the same starting content so an admin can then diverge each one.
"""

DEFAULT_PAGES = {
    "about": """## About This Site

### Geographic Region

The Front Range refers to the area from the Continental Divide to the Plains and the Colorado-Wyoming border south along the east side of the Rocky Mountains to the southern border of Pueblo County. This area includes the following counties: Larimer, Boulder, Broomfield, Gilpin, Clear Creek, Jefferson, Denver, Douglas, Park, Teller, El Paso, Fremont, and Pueblo.

This geographic region encompasses five biologic life zones: plains, foothills, montane, sub-alpine, and alpine, and partly explains why Boulder County, in the center of the defined area, has had recorded sightings for 203 butterfly species identified. In the designated Front Range area, there have been reported sightings of approximately 226 species, based on information from the website: [Butterflies and Moths of North America](https://www.butterfliesandmoths.org/).

---

### Get Involved

This website includes information on only some of the species in the checklists. We hope over time to have photos and information posted for as many species as possible found in the Front Range area. To accomplish this goal, we welcome participation within the butterfly community and nature lovers in general. We encourage advice and support from professional lepidopterists, nature photographers, butterfly watchers, and enthusiasts, which will help create a community website of benefit to everyone. Your input and resource contributions are encouraged and appreciated. All submitted and approved images will be credited with copyright retained by the original photographer.

---

### Copyright Statement

For further information on copyright and/or use of specific images, please [contact us](contact).
""",
    "resources": """## Resources for Front Range Naturalists

### Field Guides & Books

BCNA has published several field guides to help identify wildlife in the Colorado Front Range:

- _Butterflies of the Colorado Front Range: A Photographic Guide to 100 Species_ by Janet R. Chu and Stephen R. Jones — covers 100 frequently seen species from the Wyoming border to Pueblo, with over 120 color photos.
- _Dragonflies of the Colorado Front Range: A Photographic Guide_ by Ann Cooper — covers 45 dragonfly and 28 damselfly species with habitat, behavior, and flight time information.
- _Colorado Flora, Eastern Slope_ by William Weber — a comprehensive reference to all documented plant species on Colorado's eastern slope.

---

### Online Databases & Tools

These websites are valuable references for identifying and reporting wildlife sightings in the region:

- [Butterflies and Moths of North America](https://www.butterfliesandmoths.org/) — species accounts, range maps, and a sighting database for Lepidoptera across North America.
- [Colorado Front Range Butterflies](https://coloradofrontrangebutterflies.com/) — photographs, species accounts, and checklists specific to the Front Range.
- [BugGuide](https://bugguide.net/) — identification, images, and information for insects, spiders, and their kin in the US and Canada.
- [Bumble Bee Watch](https://www.bumblebeewatch.org/) — submit photos of bumble bee sightings to help track wild populations across North America.
- [BCNA Research Data](https://bcna.org/research-data/) — long-term monitoring data and research findings collected by BCNA volunteers and partners.

---

### Mobile Apps

Several apps can help you identify species in the field:

- **iNaturalist** — photograph and identify plants, insects, birds, and more; all observations contribute to global biodiversity science.
- **Audubon Butterflies** — identification guide covering 720+ butterfly species found in North America.
- **Colorado Rocky Mountain Wildflowers** — covers 520 wildflower species found throughout Colorado.
""",
    "contact": """## Get in Touch

### Contact BCNA

For questions, feedback, or to contribute photos and species information to this site, please reach out to the Boulder County Nature Association through the contact form on the [BCNA website](https://bcna.org/bcna-contacts/). We welcome participation from photographers, naturalists, and enthusiasts of all experience levels. All submitted and approved images will be credited with copyright retained by the original photographer.

---

### Mailing Address

Boulder County Nature Association
P.O. Box 493
Boulder, CO 80306

---

### Follow Us

Stay up to date with BCNA events, field trips, and nature news on social media. Find us on [Facebook](https://www.facebook.com/BoulderCountyNatureAssociation) and [Instagram](https://www.instagram.com/bouldernatue).
""",
}

VALID_PAGES = set(DEFAULT_PAGES)

# Seeded from the glossary's previous static JSON file so existing terms carry
# over as the starting point for all three datasets.
DEFAULT_GLOSSARY = [
    ("Abdomen", "The terminal (third) body segment of an adult insect."),
    ("Above", "The top side of the wings as seen from above."),
    ("Alba form", "Wings are mostly white."),
    ("Alpine", "The Rocky Mountain life zone that lies above treeline and is dominated by tundra vegetation."),
    ("Band", "An elongated surface or section with parallel or roughly parallel sides. Wider than a line."),
    ("Bar", "A short, often dark, rectangular mark on the wings."),
    ("Base (of wing)", "The portion of the wing that is attached to the butterfly's thorax."),
    ("Basking", "Resting in sunlight to warm flight muscles."),
    ("Below", "The underside of the wing, often facing the ground."),
    ("Borders (of wings)", "Outer edges."),
    ("Brood", "A generation of butterflies hatched from the eggs laid by females of the previous generation; members of a brood fly during the same general time period."),
    ("Cell", "A large area of each wing, near the forward edge, that is entirely enclosed by veins."),
    ("Cell Spot", "A spot within a wing cell."),
    ("Checkered or Checkering", "A chessboard-like pattern of usually dark markings."),
    ("Chevron", "V-shaped spot or band, usually white or silvery."),
    ("Chrysalis (plural: chrysalises)", "The hard case surrounding a butterfly pupa as it transforms from a caterpillar to an adult. See also cocoon."),
    ("Cocoon", "The soft protective case of silk or similar fibrous material that moth larvae and some butterfly larvae spin. See also chrysalis."),
    ("Costa", "The forward (anterior) edge of both the forewing and the hindwing."),
    ("Diapause", "A period of inactivity and reduced physiological function induced by environmental factors; more commonly occurs in a caterpillar or chrysalis than in adults."),
    ("Diffuse", "Not concentrated or localized."),
    ("Disk", "The central portion of a butterfly wing touching the costal and trailing margins."),
    ("Dispersal", "Moving outward from a single location. Differs from a migration in that individuals don't return to their point of origin."),
    ("Dorsal", 'The upper surface of the wings. In this guide we use the term "upper."'),
    ("Estivate", "To spend the summer or part of the summer in an inactive state."),
    ("Exoskeleton", "The hard protective outer covering of an insect's body."),
    ("Eyespot", "A scale pattern on a wing resembling an eye with a rim and pupil of contrasting colors. See also tail spot."),
    ("Flight (of adult butterflies)", "The time when a single generation of butterflies has emerged from chrysalises and is visible flying."),
    ("Foothills", "The geographic area intermediate between the plains and the high mountains and dominated by open conifer woodlands, grasslands and shrublands."),
    ("Forewings", "Forward wings."),
    ("Fringe", "The extreme outer edge of the wing."),
    ("Hibernate", "To enter a period of dormancy or torpor during extreme cold."),
    ("Hindwing", "The rear (posterior) wing of each pair."),
    ("Host", "The larval food plant. The female lays her eggs on this type of plant; after the caterpillars hatch, they eat these plants."),
    ("Inner margin", "The edge of the wing closest to the butterfly's body."),
    ("Instar", "The stage between each of the three or four molts during the growth of a caterpillar."),
    ("Larva", "The eating and growth stage of butterflies, that is, the caterpillar. (Plural: larvae.)"),
    ("Leading edge", "The front part of the wing."),
    ("Marbling", "Darker scales over yellow on a wing in a marble pattern."),
    ("Margin", "Edge, as in wing margin."),
    ("Median", "The middle part of the wing."),
    ("Migration", "A seasonal moving back and forth between breeding and wintering areas."),
    ("Montane", "The area of the high mountains below treeline and dominated by conifer forests and aspen."),
    ("Molt", "The shedding of the exoskeleton by the caterpillar, which permits growth."),
    ("Open (bands or spots)", "Uninterrupted by veins or other lines."),
    ("Outer margin", "The edge of the wings farthest from the butterfly's body."),
    ("Overwinter", "Pass the winter (in a particular life stage or place)."),
    ("Pheromones", "Sex-attractant scent molecules produced by scent scales."),
    ("Postmedian", "Between the outer margin of the wing and the middle of the wing."),
    ("Pupa", "The transition stage during which a caterpillar transforms into an adult. (Plural: pupae.)"),
    ("Pupate", "Transform from caterpillar to chrysalis."),
    ("Scale", "A small, flattened plate forming part of the wing surface."),
    ("Scintillation", "Sparkling caused by reflective scales."),
    ("Spermatophore", "A case or capsule containing a number of sperm."),
    ("Spot band", "A band made up of multiple connected or nearly connected spots."),
    ("Stigma or stigma scale", "A bold, sharply defined patch of scent scales on the forewings of many male skippers and hairstreaks."),
    ("Submargin", "Just inside the outer margin of the wing."),
    ("Submedian", "Occurring toward the body from the middle of the wing."),
    ("Taxonomic order", "A systematic arrangement that considers genetic, anatomical and other characteristics to understand the interrelationship of living organisms. Taxonomic order attempts to place families in an evolutionary sequence, with older families leading the list. As advances in gene sequencing of butterflies reveal new data, scientific names and taxonomic order will inevitably shift in the future."),
    ("Thorax", "The central portion of an insect's body to which legs and wings are attached."),
    ("Tail", "Posterior extension on the hindwing."),
    ("Tail spot", "Spot located on the hindwing near a tail, which could be an eyespot."),
    ("Talus", "A formation of rock debris at the base of a cliff, usually the result of a rockslide."),
    ("Veins", "Stiffened tubes that support the membranes of the wing, like kite struts."),
    ("Ventral", 'The lower side of the wings. This side is seen when a butterfly perches with its wings closed. In this guide we use the term "below."'),
    ("Wingspan", "The measurement of open forewings."),
]
