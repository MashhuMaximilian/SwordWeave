# SwordWeave ChatGPT companion delivery plan

Updated 2026-11-25. The detailed build plans cover [character creation](chatgpt-companion-phase-1.md), [existing-character editing](chatgpt-companion-phase-2.md), [in-session help](chatgpt-companion-phase-3.md) and [monster companions](#phase-35-monster-companions). The product sequence and ten review decisions come from the companion design and follow-up notes. See the [November 23 Stage 9 review](chatgpt-companion-full-stage-9.md) for the verdict on the earlier plan.

| Phase | What a player can do | Release depends on |
| --- | --- | --- |
| 1. Character creation | Turn a conversation into a private SwordWeave character, create or reuse its pieces, download the standard character-sheet PDF, and export future progression ideas separately. | Verified Clerk linking and access, permission-aware rules and catalogue tools, a save tied to player approval, safe retries, and both PDF downloads. |
| 2. Existing-character editing | Open an authorized character, review and apply or propose changes, and approve an exact level advancement as the owner. | Phase 1 identity and review foundations, plus revision-aware preview, existing draft and proposal permissions, and verified advancement accounting. |
| 3. Notes, consequences and in-session help | Ask about play, record a note or consequence, and make approved changes during a session using existing permissions and rules. | The shared foundation and Phase 2 build review, plus current play-state checks and verified per-action permission and replay behavior. |
| 3.5. Monster companions | Open an authorized monster companion's play sheet and export the character with its accompanying companion pages. | Phase 3 and verified website companion permissions, play state and print output. |

## November 24 platform requirements

- **Markdown prose.** Phase 1 preserves formatted backstory, descriptions and progression text, Phase 2 preserves formatted edits and proposal prose, and Phase 3 preserves formatted notes and consequence descriptions. Review and authorized read-back carry the same Markdown across each workflow. Compact fields and structured values keep their own formats. The platform work covers Atelier, character sheets, and other prose fields beyond the companion. [Platform Markdown plan](user-authored-markdown.md)
- **Monsters as character companions.** Players add or remove companions in character sheet Edit mode using existing Bestiary templates. Each individual has a pinned play copy with its own Vitality and consequences, a Bestiary reference, and a dedicated page in the character's Print or Download PDF output. Phase 3.5 integrates that website feature into the ChatGPT journey. [Platform monster-companion plan](character-monster-companions.md)

These requirements were added after the November 23 Stage 9 review. The isolated Clerk connection is still the first ChatGPT implementation milestone. The platform work is tracked in [SwordWeave's next-work index](../next-work.md#platform-feature-follow-up--24-november-2026).

## Shared implementation and release rules

- **Identity and access.** Use the verified Clerk subject and its active SwordWeave account. Resolve authorization on each tool call and again where a write commits. OAuth establishes identity and scope. Character sharing, creation visibility, and the permission required by each existing operation determine what the account can read, suggest or apply.
- **Review and write.** Conversation, preview, saved draft, submitted proposal and applied state are separate player-visible outcomes. Before a write, show the exact subject, changes and known effects. Bind approval to the actor, subject and immutable reviewed payload, including applicable revisions and version pins. A material change invalidates the review. Use the authenticated SwordWeave review page for staging while separately verifying an in-chat approval action.
- **Reuse and data.** Use existing SwordWeave services and extract a narrow, actor-aware server function where an operation is available only as an HTTP handler. Keep website entry points compatible. Use an explicit response projection instead of passing raw rows or workspace graphs to ChatGPT. Verify provider handling and give the player the agreed notice before using real private data. Start with synthetic fixtures.
- **Recovery.** Reuse the appropriate operation receipt and concurrency check where its semantics fit. Phase 1's private 90-day save recovery record covers its coordinated creation attempts. Later phases retain their own draft, proposal and play-state lifecycles. An unreadable or uncertain outcome requires read-back before retry. Show draft, confirmed, conflicted and failed outcomes explicitly.
- **Rollout.** Enable read and write tools independently for each release. Verify the existing website journey in staging and test a Free account on each intended surface before claiming support there. Keep text responses actionable when a card is unavailable. A rollback disables the affected companion tools and preserves saved characters, drafts, approved changes, notes and game state.

### Tool and approval contract across phases

Run one companion in the existing app. Phase 1 owns the transport, identity, review route, coordination tables and the shared `get_operation_status({ operationId })`. Dispatch on the stored kind before resolving a payload or receipt. Prepare and execute require the global write flag, the applicable phase write flag and scope, and the current native action permission. The staging browser review uses the same write flags and permission with its authenticated Clerk session. Preview and status require the global read flag, the applicable phase read flag and `swordweave:read`. Preview checks the proposed action's role. Status checks the operation actor and current subject read access, and returns kind, state, expiry, allowed next action and the currently permitted receipt projection. Return `UNAVAILABLE` for unknown, inaccessible or expired IDs and for an execute tool called with an unrelated operation kind. A resolve through another tool never bypasses a disabled group.

| Stored operation kind | Additional phase flags | Write scope |
| --- | --- | --- |
| `character_create`, `progression_pdf`, `progression_note` | Global controls | `swordweave:create` |
| `character_edit`, `character_advancement`, `character_proposal_submit`, `character_proposal_decide`, `character_version_proposal_submit`, `character_version_proposal_decide` | `MCP_CHARACTER_EDIT_READ_ENABLED`, `MCP_CHARACTER_EDIT_WRITE_ENABLED` | `swordweave:edit` |
| `character_piece` | `MCP_CHARACTER_EDIT_READ_ENABLED`, `MCP_CHARACTER_EDIT_WRITE_ENABLED` | `swordweave:edit` and `swordweave:create` |
| `session_note`, `session_play_action` | `MCP_CHARACTER_PLAY_READ_ENABLED`, `MCP_CHARACTER_PLAY_WRITE_ENABLED` | `swordweave:play` |

**Preparation and replacement.** Return `{ operationId, summary, approvalUrl, expiresAt }` and any permitted same-origin result links. Persist a versioned, server-resolved immutable payload and its SHA-256, the actor's internal UUID, and the kind and subject. The subject is the character UUID, the native proposal ID paired with its character UUID for a proposal decision, or a random draft series UUID for initial creation and progression PDFs. Every prepare accepts optional `supersedesOperationId`. Under the old operation's row lock, replace only an unexpired operation of the same actor, kind and subject in `pending_approval` or `approved` with no committed outcomes. Creation and PDF revisions inherit the server-assigned series from that predecessor. Invalidate its nonce and approval atomically with inserting the new row. A partly completed creation stays recoverable and cannot be replaced through this parameter. A prepare without an explicit predecessor creates an independent review.

**Staging approval.** The private GET review page resolves the signed-in actor and current action permission and returns private no-store content. For a pending review it issues a random 32-byte nonce, stores its SHA-256 and the expiry of ten minutes or the operation deadline, whichever comes first, and puts the nonce and review digest in the confirmation form. Refresh replaces the nonce. The POST requires exact configured Origin, Clerk session, operation UUID, nonce and digest. Under the operation lock, recheck the flags, actor, action permission, state and deadlines, compare both digests in constant time, consume the nonce and transition once to `approved`. Use a 303 to the review status page on success. A repeated POST can read the existing status without a second approval. This transition performs no character write. A separate authorized execute call presents only the operation UUID.

**Host approval gate.** In a synthetic staging chat, exercise one tool action after preparing an immutable operation. A reliable server-verifiable ChatGPT user action must bind the specific operation, its digest and the linked actor. Test decline, wrong actor or bound digest, supersession, concurrent confirmation, and deliberate loss of the tool response. Verify the same approval path with a text-only client. Record the trusted approval source server-side. Isolated staging can execute a browser-approved operation to exercise the save. Companion domain commits on real data require a verified host-bound approval. Keep each public write group off until that verification passes for its action envelope.

**Lifetimes and receipts.** Pending operations expire 24 hours from preparation, with a one-hour exception for progression PDFs. An approved Phase 1 character creation expires after 90 days of inactivity measured from approval or the last newly committed step. Other approved operations keep their original execution deadline. Retain minimal terminal receipts for 30 days after completion or a terminal conflict on single-action operations, and keep PDFs and their status for the original one-hour lifetime. Reads and receipt replays never extend expiry. Discard unused proposal prose and one-time approval material at terminal transition. Preserve native drafts, proposals, notes, game history and native play receipts. After companion receipt expiry, reconcile via an authorized current read before preparing another operation.

**Write ordering.** As the top-level owner of `withDatabaseTransaction`, issue `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` before any queries. Lock the operation, the character if present, the publishing advisory lock if relevant, then the operation's native state rows. Issue a fresh linked-account, role and dependency check after acquiring those locks and before any domain write. Update the receipt and domain rows atomically. Coordinate character grants and revocation with `withCharacterMutation`. Require follow/unfollow, explicit publish/unpublish and visibility with its legacy-bit synchronization to take the existing publishing lock inside the same transaction and before any per-target locks or visibility writes. Inventory other writers of the same predicates at the selected release SHA. A committed access change before the locked authorization check must be visible. A later competing share, follow or publishing change waits for the held lock and orders after the write. Verify both orderings with two transactions and keep the affected write disabled until its writers and tests are accounted for. Replays return the original permitted receipt and label any newer read-back as current state.

In the first interleaving test, hold the character or publishing lock in the website transaction. Start an approved companion execute and verify it is waiting on that lock. Commit share revocation, unfollow or unpublish in the website transaction, then assert the resumed execute records no domain changes. In the reverse order, hold the companion after locked authorization, start the relevant website access change, and assert it waits until the companion commits. Recheck the resulting subject and receipt from a third connection after both finish.

## Phase 1. Character creation

The player can talk through a concept before invoking the app, adjust its recap, choose optional backstory or portrait guidance, browse public, owned and eligible followers-only creations, and preview a build using SwordWeave rules. They can create or fork supported pieces, save a valid partial or complete character privately, and download the regular SwordWeave character-sheet PDF. The separate progression PDF contains future ideas. Adding those ideas to the sheet requires separate approval and the relevant permission.

| Milestone | Build and verification |
| --- | --- |
| 1. Authenticated connection | Put the MCP route in an isolated staging environment. Link two synthetic Clerk users to separate SwordWeave test users. Verify scopes, token issuer and audience, expiry, revocation, account mapping and reconnect. Use an isolated read/write fixture. |
| 2. Rules, discovery and preview | Return bounded, sourced rules and viewer-authorized catalogue results. Start the build with verb tier, domain, range and die type. Show free baselines, selected component versions, missing choices and the impact of optional mirrored drawbacks before any write. |
| 3. Review, save and recover | Bind approval to the reviewed proposal. Use existing authoring and character services to execute ordered, version-pinned steps with durable receipts. Verify expiry, response loss, duplicate retries, permission changes and partial failure. |
| 4. Character-sheet PDF, progression PDF and release | Download the saved sheet with the website renderer and export choices. Produce the approved progression PDF through a separate owner-checked download. Test both downloads, the complete private character journey and website regressions before rollout. |

**Exit evidence.** A Free-account test player can link a real staging account, find an allowed component, preview and explicitly approve a private save, reopen the resulting sheet, retry a lost response without duplicate objects, and download both the native sheet and the separate progression PDF. A test player with insufficient access sees a denial before private data is returned or a record is changed. [Detailed build, source files and test commands](chatgpt-companion-phase-1.md)

**Evidence already recorded.** The private Free test verified Clerk linking for two fictional accounts, catalogue and card previews, an incomplete draft, and a private save with a same-step retry. Staging confirmed the regular character-sheet PDF matched the website export and the separate progression PDF downloaded. The test used the exact-operation approval with a verified Clerk session. The temporary HTTPS sign-in widget stalled, so the interactive sign-in return, server-verifiable in-chat approval and public directory eligibility remain open. [Free-account test results](chatgpt-companion-free-account-check.md) · [Staged save evidence](../integrations/chatgpt-character-companion.md#november-25-free-character-creation)

## Phase 2. Existing-character editing

The [Phase 2 build plan](chatgpt-companion-phase-2.md) defines tool inputs and outputs, exact character selectors, apply and proposal roles, transaction behavior, source files and tests.

**Player journey.** The player selects an accessible character by ID or from their authorized roster. ChatGPT shows the sheet in context and discusses changes to the character's foundation or build. It prepares a before-and-after review with the affected slots, version pins, budget effects and unresolved rules questions. An owner or editor can apply a supported draft under the existing workspace rules. A suggester can prepare their own draft and submit a proposal for the owner to decide. A viewer can discuss only the sheet details they can already read. The player can reopen the result or proposal on the SwordWeave website.

| Milestone | Required handoff |
| --- | --- |
| 2.1. Open an authorized character | A player selects an owned or shared character and sees only the fields and slots they are allowed to use. |
| 2.2. Review an edit | Compare foundation or supported build changes with the current sheet, with exact selectors, version pins and a budget delta. |
| 2.3. Apply or propose | Verify a reviewed owner/editor write, a suggester submission and an owner decision. |
| 2.4. Reopen and release | Verify role changes, website concurrency and safe retries, then release read tools before writes. |

The staged implementation covers workspace proposals, supported existing-piece edits, and owner-reviewed creation of a private primitive or primitive-member capability on an existing character. Broader composition, player-directed forks and the separate version proposal flow use the release gates in the detailed plan.

## Phase 3. Notes, consequences and in-session help

The [Phase 3 build plan](chatgpt-companion-phase-3.md) defines the per-action permission matrix, play-state and notes adapters, replay handling, source files and tests.

**Player journey.** Open or explicitly select the character and ask a rules or current-state question. The guide states the applicable rule, the information it used, and any point that needs a table ruling. The player can approve a narrative note, a specific mechanical consequence, or a supported change to the character. After applying a change, the companion reads back the current result and the permitted history. Table rulings discussed in chat remain discussion until the player asks to record or apply a specific authorized action.

| Milestone | Required handoff |
| --- | --- |
| 3.1. Read play context | Exercise sourced rules, current Vitality and owner history, with no game-state writes from read tools. |
| 3.2. Record a note | Approve and append a note exactly once through the existing notes permissions. |
| 3.3. Apply a runtime action | Verify the reviewed current Vitality change, custom consequence, explicit resolution and eligible authored package. |
| 3.4. Use permanent editing during play | Reuse Phase 2's editing path with its own permissions and verify unchanged runtime fields. |

Level changes use the separate owner approval from [Phase 2](chatgpt-companion-phase-2.md#reviewed-level-advancement).

## Phase 3.5. Monster companions

Use the website's existing monster play sheet and Bestiary reference. Players attach and remove companions in character sheet Edit mode. Each attached monster has its own Vitality and consequences. Verify what each character collaborator can see, open the authorized play sheet from the ChatGPT journey, and confirm that every companion starts on its own page in the standard character PDF. [Platform design and tests](character-monster-companions.md)

## Verification gates

| Gate | Evidence required |
| --- | --- |
| Connection | Real Clerk staging link, verified claims and active account mapping, same-client reconnect and a two-account fixture with denial and retry checks. |
| Approval | A host-authenticated user action binds the exact immutable review to the intended actor. Verify in text on each intended surface before enabling the applicable public write group. |
| State changes | The relevant phase integration suite passes on the selected release commit. Include exact graph or play-state parity, revocation ordering, replay after a timeout and the matching website path. |
| Private data | Record provider transmission and retention behavior, the agreed player notice and the permitted projection before enabling private-data journeys. |
| Distribution | Record private Free staging, the full authenticated journey, supported surfaces and public eligibility as separate results. If public Free eligibility is unavailable, continue development on supported accounts while pursuing Free. |

The implementer records the release SHA, staging settings, test results and gate status in the integration guide. Read groups may progress independently. Enable a write group only after its authorization, host approval and state-change tests pass. A failed gate leaves that group disabled for release. The Stage 9 verdict identifies where implementation work can begin.

Creator-approved previews of followers-only creations from unfollowed authors remain unassigned. Encounter and campaign automation are outside the initial single-character session scope.
