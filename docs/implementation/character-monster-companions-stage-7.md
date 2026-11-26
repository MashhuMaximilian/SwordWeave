# Focused EGM review of monster companions

Reviewed 2026-11-24. Three fresh-context reviewers completed the Stage 7 pass on the [monster companion proposal](character-monster-companions.md). The design reviewer compared the existing monster records and their access checks. The structural reviewer checked the character draft and attachment lifecycle. The style reviewer checked how players would identify each destination and save their changes.

## Decision recorded after the review

The first release needs both the Bestiary reference and independent Vitality and consequences for every attached creature. It also needs a dedicated printed sheet for each companion in the character PDF. The [updated plan](character-monster-companions.md) uses existing pinned play copies and proposes the existing preview modal for the Bestiary action. It records proposed permissions and separate physical PDF pages.

## Options considered in the review

Use a live link to an existing monster's **Bestiary sheet** if the first release is for looking up its rules and details. This lets a character list several different monsters and open their sheets. The template already has a permission-aware preview and follows the current monster definition. List one attachment per character and monster template. A monster's updated rules appear when the player opens its sheet again.

If every attached monster must play as a distinct creature from day one, use one existing **pinned play copy** per creature. That lets two creatures of the same template track their own Vitality and consequences. The current play sheet is private to its copy owner. Decide who owns or creates the copy and who can open it when the character is shared before implementing that option. A version-pinned, read-only template is also possible if stable rules are required by themselves. [Template preview](../../src/app/monsters/%5Bid%5D/page.tsx) · [Template access and optional version](../../src/app/api/monsters/%5Bid%5D/route.ts) · [Owner-only play-copy access](../../src/app/api/monsters/copies/%5Bid%5D/route.ts)

## Findings for the implementation plan

| Priority | Finding | Proposed response for the Bestiary-link slice |
| --- | --- | --- |
| Blocker | A Bestiary reference and an independent creature open different sheets and have different sharing behavior. | Confirm the first-release choice above. Label its destination **Open Bestiary sheet**. |
| Blocker | Suggesters can enter Edit mode. Only owners and editors can apply a draft. | Show add/remove controls to owners and editors in Edit mode. Stage changes through **Review changes**, commit on **Save & return to play**, and revert pending changes on **Discard draft**. Suggesters and viewers see only permitted saved links. Attachment proposals can be scoped separately. |
| Major | A character share does not make a restricted monster or its components viewable. | Filter each attachment on the reader's current access to the character, template and required components, including public preview. During selection and commit, require an added source to be readable by both the applying editor and character owner. Show authorized editors a generic removable entry if a saved source later becomes unavailable. A direct Bestiary page uses its own authorization. |
| Major | Saving the visible list would erase hidden attachments. Undo currently restores build and foundation state. | Apply add/remove operations using scoped attachment IDs under the character revision and lock. Save attachment changes and their receipt together. Define attachment review and Undo before shipping the combined save. Remove links with the character, leave monsters available after detach, and define source deletion and clone/restore behavior before migration. |
| Major | Multiple templates, repeated saves and concurrent edits need distinct outcomes. | Test two different templates, a repeated selection of the same template, discard, mixed build rollback, retry after a lost response, and a stale second save. Test character share and monster access revocation separately. Compare the underlying character and monster records after each test. |

[Character mode and permission handling](../../src/components/characters/character-sheet-view.tsx) · [Workspace review and save controls](../../src/components/characters/workspace/character-build-workspace.tsx) · [Draft apply and Undo](../../src/lib/character/workspace/drafts.ts) · [Monster source checks](../../src/lib/monsters/composition.ts)
