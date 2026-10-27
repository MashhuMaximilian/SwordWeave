# Training and Futoshi revisions — 27 October 2026

The creator approved correcting training definitions and advancing Futoshi's
three affected primitive versions. Cornered Combatant explicitly includes
attacks with melee weapons or firearms, including ranged gunshots.

## Saved definition changes

| Primitive | Version | Result |
| --- | --- | --- |
| Expertise Upgrade Prowess (fork), 11328 | 9 | A scoped Expertise grant supplies the second PB when eligible. |
| Proficient Fieldcraft, 14065 | 3 | A proficiency grant supplies PB once. |
| Expertise Fieldcraft, 14066 | 4 | A scoped Expertise grant supplies the second PB when eligible. |
| Proficient Save, 15517 | 3 | Physical saving throw proficiency supplies PB once. |
| Proficient Mysticism, 16137 | 3 | A proficiency grant supplies PB once. |
| Corenered Combatant, 58 (existing stored spelling) | 10 | Text rule for Expertise with melee weapons or firearms, including ranged gunshots. No unconditional global automatic modifier. |
| Enfeebling Envenom, 21353 | 10 | Text rule for a neurotoxic bite applying Exposed to the victim and reducing that victim's DC. No fixed reduction to the attacker's DC. |

Innate Instinct, 21348, already had the correct minimum-10 Intuition definition
in version 7; Futoshi now uses it. The venom application procedure, any save,
DC reduction, duration and ending/recovery conditions remain table agreements.

The audit covered the ten practices, three attribute saves, attacks and other
PB-based authored targets. Current standard practice/save grants were already
correct. Separate authored arithmetic bonuses such as Attack Bonus +PB, Save
DC +PB and scoped conditional +PB modifiers remain independent bonuses.
The generic practice training templates retain their authored bindings.

## Character and history preservation

Seven new immutable definition versions were saved in one checked transaction.
Only Futoshi's three agreed occurrence pins were advanced. Futoshi remains
level 10 with **112 BU spent**. The operation checked all unrelated character
fields, acquisition fields, other pins and costs, and captured recoverable
before/after character history. Private backups and receipts are excluded
from Git.

Other characters keep their existing pinned versions. Their owners can review
the changes with **Updates available**. The bulk update path already resolves
actual primitive IDs. The individual primitive update action was corrected to
resolve the integer primitive ID from the occurrence UUID within the authorized
character; explicit pins must belong to the same underlying entity. Missing
slots no longer report a successful update.

## Verification

- 25 focused checks cover grant eligibility, repeated grants, separate bonuses,
  saving throws, narrow/broad practice scope, Futoshi's text rules and individual
  version updates.
- TypeScript checking passes.
- Production Webpack build passes.
- Readback of the seven saved definitions matches the reviewed content.
- The exported Futoshi snapshot uses the three agreed versions and retains
  level 10 and 112 BU spent.
- Production play view displays all three corrected rules and version numbers.
- The default update helper resolves Futoshi's current Intuition version in a
  real database transaction; verification writes were rolled back and the
  original character and occurrence rows were confirmed unchanged.

Damage-triggered upkeep and its counter/reset policy remain undecided.
Physical print/pencil/fold review remains with the creator when a printer is
available. No upkeep or mass character migration was implemented.

Repair sources: `scripts/revise-training-primitives-2026-10-27.ts` and its
reviewed definition module in `scripts/lib/`. The runner defaults to read-only
dry-run; apply requires an explicit audited Futoshi-owner guard and preserves
existing ownership.
