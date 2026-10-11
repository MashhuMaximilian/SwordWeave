# Encounter preview and local character editor handoff

11 October 2026. Scoped refinements of SwordWeave’s incumbent gold, silver and teal interface. This records implemented behavior and session verification; it does not establish a new visual identity or global design specification.

## Scope and delivery status

- **Encounter preview:** a readable dossier with Briefing, Creatures, Budgets and Your runs sections, an accessible creature cast, and persistent run actions. The reviewer’s single finding—an incomplete opposition total still producing a chart fill—was corrected. The scoped preview was rated **ship**.
- **Character editor:** a local proposal with editing tasks, a budget ledger, and Edit / Library / Numbers & preview panels. The reviewer found three issues; the fixes and refreshed captures were approved as a local proposal. The prototype must remain **unpushed**.
- No deployment has been performed. Screenshots in `tmp/` are untracked local evidence, not distributed artifacts or deployed output. No actual account character was edited during verification.

## Reused visual language

The source of truth remains `src/app/layout.tsx`, `src/app/arcane-materials.css`, `src/app/v12.css` and `src/app/character-workshop.css`. The feature styles consume their tokens; they do not introduce another palette or font system.

| Token / role | Light | Dark |
| --- | --- | --- |
| `--background` / page and sticky controls | `#dbe6e1` | `#071116` |
| `--foreground` / primary text | `#142e31` | `#f0f2e9` |
| `--muted-foreground` / captions and status | `#405b59` | `#bfcec6` |
| `--secondary` / quiet hover and inset areas | `#d4e3de` | `#173238` |
| `--primary` / control borders and editor focus | `#126668` | `#82d4c3` |
| `--sw-text-teal` / readiness, guidance and ledger emphasis | `#126668` | `#a8e6d7` |
| `--sw-text-gold` / workshop controls | `#684711` | `#f3db9d` |
| `--border` / dividers and tracks | `#718c81` | `#54736c` |

`--sw-metal-gold` retains the shared 125-degree metallic gradient (`#b68b3f`, `#e8c47a`, `#fff3bb`, `#ceac60`, `#e7c780`, `#ad813c`, `#f2d994`) for selection and commitment, with dark ink. `--sw-inset-fill` supplies workshop control surfaces. `--v12-instrument-edge` supplies the existing silver / gold instrument dividers. The preview’s Item BU segment uses a silver gradient (`#6e8589`, `#d8e3e3`, `#ffffff`, `#82999e`, `#edf5f4`) distinct from gold creature / progression BU.

The loaded families are **Unica One** (`--font-v12-title`, headings), **Syne** (`--font-v12-system`, interface text), **Aubrey** (`--font-v12-body`, narrative copy), and **IBM Plex Mono** (`--font-v12-technical`, quantities and ledgers). Existing Oxanium remains available as the app subtitle family; these feature styles do not introduce it as another new role. Preview V12 title / narrative sizes are 28px / 19px on desktop and 21px / 16px below 600px. The local proposal title is 30px on desktop and 21px on phone. Small corners (2–5px), fine dividers and inherited metal button depth continue the existing workbench language.

## Interaction states

| State | Encounter preview | Local character proposal |
| --- | --- | --- |
| Default / selected | Briefing opens first; muted tabs become gold when selected. Existing run actions remain at the bottom. | Your character opens with task choices; selected task is gold. Panel selection uses `aria-pressed`; existing global selection styling applies. |
| Hover | Inactive tabs use the secondary surface and primary border; run names underline. Metal actions inherit shared control styling. | Task rows use secondary fill and a visible border; panel borders use primary. Shared sheet buttons brighten by 15%. |
| Keyboard focus | Buttons, links and disclosure summaries receive a 2px teal outline, offset 3px. | Proposal buttons receive a 2px primary outline, offset 2px; fields retain shared focus styling. |
| Disabled | Buttons use 50% opacity and a blocked cursor. Rules preview is disabled when the modal stack cannot accept another entry. Existing run action eligibility remains authoritative. | Existing busy, recovery, history and permission gates disable draft actions. Undo needs pending operations; Redo needs available history; applying needs net changes and no pending recovery. |
| Loading / failure | Authentication and data loading expose `aria-busy`, a status message and three quiet skeleton blocks. Fetch errors expose an alert and Try again. | Existing draft statuses describe saving, checking and applying. The fixture shows Opening the local proposal before mounting. Draft errors, recovery and check / save progress retain the existing review UI. |

Navigation uses native buttons with labeled navigation regions and visible state attributes. The budget table carries the same information as the decorative chart, whose tracks are hidden from assistive technology. Empty notes and empty runs have explanatory states and a useful next action where applicable.

## Layout and narrow screens

The preview is container responsive: at 700px it uses a two-column briefing with the opening, objective and shared round spanning both columns. Tabs and run actions remain sticky. Below 430px, tab icons disappear, cast portraits reduce and text tightens; below 600px, padding and narrative sizes reduce. The ledger scrolls within its own wrapper when needed.

