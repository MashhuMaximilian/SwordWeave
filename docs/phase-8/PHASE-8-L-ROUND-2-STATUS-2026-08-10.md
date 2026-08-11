# Phase 8.L Round 2 — Status + Outstanding — 2026-08-10

**Author:** Senku
**Source:** user feedback `what-is-good-here-question.txt` + 4 screenshots
**Purpose:** Track everything, identify what's done and what's left.

---

## 1. What's verified shipped (live on production)

| # | Feature | Commit | Verified |
|---|---|---|---|
| 1 | K8 — advantage as keyword grant on per-axis targets | `c830e98` | ✓ |
| 2 | K8 — engine reads `behavior.advantage.<target>` per-axis counter | `104bae9` | ✓ |
| 3 | K8 — modal shows `[advantage]` instead of `+0` (via rawValue) | `0cb05aa` + `dc7511e` | ✓ |
| 4 | K6 — suppressed primitives greyed-out in modal | `c16dc26` | ✓ |
| 5 | K13 — equations pretty-formatted in modal | `c16dc26` | ✓ |
| 6 | K17 — AND/OR rendered as chips in conditions | `c16dc26` | ✓ |
| 7 | K1 — Capabilities duplication on Tessy3 fixed | `1a7303c` | ✓ |
| 8 | K3 — duplicate `↑ 18 ↓ 18` axis-marker bug fixed | `f79c7c9` | ✓ |
| 9 | L1 — stealth primitive re-targeted to fieldcraft | `084d4b9` | ✓ |
| 10 | L7 — Enlarge + Force Source use `what changes` keyword format | `084d4b9` + `d43214c` | ✓ data, ⚠️ visual |
| 11 | L8 — version pill on InlinePrimitiveCard | `084d4b9` | ⚠️ visible only when versionId set |
| 12 | L13 — `via via` double-prefix stripped | `084d4b9` | ✓ |
| 13 | L18 — Lighten removed from character slot | `084d4b9` | ✓ |
| 14 | L18 — per-attr save_dc removed (Save DC Buff / Mental / Magic) | `084d4b9` | ✓ |
| 15 | L2 — keyword display in primitive card | `104bae9` | ✓ |
| 16 | L3 — equation display in primitive card | `104bae9` | ✓ |
| 17 | M7 — Color codes (PB/2 teal, Expertise teal+bold, Proficient teal) | `c16dc26` (modal) | ✓ modal, ⚠️ drawer |
| 18 | K7 — save value teal in drawer when save_dc primitive exists | `d43214c` | ✓ |

---

## 2. What's been deployed but NOT yet visible

These changes are in main + deployed but the user is reporting they don't see them:

