# SpicyHome: a considered place

Base: `50c1b680587b0f1b3a45171c224618d6fe1dc345`. Fresh branch:
`astra/flagship-visual-experience`. No open PR or newer branch at preflight.

## Baseline, inspected before application edits

The 1,000-record committed feed is the rendering fixture. Saved finalists,
quotes, tours and the archived record in the visual harness are synthetic
notebook state, never apartment verification. External map tiles are blocked;
the map captures establish marker/layout behavior only. External font requests
are blocked in the reproducible capture harness.

- Discover at 1440: the toolbar alone occupies roughly 290px. At 390 it fills
  roughly 490px; the opening viewport contains no apartment identity. Nested
  blue panels and repeated segmented controls dominate the hierarchy.
- The skyline is a 160×76 desktop thumbnail, and smaller still on mobile. It
  contributes little context or atmosphere. Two adjacent headings say nearly
  the same thing.
- Listing cards repeat seven competing treatments: border, heavy unit line,
  rent, subtotal rule, outlined amenity chips, provenance, and action rule.
  The 390px first card is about 575px tall without a property image.
- Final Three at 1440 uses only about 300px per candidate, with small sans
  identities and 22px mono prices. At 390 it removes subtotal and layout from
  the finalist section. The result is a narrow utility shelf, not a considered
  review of three places.
- The dossier opens as an 800px settings modal. At desktop, the first screen
  devotes a large bordered panel to an editable layout select. At 390, external
  search links consume the remaining opening screen. Money is below both.
- Comparison constrains three property identities and 19 facts to that same
  narrow modal. Blue identity panels and several additional boxes compete.
- Light mode retains the navy navigation and cold blue inset panels. Dark mode
  uses the same navy for almost every component. Neither has an editorial rhythm.

## Settled direction

**Architectural editorial × personal field notebook.** Property identity,
meaningful money, and evidence lead. Controls take their place after the content
they act on. No property photography is available; text is the composition.

- Display: the existing DM Serif Display, used at 64–88px for the opening,
  38–52px for major sections and dossier identities, 28–40px for finalists.
  Mobile has its own 44–56px opening and stacked property/money composition.
- Body: DM Sans at 16px; primary evidence at 14px, short provenance at 13px. Mono is
  reserved for short edition labels and dates, never long caveats.
- Rhythm: 8px base, 24/40/64px section intervals. Wide layout capped at 1440px;
  narrow reading columns inside the dossier rather than narrow modal walls.
- Surfaces: warm ivory / paper in light; charcoal with a faint warm-neutral
  undertone in dark. A deliberately dark masthead connects both to SpicyChicken.
- Accent: SpicyChicken spice for a primary action and small editorial markers.
  Cobalt remains available for cartographic structure. No gold or glow.
- Shape: fine rules, mostly open composition; 4–8px controls and restrained
  10px large sheets. No rounded border around every fact.
- Money: large base figure and its basis travel together. Known subtotal is
  secondary and always carries incompleteness and unquoted items.
- Evidence: source, personal and derived material occupy named sections.
  Unknown is neutral text with clear semantics, never an error or fake zero.
- Final Three: three breathing columns on wide screens; complete vertical
  candidate sections on phones. Letters indicate identities, never rankings.
- Dossier: identity and money, evidence summary, monthly picture and source
  facts, source provenance, open questions, separate history, personal notebook.
  Layout editing is a disclosure; quote and tour fields remain reachable.
- Motion: brief color/opacity/entry transitions, no scroll effects. Reduced
  motion removes nonessential animation. Sticky surfaces use opaque fills.

## Imagery and design provenance

| Class | Inventory | Treatment |
| --- | --- | --- |
| Property-specific photography | None; no image/photo field in any of 1,000 records | No invented images or building forms |
| Decorative geographic photograph | `dist/assets/chicago.jpg`, 960×320, 88,669 bytes | Chicago context only; J. Crocker / Wikimedia Commons credit retained |
| Cartography | Existing Leaflet map and OpenStreetMap tiles | Existing coordinates/selection logic; fixture captures block remote tiles |
| Shared identity imagery | Original marks, lockups, patterns and favicons | Immutable; no re-vendoring |

Shared design: v2.13.0, commit
`14a752dd0269bd6ebbb7080eb0d9e1922cd1ef2c`; 22 vendored files, 0 SHA-256
differences against the committed provenance manifest at preflight.

No provider, query, budget, schedule, availability, data, price-history, or
quote-date-provenance change is part of this art direction.

The four app-owned Latin WOFF2 font files total 100,956 bytes. Their original
SIL Open Font Licenses, Fontsource package versions and SHA-256 hashes are
committed in `dist/assets/fonts/`. The app no longer imports its own fonts from
Google; shared-design files remain byte-for-byte unchanged.

Future shared-pattern candidate only: an identity-and-money opening paired with
a separate personal field notebook. No upstream work is included.
