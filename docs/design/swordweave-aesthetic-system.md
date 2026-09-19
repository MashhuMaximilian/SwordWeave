# SwordWeave aesthetic system

Status: authoritative production contract for Library, Atelier, character sheets, drawers, previews, and authoring surfaces.

This document replaces the use of scattered mockup notes as implementation guidance. The live Atelier and Library are the primary visual references. The character capability page demonstrates the intended information density, but it does not override the rules below when an older selector or component contradicts them.

## Experience

SwordWeave is an arcane scientific instrument built from obsidian glass, dark mineral surfaces, engraved brass, platinum edges, copper rule traces, and restrained alchemical light. It should feel precise, constructed, and valuable. It must not resemble a default dashboard with gold borders added afterward.

The interface has two simultaneous registers:

- **Instrument:** controls, state, formulae, BU, measurements, validation, selection, and operations.
- **Codex:** names, descriptions, provenance, heritage, composition, and authored meaning.

The material and type treatment must make these registers legible before the user reads the labels.

## Canonical references

Use these live pages as the reference set:

1. **Atelier:** three-part apparatus, metal edge hierarchy, medallions, authored work surface, Library corpus, and live preview.
2. **Library:** category rail, dense canonical entry rows, preview inspector, typography hierarchy, and selection states.
3. **Character capabilities:** heritage columns, compact nested composition, and playable density.
4. **Primitive preview:** the reference for a focused, readable entity preview.

Do not reproduce a page literally when its layout does not fit the task. Reuse its materials, component grammar, content hierarchy, and interaction semantics.

## Material grammar

| Material | Meaning | Uses |
| --- | --- | --- |
| Brass | authority, value, decisive action | principal frames, BU, primary commit actions, important thresholds |
| Platinum / silver | instrument structure | neutral frames, dividers, secondary actions, measurements, inactive controls |
| Copper | authored mechanical meaning | mechanical descriptions, recipes, modifiers, consequences, provenance paths |
| Patinated teal | live or selected state | focus, current selection, active equipment, valid state, filled meters |
| Obsidian glass | working surface | content planes, fields, drawers, modal bodies |
| Paper white | readable authored prose | narrative and verbose descriptions, explanations, body copy |
| Vermilion | destructive or invalid state | remove, error, danger, exceeded limits |

Teal is a state color. It is not the default color for Add, Save, Equip, or generic calls to action. A non-active command uses brass or neutral instrument metal. A teal control must indicate selection, focus, validity, or a live/equipped state.

Metal is created through edge contrast rather than flat color:

- dark outer edge;
- material body;
- one-pixel highlight;
- reflected shadow band;
- restrained glow only for active state;
- gradient direction follows the component geometry.

Large text surfaces remain calm. Metallic gradients belong on frames, rails, medallions, tabs, meters, and commands.

## Typography contract

| Role | Face | Required treatment |
| --- | --- | --- |
| Page and entity identity | Unica One | distinctive display voice, never used for dense prose |
| Panel and section identity | Oxanium 500 | compact structural headings |
| Authored prose and readable rules | Aubrey | narrative voice and mechanical sentences |
| Interface language | Syne | navigation, labels, tabs, buttons |
| Machine information | IBM Plex Mono | formulae, IDs, versions, aligned values |

### Primitive copy

The primitive hierarchy is fixed on every page and at every nesting depth:

- **Mechanical description:** copper, 12px, 17px line height, Aubrey medium.
- **Verbose or narrative description:** paper white, 10px, 14–15px line height, Aubrey regular.
- **Metadata:** muted silver, 8–9px, Syne or IBM Plex Mono according to content.

The role belongs to the actual rendered text node. A Markdown wrapper may not be the only semantic hook because its child paragraphs inherit competing rules. Production components must emit one of these stable hooks on the visible node:

```html
<p data-copy="mechanical">...</p>
<p data-copy="narrative">...</p>
```

or use a shared component that guarantees the same output. Selectors such as `.card p`, `.expression p`, or nesting-specific overrides are forbidden for semantic copy sizing or color.

## Surface construction

Every major surface follows the same construction:

1. outer brass or platinum frame;
2. subtle inner highlight;
3. obsidian work plane;
4. a small material rail or medallion that communicates the surface role;
5. engraved divider rhythm;
6. semantic color only where meaning changes.

A panel is not considered part of the SwordWeave system merely because it has a warm border. It needs the material edge, depth, typography, spacing, and control treatment together.

## Buttons and controls

- **Primary commit:** brass metal, dark ink, explicit verb.
- **Secondary:** platinum frame on obsidian.
- **Selected/live:** teal inset or teal edge with a state label.
- **Destructive:** vermilion boundary and text.
- **Icon-only:** reserved for universal actions with accessible labels.
- Buttons that navigate to a distinct workflow name the destination, for example **Edit in Atelier**.

Buttons are grouped by task. Navigation, mutation, and state controls do not share an undifferentiated row.

## Entity cards

Primitive, effect, capability, heritage, and item cards use one common visual grammar:

