# Phase 8.L Round 3 — Session Recap (2026-08-12)

**Author:** Senku
**For:** Mashu — full recap of everything we've done and what's next

---

## 1. Where we are — Phase 8.L "L" rounds (all post-Phase 8.K close)

Phase 8.L rounds 1-24 have been **character sheet polish**. The character sheet at `swordweave.quest/characters/<id>` is the primary surface for play. We made it shippable.

### L1-L12 (previous recap, pre-2026-08-10)

These were the engine math fixes (Phase 8.K + Phase 8.I post), condition evaluator, mirror chirality, formula modal etc. See `PHASE-8-L-ROUND-2-STATUS-2026-08-10.md` for the full list.

### L13-L20 (chain display + accordion work)

Fixed the provenance chain in modals/accordion headers. Each primitive's provenance chain now shows in this order:

```
[accordion] > [heritage] > [capability] > [effect]
```

The accordion name is OUTERMOST and only appears for inherited (non-direct) primitives. See commits `954956c`, `d628185`, `9f503ba`, `3ff3778` etc.

### L19 (modal inheritance fix)

**Issue**: Modal opened from inside the bottom drawer (encumbrance modal, etc.) didn't show accordion in the provenance chain — they were treated as if direct-slotted.

**Fix**: `86bf0fe` — EncumbranceModal + equip-slot primitives now correctly carry accordion info into the chain.

**Status**: Code shipped on main, but **BLOCKED ON VERCEL PROMOTION** — see §7 below.

### L21 (version pill — virtual UUID synthesis)

**Issue**: Records seeded directly from DB (not via library UI) had `versionId: null`. The SlotSourceBadge rendered `v:—` which looked broken.

**Fix**: `727b855` — When both `versionId` and `latestVersionId` are null, synthesize a stable virtual version id from `targetType:targetId` using the existing `resolveVirtualVersionId` helper. All SlotSourceBadge consumers now pass `targetType` + `targetId` (CAPABILITY, PRIMITIVE, ITEM, EFFECT, `<KIND>_TEMPLATE`).

**After fix**: Seeded records show `v:<8-char-hash>` instead of `v:—`. Title tooltip explains the synthesis.

### L22-L23 (Phase 8.M — single attack_bonus + save_dc)

**Issue**: Three per-attribute attack_bonus / save_dc totals were confusing. With multi-attribute proficiency, the modal needed a selector.

**Fix** (commits `52aa59e`, `dba2332`, `3a54f2e`, `f7acde9`, `f63a37c`):
- Engine exposes SINGLE `attack_bonus` and `save_dc` totals (derived from chosen attr, default = proficient attr)
- Modal shows "Scales with attribute: PHYSICAL ▼" dropdown when multiple attrs have primitives
- Selector renders BEFORE provenance (per your request)
- Seed: Added `Arcane Bolt` primitive (+3 attack_bonus.magical) so selector has something to switch between
- Cleanup: Defender primitive now uses `save_dc.physical` (was `defense_dc.physical`)

**Status**: Code shipped, BLOCKED ON VERCEL PROMOTION.

### L24 (Save DC selector detection — both target formats)

**Issue**: Save DC primitives can target EITHER `defense_dc.<attr>` (legacy) OR `save_dc.<attr>` (newer). My selector only checked the former.

**Fix**: `f7acde9` — Selector detection now checks both formats. Total reads from both. Defense Magic Buff (save_dc.magical) is now picked up.

---

## 2. Current commit status on `main`

```
4ef6467 chore: trigger Vercel rebuild for Phase 8.M (selector UI in modals)
f63a37c chore(M.3): cleanup Defender primitive to use save_dc.<attr> format
f7acde9 fix(M.3): Save DC modal now checks BOTH defense_dc and save_dc target formats
3a54f2e feat(M.3): resolve API accepts chosenAttribute query param
dba2332 feat(M.3): multi-attribute selector for attack_bonus + save_dc modals
52aa59e feat(M.1+8.M.2): SINGLE attack_bonus/save_dc engine + Arcane Bolt seed
02fa06c docs(phase-8): L-rounds 21-22 recap — version pill + Phase 8.M design
2c5e88c docs(architecture): Phase 8.M design doc for single attack_bonus/save_dc refactor
727b855 fix(L21): SlotSourceBadge synthesizes virtual version id for seeded records
```

---

## 3. BLOCKER — Vercel production alias is stuck

The production deployment for `swordweave.quest` is on `14e7e21` from **2026-08-12T16:05** (~6+ hours ago). None of the L19-L24 commits are live on the production URL.

**What you need to do**:
1. Open https://vercel.com/mashus-projects-3b3cfec0/sword-weave/deployments
2. Find the deployment for `4ef6467` (latest)
3. ⋯ menu → **"Promote to Production"**
4. Hard-refresh `swordweave.quest` (Cmd-Shift-R on desktop)

