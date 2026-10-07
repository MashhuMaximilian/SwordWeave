# Public system collections — 7 October 2026

Ten starter shelves were created using existing public system entries:

| Collection | Memberships |
|---|---:|
| First expedition | 8 |
| Urban intrigue | 11 |
| Arcane mechanisms | 9 |
| Wilderness paths | 10 |
| Sky & storm | 9 |
| Flame & forge | 10 |
| Hidden worlds | 9 |
| Guardians & wards | 11 |
| Living echoes | 12 |
| Creature foundations | 8 |

Total: 97 memberships. An entry may belong to more than one shelf.

The collections use owner `system:public-collections-2026-10`, visibility `PUBLIC`,
and no automatic `systemKind`. This distinguishes curated system shelves from
each user's automatic Original Creations, Forks, and Favorites collections.

Run `pnpm exec tsx scripts/seed-public-collections-2026-10.ts` to review the plan.
Pass `--apply` to add missing collections and memberships. IDs are deterministic;
existing names, visibility, and memberships are preserved. The script rejects
missing or ambiguous named entries and checks every selected entry with the
collection service's public access gate before writing in one transaction.

Discovery: `/library/collections?origin=system`. Individual collection pages
continue to enforce entry visibility independently of the collection visibility.
