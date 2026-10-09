import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { monsters } from "@/db/schema/monsters";
import { encounterRequest } from "@/lib/encounters/http";
import { pinSummary, EncounterError } from "@/lib/encounters/service";
import {
  shuffleEncounterEntries,
  groupBudgetLimit,
  type EncounterGroup,
} from "@/lib/encounters/groups";
import { readBoundedJson } from "@/lib/http/read-bounded-json";

const input = z
  .object({
    budget: z.number().int().min(1).max(10_000_000),
    count: z.number().int().min(1).max(20),
    mode: z.enum(["total", "perCreature"]).default("total"),
    bossBudget: z
      .number()
      .int()
      .min(1)
      .max(10_000_000)
      .nullable()
      .default(null),
    itemBudget: z
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .nullable()
      .default(null),
    environment: z.string().max(100).default(""),
    role: z.string().max(100).default(""),
  })
  .strict();
export const POST = (request: Request) =>
  encounterRequest(async (owner) => {
    const { budget, count, itemBudget, environment, role, mode, bossBudget } =
      input.parse(await readBoundedJson(request, 4096));
    const limits = { mode, bossBudget };
    const totalLimit = groupBudgetLimit(budget, count, limits);
    const candidateLimit =
      mode === "total" ? budget : Math.max(budget, bossBudget ?? 0);
    let candidates = await db
      .select({
        id: monsters.id,
        version: monsters.version,
        budget: sql<number>`(${monsters.definition}->>'budget')::double precision`,
        role: sql<string>`${monsters.definition}->'catalogue'->>'role'`,
      })
      .from(monsters)
      .where(
        sql`(${monsters.visibility}='PUBLIC' OR ${monsters.userId}=${owner} OR (${monsters.visibility}='FOLLOWERS_ONLY' AND EXISTS(SELECT 1 FROM follows f JOIN users a ON a.id=f.following_id JOIN users v ON v.id=f.follower_id WHERE a.clerk_user_id=${monsters.userId} AND v.clerk_user_id=${owner}))) AND (${monsters.definition}->>'budget')::numeric BETWEEN 1 AND ${candidateLimit} AND (${environment}='' OR ${monsters.definition}->'catalogue'->>'environment'=${environment}) AND (${role}='' OR ${monsters.definition}->'catalogue'->>'role'=${role})`,
      )
      .orderBy(monsters.id)
      .limit(500);
    const cache = new Map<
      string,
      Awaited<ReturnType<typeof pinSummary>>["summary"]
    >();
    const groups: EncounterGroup[] = [];
    const seen = new Set<string>();
    let resolutionReads = 0;
    // Bound the work even if a catalogue contains invalid pins or the equipment limit cannot be met.
    for (let attempt = 0; attempt < 18 && groups.length < 3; attempt++) {
      const entries = shuffleEncounterEntries(
        candidates,
        budget,
        count,
        Math.random,
        limits,
      );
      if (!entries.length) break;
      let invalid = false;
      const unread = entries.filter(
        (entry) => !cache.has(`${entry.templateId}:${entry.version}`),
      );
      if (resolutionReads + unread.length > 36) break;
      resolutionReads += unread.length;
      // Reads are independent; four at a time keeps shuffled proposals responsive without flooding the database.
      for (let offset = 0; offset < unread.length; offset += 4) {
        const resolved = await Promise.all(
          unread.slice(offset, offset + 4).map(async (entry) => {
            try {
              return {
                entry,
                summary: (
                  await pinSummary(owner, entry.templateId, entry.version)
                ).summary,
              };
            } catch {
              return { entry, summary: null };
            }
          }),
        );
        for (const result of resolved) {
          if (result.summary)
            cache.set(
              `${result.entry.templateId}:${result.entry.version}`,
              result.summary,
            );
          else {
            candidates = candidates.filter(
              (c) => c.id !== result.entry.templateId,
            );
            invalid = true;
          }
        }
      }
      if (invalid) continue;
      const creatures = entries.map(
        (e) => cache.get(`${e.templateId}:${e.version}`)!,
      );
      const creatureBu = entries.reduce(
        (n, e, i) => n + creatures[i]!.budget * e.quantity,
        0,
      );
      const itemBu = entries.reduce(
        (n, e, i) => n + creatures[i]!.itemBu * e.quantity,
        0,
      );
      const signature = entries
        .map((e) => `${e.templateId}:${e.version}:${e.quantity}`)
        .sort()
        .join("|");
      if (
        creatureBu > totalLimit ||
        creatures.some(
          (c, i) =>
            c.budget >
            (bossBudget !== null && i === 0
              ? bossBudget
              : mode === "perCreature"
                ? budget
                : totalLimit),
        ) ||
        (itemBudget !== null && itemBu > itemBudget) ||
        seen.has(signature)
      )
        continue;
      seen.add(signature);
      groups.push({
        entries,
        creatures,
        creatureBu,
        itemBu,
        count,
        ...(bossBudget !== null
          ? {
              boss: {
                templateId: entries[0]!.templateId,
                version: entries[0]!.version,
              },
            }
          : {}),
      });
    }
    if (!groups.length)
      throw new EncounterError(
        "Could not find a complete group with these limits. Increase the creature or equipment BU limit, or reduce the creature count.",
      );
    return { groups };
  });
