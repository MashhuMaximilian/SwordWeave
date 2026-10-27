# SwordWeave: publication and commerce follow-up

Updated 11 October 2026 from the publication, licensing and future-store discussion. The original working roadmap is `.local-plans/next-phase.md`, whose latest update includes these decisions alongside the earlier collections/monsters, GM workspace and ChatGPT app/MCP plan. That ignored file remains private and is not committed or deployed. This document is a publication/commerce companion, not a replacement project roadmap. Historical implementation closeouts retain their original release context. Items below are plans, not claims that implementation or release has happened.

## Current character-sheet follow-up / 27 October 2026

The interactive character PDF generator is live on production, including the
26 October practice/roll-marker and attribute-fit corrections. The creator
approved refreshing the static Aegis downloads on Books, the creator kit and
itch.io; see [the current release checkpoint](marketing/aegis-static-refresh-2026-10-27.md).
The creator is handling the physical print/pencil/fold check. Futoshi's three
definition/version corrections and older PB-based training primitives are
recap-only work for now; no definition or character pins are changed. PUB-01's
damage-triggered Vitality upkeep counter/reset policy remains undecided.
Private creator export/import and the other long-term product phases below
remain deferred.

The compact core release notes below retain their original historical context.

## Earlier core release: three compact free alpha core editions

The PHB, Game Master's Guide and SRD are now compact v0.1 alpha core manuscripts with indexed, bookmarked light/dark PDFs and responsive readers. The release preserves the approved app fonts and gold/silver/teal materials. The PHB teaches all player procedures; the SRD reproduces the mechanical framework and principal primitive families; the GM Guide provides practical preparation and adjudication tools. No class subsystem, mandatory Monster Manual or exhaustive heritage/fork appendix was added.

Book links are in the homepage, public navigation and rules pages. Historical public “Source notes” are replaced by real book section links. The new System sample collection contains 30 anonymously readable, pinned encounter preparations; its seed rerun creates no duplicates or play copies.

See [release manifest](publications/release-manifest.json), [publication sources](publications/README.md), [accepted rulings](publications/creator-rulings-2026-10-10.md) and [sample encounters](library/system-encounters-v0.1-alpha.md). Static versioned website downloads are available; preferred R2 upload needs renewed Cloudflare authorization, with `images/*` preserved.

Next: substantial illustrated PHB and GM Guide editions, and a fuller digital SRD following the [full-edition production plan](publications/full-edition-production-plan.md). The present 42/34/33-page editions are usable alpha references, not the final illustrated print books. The SRD has no print-production requirement. Also continue actual table feedback/errata, the creator's single deferred upkeep ruling, and optional R2 delivery after authentication. Printed products, adventure commerce and the ChatGPT app/MCP remain later phases. The existing short-rest carryover and agreed recovery controls already passed the earlier shared-component browser check and focused release tests.

### Open decisions before calling the core release final

See [Rules reconciliation](publications/rules-reconciliation.md) for existing baselines and source provenance.

| ID | Decision needed | Why it matters |
| --- | --- | --- |
| PUB-01 | **Deferred explicitly:** damage-triggered Vitality upkeep and reset/excess policy. Continue writing with a placeholder. | Keep contextual upkeep/consequences distinct from this numerical proposal; do not automate an undecided rule. |
| PUB-02 | **Clarified:** agreed short pauses/overnight rests, 50% maximum rounded-up short-rest allowance, actual-used carryover until long rest, full/partial long-rest recovery, separate rescue and consequences. | Record actual agreement; no automatic rest timer. |
| PUB-03 | **Clarified for manuscripts:** continuous Extreme reach to approximately three miles, sensory location or authored targeting exceptions, DM-agreed extensions. Retain Very Far 120 ft as existing reference. | Reconcile historical catalogue wording when updating definitions rather than silently changing pinned entries. |
| PUB-04 | Editorially resolved: apply Core rule, Default, Authored rule, Optional guidance, Example and App note. | Readers must distinguish rules, advice, examples and app behavior. |

The proof is approved visually. The creator has answered the bias/slot/movement and rest questions; PUB-01's numerical rule remains deliberately deferred. Preserve its placeholder in the released alpha until the creator settles it.

Both older PDF sources were compared locally: `/Users/max/Desktop/Downloads/Swordweave Light Player's Handbook TTRPG.pdf` and `/Users/max/Desktop/Downloads/Dungeon Master's Guide_ SwordWeave.pdf`. Source hashes, page counts and returned Notion snapshot metadata are in `publications/rules-source-index-2026-10-10.json`. Existing Google/Notion drafts are source material only. No Google Docs authoring is planned.

Publication policy and outlines: [Book rights](publications/book-rights-policy.md), [book outlines](publications/book-outlines.md), [review package](publications/README.md).

## Deferred: support, products and distribution

