export type CreationMode = "complete" | "quick";
export type CreationAuthorKind =
  "primitive" | "effect" | "capability" | "heritage" | "item";
export type CreationReturnedEntry = {
  targetType: string;
  targetId: string;
  name: string;
};
export type CreationReturnRecord = {
  token: string;
  draftId: string;
  accountId: string;
  mode: CreationMode;
  kind: CreationAuthorKind;
  heritageKind?: "LINEAGE" | "UPBRINGING" | "MANIFEST";
  createdAt: number;
  result?: CreationReturnedEntry;
};
export const creationDraftKey = (accountId: string, mode: CreationMode) =>
  `swordweave-character-creation:${accountId}:${mode}`;
export const creationModeKey = (accountId: string) =>
  `swordweave-character-creation:${accountId}:mode`;
const returnKey = (token: string) =>
  `swordweave-character-authoring-return:${token}`;
export function createCreationReturn(
  storage: Storage,
  record: CreationReturnRecord,
) {
  storage.setItem(returnKey(record.token), JSON.stringify(record));
  const params = new URLSearchParams({
    build: record.kind,
    new: "1",
    creationReturn: record.token,
  });
  if (record.heritageKind)
    params.set("kind", record.heritageKind.toLowerCase());
  return `/atelier?${params}`;
}
export function readCreationReturn(
  storage: Storage,
  token: string | null,
  accountId: string,
  now = Date.now(),
): CreationReturnRecord | null {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  try {
    const r = JSON.parse(
      storage.getItem(returnKey(token)) ?? "null",
    ) as CreationReturnRecord | null;
    if (
      !r ||
      r.token !== token ||
      r.accountId !== accountId ||
      !r.draftId ||
      !/^[0-9a-f-]{36}$/i.test(r.draftId) ||
      !["complete", "quick"].includes(r.mode) ||
      !["primitive", "effect", "capability", "heritage", "item"].includes(
        r.kind,
      ) ||
      !Number.isFinite(r.createdAt) ||
      now - r.createdAt > 7 * 86400000 ||
      r.createdAt > now + 60000
    )
      return null;
    return r;
  } catch {
    return null;
  }
}
export function setCreationReturnResult(
  storage: Storage,
  token: string,
  accountId: string,
  result: CreationReturnedEntry,
) {
  const record = readCreationReturn(storage, token, accountId);
  if (!record)
    throw new Error(
      "This character creation draft is no longer available for this account.",
    );
  storage.setItem(returnKey(token), JSON.stringify({ ...record, result }));
}
export function consumeCreationReturn(
  storage: Storage,
  token: string,
  accountId: string,
) {
  if (readCreationReturn(storage, token, accountId))
    storage.removeItem(returnKey(token));
}
/** Preserve the existing creation draft shape under its account and identity. */
export function writeCreationDraft(
  storage: Storage,
  key: string,
  draftId: string | null,
  value: string,
) {
  storage.setItem(key, value);
  if (draftId) storage.setItem(`${key}:${draftId}`, value);
}

const legacyKeys: Record<CreationMode, string> = {
  complete: "swordweave-character-creation-v3",
  quick: "swordweave-quickbuild-v1",
};
export function availableLegacyCreationDrafts(
  storage: Storage,
): CreationMode[] {
  return (["complete", "quick"] as const).filter(
    (mode) =>
      !!storage.getItem(legacyKeys[mode]) &&
      !storage.getItem(`${legacyKeys[mode]}:claimedBy`),
  );
}
/** Explicit user action assigns an unscoped old draft once; its original stays intact. */
export function claimLegacyCreationDraft(
  storage: Storage,
  accountId: string,
  mode: CreationMode,
  draftId: string,
) {
  const key = legacyKeys[mode];
  if (storage.getItem(`${key}:claimedBy`))
    throw new Error("This earlier draft has already been resumed.");
  const value = JSON.parse(storage.getItem(key) ?? "null");
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.state
  )
    throw new Error("This earlier draft could not be read.");
  writeCreationDraft(
    storage,
    creationDraftKey(accountId, mode),
    draftId,
    JSON.stringify({ ...value, draftId }),
  );
  storage.setItem(creationModeKey(accountId), mode);
  storage.setItem(`${key}:claimedBy`, accountId);
}