**I tried to auto-promote** via `npx vercel promote 4ef6467 --yes` but the `VERCEL_TOKEN` in `~/.bashrc` is empty in my environment. I cannot bypass this without your dashboard action.

---

## 4. Capabilities on/off and override — how it works

### Capability toggle (per capability)

The capability card has two states: **Active** and **Inactive**.

- **Toggle endpoint**: `POST /api/characters/{id}/capabilities/{capId}/toggle` with `{ active: bool }`
- **Trigger endpoint**: `POST /api/characters/{id}/capabilities/{capId}/trigger`
- **Active state** persists in **localStorage ONLY** (per-capability, per-character). Server doesn't store active state.
- **Every toggle/trigger** writes a log entry to the audit log (`capability_toggle` event type).
- **Trigger** = instant fire + revert to inactive + 1.2s visual flash. Does NOT persist any "active" state.

```typescript
// capability-card.tsx
const [active, setActive] = useState(false);
// localStorage key: readToggle(characterId, capability.id)
const showActive = triggerFlash || (hydrated && active);
```

### What "Active" actually does

When a capability is **active**, its effects (and their primitives) contribute to the running totals on the sheet. When **inactive**, the capability is dormant — its primitives do NOT contribute to the totals.

**However** (caveat from your R5-Q7 reframe):
> *Our software is more like a digital interactive character sheet. Not a way to actually play the game on the phone.*

The active/inactive toggle is **a player tool to decide which capabilities are "on" right now**. It's NOT combat state (the DM doesn't toggle these at the table). For temporary play conditions ("I'm poisoned"), the **Play Session Scratchpad** is the right tool — see §6.

### Override / "force" a capability

There's no "override" endpoint. If you want a capability to ALWAYS contribute regardless of toggle:
- Mark the primitive as `originCapOFF: false` (or omit — the default)
- This primitive will be applied even when the capability is inactive

If you want it to ONLY contribute when active:
- Mark the primitive as `originCapOFF: true` — only fires when the cap is active

This is in `character-sheet-view.tsx` and the engine's `conditionContext` evaluation.

---

## 5. Effect on/off — same pattern

Effects (children of capabilities) follow the same active/inactive model:
- An effect is **active** when its parent capability is active
- Effect primitives contribute to totals when the effect is active
- Effect can have its own conditions (e.g. "while poisoned, target takes -2 to attack")

**Effect primitive toggle** is NOT a separate UI — it inherits from the parent capability's active state.

---

## 6. The Play Session Scratchpad (R5-Q6, FAB-launch) — NOT YET IMPLEMENTED

From your earlier session (R5-Q6, 2026-08-04):

> *"Like during play I get poisoned or exhausted until long rest. We need to add it to the character sheet so I don't forget about it until the next session. which would be title, description, optional modifiers for number geeks (like i really want to reflect on the ch sheet this -1 to all ability checks for example) and it is on until long rest, short rest or manual toggle off. And would be like warnings in the bottom drawer you could active/inactive and delete."*

**Status**: ❌ Not implemented yet. Original spec item **I29** (replaces the abandoned "future FAB" item I21).

### Planned design (we agreed on this in R5):

1. **FAB** on the character sheet (floating action button, bottom-right)
2. Click FAB → modal opens with:
   - **Title** (e.g. "Poisoned")
   - **Description** (free text, e.g. "Stung by a giant spider")
   - **Optional modifiers** (target / axis / operation / value)
     - e.g. `attribute.physical` add -1 (for "exhausted, -1 to all checks")
   - **Duration tier**: long rest / short rest / manual toggle off
3. Saves as **runtime condition** on the character
4. Shows in the bottom drawer as a **warning card** (yellow/amber, distinct from capability cards)
5. Each card has:
   - **Active/Inactive toggle** (similar to capability)
   - **Edit** button
   - **Delete** button
6. On long rest → auto-deactivate all "long rest" scratchpad items
7. On short rest → auto-deactivate all "short rest" scratchpad items

### This is a separate feature from capability toggle

The capability toggle is for **in-game capabilities** (e.g. "Hunter's Mark" is active or not). The scratchpad is for **out-of-game tracking** (e.g. "I'm currently poisoned"). They're different:

| | Capability toggle | Scratchpad |
|---|---|---|
| Scope | Game mechanic | Player note |
| Source | Library cap slot | Free-form |
| Auto-clear | Never | On rest (or manual) |
| Modifiers | Read from cap data | User-defined at creation |
| Persistence | localStorage | Server-side (runtime_condition table) |

---

## 7. Open items / what's next

