# SwordWeave finishing pass — 4 October 2026

## Outcome and scope

Tasks 1–8 are implemented locally as one teaching and interface refinement pass. The goal is a usable first character and first session for a new player, with a shared visual language across public pages, creation, Library, Atelier and the sheet. Task 9 remains a hosting decision; no hosting configuration or assets have been migrated.

## Implemented work

1. **Beginner play guide:** a sequential reading path starts with the shared tabletop conversation, DM and party, dice notation and a complete check. Optional definitions and examples cover attributes, practices, reusable primitive ownership, mirrored use, improvised capabilities, progression beyond level 20, Strain, CV, upkeep, interruption, cover and contextual conditions. Search includes the optional explanations. See the [source and rules audit](play-guide-beginner-audit-2026-10-04.md).
2. **Creation as onboarding:** both creation paths explain starting access and recommend leaving BU available for later ideas. Quickbuild introduces drawbacks before heritage selection. Help explains buying or inventing primitives during play, with the table's agreement, and suggests a more forgiving starting level for new players.
3. **Compact mobile creation:** the persistent budget dock becomes one small row, with an expandable detailed ledger. Remaining budget and DM review state stay immediately visible; Quickbuild also shows the separate item budget, with its full ledger available on the smallest screens. Portrait controls, heritage summaries, package cards and drawback cards use compact layouts rather than large empty blocks. The FAB clears the collapsed dock and is temporarily hidden while its ledger is open.
4. **Atelier workspace and character workshop:** the redundant top navigation is removed. Tablets and sufficiently wide landscape phones use three resizable work surfaces. Column container queries adapt editor fields and headers. The character modal has a fixed header, compact tabs, independently scrolling content, a budget rail and clear creation action. Story sections and component rows expand; component names open the existing Library preview above the workshop.
5. **Shared materials:** semantic theme tokens unify surfaces, text and inputs. Shiny gold identifies selection and commitment. Metallic teal frames exploration, controls and work surfaces. Silver retains a supporting role for neutral readings and metal objects. Native selection options receive theme colors.
6. **Navigation and interaction:** the public mobile close control uses a centered X. The FAB has shorter labels and matching masked game icons, including Play guide and Buy me dice. Actual preview triggers gain a restrained iridescent glass edge and lift, with keyboard focus and reduced-motion support.
7. **Light theme:** ordinary dark fills and pale text in older public pages, character drawers and phone sheet sections now use semantic materials. Light surfaces use readable dark ink, teal and ochre; mechanical descriptions retain a warm contrasting color, including selected rows.
8. **Public explanation:** the home page, walkthrough, character introduction, rules and combat pages reflect the current creation paths, ownership model and shared party combat plan.

## Validation and limits

- The final production build and TypeScript check passed, including the converted workshop and phone styles. The terminal log is `tmp/finishing-pass/final-build.log`. Two subsequent selected-text color adjustments were CSS-parsed and contrast-checked; they do not change types or application behavior.
- Focused checks passed: 44 creation/budget/Quickbuild tests, 41 character-modal tests and 4 guide-search tests.
- Full working-tree suite: 2,723 passed, 149 failed, 15 skipped. All 149 failing test identities also fail at the previous committed version; the comparison found no newly failing tests. Existing failures include database fixture suites, three historical recipe-card assertions and a clone-route authentication mock. The full suite is not green.
- CSS parsing and `git diff --check` passed. Scoped lint retains historical effect-state and image/hook warnings; the touched integration files have no errors with the existing effect-state rule excluded.
- Desktop checks were made during implementation. Final mobile/tablet/light-theme visual validation could not be completed: the browser tool's security policy rejected local navigation. No alternate browser or raw automation workaround was attempted. These renders still need an interactive review; code/build checks are not a substitute.
- This pass does not change the rules engine or production database, and has not been pushed or deployed.

## Hosting decision

See the [hosting assessment](image-hosting-assessment-2026-10-04.md) for the inspected Vercel Hobby usage, current asset footprint, public/private image delivery constraints and official pricing sources. The recommendation is to retain Vercel for the app and use Cloudflare R2 for the growing public artwork catalog, with private uploads kept separate. Keeping Vercel and reducing verified-unused deployment assets is the simpler immediate alternative.
