/** Real service checks, with the migration and every fixture rolled back. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { db, pool, withDatabaseTransaction } from "@/db/client";
import {
  users,
  follows,
  collections,
  encounters,
  characters,
  publications,
} from "@/db/schema";
import { createMonster } from "@/lib/monsters/service";
import {
  saveEncounter,
  getEncounter,
  startEncounter,
  getRun,
  deleteEncounter,
} from "@/lib/encounters/service";
import { listEncounterDirectory } from "@/lib/encounters/directory";
import { saveMemberships, collectionContents } from "@/lib/collections/service";
import { queryLibrary } from "@/lib/publishing/library-query";
import { readCharacterCataloguePreview } from "@/lib/character/catalogue-preview";
class Rollback extends Error {}
let checks = 0;
const pass = (value: unknown, label: string) => {
  assert.ok(value, label);
  checks++;
  console.log(`PASS ${label}`);
};
async function rejects(work: () => Promise<unknown>, label: string) {
  let denied = false;
  try {
    await work();
  } catch {
    denied = true;
  }
  pass(denied, label);
}
async function main() {
  try {
    await withDatabaseTransaction(async () => {
      await db.execute(
        sql.raw(
          readFileSync(
            "src/db/migrations/0074_encounter_visibility.sql",
            "utf8",
          ),
        ),
      );
      const author = `sharing-check-${randomUUID()}`,
        viewer = `sharing-check-${randomUUID()}`,
        stranger = `sharing-check-${randomUUID()}`;
      const [a, v] = await db
        .insert(users)
        .values([
          { clerkUserId: author, username: author },
          { clerkUserId: viewer, username: viewer },
        ])
        .returning();
      if (!a || !v) throw new Error("Fixture accounts unavailable");
      await db.insert(follows).values({ followerId: v.id, followingId: a.id });
      const characterKey = randomUUID();
      const characterRows = await db
        .insert(characters)
        .values([
          {
            userId: author,
            name: `Sharing ${characterKey} public`,
            isPublic: true,
            attrPhysical: 4,
            attrMental: 3,
            attrMagical: 3,
          },
          {
            userId: author,
            name: `Sharing ${characterKey} followers`,
            isPublic: false,
            attrPhysical: 4,
            attrMental: 3,
            attrMagical: 3,
          },
          {
            userId: author,
            name: `Sharing ${characterKey} private`,
            isPublic: false,
            attrPhysical: 4,
            attrMental: 3,
            attrMagical: 3,
          },
          {
            userId: viewer,
            name: `Sharing ${characterKey} own`,
            isPublic: false,
            attrPhysical: 4,
            attrMental: 3,
            attrMagical: 3,
          },
        ])
        .returning();
      await db
        .insert(publications)
        .values({
          targetType: "CHARACTER",
          targetId: characterRows[1]!.id,
          versionId: randomUUID(),
          versionNumber: 1,
          authorId: a.id,
          visibility: "FOLLOWERS_ONLY",
        });
      const chars = await queryLibrary({
        targetType: "CHARACTER",
        viewerClerkId: viewer,
        search: characterKey,
      });
      pass(
        chars.total === 3,
        "normal character discovery includes public, own-private and followed-only sheets",
      );
      const ownPrivate = await queryLibrary({
        targetType: "CHARACTER",
        viewerClerkId: viewer,
        search: characterKey,
        visibility: "PRIVATE",
      });
      pass(
        ownPrivate.total === 1 &&
          ownPrivate.items[0]?.targetId === characterRows[3]!.id,
        "private visibility filter retains only an authorized own sheet",
      );
      const noFollow = await queryLibrary({
        targetType: "CHARACTER",
        viewerClerkId: stranger,
        search: characterKey,
      });
      pass(
        noFollow.total === 1,
        "character discovery denies another user's private and follower-only sheets",
      );
      const publicPreview = await readCharacterCataloguePreview(
        characterRows[0]!.id,
        null,
      );
      pass(
        publicPreview?.name === characterRows[0]!.name &&
          !("dmNotes" in publicPreview) &&
          !("userId" in publicPreview),
        "public character summary omits private notes and owner identity",
      );
      pass(
        !!(await readCharacterCataloguePreview(characterRows[1]!.id, viewer)),
        "follower can open a follower-only character summary",
      );
      pass(
        (await readCharacterCataloguePreview(
          characterRows[1]!.id,
          stranger,
        )) === null,
        "non-follower cannot open a follower-only character summary",
      );
      pass(
        (await readCharacterCataloguePreview(characterRows[2]!.id, null)) ===
          null,
        "anonymous character summary denies private sheets",
      );
      const definition = {
        name: "Sharing fixture",
        budget: 25,
        attributes: { physical: 3, mental: 0, magical: 0 },
        references: [],
      };
      const publicMonster = await createMonster(
        author,
        definition,
        true,
        undefined,
        undefined,
        "PUBLIC",
      );
      const followerMonster = await createMonster(
        author,
        definition,
        false,
        undefined,
        undefined,
        "FOLLOWERS_ONLY",
      );
      const privateMonster = await createMonster(author, definition);
      const body = {
        name: "Public scene fixture",
        visibility: "PUBLIC",
        partyBu: 40,
        partyItemBu: 10,
        entries: [{ templateId: publicMonster.id, version: 1, quantity: 2 }],
      };
      const open = await saveEncounter(author, body);
      const followers = await saveEncounter(author, {
        ...body,
        name: "Follower scene fixture",
        visibility: "FOLLOWERS_ONLY",
        entries: [{ templateId: followerMonster.id, version: 1, quantity: 1 }],
      });
      const hidden = await saveEncounter(author, {
        ...body,
        name: "Private scene fixture",
        visibility: "PRIVATE",
        entries: [{ templateId: privateMonster.id, version: 1, quantity: 1 }],
      });
      await rejects(
        () =>
          saveEncounter(author, {
            ...body,
            entries: [
              { templateId: privateMonster.id, version: 1, quantity: 1 },
            ],
          }),
        "private template cannot enter public preparation",
      );
      await rejects(
        () =>
          saveEncounter(viewer, {
            ...body,
            visibility: "FOLLOWERS_ONLY",
            entries: [
              { templateId: followerMonster.id, version: 1, quantity: 1 },
            ],
          }),
        "another author's followers are not the same audience",
      );
      pass(
        (await getEncounter(null, open.id)).definition.visibility === "PUBLIC",
        "anonymous public preparation",
      );
      pass(
        (await getEncounter(viewer, followers.id)).definition.visibility ===
          "FOLLOWERS_ONLY",
        "real follower-only preparation",
      );
      await rejects(
        () => getEncounter(stranger, followers.id),
        "non-follower denied",
      );
      await rejects(
        () => getEncounter(viewer, hidden.id),
        "private preparation denied to followers",
      );
      await db
        .update(encounters)
        .set({
          definition: {
            ...open.definition,
            characterIds: [randomUUID()],
            budgetSource: "characters",
          },
        })
        .where(eq(encounters.id, open.id));
      const shared = await getEncounter(viewer, open.id);
      pass(
        !shared.definition.characterIds.length &&
          shared.definition.partyBu === 40,
        "linked private sheet identities redacted from preparation",
      );
      const op = randomUUID();
      const run = await startEncounter(viewer, open.id, op, open.revision);
      const retry = await startEncounter(viewer, open.id, op, open.revision);
      pass(run.id === retry.id, "retry-safe shared encounter start");
      const live = await getRun(viewer, run.id);
      pass(
        "members" in live && live.members.length === 2,
        "shared start creates independent private play copies",
      );
      await rejects(
        () => getRun(author, run.id),
        "source author cannot read another GM's run",
      );
      pass(
        !(await getEncounter(author, open.id)).runs.length,
        "another GM's run absent from author's preview",
      );
      await rejects(
        () => deleteEncounter(viewer, open.id),
        "read access never grants deletion",
      );
      await rejects(
        () => saveEncounter(viewer, shared.definition, open.id, open.revision),
        "read access never grants editing",
      );
      const directory = await listEncounterDirectory(viewer, {
        ids: [open.id, followers.id, hidden.id],
      });
      pass(
        directory.length === 2 &&
          directory.find((e) => e.id === open.id)?.enemyBu === 50,
        "directory visibility and quantity budgets",
      );
      const publicCatalogue = await queryLibrary({
        targetType: "ENCOUNTER",
        viewerClerkId: viewer,
        authorClerkId: author,
        sort: "RECENT",
      });
      pass(
        publicCatalogue.items.length === 2 &&
          publicCatalogue.items.every((e) => e.encounter),
        "Library encounter branch hydrates accessible entries",
      );
      const [collection] = await db
        .insert(collections)
        .values({
          ownerId: author,
          name: "Mixed fixture",
          visibility: "PUBLIC",
        })
        .returning();
      if (!collection) throw new Error("Collection missing");
      await saveMemberships(author, "ENCOUNTER", open.id, [collection.id]);
      await saveMemberships(author, "ENCOUNTER", hidden.id, [collection.id]);
      await saveMemberships(author, "MONSTER", publicMonster.id, [
        collection.id,
      ]);
      const contents = await collectionContents(collection.id, null);
      pass(
        contents.entries.length === 2 &&
          contents.entries.some((e) => e.targetType === "ENCOUNTER") &&
          contents.entries.some((e) => e.targetType === "MONSTER"),
        "mixed collection hides private entries while preserving public monsters and encounters",
      );
      const mixed = await queryLibrary({
        collectionId: collection.id,
        sort: "RECENT",
      });
      pass(
        mixed.items.length === 2 &&
          mixed.items.some((e) => e.targetType === "ENCOUNTER"),
        "mixed collection's shared catalogue pipeline",
      );
      await db.delete(follows).where(eq(follows.followerId, v.id));
      await rejects(
        () => getEncounter(viewer, followers.id),
        "revoked follow blocks preparation",
      );
      pass(
        !!(await getRun(viewer, run.id)),
        "existing private run remains resumable",
      );
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  console.log(
    `${checks} real-database checks passed; migration and fixture writes rolled back.`,
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
