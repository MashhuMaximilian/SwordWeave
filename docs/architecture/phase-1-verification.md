# Phase 1 Verification Checklist

> **Status**: ready for Mashu's hands-on validation. Commit `c68bafc`.
> **Scope**: intent flag + deferred fork UX for **primitives only**.
> Effects, capabilities, items, templates land in Phase 2.

This document is the **single source of truth** for what to check.
Walk it top to bottom. Each test is one user-observable behaviour;
each is bound to a specific code path so failures are easy to localise.

The matrix cell you're verifying is called out per-test. Don't judge
later-phase behaviours — they ship in Phases 2–5.

---

## Pre-flight (30 seconds)

1. Visit `https://www.swordweave.quest/library/browse`.
2. Sign in if you aren't already (your normal dev account works).
3. Open `/creations` and note the count of `Strike (fork)` rows
   already there from prior testing. **This is your baseline —
   don't be alarmed if there are several.**

---

## Test 1: Fork button does NOT create a fork on click

This is the **central change** of Phase 1. The old behaviour (round 4)
created a fork immediately and popped a success modal. The new behaviour
navigates to the sandbox with **no side effect**.

### Steps

1. On `/library/browse` find any primitive that isn't owned by you.
   System content (e.g. `Fire Resistance`) is fine if you don't own
   anything yet.
2. Click the **Fork** button (the GitFork icon next to the heart).
3. **Verify**: you land on `/sandbox/grammar?build=primitive&edit=<id>&intent=fork`.
4. **Verify**: the form opens pre-filled with the source's content.
5. **Verify**: the form header shows a **blue chip** "Forking <name>".
6. **Verify**: a **Discard** button is visible next to Reset.
7. **Verify**: `/creations` count is **unchanged** from baseline.
8. **Verify**: nothing was written to the DB. (You can re-query the
   fork count by going back to `/library/browse` and looking at the
   fork count badge on the source card — it should be **unchanged**.)

### Expected matrix cell

> intent=fork + non-owner → fork materialized at save time, **not** on
> click.

### If it fails

- **Still creates a fork on click?** → `handleFork` in
  `src/components/engagement/like-fork-bar.tsx` wasn't replaced.
  Check `git log -p src/components/engagement/like-fork-bar.tsx`
  shows commit `c68bafc`.
- **Doesn't navigate?** → URL builder mismatch. Check the URL it
  tried to navigate to in the browser console.
- **No chip?** → `saveIntentLabel` import or label computation broken
  in `src/components/sandbox/primitive-form.tsx`.

---

## Test 2: Fork via save → fork row appears

Now prove that save in the fork-state actually creates the fork.

### Steps

1. You're on `/sandbox/grammar?build=primitive&edit=<id>&intent=fork`
   (continuing from Test 1).
2. Change one field — e.g. the narrative rule. The form should mark
   itself dirty.
3. Click **Save** at the bottom.
4. **Verify**: success toast/message "Primitive saved to your account."
5. **Verify**: URL bar shows `?edit=<NEW_ID>&intent=fork` (the `edit`
   param swapped from source to new fork — this is `swapTarget=true`).
6. **Verify**: the blue chip is still "Forking <name>" (intent
   unchanged).
7. **Verify**: `/creations` count went **up by 1**.
8. **Verify**: the new row's name has a "(fork)" suffix.
9. **Verify**: the source primitive in `/library/browse` has its
   fork count incremented by 1.

### Expected matrix cell

> intent=fork + non-owner (system content counts) → fork-create.
> URL swaps from source to new fork.

### If it fails

- **No URL swap?** → `grammar-sandbox-client`'s `onSaved` callback
  didn't run the `router.replace`. Check
  `src/components/sandbox/grammar-sandbox-client.tsx` line ~352.
- **Fork count not incremented?** → The `POST /api/primitives`
  dispatch path isn't running. Check server logs in Vercel for the
  request body. Should include `"intent":"fork","sourceId":"<id>"`.
- **Wrong name?** → `computeUniqueForkName` should produce
  `"<name> (fork)"` for first fork. If it produced `"<name> (fork) 2"`,
  your user already had a `Strike (fork)` row — that's the unique-name
  walking working as designed.