- version medallion or compact version token;
- entity name and kind;
- BU and availability aligned as instrument readings;
- mechanical description before narrative description;
- composition represented as nested authored pieces;
- provenance and mirror state as explicit labelled tokens;
- destructive editing controls separated from runtime controls.

Nested cards are denser than root cards, but they do not change the semantic typography or material meaning.

## Previews and modals

There is one preview language for Library, Atelier, and character sheets. The context may add a destination action, but it must not replace the preview structure.

A read-only preview contains:

- compact instrument header;
- entity identity;
- type, version, BU, provenance, and availability;
- mechanical and narrative meaning;
- composition and nested pieces;
- context action bar when needed.

A read-only preview never contains search, filters, runtime Activate/Trigger controls, editing fields, or an unrelated catalogue.

Modal rules:

- Desktop is a focused instrument panel, not a full-width page inside a dialog.
- Mobile is a bottom sheet or full-height instrument with safe-area padding.
- Header height is content-driven and compact; target 44–56px.
- The body uses the same entity components as Library and Atelier.
- Close remains visible.
- Nested previews use the same modal stack and visual shell.
- Primitive, effect, capability, heritage, item, formula, and provenance dialogs share the same frame, spacing scale, and action bar.

The primitive preview is the baseline. Other entity previews should become compositions of the same primitives, not separate bespoke modal designs.

## Bottom drawer

The bottom drawer is one integrated character instrument.

- Use one continuous metallic chassis and one visual depth.
- Vitality, derived values, practices, load, equipment, and speed are instrument groups separated by engraved rails and spacing.
- Do not place a full border around every practice or every small value.
- Use alignment, columns, hairline dividers, and typography for internal organization.
- Use brass for structure and headings, platinum for neutral readings, teal for current or filled state, and green metal only for vitality.
- Meters have visible filled and empty materials.
- Equipment slots show each filled slot distinctly.
- Desktop may use more columns. Mobile preserves the order and collapses groups without changing their meaning.

## Character edit mode

Character edit mode is an embedded Atelier context, not a collection of disconnected forms.

Desktop has three coordinated zones:

1. **Corpus:** character pieces and Library sources with the same Library cards and filters.
2. **Composition:** the selected character, heritage, capability, effect, or item and its ordered contents.
3. **Build and preview:** the correct authoring form and the global entity preview.

Mobile uses three explicit tabs: **Corpus**, **Build**, and **Preview**. The selected destination persists between tabs.

Every edit action must state its destination:

- Add directly to character;
- Add to selected heritage/capability/effect/item;
- Create new in selected destination;
- Fork from Library and add;
- Move or bundle existing character piece;
- Remove reference from bundle;
- Remove direct piece from character;
- Edit definition in Atelier.

The Build & Preview surface is a visible part of edit mode. It cannot depend on discovering a FAB button.

## Library inside character editing

The character Library reuses the production Library entry and preview components. It does not maintain a simplified parallel card system.

- same category navigation;
- same filters and search;
- same canonical/community/provenance indicators;
- same entity typography;
- same preview component;
- an additional destination command supplied by the character context.

Selecting an entry first previews it. Adding it requires an explicit destination. A direct one-click add may exist only when the destination is already visible and unambiguous.

## Inventory

Inventory distinguishes three gameplay roles:

- **Equipped:** constructed items that currently affect play;
- **Gear and artifacts:** equippable constructed items not currently active;
- **Pack, supplies, and currency:** compact records without full construction detail by default.

Items containing capabilities, effects, or primitives use the same nested entity grammar as the capability page. Inventory editing opens the shared character Atelier context while leaving the loadout legible.

## Responsive behavior

- Desktop may increase columns when cards remain readable.
- Tablet reduces columns before reducing type.
- Mobile uses one primary reading column and explicit tabs for multi-zone workflows.
- Modal controls and destination actions remain visible without horizontal scrolling.
- Touch targets remain at least 40px even when the visual glyph is smaller.
- Decorative detail may reduce on mobile; hierarchy and material semantics do not.

## Acceptance requirements

A change is not complete until all applicable checks pass in a real browser:

1. Inspect the actual visible text node, not only its wrapper.
2. Record computed `font-size`, `line-height`, and `color` for mechanical and narrative text at root and nested depths.
3. Capture desktop and 390×844 mobile states.
4. Compare against live Atelier and Library reference captures from the same build.
5. Exercise play and edit modes.
6. Exercise primitive, effect, capability, heritage, item, formula, and provenance modals.
7. Verify empty, loading, selected, active, mirrored, unavailable, and destructive states.
8. Verify Library add, fork, destination selection, edit, remove, and Build/Preview transitions.
9. Verify keyboard focus, Escape, scroll containment, and reachable close/action controls.

Passing TypeScript or unit tests does not validate the visual system.

## Prohibited implementation patterns

- late CSS patches that override an unknown earlier selector;
- semantic typography based on DOM depth;
- page-specific copies of Library cards or entity previews;
- generic teal primary buttons;
- thick decorative modal headers;
- default dashboard cards with metallic borders;
- bordered micro-card grids for every drawer value;
- runtime controls inside read-only previews;
- hidden critical edit flows that depend on the global FAB.