| Priority | Item | Status | Effort |
|---|---|---|---|
| 🔴 **BLOCKER** | **Promote latest Vercel deployment to production** | Stuck on `14e7e21` (6+ hrs old) | Manual — your action |
| 🟡 High | **Play Session Scratchpad (I29)** | Not implemented. Was originally planned in Phase 8.I but cut to "future FAB". You mentioned it in R24. | ~1 session |
| 🟢 Medium | Re-seed test character (the seed got the OLD `defense_dc.physical` format on Defender; after cleanup commit you should re-seed) | After Vercel promote | Quick |
| 🟢 Medium | Verify selector UI in both modals | After Vercel promote | Quick |
| 🟢 Low | L19 modal inheritance fix verification (the long-standing one) | After Vercel promote | Quick |
| 🔵 Future | **Multi-attribute proficiency** data model (currently `attrProficient` is single) — would unlock the selector UI to be useful (the selector currently only fires when multi-attr PRIMITIVES exist, which is a manual seed) | Future session | ~1-2 sessions |
| 🔵 Future | Defense DC refactor (currently per-attr; out of Phase 8.M scope but worth thinking about) | Future | TBD |
| 🔵 Future | **Attack / save trigger flow polish** — the current `Trigger` button is purely visual; we should hook it into combat state | Future | TBD |

---

## 8. Things to double-check after Vercel promotion

1. **Save DC modal**: Click Save DC in footer → should show "Scales with attribute: PHYSICAL ▼ | MAGICAL" dropdown BEFORE provenance
2. **Attack Bonus modal**: Same selector above provenance
3. **Version pill**: No more `v:—` anywhere — every slot should show `v:<hash>` or `v:1 (no version yet)`
4. **L19 modal inheritance**: Open encumbrance modal from drawer → primitives should show accordion in chain
5. **Phase 8.M.1 single totals**: Footer should show ONE number for atk/save DC, not three

---

## 9. Open questions for you (after promotion)

These were the items you mentioned in R24 that I haven't implemented yet:

### Q1. Play Session Scratchpad (I29)
- Where should the FAB live? Bottom-right of the sheet, or in the bottom drawer?
- What's the title for the FAB? "Add condition" or "+" icon or "Scratchpad"?
- Should the scratchpad show on the sheet itself (as a banner at top), or only in the bottom drawer?
- Should "long rest" / "short rest" auto-deactivate also clear from the sheet, or just toggle inactive (recoverable)?

### Q2. Multi-attribute proficiency (future)
- When you say "if we will add proficiency to more than one attribute" — is the data model change coming? Or just UI readiness?
- Should we add a `attrsProficient: string[]` (multi) alongside `attrProficient: string` (single, kept for backward compat)?

### Q3. Capability override
- Do you want a separate "Override" button on the capability card (forces active regardless of source)? Or is the existing localStorage toggle enough?

### Q4. Effect-only toggle
- Are there cases where you want an effect to be toggleable independently of its parent capability? (e.g. "Marked" can be off even when "Hunter's Mark" is on)

---

## 10. Quick reference — code locations

| Feature | File | Lines (approx) |
|---|---|---|
| Capability toggle button | `src/components/characters/capability-card.tsx` | 318-376 |
| Capability trigger button | `src/components/characters/capability-card.tsx` | 379-426 |
| Active state storage | `src/components/characters/capability-card.tsx` | 132-160 (readToggle/writeToggle) |
| Toggle endpoint | `src/app/api/characters/[id]/capabilities/[capId]/toggle/route.ts` | POST |
| Trigger endpoint | `src/app/api/characters/[id]/capabilities/[capId]/trigger/route.ts` | POST |
| Engine single attack_bonus / save_dc | `src/lib/engine/resolve-modifiers.ts` | 648-678 |
| Modal selector | `src/components/characters/formula-modal.tsx` | 116-124 (prop type), 433-457 (rendering) |
| Selector wiring in modals | `src/components/characters/bottom-sticky-bar.tsx` | 506-526 (detection), 1192+ (atk modal), 1146+ (dc modal) |
| Virtual version id | `src/components/characters/slot-source-badge.tsx` | 73-91 (synthesis), 144-159 (display) |
| Provenance chain accordion | `src/components/characters/character-sheet-view.tsx` | ~2030 area (chain building) |

---

## 11. What I will do next (if no objection)

After you promote the Vercel deployment and confirm:
1. **Verify all modals show the selector** — atk + dc
2. **Re-seed the test character** with the new cleanup commit (defense_dc.physical → save_dc.physical)
3. **Start the Play Session Scratchpad (I29)** — your "FAB extra in ch sheet"
   - FAB position: bottom-right of sheet (mobile-friendly)
   - Modal: title / description / modifiers / duration tier
   - Cards in the bottom drawer (warning style, distinct from capability)
   - Long rest / short rest auto-deactivate
4. **Update memory** with the L-rounds recap and Phase 8.M decisions

Or if you'd rather prioritize differently:
- (a) Q1 (scratchpad) — fresh new feature
- (b) L19 modal inheritance re-verify + cleanup
- (c) Phase 8.N — next phase of work

Let me know what to focus on first. 🚀