---

## Test 3: Discard button leaves no trace

The whole point of the deferred model is that bailing out shouldn't
leave a row in the DB.

### Steps

1. On `/library/browse`, click Fork on a primitive you don't own.
2. On `/sandbox/grammar?build=primitive&edit=<id>&intent=fork`,
   change a few fields.
3. Click **Discard**.
4. **Verify**: URL bar returns to `/sandbox/grammar` with no `?edit=`
   or `?intent=` params (or whatever surface you came from).
5. **Verify**: `/creations` count is **unchanged** from baseline.
6. **Verify**: the source primitive's fork count is **unchanged**.
7. **Verify**: refreshing the page shows the same.

### Expected behaviour

> Cancel/back-out → no fork row. No DB write.

### If it fails

- **URL params not cleared?** → Discard button's
  `URLSearchParams.delete` calls didn't run. Check
  `src/components/sandbox/primitive-form.tsx` near the
  `discard-edit-button` testid.

---

## Test 4: Load into build — owner gets version-update path

The matrix has a special case: if you load your **own** primitive
into build via the Load into build button, save should update the
row in place (no new fork).

### Steps

1. On `/creations` find a primitive you own.
2. Click **Load into build** (NOT Fork — the difference matters).
3. **Verify**: URL is `/sandbox/grammar?build=primitive&edit=<id>&intent=load`.
4. **Verify**: form header shows a **gray chip** "Working on <name>".
5. Change one field, save.
6. **Verify**: URL stays on the **same** `?edit=<id>` (no swap — this
   is `swapTarget=false`).
7. **Verify**: `/creations` count is **unchanged** (no new row).
8. **Verify**: the original primitive was updated in place.

### Expected matrix cell

> intent=load + caller owns → UPDATE in place. URL doesn't swap.

### If it fails

- **URL swapped?** → dispatchSave returned `kind: "forked"` instead
  of `kind: "version-update"`. The ownership check at
  `decideSaveOutcome` failed — verify by inspecting the request body
  + looking up the source row's `userId` in the DB.
- **No chip or wrong color?** → `intent` prop on PrimitiveForm was
  null. The URL update in `applyPendingAction` didn't run. Check
  `grammar-sandbox-client.tsx` line ~272.

---

## Test 5: Load into build — non-owner gets fork path

This is the "I want to play with this but don't claim ownership yet"
gesture. Save should fork.

### Steps

1. On `/library/browse` find a primitive you don't own.
2. Click **Load into build** on its preview card (NOT Fork — click
   the **Load into build** button at the bottom of the preview).
3. **Verify**: URL is `?build=primitive&edit=<id>&intent=load`.
4. **Verify**: gray chip "Working on <name>".
5. Change a field, save.
6. **Verify**: URL swaps to `?edit=<NEW_ID>` (fork path).
7. **Verify**: `/creations` count went **up by 1**.
8. **Verify**: source primitive's fork count incremented.

### Expected matrix cell

> intent=load + non-owner → fork-create.

### If it fails

- **Treated as version-update?** → Server saw caller as the owner.
  Check the source row's `userId` matches your Clerk id.
- **No fork created?** → Dispatch went down `version-update` path.
  Inspect `/api/primitives` request body — `intent` should be
  `"load"` and `sourceId` should be set.

---

## Test 6: Fork button on YOUR OWN content still forks

This is the matrix's "intent beats ownership" rule. Even though you
own the source, intent=fork creates a new row.

### Steps

1. On `/creations` find a primitive you own.
2. Click **Fork** (the GitFork icon).
3. **Verify**: URL is `?build=primitive&edit=<id>&intent=fork` (note:
   `intent=fork`, not load).
4. **Verify**: blue chip "Forking <name>".
5. Change a field, save.
6. **Verify**: new fork row appears. `/creations` count up by 1.
7. **Verify**: source primitive's content is **unchanged**.

### Expected matrix cell

> intent=fork + caller owns → fork-create (NOT version-update).

### If it fails

- **Updated in place?** → `decideSaveOutcome` is treating intent=fork
  as load. Inspect `/api/primitives` request body — `intent` should
  be `"fork"`.

