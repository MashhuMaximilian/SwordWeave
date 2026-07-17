# Phase 7.10.4 — System User UI Label + Role Check

**Date:** 2026-07-16
**Scripts:** `scripts/apply-migration-0035.ts`, `scripts/backfill-system-admins.ts`
**Migration:** `src/db/migrations/0035_serious_vargas.sql`
**Status:** All changes applied. 1695/1695 tests passing.

---

## The rule (confirmed)

```typescript
function resolveAuthorDisplay(userId) {
  if (userId === null) return "System";              // legacy canon
  const user = lookupUserByClerkId(userId);
  if (!user) return "Unknown";                       // orphan
  if (user.isAdmin) return "System";                 // admin-authored canon
  return user.displayName;                            // regular user
}
```

`user_id IS NULL` → "System" (legacy canon)
`user.isAdmin === true` → "System" (Clerk role = admin)
Otherwise → displayName

---

## What changed

### 1. New column: `users.is_admin`

Added via drizzle-generated migration 0035. Boolean, default `false`. Indexed for fast lookups.

### 2. Schema + types

- `src/db/schema/profiles.ts`: Added `isAdmin` column to `users` table, plus `is_admin_idx` index
- `src/lib/profiles/lookup.ts`: `CreateProfileInput` accepts `isAdmin?: boolean`, stored on insert

### 3. Clerk role capture

- `src/app/api/users/sync/route.ts`: Reads `currentUser().publicMetadata.role === "admin"` and passes `isAdmin` through the profile create/update paths
- `src/app/api/webhooks/clerk/route.ts`: Same — reads `data.public_metadata.role` from the Clerk webhook payload and stores on user create/update

### 4. Author resolver

- `src/lib/auth/author-resolver.ts`: `AuthorInfo` now exposes `isAdmin: boolean`

### 5. Library item page

- `src/app/library/item/[id]/page.tsx`: Three-branch author rendering:
  1. `author.isAdmin === true` → "System" with Shield icon (no link)
  2. `author && !author.isAdmin` → existing "by {username}" link
  3. `!author` (legacy canon) → "System" with Shield icon
- `LikeForkBar` receives `null` author for admins, hiding the follow button

### 6. Backfill

`scripts/backfill-system-admins.ts` marked `xeun` as `is_admin = true`. Other users unchanged.

---

## Files changed

- `src/db/schema/profiles.ts` — added isAdmin column
- `src/db/migrations/0035_serious_vargas.sql` — drizzle-generated
- `src/lib/profiles/lookup.ts` — CreateProfileInput accepts isAdmin
- `src/lib/auth/author-resolver.ts` — AuthorInfo exposes isAdmin
- `src/app/api/users/sync/route.ts` — reads Clerk publicMetadata.role
- `src/app/api/webhooks/clerk/route.ts` — reads Clerk public_metadata.role
- `src/app/library/item/[id]/page.tsx` — 3-branch rendering + hide follow for admins
- `scripts/apply-migration-0035.ts` — applied migration
- `scripts/backfill-system-admins.ts` — marked xeun admin
- `src/lib/__tests__/system-user.test.ts` — 9 new tests

## Tests added (9)

- Column + index exist
- xeun is admin
- mashu is not admin
- anon-* users are not admin
- resolveAuthorByClerkId returns isAdmin=true for admin
- resolveAuthorByClerkId returns isAdmin=false for non-admin
- resolveAuthorByClerkId returns null for unknown clerk id
- resolveAuthorByClerkId returns null for null/undefined/empty

Total: 1695/1695 passing. Tsc clean. Build clean.