The local editor uses page scrolling and a sticky 220px task rail; the rail becomes 180px below 900px. Below 767px, tasks form a horizontal scroll strip, root cards become one column, and the three panel controls occupy a full row. Review remains available in the phone heading and sticky draft footer. The footer includes the existing Undo / Redo controls and review count, with right padding to accommodate the app’s floating control. Phone foundation forms reserve 90px below the form; the floating control is docked 8px from the bottom beside the reserved footer area, keeping helper text clear. The editable form stays mounted while Library or Numbers & preview is shown, preserving unfinished values across panel switches.

## Preserved rules and data mechanics

- Encounter loading stays account scoped: the component resets by viewer and encounter ID, accepts initial data only for the initial viewer, and otherwise fetches `/api/encounters/{id}` without caching, with cancellation. Private unavailable creature names, portraits, tactics and rules are hidden.
- Creature previews use the existing modal stack and pass the exact pinned template ID and version. Quantities contribute to separate creature and Item BU ledgers. Inaccessible references make totals incomplete: the opposition chart is 0%, totals / ratios / differences show unavailable values, and the UI explains why. BU comparisons retain the warning that totals alone do not determine difficulty.
- Starting and resuming use the existing `EncounterActions` and saved run routes. Fresh private sheets, existing run state, shared preparation, ownership, authentication and action eligibility continue through the existing implementation.
- `encounterBriefing` recognizes existing preparation headings, preserves custom prose and unknown paragraphs, and renders through the existing narrative Markdown component. It does not rewrite source notes.
- The proposal wraps `CharacterBuildWorkspace` and its existing `useCharacterDraft` controller. Staging, local recovery, Undo / Redo, draft checks, review, collaboration, apply and discard follow the current paths. Owner / Editor / Suggester / Viewer permissions remain enforced; a Viewer cannot enter the build branch, and a Suggester does not receive the direct Save & return to play action. Current vitality and other play state stay separate from reviewed build changes.
- Task and play navigation retain the unfinished-form guard. Foundation changes stage through the existing character operation. Review now returns an unfinished foundation to Edit with a notice to add those changes to the draft or close the form. Primary Library replacement always uses the navigation guard, then clears the foundation and opens its replacement in Edit. The proposal has no separate save API.

## Local access and verification

The isolated route is **`/dev/character-editor`**. It returns not found outside development. Its fictional character is **Lyra, the wayfinder**. The fixture intercepts only that fictional character’s API prefix in the browser: supported GETs return local data; mutations return 409; unsupported fixture actions return 404. Other requests retain normal behavior and the fetch wrapper is restored on unmount.

The real character sheet can show the proposal in development at **`/characters/{id}?editor=guided`**. That query uses the real character’s existing permission and draft paths; it is not the isolated fixture. No real account changes were made to exercise it.

Session evidence supplied for this handoff:

- Browser checks at **1440 × 1000** and **412 × 915**, in dark and light themes, found no page overflow. Nested monster inspection used the pinned version. A mocked inaccessible template hid its name and produced a 0% opposition bar.
- The fictional identity survived a Library round trip. Stage, Undo and Redo were confirmed without editing an actual account character.
- Character review found that Review could discard unstaged foundation fields, primary Library replacement did not clear or guard the foundation, and the phone floating control overlapped final helper text. The local fixes described above address those paths. Browser verification preserved an unfinished name during Review; refreshed desktop and both phone-theme captures passed the scoped reviewer check. Authenticated account saving has **not** been tested.
- Typecheck passed. **21 existing local draft, history and encounter tests passed.** Changed-file ESLint passed apart from two pre-existing effect warnings in `character-workspace.tsx`; they were not introduced by this scope.
- Local screenshot evidence includes `tmp/encounter-preview-desktop-briefing.png`, `tmp/encounter-preview-desktop-creatures.png`, `tmp/encounter-preview-desktop-budgets.png`, `tmp/encounter-preview-desktop-light.png`, `tmp/encounter-preview-phone-briefing.png`, `tmp/encounter-preview-phone-budgets.png`, `tmp/encounter-preview-phone-light.png`, `tmp/encounter-preview-phone-unavailable.png`, `tmp/character-proposal-desktop-overview.png`, `tmp/character-proposal-desktop-identity.png`, `tmp/character-proposal-phone-identity.png`, `tmp/character-proposal-phone-abilities.png` and `tmp/character-proposal-phone-light.png`.

An isolated Turbopack production build of the staged preview and documentation passed. No deployment is claimed in this pre-release handoff. This documentation pass inspected the feature sources and recorded the supplied browser / test evidence; it did not rerun tests or mutate the server. Unrelated working-tree changes are outside this handoff.

## Publication follow-through

The next publication phase is recorded in [the full edition production plan](../publications/full-edition-production-plan.md). The current PHB, GM Guide and SRD remain compact alpha editions (42 / 34 / 33 pages). The planned illustrated PHB and GM Guide and complete digital SRD are future work; the plan does not claim those manuscripts or print masters already exist.