---

## Test 7: Cancel/close leaves no trace (browser close)

Same as Test 3 but via the browser tab itself.

### Steps

1. Open a sandbox with `?intent=fork&edit=<id>`.
2. Type some changes (don't save).
3. Close the tab without saving.
4. Reopen the URL of that primitive on `/library/browse`.
5. **Verify**: its fork count is unchanged.

### Expected behaviour

> No save → no fork.

### If it fails

> This test cannot fail given the design — there's no save, no
> server hit. Only fail mode: if you accidentally hit Save before
> closing.

---

## Test 8: Page refresh on intent=fork keeps the chip

The intent flag is in the URL, so refreshing preserves it.

### Steps

1. Navigate to `/sandbox/grammar?build=primitive&edit=<id>&intent=fork`.
2. **Verify**: form pre-fills, blue chip visible.
3. Hard refresh the page (Cmd+R / Ctrl+R).
4. **Verify**: form still pre-fills, blue chip still visible.

### Expected behaviour

> URL is the source of truth for intent.

### If it fails

> Check `parseSaveIntent` in
> `src/lib/publishing/save-intent.ts` is being called by the
> sandbox route.

---

## Test 9: Direct deep link with intent=null defaults to load

A deep link without `?intent=` should behave like a Load (the
"default" intent for `intent=null`).

### Steps

1. Open `/sandbox/grammar?build=primitive&edit=<id>` (no `intent`).
2. **Verify**: no chip rendered (intent is null → no chip).
3. Save with no changes.
4. **Verify**: same matrix-cell rules as Test 4/5 apply
   (owner=UPDATE, non-owner=fork).

### Expected behaviour

> intent=null + owned → UPDATE in place.
> intent=null + non-owner → fork.

### If it fails

> Same dispatch logic — `decideSaveOutcome` is the single source of
> truth. If Test 4 and Test 5 pass, this will too.

---

## Test 10: Discard from Creations page

Same Discard UX works from the "Edit in sandbox" path.

### Steps

1. On `/creations` find one of your forks.
2. Click **Edit in sandbox** (NOT Fork button).
3. URL is `?build=primitive&edit=<forkId>` (no `intent` because
   this came from Creations, not a Fork button).
4. **Verify**: no chip (intent=null).
5. **Verify**: no Discard button (no sourceId in URL).
6. (You can skip the Discard check here — it correctly doesn't
   show because there's no fork to discard.)

### Expected behaviour

> Creations → Edit in sandbox → no intent, no chip. Save uses
> legacy `id` field via dispatch (still works).

---

## What's NOT in Phase 1 (explicitly out of scope)

The following behaviours **look related** but ship in later phases.
Don't report these as bugs:

- **Effects/capabilities/items/templates**: clicking Fork on one of
  these navigates correctly, but save still uses the legacy `id`
  path (no fork-on-save yet). That's Phase 2.
- **No-change message**: saving with zero changes still creates a
  fork/updates. The OQ5 message ("you can't save something you're
  not the owner of") comes in **Phase 4** when content hashing
  lands. For Phase 1 every save proceeds regardless of changes.
- **Slot-source badges / version indicators in build preview**:
  these are Phase 5.
- **`/api/fork` route deletion**: route still exists, just
  unused. Removed in a cleanup commit after Phase 5.

---

## Quick smoke (60 seconds, optional)

If you don't want to walk every test, do this:

1. Click Fork on any primitive (non-owner).
2. Land on sandbox, see blue "Forking X" chip.
3. Save with no changes → new "Strike (fork)" or similar appears in
   `/creations`.
4. Click Discard → URL clears, no fork row.
5. Click Load into build on your own primitive → gray "Working on
   X" chip → save → no new row, original updated.

If those five steps behave correctly, Phase 1 is working.

---

## Reporting feedback

When you report back, please distinguish:

- **Phase 1 bugs**: anything in Tests 1–10 fails.
- **Out-of-scope observations**: anything else you noticed
  (slot UX, no-change message, etc.). I'll log these but not act
  until their phase.

This way I can validate Phase 1 cleanly without later-phase
features contaminating the verdict.