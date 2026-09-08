import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
const caller = vi.hoisted(() => ({ id: "user_workspace_verification" }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect: async () => ({ userId: caller.id }) },
}));
import { db, pool } from "@/db/client";
import * as s from "@/db/schema";
import { readWorkspace } from "../read";
import { createWorkspaceEntity } from "../save-entity";
import { resolveLatestVersionId } from "@/lib/versions/slot-source";
import { saveCharacterBundles } from "@/lib/api/character-bundle-saver";
import { executeWorkspaceCommand } from "../commands";
import { POST as create } from "@/app/api/characters/[id]/workspace/create/route";
import {
  POST as consequences,
  GET as getConsequences,
} from "@/app/api/characters/[id]/consequences/route";
import { POST as promote } from "@/app/api/characters/[id]/consequences/[occurrenceId]/promote/route";
import {
  POST as apply,
  GET as preview,
} from "@/app/api/characters/[id]/consequences/apply/route";
const enabled =
  process.env["WORKSPACE_TEST_DATABASE"] === "sw_workspace_verify_20260908";
const suite = enabled ? describe : describe.skip;
suite("isolated workspace transactions", () => {
  const characterId = randomUUID();
  const context = { params: Promise.resolve({ id: characterId }) };
  let primitiveId: number;
  let effectId: string;
  const request = (body: unknown) =>
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  beforeAll(async () => {
    if (
      !new URL(process.env["DATABASE_URL"]!).pathname.endsWith(
        "/sw_workspace_verify_20260908",
      )
    )
      throw new Error("Refusing non-isolated database.");
    await db
      .insert(s.users)
      .values({ clerkUserId: caller.id, username: "workspace_verification" })
      .onConflictDoNothing();
    await db.insert(s.characters).values({
      id: characterId,
      name: `Workspace verification ${characterId}`,
      userId: caller.id,
      mode: "BUILD",
      currentVitality: 50,
      level: 5,
      attrPhysical: 5,
      attrMental: 3,
      attrMagical: 2,
    });
    const primitive = await createWorkspaceEntity("primitive", {
      name: `Verification piece ${characterId}`,
      category: "OUTPUT",
      buCost: 4,
      costTier: "Tier 1: Minor (4 BU anchor)",
      mechanicalOutputText: "",
      narrativeRule: "",
      isPublic: false,
      isMirrorable: false,
      mirrorVector: "STANDARD_ONLY",
      mirrorBuCredit: 0,
      mirrorEligibilityNotes: "",
      sourceOrigin: "manual",
      tags: [],
      consequenceBehavior: {
        timing: "on-use",
        vitalityDelta: -5,
        restrictions: [],
        recovery: "Recover deliberately",
      },
      hardModifiers: [],
    });
    primitiveId = Number(primitive.id);
    const versionId = await resolveLatestVersionId("primitive", primitiveId);
    expect(versionId).not.toBeNull();
    await db.insert(s.characterPrimitives).values({
      characterId,
      primitiveId,
      source: "PERSONAL",
      slotSource: "PINNED",
      versionId,
    });
  }, 30000);
  afterAll(async () => {
    await db.delete(s.characters).where(eq(s.characters.id, characterId));
    await pool.end();
  }, 30000);
  it("creates and attaches a named empty effect atomically and retries once", async () => {
    const command = {
      commandId: randomUUID(),
      expectedRevision: 0,
      kind: "effect",
      category: "MANIFEST",
      draft: {
        name: `Empty effect ${characterId}`,
        narrativeDescription: "",
        primitiveSlots: [],
        isPublic: false,
      },
    };
    const response = await create(request(command), context);
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    effectId = result.effect.id;
    const retry = await create(request(command), context);
    expect((await retry.json()).effect.id).toBe(effectId);
    const graph = await readWorkspace(characterId);
    expect(graph.nodes.some((n) => n.id === effectId)).toBe(true);
    expect(graph.revision).toBe(1);
  }, 30000);
  it("versions the containing effect and preserves explicit instances", async () => {
    const graph = await readWorkspace(characterId);
    const target = graph.nodes.find((n) => n.id === effectId)!;
    const edge = graph.edges.find((e) => e.child === target.key)!;
    const before = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    const command = {
      commandId: randomUUID(),
      operation: "add-reference",
      expectedRevision: graph.revision,
      target: target.key,
      path: [edge.id],
      expectedHash: target.data["contentHash"],
      child: `primitive:${primitiveId}`,
    };
    const saved = await executeWorkspaceCommand(
      characterId,
      caller.id,
      command,
    );
    expect(saved["outcome"]).toBe("version-update");
    const retry = await executeWorkspaceCommand(
      characterId,
      caller.id,
      command,
    );
    expect(retry["revision"]).toBe(saved["revision"]);
    const after = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    expect(after.some((r) => r.instanceId === before[0]!.instanceId)).toBe(
      true,
    );
    expect(after).toHaveLength(1);
    expect(after[0]!.directSource).toBe("PERSONAL");
    const versions = await db
      .select()
      .from(s.effectVersions)
      .where(eq(s.effectVersions.effectId, effectId));
    expect(versions).toHaveLength(2);
  }, 30000);
  it("rejects stale membership submissions without changing versions", async () => {
    const graph = await readWorkspace(characterId);
    const target = graph.nodes.find((n) => n.id === effectId)!;
    const edge = graph.edges.find((e) => e.child === target.key)!;
    await expect(
      executeWorkspaceCommand(characterId, caller.id, {
        commandId: randomUUID(),
        operation: "add-reference",
        expectedRevision: 0,
        target: target.key,
        path: [edge.id],
        expectedHash: target.data["contentHash"],
        child: `primitive:${primitiveId}`,
      }),
    ).rejects.toThrow("changed");
    expect(
      await db
        .select()
        .from(s.effectVersions)
        .where(eq(s.effectVersions.effectId, effectId)),
    ).toHaveLength(2);
  }, 30000);
  it("forks a borrowed container without editing its child definitions", async () => {
    await db
      .update(s.effects)
      .set({ userId: "another-author" })
      .where(eq(s.effects.id, effectId));
    const graph = await readWorkspace(characterId);
    const target = graph.nodes.find((n) => n.id === effectId)!;
    const edge = graph.edges.find((e) => e.child === target.key)!;
    const saved = await executeWorkspaceCommand(characterId, caller.id, {
      commandId: randomUUID(),
      operation: "edit",
      expectedRevision: graph.revision,
      target: target.key,
      path: [edge.id],
      expectedHash: target.data["contentHash"],
      draft: { name: `My fork ${characterId}` },
    });
    expect(saved["outcome"]).toBe("forked");
    expect(saved["id"]).not.toBe(effectId);
    const original = await db.query.effects.findFirst({
      where: eq(s.effects.id, effectId),
    });
    expect(original!.userId).toBe("another-author");
    const primitive = await db.query.primitives.findFirst({
      where: eq(s.primitives.id, primitiveId),
    });
    expect(primitive!.name).toBe(`Verification piece ${characterId}`);
    effectId = String(saved["id"]);
    expect(
      (await readWorkspace(characterId)).edges.some(
        (e) => e.parent === null && e.child === `effect:${effectId}`,
      ),
    ).toBe(true);
  }, 30000);
  it("leaves unchanged saves untouched and serializes conflicting edits", async () => {
    const graph = await readWorkspace(characterId);
    const target = graph.nodes.find((n) => n.id === effectId)!;
    const edge = graph.edges.find(
      (e) => e.child === target.key && e.parent === null,
    )!;
    const base = {
      operation: "edit",
      expectedRevision: graph.revision,
      target: target.key,
      path: [edge.id],
      expectedHash: target.data["contentHash"],
      draft: {},
    };
    const saved = await executeWorkspaceCommand(characterId, caller.id, {
      ...base,
      commandId: randomUUID(),
    });
    expect(saved["outcome"]).toBe("no-op");
    expect(saved["revision"]).toBe(graph.revision);
    const outcomes = await Promise.allSettled(
      ["A", "B"].map((suffix) =>
        executeWorkspaceCommand(characterId, caller.id, {
          ...base,
          commandId: randomUUID(),
          draft: { name: `Concurrent ${suffix} ${characterId}` },
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  }, 30000);
  it("moves membership atomically and undoes it through compensating versions", async () => {
    let graph = await readWorkspace(characterId);
    const response = await create(
      request({
        commandId: randomUUID(),
        expectedRevision: graph.revision,
        kind: "effect",
        category: "LINEAGE",
        draft: {
          name: `Move destination ${characterId}`,
          primitiveSlots: [],
          isPublic: false,
        },
      }),
      context,
    );
    const created = await response.json();
    expect(response.status, JSON.stringify(created)).toBe(200);
    graph = await readWorkspace(characterId);
    const source = graph.nodes.find((n) => n.id === effectId)!;
    const destination = graph.nodes.find((n) => n.id === created.effect.id)!;
    const sourcePath = graph.edges.find(
      (e) => e.child === source.key && e.parent === null,
    )!;
    const destinationPath = graph.edges.find(
      (e) => e.child === destination.key && e.parent === null,
    )!;
    const membership = graph.edges.find(
      (e) => e.parent === source.key && e.child === `primitive:${primitiveId}`,
    )!;
    const commandId = randomUUID();
    const result = await executeWorkspaceCommand(characterId, caller.id, {
      commandId,
      operation: "move-reference",
      expectedRevision: graph.revision,
      target: source.key,
      path: [sourcePath.id],
      expectedHash: source.data["contentHash"],
      edgeId: membership.id,
      destination: destination.key,
      destinationPath: [destinationPath.id],
      destinationHash: destination.data["contentHash"],
    });
    graph = await readWorkspace(characterId);
    expect(
      graph.edges.some(
        (e) => e.parent === source.key && e.child === membership.child,
      ),
    ).toBe(false);
    expect(
      graph.edges.some(
        (e) => e.parent === destination.key && e.child === membership.child,
      ),
    ).toBe(true);
    const current = graph.nodes.find((n) => n.id === String(result["id"]))!;
    await executeWorkspaceCommand(characterId, caller.id, {
      commandId: randomUUID(),
      operation: "undo",
      undoCommandId: commandId,
      expectedRevision: graph.revision,
      target: current.key,
      path: [
        graph.edges.find((e) => e.parent === null && e.child === current.key)!
          .id,
      ],
      expectedHash: current.data["contentHash"],
    });
    graph = await readWorkspace(characterId);
    expect(
      graph.edges.some(
        (e) => e.parent === source.key && e.child === membership.child,
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (e) => e.parent === destination.key && e.child === membership.child,
      ),
    ).toBe(false);
    const instances = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    expect(instances).toHaveLength(1);
  }, 30000);
  it("rolls back creation when the destination is invalid", async () => {
    const graph = await readWorkspace(characterId);
    const response = await create(
      request({
        commandId: randomUUID(),
        expectedRevision: graph.revision,
        kind: "effect",
        category: "MANIFEST",
        draft: {
          name: `Rolled back ${characterId}`,
          primitiveSlots: [],
          isPublic: false,
        },
        target: `primitive:${primitiveId}`,
        path: [
          graph.edges.find((e) => e.child === `primitive:${primitiveId}`)!.id,
        ],
        expectedHash: graph.nodes.find(
          (node) => node.key === `primitive:${primitiveId}`,
        )!.data["contentHash"],
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(
      await db
        .select()
        .from(s.effects)
        .where(eq(s.effects.name, `Rolled back ${characterId}`)),
    ).toHaveLength(0);
  }, 30000);
  it("preserves a shared direct instance and its pinned version through the build modal", async () => {
    const before = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    await db.transaction((tx) =>
      saveCharacterBundles(tx, {
        userId: caller.id,
        characterId,
        level: 5,
        heritages: [],
        primitivesBySource: {},
        capabilitiesBySource: {},
        itemsBySource: {},
      }),
    );
    const after = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    expect(after).toHaveLength(1);
    expect(after[0]!.instanceId).toBe(before[0]!.instanceId);
    expect(after[0]!.directSource).toBe("PERSONAL");
    expect(before[0]!.versionId).not.toBeNull();
    expect(after[0]!.versionId).toBe(before[0]!.versionId);
    expect(after[0]!.slotSource).toBe("PINNED");
    const character = await db.query.characters.findFirst({
      where: eq(s.characters.id, characterId),
    });
    expect(character!.buSpent).toBe(4);
  }, 30000);
  it("detaches and restores a bundle without removing an independent primitive", async () => {
    let graph = await readWorkspace(characterId);
    const target = graph.nodes.find((node) => node.id === effectId)!;
    const path = [
      graph.edges.find(
        (edge) => edge.parent === null && edge.child === target.key,
      )!.id,
    ];
    const commandId = randomUUID();
    const base = {
      target: target.key,
      path,
      expectedHash: target.data["contentHash"],
    };
    await executeWorkspaceCommand(characterId, caller.id, {
      ...base,
      commandId,
      operation: "detach",
      expectedRevision: graph.revision,
    });
    graph = await readWorkspace(characterId);
    expect(graph.edges.some((edge) => edge.child === target.key)).toBe(false);
    const rows = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.originEffectId).toBeNull();
    await executeWorkspaceCommand(characterId, caller.id, {
      ...base,
      commandId: randomUUID(),
      operation: "undo",
      undoCommandId: commandId,
      expectedRevision: graph.revision,
    });
    graph = await readWorkspace(characterId);
    expect(
      graph.edges.some(
        (edge) => edge.parent === null && edge.child === target.key,
      ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(s.characterPrimitives)
        .where(eq(s.characterPrimitives.characterId, characterId)),
    ).toHaveLength(1);
  }, 30000);
  it("imports legacy occurrences idempotently and honors tombstones", async () => {
    const occurrence = {
      id: "legacy-one",
      title: "Narrative injury",
      description: "",
      tags: [],
      modifiers: [],
      active: true,
      createdAt: 1,
      source: "custom",
      durationTier: "manual",
    };
    const response = await consequences(
      request({
        operation: "import",
        commandId: randomUUID(),
        occurrences: [occurrence],
      }),
      context,
    );
    expect(response.status).toBe(200);
    await consequences(
      request({
        operation: "save",
        commandId: randomUUID(),
        changes: [{ id: occurrence.id, expectedRevision: 1, occurrence: null }],
      }),
      context,
    );
    await consequences(
      request({
        operation: "import",
        commandId: randomUUID(),
        occurrences: [occurrence],
      }),
      context,
    );
    const records = await (
      await getConsequences(new Request("http://localhost"), context)
    ).json();
    expect(
      records.records.find((r: { id: string }) => r.id === occurrence.id)
        .occurrence,
    ).toBeNull();
  }, 30000);
  it("clears a manual override durably without changing the automatic base state", async () => {
    const occurrence = {
      id: "override-reset",
      title: "Automatic test",
      description: "",
      tags: [],
      modifiers: [],
      active: true,
      manualOverride: false,
      createdAt: 1,
      source: "sheet-auto",
      durationTier: "manual",
    };
    expect(
      (
        await consequences(
          request({
            operation: "save",
            commandId: randomUUID(),
            changes: [{ id: occurrence.id, expectedRevision: 0, occurrence }],
          }),
          context,
        )
      ).status,
    ).toBe(200);
    const { manualOverride: _override, ...automatic } = occurrence;
    expect(
      (
        await consequences(
          request({
            operation: "save",
            commandId: randomUUID(),
            changes: [
              { id: occurrence.id, expectedRevision: 1, occurrence: automatic },
            ],
          }),
          context,
        )
      ).status,
    ).toBe(200);
    const data = await (
      await getConsequences(new Request("http://localhost"), context)
    ).json();
    const saved = data.records.find(
      (record: { id: string }) => record.id === occurrence.id,
    ).occurrence;
    expect(saved.manualOverride).toBeUndefined();
    expect(saved.active).toBe(true);
  }, 30000);
  it("applies a package once per idempotency key, then allows a deliberate second application", async () => {
    const key = `effect:${effectId}`;
    const p = await (
      await preview(new Request(`http://localhost?key=${key}`), context)
    ).json();
    const command = {
      key,
      commandId: randomUUID(),
      expectedHash: p.hash,
      expectedVitality: p.currentVitality,
      commit: true,
    };
    const response = await apply(request(command), context);
    const first = await response.json();
    expect(response.status, JSON.stringify(first)).toBe(200);
    expect(first.currentVitality).toBe(45);
    const retry = await (await apply(request(command), context)).json();
    expect(retry.applicationId).toBe(first.applicationId);
    const p2 = await (
      await preview(new Request(`http://localhost?key=${key}`), context)
    ).json();
    const second = await (
      await apply(
        request({
          ...command,
          commandId: randomUUID(),
          expectedVitality: p2.currentVitality,
        }),
        context,
      )
    ).json();
    expect(second.currentVitality).toBe(40);
    const logs = await db
      .select()
      .from(s.characterLog)
      .where(
        and(
          eq(s.characterLog.characterId, characterId),
          eq(s.characterLog.kind, "vitality_change"),
        ),
      );
    expect(logs).toHaveLength(2);
  }, 30000);
  it("promotes an application without replaying vitality or buying another instance", async () => {
    const records = await db
      .select()
      .from(s.characterConsequences)
      .where(eq(s.characterConsequences.characterId, characterId));
    const record = records.find((row) => row.occurrence.applicationId)!;
    const before = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    const body = {
      commandId: randomUUID(),
      expectedRevision: record.revision,
      draft: {
        name: `Promoted ${characterId}`,
        category: "CONDITION",
        costTier: "Tier 1: Minor (4 BU anchor)",
        buCost: 4,
        mechanicalOutputText: "",
        narrativeRule: "Recovered deliberately",
        isPublic: false,
        hardModifiers: [],
        consequenceBehavior: {
          timing: "on-use",
          vitalityDelta: -5,
          restrictions: [],
          recovery: "Recover deliberately",
        },
      },
    };
    const params = {
      params: Promise.resolve({
        id: characterId,
        occurrenceId: record.occurrenceId,
      }),
    };
    const response = await promote(request(body), params);
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(
      (await (await promote(request(body), params)).json()).primitive.id,
    ).toBe(result.primitive.id);
    const after = await db
      .select()
      .from(s.characterPrimitives)
      .where(eq(s.characterPrimitives.characterId, characterId));
    expect(after).toEqual(before);
    expect(
      (await db.query.characters.findFirst({
        where: eq(s.characters.id, characterId),
      }))!.currentVitality,
    ).toBe(40);
    const saved = await db.query.characterConsequences.findFirst({
      where: and(
        eq(s.characterConsequences.characterId, characterId),
        eq(s.characterConsequences.occurrenceId, record.occurrenceId),
      ),
    });
    expect(saved!.occurrence.promotedPrimitiveId).toBe(result.primitive.id);
    expect(saved!.occurrence.applicationSnapshot).toEqual(
      record.occurrence.applicationSnapshot,
    );
  }, 30000);
  it("rolls back all consequence changes when one occurrence is stale", async () => {
    const record = await db.query.characterConsequences.findFirst({
      where: and(
        eq(s.characterConsequences.characterId, characterId),
        eq(s.characterConsequences.occurrenceId, "override-reset"),
      ),
    });
    const response = await consequences(
      request({
        operation: "save",
        commandId: randomUUID(),
        changes: [
          {
            id: record!.occurrenceId,
            expectedRevision: record!.revision,
            occurrence: { ...record!.occurrence, title: "Should roll back" },
          },
          { id: "legacy-one", expectedRevision: 0, occurrence: null },
        ],
      }),
      context,
    );
    expect(response.status).toBe(409);
    const after = await db.query.characterConsequences.findFirst({
      where: and(
        eq(s.characterConsequences.characterId, characterId),
        eq(s.characterConsequences.occurrenceId, record!.occurrenceId),
      ),
    });
    expect(after!.occurrence.title).toBe(record!.occurrence.title);
    expect(after!.revision).toBe(record!.revision);
  }, 30000);
  it("mirrors only a direct supply and compensates without changing its bundle", async () => {
    await db
      .update(s.characters)
      .set({ mode: "BUILD" })
      .where(eq(s.characters.id, characterId));
    await db
      .update(s.primitives)
      .set({ isMirrorable: true, mirrorBuCredit: 4 })
      .where(eq(s.primitives.id, primitiveId));
    const graph = await readWorkspace(characterId);
    const target = graph.nodes.find(
      (n) => n.key === `primitive:${primitiveId}`,
    )!;
    const root = graph.edges.find(
      (e) => e.child === target.key && e.parent === null,
    )!;
    expect(root.data?.["directSource"]).toBeTruthy();
    const before = await db.query.characterPrimitives.findMany({
      where: eq(s.characterPrimitives.characterId, characterId),
    });
    const command = {
      commandId: randomUUID(),
      operation: "mirror-instance",
      target: target.key,
      path: [root.id],
      expectedHash: target.data["contentHash"] ?? null,
      expectedRevision: graph.revision,
    };
    const result = await executeWorkspaceCommand(
      characterId,
      caller.id,
      command,
    );
    const next = await readWorkspace(characterId);
    expect(
      next.edges
        .filter((e) => e.parent !== null && e.child === target.key)
        .every((e) => !e.isMirrored),
    ).toBe(true);
    expect(
      next.edges.find((e) => e.parent === null && e.child === target.key)
        ?.isMirrored,
    ).toBe(true);
    const after = await db.query.characterPrimitives.findMany({
      where: eq(s.characterPrimitives.characterId, characterId),
    });
    expect(after).toHaveLength(before.length + 1);
    expect(
      (await executeWorkspaceCommand(characterId, caller.id, command))[
        "revision"
      ],
    ).toBe(result["revision"]);
    await executeWorkspaceCommand(characterId, caller.id, {
      ...command,
      commandId: randomUUID(),
      operation: "undo",
      undoCommandId: command.commandId,
      expectedRevision: next.revision,
    });
    const restored = await db.query.characterPrimitives.findMany({
      where: eq(s.characterPrimitives.characterId, characterId),
    });
    expect(
      restored
        .map((p) => ({
          id: p.instanceId,
          mirror: p.isMirrored,
          direct: p.directSource,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      before
        .map((p) => ({
          id: p.instanceId,
          mirror: p.isMirrored,
          direct: p.directSource,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  }, 30000);
});
