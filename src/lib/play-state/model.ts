import { consequenceJson } from "@/lib/character/consequences/json";
import { z } from "zod";
export type SubjectKind = "CHARACTER" | "MONSTER_PLAY_COPY" | "ENCOUNTER_RUN";
export type PlayOverrides = Record<string, unknown>;
export type PlayState = { revision: number; overrides: PlayOverrides; fieldRevisions: Record<string, number> };
export const emptyPlayState = (): PlayState => ({ revision: 0, overrides: {}, fieldRevisions: {} });
const field = z.string().max(240).regex(/^(currentVitality|baselineVitality|(?:cap|eff|consequence):[a-zA-Z0-9_-]{1,200}|itemcap:[a-zA-Z0-9_-]{1,100}:[a-zA-Z0-9_-]{1,100})$/);
export const playMutationSchema = z.object({
  opId: z.uuid(), source: z.enum(["manual", "long_rest", "short_rest"]).optional(), baseRevision: z.number().int().min(0).max(2147483646),
  changes: z.array(z.object({ field, value: z.unknown().nullable() }).strict()).min(1).max(64),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.changes.map(c => c.field)).size !== value.changes.length) ctx.addIssue({ code: "custom", message: "Duplicate fields." });
  if (JSON.stringify(value).length > 131072) ctx.addIssue({ code: "custom", message: "Session operation exceeds 128KB." });
  for (const c of value.changes) {
    if ((c.field === "currentVitality" || c.field === "baselineVitality") && c.value !== null && !(typeof c.value === "number" && Number.isSafeInteger(c.value) && c.value >= 0)) ctx.addIssue({ code: "custom", message: "Invalid vitality." });
    if (/^(cap|eff|itemcap):/.test(c.field) && c.value !== null && c.value !== true) ctx.addIssue({ code: "custom", message: "Toggle overrides must be true or cleared." });
  }
});
export type PlayMutation = z.infer<typeof playMutationSchema>;
export class PlayConflict extends Error {
  readonly status = 409;
  constructor(readonly state: PlayState, readonly fields: string[]) { super("Session fields changed on another device."); }
}
export function applyPlayMutation(state: PlayState, mutation: PlayMutation): PlayState {
  if (mutation.baseRevision > state.revision) throw new PlayConflict(state, mutation.changes.map(c => c.field));
  const conflicts = mutation.changes.filter(c => (state.fieldRevisions[c.field] ?? 0) > mutation.baseRevision).map(c => c.field);
  if (conflicts.length) throw new PlayConflict(state, conflicts);
  const changes = mutation.changes.filter(c => consequenceJson(state.overrides[c.field]) !== consequenceJson(c.value));
  if (!changes.length) return state;
  const next: PlayState = { revision: state.revision + 1, overrides: { ...state.overrides }, fieldRevisions: { ...state.fieldRevisions } };
  for (const { field, value } of changes) {
    if (value === null) delete next.overrides[field]; else next.overrides[field] = value;
    next.fieldRevisions[field] = next.revision;
  }
  if (JSON.stringify(next).length > 1048576 || Object.keys(next.fieldRevisions).length > 10000) throw new Error("Session state limit reached. Remove unused session entries.");
  return next;
}
export function sessionBackup(subjectKind: SubjectKind, subjectId: string, buildRefs: string[], state: PlayState) {
  return { format: "swordweave-session", version: 1, subjectKind, subjectId, buildRefs: [...buildRefs].sort(), overrides: state.overrides };
}
export function previewSessionBackup(raw: unknown, kind: SubjectKind, id: string, refs: string[]): PlayOverrides {
  const backup = z.object({ format: z.literal("swordweave-session"), version: z.literal(1), subjectKind: z.enum(["CHARACTER", "MONSTER_PLAY_COPY"]), subjectId: z.uuid(), buildRefs: z.array(z.string()).max(10000), overrides: z.record(z.string(), z.unknown()) }).strict().parse(raw);
  if (backup.subjectKind !== kind || backup.subjectId !== id || JSON.stringify([...backup.buildRefs].sort()) !== JSON.stringify([...refs].sort())) throw new Error("This backup belongs to a different sheet or build. Open the matching sheet before restoring.");
  const changes = Object.entries(backup.overrides).map(([field, value]) => ({ field, value }));
  for (let offset = 0; offset < changes.length; offset += 64) playMutationSchema.parse({ opId: "00000000-0000-4000-8000-000000000000", baseRevision: 0, changes: changes.slice(offset, offset + 64) });
  return backup.overrides;
}
