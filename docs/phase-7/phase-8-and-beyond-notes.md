# Phase 8+ — Carryover Notes from Phase 7 Closeout

Created: 2026-07-16, end of Phase 7 Q-B closeout. These are
**deferred items** that were intentionally not built during Phase 7
because they need Phase 8's design decisions or character-sheet
context. Pull from this doc when Phase 8 opens.

---

## From Phase 7 closeout (per user 2026-07-16)

### 1. Phase 8 — Full D: character-sheet rendering during play

The **/sandbox/characters** page (and any character-creation flow)
does not yet render condition badges next to applied modifiers.

When a player has a modifier with `target-below-half-hp`, no badge
appears in their active sheet — the modifier is applied (engine
returns `true` for v1), but the condition is invisible to the player
during play.

The reusable `<ConditionBadges>` component already exists at
`src/components/library/condition-badges.tsx` and drops in. The
hard part is **deciding when a condition is active**, since v1
doesn't have an engine evaluator. Strategy TBD when Phase 8 opens.

Also: **DM-side condition tracker.** No way for a DM to track
which conditions are currently active for a target / scene / actor.
The condition is purely an authoring hint on the modifier
description today.

### 2. Phase 28 / probably-never — engine routing for v1 preset keys

When evaluation opens, pick a strategy:
- LLM-assisted adjudication (parse narrative + current scene state)
- Manual DM toggle ("this target is bleeding right now")
- Hybrid: presets auto-trackable (HP thresholds), narrative always
  manual

**User note (2026-07-16):** "Waaaay later probably never or like
phase 28 doesn't matter keep notes." Treat as low priority.
Skip from active backlog unless user reopens.

### 3. Phase 8 — custom pills engine-addressable?

Right now they're display-only. If a future preset catalog expands
to cover author-added pills (via a permissioned registry), the
engine needs to know about them.

**User note (2026-07-16):** "In phase 8 in guess."

### 4. Phase 8 — BU cost of conditions

A modifier's BU cost doesn't change if it carries a preset. Open
design question.

**User note (2026-07-16):** "In Phase 8."

### 5. ASAP — snapshot shape gap

`formSnapshot.primitiveIds` doesn't carry per-id `isMirrored`, so
the **item-form's snapshot path** can't show MIRRORED badges while
the user is actively editing. DB-row path works. Fix = widen the
snapshot shape to include `mirroredPrimitiveIds: number[]` next to
`primitiveIds`. ~30 min.

**User note (2026-07-16):** "Snapshot you mean versioning and
forking? We should fix that if so asap."

**WAIT — ambiguity to resolve before fixing.** User may be
referring to:
- (A) the **form snapshot** captured during sandbox editing (the
  in-memory snapshot used by the preview pane), OR
- (B) the **versioning/forking system** (content_hash, fork
  lineage, save intent — see `src/lib/versions/` and
  `src/lib/publishing/`)

Read user's intent carefully before assuming. The mirror-badge
preview bug is (A). The user's wording ("versioning and forking")
suggests they may be thinking of (B) — which is a much bigger
issue if snapshot-based previews drive versioning decisions.

**Action for Phase 8 planning:** clarify which "snapshot" they
mean. If (A), it's a trivial 30-min fix to item-form. If (B),
it's an architectural decision about whether form snapshots should
participate in content hashing at all.

---

## Phase 7.5 (new — proposed scope, not yet started)

**Scope:** rebuild primitive / capability / effect / template
systems; rebuild DB entries of primitives properly with mirroring,
modifiers, and conditions.

**Mirrorability rule (chirality):**
- Only primitives with a modifier are mirrorable.
- Domains / verbs / other primitives without a modifier are NOT
  mirrorable.
- The Mirror checkbox visibility in the preview should be driven
  by this rule (auto-hide when the primitive has no modifier).

**Per-primitive rebuild tasks:**
1. Take each primitive and rebuild from scratch with:
   - Proper triggers (conditions)
   - Conditions
   - Modifiers
   - Mirroring (where applicable)
2. Domains have none of the above — they are pure namespace
   primitives and should NOT show mirror/condition controls.

**Workload estimate:** depends on primitive count. Need to query
the DB for the count and categorize by type (modifier-bearing vs
domain/verb).

---

## Open questions for Phase 7.5 kickoff

User (2026-07-16) asked to be asked a set of questions before
planning Phase 7.5. See Discord thread for the actual list —
capture them in the planning doc when the conversation continues.