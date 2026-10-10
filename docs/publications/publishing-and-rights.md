# SwordWeave publishing and rights

Date: 10 October 2026. Working policy for review; this file does not replace LICENSE or grant new licenses.

## Confirmed intent

- The Player's Handbook, Game Master's Guide and SRD will be complete, free digital books. Their current publication policy is recorded in [Rights policy for the three free books](book-rights-policy.md); adventure commerce and platform licensing changes are deferred.
- Keep one manuscript with an interactive light/dark reader and separate light/dark PDFs. Use the app's fonts and metallic gold, silver and teal in both themes.
- Rules, primitives, heritages, manifests and homebrew compatibility remain freely available. No subscription or purchase requirement is introduced for mechanical options.
- Buy Me a Coffee supports development voluntarily.
- Original adventure books, stories and collections may be sold later.
- The current website guide and sheet/builder explanations are the primary rules sources. Current explicit conversation rulings take precedence. Historical documents and Notion supply context and omissions; dates alone do not establish authority.
- Author manuscripts in the repository. Existing Google documents are source material only.
- Compatible third-party creators may sell and distribute their own works using the open system with required credit, license information and a system link. Official sales, an optional future platform bookstore and authorized bookshop/hobby-store distribution are tracked in [Current and deferred work](../next-work.md).

## Publication architecture

See [Licensing and revenue, in plain language](licensing-and-revenue-options.md) for the product-level explanation and options.

Use structured manuscript files under `docs/publications/`, with stable rule IDs and versioned releases. The proof demonstrates one content file feeding a responsive HTML reading preview and eight-page light and dark PDFs, using the app fonts and metallic materials.

When the text and design are approved, adapt the reader into website routes:

- `/books`: the three books, release information and download links.
- `/books/players-handbook/[chapter]`.
- `/books/game-masters-guide/[chapter]`.
- `/srd/[section]`.

These are proposed routes, not routes added in this task. Keep the current `/rules` quick guide available; books can provide deeper explanations without changing sheet controls.

Generate PDFs at release time from the same approved manuscript. Do not print the ordinary interactive website into a PDF or generate books separately by hand. Keep links, a contents page, bookmarks, selectable text, embedded fonts and a declared rules version. A print edition and phone reading layout can differ while sharing content.

### Storage and delivery

- Git stores manuscripts, definitions, outlines, generation scripts, revision history and a release manifest.
- The website serves the responsive reading pages through its existing deployment.
- The existing R2 bucket `swordweave-public-art` can serve released PDF files through the existing public asset origin. Use `documents/swordweave/<rules-version>/players-handbook.pdf`, `game-masters-guide.pdf` and `srd.pdf`. Preserve the existing `images/*` artwork hierarchy.
- An object manifest records content type, byte count, SHA-256, manuscript revision and release date. Immutable version keys prevent old links silently changing; website links select the latest approved version.
- All three complete free digital books can use public delivery. Future paid adventure delivery is a later decision; public R2 URLs are publicly downloadable and must not be treated as private access control. Private sharing with friends is intended to be permitted for future adventures, with a voluntary coffee invitation.
- This task produces local draft artifacts only. Nothing has been uploaded or published.

## Figma

Read access to the supplied Swordweave design file succeeded through MCP on 10 October. Its supplied page was empty. No Figma nodes were created or changed.

The remote server can be used with a Starter account, with lower read-call limits. At the time of research the official documentation describes 20 calls/month for Starter; limits can change. [Figma access documentation](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/).

Figma is optional. It can hold covers and representative spreads if useful for visual review. Structured HTML/CSS and a typeset PDF already provide a reviewable proof without requiring a paid design account. The eight-page sample is a proposed visual direction, not a final page template.

## Rights: intended boundary and existing grants

The quoted earlier policy and the repository do not currently match:

| Material | Existing notice | Intended treatment for future publication |
| --- | --- | --- |
| Website source and backend | MIT software notice with no platform directory exclusion | Reserve new platform-specific implementation where desired; identify a separately licensed reusable engine boundary. |
| Reusable mechanical engine code | Included in the MIT source scope | Keep a clearly identified engine open under MIT. This requires a module inventory, not just changing a heading. |
| Rules text, primitives, BU and canonical mechanics | CC BY 4.0 | Retain CC BY 4.0 for a clearly identified SRD and open rules material. |
| Descriptive lore | Explicitly included in current CC BY wording | Identify already released material; apply separate terms to future original setting/adventure text where intended. |
| Official art, logos and brand | No complete asset-by-asset rights schedule in the root notice | Reserve owned assets explicitly where permitted; preserve third-party license obligations and prior grants. |
| Community creations | Not automatically owned by the platform | Preserve creator rights; publishing visibility and remix/fork features are not substitutes for content licensing terms. |

Making rules free concerns price and access. Licensing determines what other people may copy, adapt and republish. CC BY permits commercial reuse with attribution, while allowing the author to sell their own publications too. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

For example, an adventure could contain openly licensed SwordWeave rules and separately protected new plot, setting text, characters, maps and illustrations. A rights notice must identify those scopes clearly. Previously granted MIT/CC permissions remain available under their terms; an amended notice cannot retract them. Third-party and contributor material also needs its own provenance check.

### CC BY versus ORC

Recommend retaining CC BY 4.0 for the first SRD release: it matches both the current repository and the Notion hub's explicit license choice and permits creators to publish compatible products without requiring their additions to be open.

ORC is a distinct license, not a synonym for CC BY. It reserves designated creative material while requiring published mechanical adaptations using its licensed material to be released under ORC. Its explanatory document describes these obligations: [official ORC AxE](https://azoralaw.com/wp-content/uploads/2023/09/ORC-AxE.FINAL_.pdf). Switching or adding ORC requires a deliberate policy decision and full notice, not an “ORC-style” label.

### Concrete next rights work

1. Inventory source directories and separate reusable engine from platform-specific UI, account and backend implementation.
2. Inventory already released rules/lore and artwork/font/icon provenance.
3. Draft exact per-directory and per-publication notices, preserving existing grants and dependency terms.
4. Review the concrete notice before replacing LICENSE or publishing a new rights policy. Do not claim that the existing MIT platform has already become proprietary.

## Source availability

The browser connection exposed one existing SRD document, containing a legal notice with unresolved attribution placeholders. It was exported for read-only comparison. The PHB and GM draft tabs were not visible through that connection, so this pass does not claim to have compared those drafts. The outlines and proof are grounded in the current website source and accessible Notion rules.
