# Agreed rests and v0.1 alpha — verification

10 October 2026. Creator-approved follow-up to the publication rule reconciliation.

## Changes

- Short-rest recovery is a finite half-maximum allowance, rounded up, between completed long rests. Only actual healing spends it; unused points persist.
- Completed long rests refresh the allowance, including when the table records partial healing or no healing at full Vitality.
- Shared character/private-creature controls ask for the table-agreed amount. Recovery and allowance assignments share a revisioned operation, offline queue and conflict decision.
- Character rest history records rests even when no Vitality changes. The legacy authenticated rest endpoint uses the same recovery calculation.
- Ordinary equipment uses one slot, two-handed equipment two, and higher authored requirements remain authoritative. Size still affects Load rather than multiplying slots automatically.
- Guide wording records accepted stacking dice, targeting, movement, recovery and contextual upkeep. Damage-triggered upkeep/reset remains explicitly undecided and is not automated.
- A shared **v0.1 alpha** label sits beside the homepage-navigation and FAB wordmarks.

## Checks

- 62 focused tests pass across five files: recovery (8), client synchronization (15), encumbrance (28), mutation model (7), authenticated character play-state route (4).
- Production build includes TypeScript checking. Final build excludes the disposable UI fixture.
- Firefox UI review used the actual shared rest component and synchronization client with intercepted fixture API responses. No personal character, real creature or database record was changed for this UI review.
- At maximum 13/current 10, the dialog defaults to 3 healing, producing current 13/used 3/remaining 4. After further damage to 9, the next rest defaults to 4, producing current 13/used 7/remaining 0.
- A partial long rest restoring 1 at current 9 produces current 10/used 0/remaining 7.
- Offline restoration of 2 queues one operation; reconnect saves it with current 12/used 2/remaining 5. Automated synchronization tests cover additional conflict/account/cache cases.
- Negative recovery disables submission. Escape dismisses the dialog and returns focus to Short rest.
- Phone-width light/dark screenshots and desktop private-creature dialog were inspected. No horizontal overflow at 412 × 915 or 1440 × 900. The dialog has bounded viewport height and internal scrolling for short screens.
- Homepage and FAB badges show the same text, 9px at 412px/desktop and 8px at 320px, without horizontal overflow.

These are local desktop-browser simulations and shared-component checks, not a claim of testing two physical devices or a personal-account end-to-end rest. The original large-suite results remain historical; this is a focused follow-up.

The local Next development watcher failed with file-limit errors. A production server launched with an appropriate process file limit supported review. Review servers are stopped at completion. No migrations or artwork changes are required.