- [ ] **Explore before signing in — implemented, release approved, 23 October 2026:** the creator chose “Experiment freely; sign in to save.” Atelier now has a local guest implementation using current public catalog pieces, editable temporary drafts and local monster calculations. Save and stored-art uploads require sign-in; bounded tab recovery carries drafts through sign-in without saving or publishing automatically. Private content, history and server writes retain their existing access checks. Local guest browser checks pass. The creator approved the main/production release; record hosted verification separately. Other protected tool routes are outside this change.

- [ ] **Character PDF generation — implemented, release approved, 23 October 2026:** local Download PDF and Print use authorized character data, twelve coordinated styles, Auto/Normal/Dense, Portrait/foldable Landscape, remembered choices, supporting pages and optional workbench. The gallery uses real loaded previews; its orientation/density controls are the export settings. Markdown, saved portraits, heritage art and actual grayscale entity icons are included. App fonts are embedded and changing fields remain writable. Public/owned/shared roster exports and the sheet drawer are checked. Production packaging and reconciliation with current main are prepared in an isolated release export. The creator approved publication to main/production after the protected preview build. See [implementation and verification](publications/character-pdf-local-implementation.md). Paper/pencil/fold and native print-dialog review remain for printer access Monday. The separate [Aegis print pack](marketing/character-sheet-itch-pack.md) is already published on Books, the creator kit and itch.io; regenerating those static files with the latest renderer is a separate follow-up.

- [x] **Character PDF save/practice alignment, 23 October 2026:** implemented measured adjacent label/value cells, centered signed values and inset padding for all twelve styles, portrait/landscape and normal/dense fronts. Verified 144 actual-font cases with positive/negative and multi-digit values. Final four review PDFs pass independent closed-file checks across 32 pages. Physical print review is part of the release follow-up above.

- [ ] **Private distribution of creator-made content — deferred, 21 October 2026:** explore selling or sharing characters, monsters, encounters and related creations as export files from private platform records. A recipient could import an independent copy into their own account, private by default, with no automatic public Library publication. This is an idea to investigate later, not an implemented feature or a chosen enforcement design. Creators may also distribute pen-and-paper or other digital products without the platform. Before implementation, decide file format/versioning, bundled versus referenced primitives/effects/capabilities/heritages/items, dependency permissions, original attribution and provenance, recipient ownership versus source authorship, account authorization and safe import validation. Private visibility is not DRM or a promise that copying can be controlled. Preserve existing CC BY reuse rights; any separate creative-asset licenses, commercial delivery and future store terms need their own review. No export/import UI/API, marketplace, payment flow, license lock or enforcement mechanism is commissioned now. Coordinate with the separately deferred general entity JSON interoperability work.

- [ ] **Website rights/support information:** concise open-system explanation, attribution/link examples, voluntary Buy Me a Coffee invitation and clear per-product rights. Keep every official playable option free, including mechanics introduced in future paid adventures. Add public website wording when the policy and book releases are ready.
- [ ] **First adventure/starter offering:** original story, maps, handouts, prepared encounters and linked platform collections. Choose free/pay-what-you-want/fixed-price for each product later. Private friend-to-friend sharing and onward private sharing are intended; coffee support is voluntary.
- [ ] **Native SwordWeave bookstore:** official digital books/adventures/atlases, product previews, purchase/receipt/download flows and collection links. External storefronts are optional interim tools, not a permanent architecture requirement. Decide payment, seller setup, regional/tax handling and delivery before implementation.
- [ ] **Creator sales, if desired:** authors retain their work; permit compatible commercial products with required attribution/system/license links. A future store needs explicit hosting/selling permission, creator terms, optional commission decisions, payout handling and moderation. Do not impose a royalty for merely using the open rules.
- [ ] **Print editions and retail distribution:** print-specific masters/proofs, manufacturing costs, pricing, inventory/fulfillment, wholesale/consignment and bookshop/hobby-store arrangements. Digital core books remain free. Authorized store distribution is separate from private reader sharing; respect existing open licenses and applicable physical-copy resale rights.
- [ ] **Complete rights/provenance inventory:** existing MIT/CC grants, reusable engine/platform boundaries if still desired, AI illustration provenance, human edits, font/icon/reference-asset notices and contributor permissions. Record actual generators/models where known; do not promise exclusive copyright over purely AI-generated expression.

## Other previously deferred phases

- [ ] ChatGPT app/MCP character creation, grouped with general entity JSON interoperability: concept discussion, canonical or validated newly authored options, signed-in account saving and a sheet link. Build on existing character/session synchronization.
- [ ] Broader GM workspace: campaign notes, maps and VTT-like features after the focused encounter workflow.
- [ ] Historical R2 archival/cleanup only as a separately scoped task; preserve required files and existing asset paths.

No bookstore, checkout, retail agreement, new account type or paid mechanics gate is implemented by this document. No local development server is needed for this planning work.
