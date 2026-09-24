"""
content_defaults.py

Default/seed data for each dataset's editable site content: the About/
Resources/Contact page bodies and the Glossary term list. Each dataset
(butterflies/dragonflies/wildflowers) gets its own independent copy of these
tables in its own database (see db_helpers._seed_site_content), seeded from
the same starting content so an admin can then diverge each one.
"""

DEFAULT_PAGES = {
    "info": """## Info

Content coming soon.
""",
    "glossary": "",
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