| # | Issue | Why |
|---|---|---|
| 19 | Size pill in header still MEDIUM | `resolveCharacterAxes` is in sheet.ts but the character page's `aggregateCharacterSheet` may not be calling it correctly, OR deploy lag |
| 20 | Capacity modal still shows MEDIUM (40 base), not LARGE (80 base) | Same as above |
| 21 | Equip slots still showing 6/6 (Extra Slot primitive should add 1) | Extra Slot primitive targeting `equip_slot` not flowing through |
| 22 | Version pill not visible on primitive cards | `primitiveLink.versionId` is null in the seeded data (need to set versionId when slotting) |
| 23 | Bundle JSON error still happening (Stone's Endurance) | Likely a stale client cache or endpoint issue |
| 24 | Communion modal doesn't show adv/disadv primitives in the breakdown | Practice modal needs to pull primitives from `skill_practice_check.communion` — but those grant primitives don't contribute numerically, only via the `behavior.advantage.<target>` counter |
| 25 | Practice/save rows in drawer missing color codes | Drawer rows use simple isProf boolean, no breakdown visibility |

---

## 3. Outstanding issues raised by user in this round

### L19 — Net adv/disadv display rules
**Cases:**
- 1 adv + 1 disadv: cancel → `+24` (no markers)
- 1 adv + 2 disadv: `+24 ⇊(2) *`
- 4 adv + 1 disadv: `+24 ⇈(2) *` (net 3 adv, display ⇈(2))
- 3 adv + 0 disadv: `+24 ⇈(3) *`
- 1 adv + 0 disadv: `+24 ⇈ *`

**Implementation:** The AxisMarkers needs to compute NET (adv - disadv) and display one or the other (not both). If net ≥ 2 → `⇈(N)`. If net ≤ -2 → `⇊(N)`. If net = 1 → `⇈` (no parens). If net = -1 → `⇊`. If net = 0 → no markers.

### L20 — Practice modal must show practice primitives
The user's modal screenshot shows practice primitives missing. The Communion modal has:
- Attribute primitives (Magical Buff +2)
- Practice primitives (Advantage on Communion, Disadvantage on Communion)

But the modal might be using ContributionList filtered to highlight `c.value !== 0` (numeric) — which filters out grants.

### L21 — Capacity modal "30 (primitives)" needs expansion
The capacity formula shows `+30 (primitives)` but doesn't list which primitives. The user wants to see the breakdown.

### L22 — Modal structure inconsistency
User says:
> "idk why not all behave like this. So not all modals properly show practice primitives, only the attribute ones...."

The 4 modal paths (attribute, save, practice, max_vitality) need the same structure. The attribute modal works; practice modal is missing things.

### L23 — L6 (ONE global save_dc + attack_bonus)
**Major architectural refactor.** Plan:
1. Engine: define `resolveSaveDc(input, attr)` and `resolveAttackBonus(input, attr)` — use proficient attr's modifier + PB
2. Migration: rename all `save_dc.physical` → `save_dc`, `attack_bonus.physical` → `attack_bonus`
3. Update `isValidTarget` in resolve route
4. Update bottom-sticky-bar to use new keys
5. Modal: let user choose which attribute feeds the global save_dc when multiple attribute-related primitives exist

**Estimated commits:** 3-4. **Estimated work:** 2-3 hours.

### L24 — JSON bundle error (L4)
User says: "Failed to execute 'json' on 'Response': Unexpected end of JSON input → still issue"
**Action:** investigate which endpoint returns empty/truncated.

### L25 — Drawer color codes per practice
Apply the user's color rules:
- Proficient: text + value teal
- Expertise: text + value teal+bold
- PB/2: value only teal
- Plain: text + value normal

### L26 — Communion needs 2 advantages to test stacking
Add "Advantage on Communion 2" primitive.

### L27 — Influence needs a disadvantage primitive
Add "Disadvantage on Influence" primitive.

### L28 — Version pill on primitive cards
Currently `primitiveLink.versionId` is null in seeded data. Need to set it when slotting.

---

## 4. Decisions needed to proceed

### D-L19 — Practice list marker rules
**Options:**
- (a) Net (adv - disadv): 3 adv + 1 disadv = `⇈(2)`. 1 adv + 2 disadv = `⇊(2)`.
- (b) Show both: 3 adv + 1 disadv = `⇈(3) ⇊`.
- (c) Show min rule: only show if count ≥ 2, regardless of net.

**Recommended:** (a) — net is the actual game effect.

### D-L20 — Practice modal section
**Options:**
- (a) Show all contributions to the target, including grants (show as `grant [advantage]` icon row)
- (b) Hide grants from the breakdown (only show numeric contributions)

**Recommended:** (a) — the user explicitly wants to see all primitives feeding the practice.

### D-L21 — Capacity modal primitive breakdown
**Options:**
- (a) Expand the primitives section inline (list each primitive + its value)
- (b) Modal that opens when clicked

**Recommended:** (a) — inline is more transparent.

### D-L22 — Modal structure consistency
**Options:**
- (a) Audit all 4 modal paths and apply the unified structure
- (b) Refactor to a single ModalShell component

**Recommended:** (a) — quick fix.

### D-L23 — L6 architectural refactor
**Options:**
- (a) Tackle now (3-4 commits)
- (b) Defer to Phase 8.M

**Recommended:** (b) — focused fix this round, architectural next.

### D-L24 — Commits this round
**Options:**
- (a) Visible bugs only (L19, L20, L21, L22, L25, L26, L27) ~6 commits
- (b) (a) + L6 architectural ~10 commits
- (c) (a) + L4 + L28 investigations ~8 commits

**Recommended:** (a) — visible bugs only. L6 + L4 + L28 follow-up.

---

## 5. Request

Pick D-L19, D-L20, D-L21, D-L22, D-L23, D-L24 and I'll plan + start.
