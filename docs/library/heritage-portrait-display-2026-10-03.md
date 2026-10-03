# Heritage portraits and icon frames

Checkpoint before this change: `1b8166d`.

Heritage Identity now offers the existing authenticated image upload control and an image URL field. The saved `imageUrl` remains the storage contract; no schema or rules migration is required. Explicit portraits take precedence, then uploaded icon artwork, then exact curated lineage artwork. Game icons continue using the metallic proxy; portraits do not.

Library and Atelier lists, heritage detail pages, shared preview modals, live drafts, legacy template previews, and character heritage channels now resolve the same artwork. Portrait badges cover their circular frame and crop at `center 20%`. Detail/modal/live-draft portraits are 112px; character badges retain their existing 42px frame with a 40px image. Icons retain their existing sizes and clearance. Image borders, outlines and shadows are removed so the ring supplies the frame.

## Verification

- TypeScript: `npx tsc --noEmit` passed.
- Seven focused lineage-art and metallic SVG tests passed.
- Local Hearthspark detail: 112px frame, 110px image, cover, upper crop, zero image border, direct WEBP URL.
- Local Atelier: all 90 rendered game icons had zero image border.
- Image URL preview loaded successfully.
- WEBP upload completed through the existing upload route; authenticated blob preview loaded successfully. Test draft was reset without saving a heritage.
- Live draft portrait measured 112px.
- Private 25 BU character: heritage image measured 40px inside the unchanged 42px frame; info preview measured 112px. Displayed Vitality 17/17, DC 12 and attack +8 remained unchanged.
- `git diff --check` passed.

Screenshots: `output/portrait-checks/heritage-detail.png` and `output/portrait-checks/heritage-sheet-preview.png` (local verification output, not release assets).

No deployment or library/character record writes are included in this presentation pass. Curated image attachment still follows asset deployment, as documented in `lineage-art-integration-2026-10.md`. Filters and sorting remain the next UX backlog task. The earlier expansion, eighteen small heritage bases, 144-item collection and eight private example characters are recorded in `library-expansion-completion-2026-10.md`.
