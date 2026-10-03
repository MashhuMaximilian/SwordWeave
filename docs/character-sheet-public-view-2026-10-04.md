# Public character sheets — 4 October 2026

Public roster entries open `/characters/{id}?view=public`, using the standard sheet. Old `CHARACTER:` library links redirect there. The separate character preview page is removed.

- Publication visibility overrides legacy `isPublic`, including explicit unpublishing. A viewing URL cannot grant access to a private character.
- Public viewing is read-only, including when the viewer also owns the character. Normal owner/editor sheet links retain their existing permission.
- The saved workspace graph and consequences are loaded on the server after the access check. Public viewing does not import, sync, or write a visitor's local play state.
- HP, rest, quantity, equipment, capability/effect toggles, and consequence changes are disabled. Navigation, searching the build, and explanatory modals remain available.
- Private notes, DM notes, shares, and private event logs are excluded from public viewing.
- Fork creates an owned private copy and opens its normal sheet. It preserves pinned versions, mirrored slots, origins, equipment, portraits, and standalone effect memberships. Private notes are not copied for a public reader; DM notes are never copied.

## Verification

- TypeScript check passed.
- 28 access/permission/fork tests passed.
- Local public sheet: full heritage/capability build displayed; actions disabled; equipment read-only; DC explanation opened; the FAB omitted character editing.
- Real database fork path checked inside a transaction: 29 primitive slots, 6 capabilities, 3 heritages, 3 items, pinned metadata and portrait preserved; original unchanged. The transaction was rolled back and no test character remained.
- Scoped lint has no errors with the three existing legacy rules (`set-state-in-effect`, `refs`, `no-unescaped-entities`) excluded. Existing warnings remain.
- No schema migration is required for this change.
