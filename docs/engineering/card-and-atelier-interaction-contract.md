# Card and Atelier interaction contract

User requirements consolidated on 2026-10-07. Preserve these when changing
Library, Maker’s Archive, collection pages, previews, creation, or Atelier.

## Shared card interactions

- A desktop pointer hovering an interactive entity card gives it the shared gold
  material and dark readable ink. Mechanical and narrative copy change together.
- A clickable rule inside the gold card becomes **bold** on its own hover.
  Do not underline it or add pale beige backgrounds behind individual rules.
- Keyboard focus provides the same readable material and a visible focus cue.
- Touch uses a transient pressed state. Releasing a tap must not leave dark text
  on a dark card because a desktop hover or focus rule remained active.
- Ordinary mechanical copy uses the mechanical color; ordinary descriptions use
  the narrative color. Nested full previews keep their own surface and ink.
- Gold materials use the shared gold token in light and dark themes, rather than
  a gradient made from theme-dependent heading colors.

The final shared cascade is `src/app/card-interactions.css`. Avoid introducing
another independent card hover palette in a component stylesheet. Keep the
background and foreground change in the same interaction rule.

## Creatures in Atelier

- Open source previews through the column’s existing modal stack. Use the common
  preview destination bar, including the source link. Do not append a standalone
  Load in Build button under a source card.
- The middle creature editor uses author tabs: Identity, Foundation, Weaknesses,
  Pieces, Publish. Its resolved sheet belongs in the right preview column.
- Primitive, effect, capability and item previews can add to the active creature
  through the ordinary slot event. This must also work in the independent
  Build & Preview workspace, with its own event bus and draft.
- Source loading does not save anything. Saving an edited public source as a new
  creature preserves its fork lineage and checks source visibility on the server.
- Replacing a draft uses the in-app confirmation. The independent modal draft and
  primary editor must not overwrite each other.
- Deliver the first queued component only after a new creature editor is ready.
- The three columns own their scroll boundaries. Source rows must not paint as
  an extra list below the workspace.
- Composition grids respond to their available width. Phone source cards reserve
  separate columns for artwork, copy, and bookmark; titles must not collapse into
  one-character lines.

## Navigation proposals

The FAB support link is full width, labeled “Keep the project going”, with the
game-icons campfire. Navigation grouping concepts remain proposals until chosen
by the user; do not silently implement a new navigation structure.
