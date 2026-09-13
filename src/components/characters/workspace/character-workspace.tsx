"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowLeft, Plus, Search } from "lucide-react";
import { BundleContents } from "./bundle-contents";
import { WorkspaceSurface } from "./workspace-surface";
import { WorkspaceEntityPreview } from "./workspace-entity-preview";
import { WorkspaceLibraryPicker } from "./library-picker";
import { EntityComposer } from "./entity-composer";
import { ConsequencePackageAction } from "../consequence-package-action";
import { CapabilityCard } from "../capability-card";
import {
  useToggleState,
  effStorageKey,
  notifyToggleChanged,
} from "@/lib/hooks/use-toggle-state";
import { useRuntimeConditions } from "@/lib/hooks/use-runtime-conditions";
import { activeRestrictions } from "@/lib/character/consequences/types";
import {
  bundleBu,
  canContain,
  validateReference,
  effectiveAvailability,
  supplyPaths,
  type WorkspaceGraph,
  type EntityKey,
  type EntityKind,
  type WorkspaceCategory,
  type WorkspaceNode,
  type WorkspaceEdge,
} from "@/lib/character/workspace/model";
import type { SlotSource } from "@/lib/versions/slot-source";
import { libraryFamilyLabel } from "@/components/library/library-market-rail";
import { formatEquationValue } from "@/lib/engine/equation-formatter";

const categories = [
  ["ALL", "All Primitives"],
  ["LINEAGE", "Lineages"],
  ["UPBRINGING", "Upbringings"],
  ["MANIFEST", "Manifests"],
] as const;
const button =
  "rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
export function CharacterWorkspace({
  characterId,
  mode,
  items = false,
}: {
  characterId: string;
  mode: "BUILD" | "PLAY";
  items?: boolean;
}) {
  const router = useRouter();
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<WorkspaceCategory>(
    items ? "ITEM" : "ALL",
  );
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState<"expressions" | "mastery">("expressions");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selection, setSelection] = useState<EntityKey[]>([]);
  const [composer, setComposer] = useState<{
    kind: EntityKind;
    node?: WorkspaceNode;
    grouping?: boolean;
  } | null>(null);
  const [picker, setPicker] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveReview, setSaveReview] = useState<{
    name: string;
    buSpent: number;
    characterBuDelta: number;
    bundleBu: number;
    members: string[];
    confirm: () => Promise<void>;
    cancel: () => void;
  } | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [detachedUndo, setDetachedUndo] = useState<{
    target: EntityKey;
    path: string[];
    expectedHash: string | null;
  } | null>(null);
  const savedKey = useRef<EntityKey | null>(null);
  const [pending, setPending] = useState<{
    child: EntityKey;
    operation:
      "add-reference" | "remove-reference" | "move-reference" | "detach";
    name?: string;
    category?: string;
    edgeId?: string;
    destination?: EntityKey;
    destinationPath?: string[];
    destinationHash?: string | null;
  } | null>(null);
  const [dragged, setDragged] = useState<EntityKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selecting, setSelecting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const requests = useRef(new Map<string, string>());
  const toggles = useToggleState(characterId);
  const { conditions } = useRuntimeConditions(characterId);
  const restrictions = activeRestrictions(conditions);
  const storageKey = `sw:workspace:${characterId}:${items ? "items" : "capabilities"}`;
  const reload = useCallback(async () => {
    const response = await fetch(`/api/characters/${characterId}/workspace`, {
      cache: "no-store",
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(value.error ?? "Unable to load workspace.");
    setGraph(value);
    return value as WorkspaceGraph;
  }, [characterId]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (saved) {
          setCategory(saved.category);
          setLayout(saved.layout === "list" ? "list" : "grid");
          setExpanded(saved.expanded ?? []);
        }
      } catch {
        /* Start at overview. */
      }
      setReady(true);
      try {
        await reload();
      } catch (error) {
        if (active)
          setError(
            error instanceof Error ? error.message : "Workspace unavailable.",
          );
      }
    });
    const refresh = () => {
      void reload().catch((e) => setError(String(e.message)));
    };
    window.addEventListener("sw:workspace-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("sw:workspace-changed", refresh);
    };
  }, [reload, storageKey]);
  useEffect(() => {
    if (ready)
      localStorage.setItem(
        storageKey,
        JSON.stringify({ category, expanded, layout }),
      );
  }, [ready, storageKey, category, expanded, layout]);
  const selectedEdge = graph?.edges.find((e) => e.id === path.at(-1));
  const selected = graph?.nodes.find((n) => n.key === selectedEdge?.child);
  const [costPreview, setCostPreview] = useState<{
    key: string;
    error?: string;
    characterBuDelta?: number;
    mirrorCreditDelta?: number;
    buSpent?: number;
    changes?: { name: string; before: number; after: number }[];
  } | null>(null);
  const previewBody =
    pending && selected && graph
      ? JSON.stringify({
          target: selected.key,
          path,
          expectedHash: selected.data["contentHash"] ?? null,
          expectedRevision: graph.revision,
          ...pending,
        })
      : null;
  useEffect(() => {
    if (!previewBody) return;
    const controller = new AbortController();
    void fetch(`/api/characters/${characterId}/workspace/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...JSON.parse(previewBody),
        commandId: crypto.randomUUID(),
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        setCostPreview({ key: previewBody, ...value });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCostPreview({ key: previewBody, error: error.message });
      });
    return () => controller.abort();
  }, [characterId, previewBody]);
  const currentPreview = costPreview?.key === previewBody ? costPreview : null;
  const changed = async () => {
    const next = await reload();
    if (savedKey.current) {
      const nextPath = supplyPaths(next, savedKey.current)[0]?.edges.map(
        (e) => e.id,
      );
      if (nextPath) {
        setPath(nextPath);
        const root = next.edges.find((e) => e.id === nextPath[0]);
        if (root) setCategory(root.category);
      }
      savedKey.current = null;
    }
    router.refresh();
    window.dispatchEvent(new CustomEvent("sw:workspace-changed"));
    window.dispatchEvent(new CustomEvent("sw:library-changed"));
  };
  const identity = (data: unknown) => {
    const key = JSON.stringify(data);
    if (!requests.current.has(key))
      requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key)!;
  };
  async function command(
    operation: string,
    extra: Record<string, unknown> = {},
  ) {
    if (
      !graph ||
      (!selected && !extra["target"] && !(operation === "undo" && detachedUndo))
    )
      throw new Error("Select a destination first.");
    const body = {
      operation,
      expectedRevision: graph.revision,
      target: selected?.key,
      path,
      expectedHash: selected?.data["contentHash"] ?? null,
      ...(operation === "undo" && detachedUndo ? detachedUndo : {}),
      ...extra,
    };
    const commandId = identity(body);
    const response = await fetch(`/api/characters/${characterId}/workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, commandId }),
    });
    if (!response.ok) {
      const result = await response.clone().json();
      setError(result.error);
    }
    if (response.ok && operation !== "undo") {
      setLastCommand(commandId);
      setDetachedUndo(
        operation === "detach" && selected
          ? {
              target: selected.key,
              path,
              expectedHash:
                (selected.data["contentHash"] as string | null) ?? null,
            }
          : null,
      );
    }
    return response;
  }
  const performSave: typeof fetch = async (_url, init) => {
    const draft = JSON.parse(String(init?.body ?? "{}"));
    if (composer?.node) {
      const response = await command("edit", { draft });
      if (!response.ok) return response;
      const result = await response.json();
      savedKey.current = `${composer.node.kind}:${result.id}`;
      return Response.json(result.entityResponse);
    }
    const body = {
      kind: composer?.kind,
      draft,
      category:
        composer?.kind === "heritage"
          ? draft.kind
          : category === "ALL"
            ? "MANIFEST"
            : category,
      expectedRevision: graph?.revision,
      ...(selected && !composer?.grouping
        ? {
            target: selected.key,
            path,
            expectedHash: selected.data["contentHash"] ?? null,
          }
        : {}),
    };
    const response = await fetch(
      `/api/characters/${characterId}/workspace/create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, commandId: identity(body) }),
      },
    );
    if (response.ok && composer) {
      const result = await response.clone().json();
      const id =
        result.dispatchOutcome?.newId ??
        result[composer.kind]?.id ??
        result.template?.id;
      if (id) savedKey.current = `${composer.kind}:${id}`;
    }
    return response;
  };
  const saveRequest: typeof fetch = async (url, init) => {
    if (!graph || !composer)
      return Response.json({ error: "Choose a composer." }, { status: 400 });
    const preview = await fetch(
      `/api/characters/${characterId}/workspace/draft-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: composer.kind,
          category:
            composer.kind === "heritage"
              ? JSON.parse(String(init?.body ?? "{}")).kind
              : items
                ? "ITEM"
                : category === "ALL"
                  ? "MANIFEST"
                  : category,
          expectedRevision: graph.revision,
          draft: JSON.parse(String(init?.body ?? "{}")),
          edit: !!composer.node,
          ...(selected && !composer.grouping ? { target: selected.key } : {}),
        }),
      },
    );
    const result = await preview.json();
    if (!preview.ok) {
      setError(result.error);
      return Response.json(result, { status: preview.status });
    }
    return new Promise<Response>((resolve) =>
      setSaveReview({
        ...result,
        confirm: async () => {
          try {
            resolve(await performSave(url, init));
          } catch (error) {
            resolve(
              Response.json(
                {
                  error:
                    error instanceof Error ? error.message : "Save failed.",
                },
                { status: 500 },
              ),
            );
          } finally {
            setSaveReview(null);
          }
        },
        cancel: () => {
          setSaveReview(null);
          resolve(
            Response.json(
              { error: "Save cancelled. Your draft is retained." },
              { status: 409 },
            ),
          );
        },
      }),
    );
  };
  function chooseCategory(value: WorkspaceCategory) {
    setPreview(false);
    setCategory(value);
    setPath([]);
    setSelection([]);
    setComposer(null);
    setPicker(false);
    setLibraryOpen(false);
  }
  function openEdge(edge: WorkspaceEdge, parentPath: string[] = path) {
    setPreview(false);
    setPath([...parentPath, edge.id]);
    setSelection([]);
    setComposer(null);
    setPicker(false);
    setLibraryOpen(false);
  }
  if (!graph)
    return (
      <div className="rounded border border-border p-6">
        {error ? <p role="alert">{error}</p> : "Loading character workspace…"}
      </div>
    );
  const roots = graph.edges.filter(
    (e) =>
      e.parent === null &&
      (items ? e.category === "ITEM" : e.category !== "ITEM"),
  );
  const nodes = selected
    ? graph.edges
        .filter((e) => e.parent === selected.key)
        .map((e) => ({
          node: graph.nodes.find((n) => n.key === e.child)!,
          edge: e,
        }))
        .filter((r) => r.node)
    : !items && lens === "mastery"
      ? graph.nodes
          .filter((n) => n.kind === "primitive" && (category === "ALL" || supplyPaths(graph, n.key).some(p => p.edges[0]?.category === category)))
          .map((node) => ({ node, edge: undefined }))
      : roots
          .filter((e) => category === "ALL" || e.category === category)
          .map((edge) => ({
            node: graph.nodes.find((n) => n.key === edge.child)!,
            edge,
          }))
          .filter((r) => r.node);
  const visible = nodes.filter(({ node }) => {
    const paths = supplyPaths(graph, node.key);
    const available = effectiveAvailability(
      node.key,
      paths,
      restrictions,
      toggles.offCapabilityIds,
      toggles.offEffectIds,
    ).available;
    return (
      node.name.toLowerCase().includes(query.toLowerCase()) &&
      (typeFilter === "all" ||
        (lens === "mastery" && !selected
          ? String(node.data["category"]) === typeFilter
          : node.kind === typeFilter)) &&
      (availability === "all" ||
        available === (availability === "available")) &&
      (sourceFilter === "all" ||
        (sourceFilter === "item"
          ? paths.some((p) => p.item)
          : paths.some((p) => p.edges[0]?.category === sourceFilter)))
    );
  });
  const creationKinds: EntityKind[] = selected
    ? (
        [
          "primitive",
          "effect",
          "capability",
          "heritage",
          "item",
        ] as EntityKind[]
      ).filter((kind) => canContain(selected.kind, kind))
    : items
      ? ["item"]
      : ["primitive", "capability", "effect", "heritage"];
  const currentCategory =
    category === "LINEAGE" || category === "UPBRINGING" ? category : "MANIFEST";
  const candidates = selected
    ? graph.nodes.filter(
        (n) =>
          canContain(selected.kind, n.kind) &&
          !graph.edges.some(
            (e) => e.parent === selected.key && e.child === n.key,
          ),
      )
    : [];
  function addToDestination(
    child: EntityKey,
    destination: EntityKey,
    destinationPath: string[],
  ) {
    const invalid = validateReference(graph!, destination, child);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPath(destinationPath);
    setPending({ child, operation: "add-reference" });
    setError(null);
  }
  const rowContext = {
    graph,
    mode,
    selected,
    path,
    expanded,
    selection,
    selecting,
    dragged,
    restrictions,
    toggles,
    setExpanded,
    setSelection,
    setPath: (next: SetStateAction<string[]>) => {
      setPath(next);
      setQuery("");
      setTypeFilter("all");
      setSourceFilter("all");
      setAvailability("all");
      setSelection([]);
    },
    setComposer,
    setPreview,
    setDragged,
    setPending,
    setError,
    addToDestination,
    command,
    changed,
    onSaved: (key: EntityKey) => {
      savedKey.current = key;
    },
  };

  return (
    <div className="v12-character-workspace space-y-5" data-layout={layout}>
      {!items && <nav className="v12-projection-tabs" aria-label="Character information view">
        {(["expressions", "mastery"] as const).map(value => <button key={value} aria-pressed={lens === value} onClick={() => { setLens(value); chooseCategory("ALL"); setTypeFilter("all"); }}>
          {value === "expressions" ? "Capabilities and traits" : "All primitives"}
        </button>)}
        <p>{lens === "expressions" ? "Grouped by what grants them" : "Grouped by Lexicon Category / Market family"}</p>
      </nav>}
      <nav
        aria-label="Character categories"
        className="v12-character-workspace-tabs grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {(items ? [["ITEM", "Items"]] : categories).map(([key, label]) => (
          <button
            key={key}
            className={`${button} ${category === key ? "bg-primary/15 text-primary border-primary" : ""}`}
            aria-pressed={category === key}
            onClick={() => chooseCategory(key as WorkspaceCategory)}
          >
            {key === "ALL" ? "All sources" : label}
          </button>
        ))}
      </nav>
      <WorkspaceSurface
        modal={!!selected || !!composer}
        title={
          composer
            ? `${composer.node ? "Edit" : "Create"} ${composer.kind}`
            : (selected?.name ?? "Character")
        }
        onClose={() => {
          if (saveReview) {
            saveReview.cancel();
            return;
          }
          if (composer) {
            setComposer(null);
            return;
          }
          setPath([]);
          setPreview(false);
          setPending(null);
        }}
      >
        <section className="v12-character-workspace-surface min-w-0 space-y-4" aria-label="Selected workspace">
          <div
            className={
              path.length
                ? "flex flex-wrap items-center gap-2 text-sm"
                : "hidden"
            }
          >
            <button
              className="text-muted-foreground hover:text-primary"
              onClick={() => {
                setPath([]);
                setComposer(null);
              }}
            >
              Overview
            </button>
            {path.map((id, index) => {
              const e = graph.edges.find((e) => e.id === id);
              return (
                <button
                  key={id}
                  className="flex items-center gap-1 text-primary"
                  onClick={() => {
                    setPath(path.slice(0, index + 1));
                    setComposer(null);
                  }}
                >
                  <ChevronRight className="size-3" />
                  {graph.nodes.find((n) => n.key === e?.child)?.name ??
                    "Removed"}
                </button>
              );
            })}
          </div>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className={
                  selected || composer ? "sr-only" : "text-2xl font-semibold"
                }
              >
                {composer
                  ? `${composer.node ? "Edit" : "Create"} ${composer.kind}`
                  : (selected?.name ??
                    (items
                      ? "Items"
                      : category === "ALL" ? (lens === "mastery" ? "Flat primitive ledger" : "Granted expressions") : categories.find((c) => c[0] === category)?.[1]))}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {composer
                  ? "Name it and choose what to include."
                  : selected
                    ? selected.kind === "primitive"
                      ? "Modifiers and rules."
                      : "Contents and actions."
                    : "Choose a card to see its contents, or add something new."}
              </p>
            </div>
            {path.length > 0 && (
              <button
                className={button}
                onClick={() => {
                  if (composer) setComposer(null);
                  else setPath(path.slice(0, -1));
                }}
              >
                <ArrowLeft className="mr-1 inline size-4" />
                {composer
                  ? `Back to ${selected?.name ?? "character"}`
                  : path.length > 1
                    ? `Back to ${graph.nodes.find((n) => n.key === graph.edges.find((e) => e.id === path.at(-2))?.child)?.name ?? "character"}`
                    : "Back to character"}
              </button>
            )}
          </header>
          {saveReview && (
            <div
              role="region"
              aria-label="Review authored content"
              className="sticky top-0 z-20 space-y-3 rounded-lg border border-primary bg-card p-5 shadow-xl"
            >
              <h3 className="font-semibold">Save {saveReview.name}</h3>
              <p>
                Character BU: {saveReview.buSpent} →{" "}
                {saveReview.buSpent + saveReview.characterBuDelta}
              </p>
              <p>
                Bundle content: {saveReview.bundleBu} {items ? "Item BU" : "BU"}
              </p>
              {saveReview.members.length ? (
                <ul className="list-inside list-disc">
                  {saveReview.members.map((member, index) => (
                    <li key={index}>{member}</li>
                  ))}
                </ul>
              ) : (
                <p>This definition has no bundled pieces yet.</p>
              )}
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => {
                    setBusy(true);
                    void saveReview.confirm().finally(() => setBusy(false));
                  }}
                >
                  Confirm save
                </button>
                <button
                  disabled={busy}
                  className={button}
                  onClick={saveReview.cancel}
                >
                  Keep editing
                </button>
              </div>
            </div>
          )}
          {selected && !composer && (
            <button className={button} onClick={() => setPreview(!preview)}>
              {preview ? "Back to contents" : "Preview"}
            </button>
          )}
          {selected && preview && !composer && (
            <WorkspaceEntityPreview
              node={selected}
              graph={graph}
              onOpen={(key) => {
                const edge = graph.edges.find(
                  (e) => e.parent === selected.key && e.child === key,
                );
                if (edge) {
                  openEdge(edge);
                  setPreview(true);
                }
              }}
            />
          )}
          {error && (
            <div className="rounded border border-destructive p-3 text-sm">
              <p role="alert" className="text-destructive">
                {error}
              </p>
              <button
                className={`${button} mt-2`}
                onClick={() => {
                  void reload()
                    .then(() => setError(null))
                    .catch((e) => setError(e.message));
                }}
              >
                Refresh character data; keep my draft
              </button>
            </div>
          )}
          {composer ? (
            <EntityComposer
              key={`${composer.kind}:${composer.node?.key ?? "new"}`}
              graph={graph}
              node={composer.node}
              kind={composer.kind}
              category={currentCategory}
              selection={composer.grouping ? selection : []}
              saveRequest={saveRequest}
              onSaved={() => {
                setComposer(null);
                setSelection([]);
                setSelecting(false);
                void changed().catch((e) => setError(e.message));
              }}
            />
          ) : (
            <>
              {mode === "BUILD" && !preview && (
                <div className="flex flex-wrap gap-2">
                  {selected && (
                    <button
                      className={button}
                      onClick={() =>
                        setComposer({ kind: selected.kind, node: selected })
                      }
                    >
                      Edit {selected.kind}
                    </button>
                  )}
                  {selected && selectedEdge?.parent === null && (
                    <button
                      className={button}
                      onClick={() =>
                        setPending({ child: selected.key, operation: "detach" })
                      }
                    >
                      Remove from character
                    </button>
                  )}
                  {creationKinds.length > 0 && (
                    <details className="relative sm:hidden">
                      <summary className={`${button} cursor-pointer list-none`}>
                        + Create
                      </summary>
                      <div className="absolute left-0 top-full z-30 mt-1 flex min-w-48 flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
                        {creationKinds.map((kind) => (
                          <button
                            key={kind}
                            className={`${button} text-left`}
                            onClick={() => setComposer({ kind })}
                          >
                            Create {kind}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="hidden sm:contents">
                    {creationKinds.map((kind) => (
                      <button
                        key={kind}
                        className={button}
                        onClick={() => setComposer({ kind })}
                      >
                        <Plus className="mr-1 inline size-3" />
                        Create {kind}
                      </button>
                    ))}
                  </div>
                  {creationKinds.length > 0 && (
                    <button
                      className={button}
                      onClick={() => setLibraryOpen(!libraryOpen)}
                    >
                      Library
                    </button>
                  )}
                  {lastCommand && (selected || detachedUndo) && (
                    <button
                      className={button}
                      onClick={() => {
                        void command("undo", { undoCommandId: lastCommand })
                          .then(async (r) => {
                            const data = await r.json();
                            if (!r.ok) throw new Error(data.error);
                            setLastCommand(null);
                            setDetachedUndo(null);
                            await changed();
                          })
                          .catch((e) => setError(e.message));
                      }}
                    >
                      Undo last change
                    </button>
                  )}
                  {selected && selected.kind !== "primitive" && (
                    <button
                      className={button}
                      onClick={() => setPicker(!picker)}
                    >
                      On this character
                    </button>
                  )}
                  <button
                    className={button}
                    aria-pressed={selecting}
                    onClick={() => {
                      setSelecting(!selecting);
                      setSelection([]);
                    }}
                  >
                    {selecting ? "Done selecting" : "Select pieces"}
                  </button>
                  {selection.length > 0 && (
                    <>
                      <span className="self-center text-sm">
                        {selection.length} selected
                      </span>
                      {(["effect", "capability", "heritage"] as EntityKind[])
                        .filter((kind) =>
                          selection.every((key) =>
                            canContain(
                              kind,
                              graph.nodes.find((n) => n.key === key)!.kind,
                            ),
                          ),
                        )
                        .map((kind) => (
                          <button
                            key={kind}
                            className={button}
                            onClick={() =>
                              setComposer({ kind, grouping: true })
                            }
                          >
                            Group as {kind}
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
              {libraryOpen && (
                <WorkspaceLibraryPicker
                  kinds={creationKinds}
                  category={category}
                  onSelect={(child, name, heritageType) =>
                    setPending({
                      child,
                      name,
                      ...(heritageType ? { category: heritageType } : {}),
                      operation: "add-reference",
                    })
                  }
                />
              )}
              {picker && (
                <div className="space-y-2 rounded border border-border p-3">
                  <p className="font-medium">
                    Add a reference from this character
                  </p>
                  {candidates.map((n) => (
                    <button
                      key={n.key}
                      className={`${button} mr-2`}
                      onClick={() =>
                        setPending({ child: n.key, operation: "add-reference" })
                      }
                    >
                      {n.name}
                    </button>
                  ))}
                  {!candidates.length && (
                    <p className="text-sm text-muted-foreground">
                      No compatible pieces available.
                    </p>
                  )}
                </div>
              )}
              {selected?.description &&
                selected.description !== "null" &&
                !preview && (
                  <p className="whitespace-pre-wrap text-sm">
                    {selected.description}
                  </p>
                )}
              {selected?.kind === "effect" && mode === "PLAY" && (
                <button
                  className={button}
                  aria-pressed={!toggles.offEffectIds.has(selected.id)}
                  onClick={() => {
                    const key = effStorageKey(characterId, selected.id);
                    if (toggles.offEffectIds.has(selected.id))
                      localStorage.removeItem(key);
                    else localStorage.setItem(key, "1");
                    notifyToggleChanged();
                  }}
                >
                  {toggles.offEffectIds.has(selected.id)
                    ? "Enable effect"
                    : "Disable effect"}
                </button>
              )}
              {selected &&
                (selected.kind === "effect" || selected.kind === "primitive") &&
                mode === "PLAY" && (
                  <ConsequencePackageAction
                    characterId={characterId}
                    entityKey={selected.key}
                  />
                )}
              {selected?.kind === "capability" && mode === "PLAY" && (
                <CapabilityCard
                  characterId={characterId}
                  showPrimitives={false}
                  capability={{
                    id: selected.id,
                    name: selected.name,
                    type: String(selected.data["type"]),
                    sourceType: String(selected.data["sourceType"]),
                    acquiredAtLevel: Number(
                      selectedEdge?.data?.["acquiredAtLevel"] ?? 1,
                    ),
                    versionId: selected.versionId,
                    latestVersionId: selected.latestVersionId,
                    slotSource: (selectedEdge?.slotSource ??
                      null) as SlotSource | null,
                    verboseDescription: selected.description,
                  }}
                />
              )}
              {preview ? null : selected?.kind === "primitive" ? (
                <WorkspaceEntityPreview
                  node={selected}
                  graph={graph}
                  onOpen={() => {}}
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex gap-1" aria-label="Card layout">
                      {(["grid", "list"] as const).map((value) => (
                        <button
                          key={value}
                          className={`${button} ${layout === value ? "bg-primary/15 text-primary" : ""}`}
                          aria-pressed={layout === value}
                          onClick={() => setLayout(value)}
                        >
                          {value === "grid" ? "Grid" : "List"}
                        </button>
                      ))}
                    </div>
                    <label className="flex min-w-40 flex-1 items-center gap-2 rounded border border-border bg-card px-3">
                      <Search className="size-4" />
                      <input
                        aria-label="Search pieces"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-transparent py-2 outline-none"
                        placeholder="Search pieces…"
                      />
                    </label>
                    <details className="relative">
                      <summary className={`${button} cursor-pointer list-none`}>
                        Filters
                        {[sourceFilter, availability, typeFilter].some(
                          (v) => v !== "all",
                        )
                          ? " •"
                          : ""}
                      </summary>
                      <div className="absolute right-0 top-full z-20 mt-1 flex w-56 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-xl">
                        <select
                          aria-label="Filter source"
                          className={button}
                          value={sourceFilter}
                          onChange={(e) => setSourceFilter(e.target.value)}
                        >
                          <option value="all">All sources</option>
                          <option value="LINEAGE">Lineages</option>
                          <option value="UPBRINGING">Upbringings</option>
                          <option value="MANIFEST">Manifests</option>
                          <option value="item">Item contribution</option>
                        </select>
                        <select
                          aria-label="Filter availability"
                          className={button}
                          value={availability}
                          onChange={(e) => setAvailability(e.target.value)}
                        >
                          <option value="all">Any availability</option>
                          <option value="available">Available</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                        <select
                          aria-label="Filter type"
                          className={button}
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                        >
                          <option value="all">All types</option>
                          {(lens === "mastery" && !selected
                            ? [
                                ...new Set(
                                  graph.nodes
                                    .filter((n) => n.kind === "primitive")
                                    .map((n) => String(n.data["category"])),
                                ),
                              ]
                            : [
                                "primitive",
                                "capability",
                                "effect",
                                "heritage",
                                "item",
                              ]
                          ).map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                    </details>
                  </div>
                  <div
                    data-v12-source-grid
                    className={
                      !selected && !items && lens === "expressions" ? "v12-expression-sources space-y-4" : layout === "grid"
                        ? "grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3"
                        : "space-y-3"
                    }
                    onDragOver={(e) => {
                      if (
                        mode === "BUILD" &&
                        selected &&
                        e.dataTransfer.types.includes(
                          "application/swordweave-reference",
                        )
                      ) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "link";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const child = e.dataTransfer.getData(
                        "application/swordweave-reference",
                      ) as EntityKey;
                      if (selected && child)
                        setPending({ child, operation: "add-reference" });
                    }}
                  >
                    {!selected && !items && lens === "mastery" ? (
                      <div className="v12-mastery-ledger">
                        {Array.from(new Set(visible.map(({ node }) => String(node.data["category"] ?? "UNCLASSIFIED")))).map(family => {
                          const members = visible.filter(({ node }) => String(node.data["category"] ?? "UNCLASSIFIED") === family);
                          return <section className="v12-mastery-family" key={family}>
                            <header><div><p className="v12-kicker">Lexicon Category</p><h3>{libraryFamilyLabel({value: family, label: family})}</h3></div><span className="v12-tag">{members.length}</span></header>
                            {members.map(({node}) => <div className="v12-mastery-entry" key={node.key}>
                              <WorkspaceRow node={node} context={rowContext} />
                              <div className="v12-mastery-paths" aria-label={`Supply paths for ${node.name}`}>
                                {supplyPaths(graph, node.key).map(supply => <button key={supply.edges.map(e => e.id).join("/")} onClick={() => { setPath(supply.edges.map(e => e.id)); setPreview(false); }}>
                                  {supply.nodes.slice(0, -1).map(key => graph.nodes.find(n => n.key === key)?.name ?? key).join(" → ") || "Direct mastery"}
                                  {supply.edges.some(e => e.isMirrored) ? " · Mirrored" : ""}
                                  {supply.edges.at(-1)?.versionId ? " · Pinned version" : ""}
                                </button>)}
                              </div>
                            </div>)}
                          </section>;
                        })}
                      </div>
                    ) : visible.map(({ node, edge }) => (
                      <WorkspaceRow
                        key={edge?.id ?? node.key}
                        node={node}
                        edge={edge}
                        context={rowContext}
                      />
                    ))}
                    {!visible.length && (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                        {query
                          ? "No matching pieces."
                          : "This space is ready for your first piece."}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {pending && (
            <div
              role="dialog"
              aria-label="Review membership change"
              className="rounded-lg border border-primary bg-card p-4"
            >
              <h3 className="font-semibold">
                {pending.operation === "add-reference"
                  ? "Add reference"
                  : pending.operation === "move-reference"
                    ? "Move membership"
                    : pending.operation === "detach"
                      ? "Remove from character"
                      : "Remove reference"}
              </h3>
              <p className="my-2 text-sm">
                {pending.name ??
                  graph.nodes.find((n) => n.key === pending.child)?.name}{" "}
                {pending.operation === "add-reference"
                  ? "will be included in"
                  : "will be removed from"}{" "}
                {selected?.name ?? currentCategory.toLowerCase()}
                {pending.destination
                  ? ` and added to ${graph.nodes.find((n) => n.key === pending.destination)?.name}`
                  : ""}
                .{" "}
                {pending.operation === "detach"
                  ? "This removes the character reference. Other supplying bundles remain intact."
                  : "Saving versions your bundle or creates your fork. The referenced piece stays unchanged."}
              </p>
              {selected && (
                <div className="my-3 space-y-1 rounded border border-border p-3 text-sm">
                  {currentPreview?.error ? (
                    <p role="alert">{currentPreview.error}</p>
                  ) : currentPreview ? (
                    <>
                      <p>
                        Character BU: {currentPreview.buSpent} →{" "}
                        {(currentPreview.buSpent ?? 0) +
                          (currentPreview.characterBuDelta ?? 0)}{" "}
                        (
                        {(currentPreview.characterBuDelta ?? 0) >= 0 ? "+" : ""}
                        {currentPreview.characterBuDelta})
                      </p>
                      <p>
                        Mirror credit change: {currentPreview.mirrorCreditDelta}
                      </p>
                      {currentPreview.changes?.map((c) => (
                        <p key={c.name}>
                          {c.name}: {c.before} → {c.after} character supply
                          paths
                        </p>
                      ))}
                    </>
                  ) : (
                    <p>Calculating membership and costs…</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  disabled={
                    busy ||
                    (!!selected && (!currentPreview || !!currentPreview.error))
                  }
                  className={button}
                  onClick={() => {
                    setBusy(true);
                    void (
                      selected
                        ? command(pending.operation, pending)
                        : (() => {
                            const [kind, existingId] = pending.child.split(":");
                            const body = {
                              kind,
                              existingId,
                              draft: {},
                              category:
                                pending.category ??
                                (category === "ALL" ? "MANIFEST" : category),
                              expectedRevision: graph.revision,
                            };
                            return fetch(
                              `/api/characters/${characterId}/workspace/create`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  ...body,
                                  commandId: identity(body),
                                }),
                              },
                            );
                          })()
                    )
                      .then(async (r) => {
                        const result = await r.json();
                        if (!r.ok) throw new Error(result.error);
                        if (selected && result.id)
                          savedKey.current = `${selected.kind}:${result.id}`;
                        setPending(null);
                        setPicker(false);
                        setLibraryOpen(false);
                        await changed();
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  {pending.operation === "detach"
                    ? "Remove from character"
                    : selected
                      ? `Save ${selected.kind === "heritage" ? String(selected.data["kind"] ?? "heritage").toLowerCase() : selected.kind}`
                      : "Add to character"}
                </button>
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </WorkspaceSurface>
    </div>
  );
}

type PendingMembership = {
  child: EntityKey;
  operation: "add-reference" | "remove-reference" | "move-reference" | "detach";
  name?: string;
  category?: string;
  edgeId?: string;
  destination?: EntityKey;
  destinationPath?: string[];
  destinationHash?: string | null;
};
type RowContext = {
  graph: WorkspaceGraph;
  mode: "BUILD" | "PLAY";
  selected: WorkspaceNode | undefined;
  path: string[];
  expanded: string[];
  selection: EntityKey[];
  selecting: boolean;
  dragged: EntityKey | null;
  restrictions: ReturnType<typeof activeRestrictions>;
  toggles: ReturnType<typeof useToggleState>;
  setExpanded: Dispatch<SetStateAction<string[]>>;
  setSelection: Dispatch<SetStateAction<EntityKey[]>>;
  setPath: Dispatch<SetStateAction<string[]>>;
  setComposer: (value: null) => void;
  setPreview: Dispatch<SetStateAction<boolean>>;
  setDragged: Dispatch<SetStateAction<EntityKey | null>>;
  setPending: Dispatch<SetStateAction<PendingMembership | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  addToDestination: (
    child: EntityKey,
    destination: EntityKey,
    path: string[],
  ) => void;
  command: (
    operation: string,
    extra?: Record<string, unknown>,
  ) => Promise<Response>;
  changed: () => Promise<void>;
  onSaved: (key: EntityKey) => void;
};
function WorkspaceRow({
  node,
  edge,
  context,
}: {
  node: WorkspaceNode;
  edge?: WorkspaceEdge | undefined;
  context: RowContext;
}) {
  const {
    graph,
    mode,
    selected,
    path,
    expanded,
    selection,
    selecting,
    dragged,
    restrictions,
    toggles,
    setExpanded,
    setSelection,
    setPath,
    setComposer,
    setPreview,
    setDragged,
    setPending,
    setError,
    addToDestination,
    command,
    changed,
    onSaved,
  } = context;
  const paths = supplyPaths(graph!, node.key);
  const state = effectiveAvailability(
    node.key,
    paths,
    restrictions,
    toggles.offCapabilityIds,
    toggles.offEffectIds,
  );
  const id = edge?.id ?? node.key;
  const open = expanded.includes(id);
  const destinations = graph!.nodes
    .filter(
      (n) =>
        n.key !== selected?.key && !validateReference(graph!, n.key, node.key),
    )
    .flatMap((n) =>
      supplyPaths(graph!, n.key).map((p) => ({
        node: n,
        path: p.edges.map((e) => e.id),
        label: p.nodes
          .map((k) => graph!.nodes.find((v) => v.key === k)?.name)
          .join(" → "),
      })),
    );
  const validDrop = !!dragged && !validateReference(graph!, node.key, dragged);
  return (
    <article
      key={id}
      data-v12-workspace-row
      data-workspace-kind={node.kind}
      className={`rounded-lg border bg-card ${validDrop ? "border-primary ring-1 ring-primary" : "border-border"}`}
      draggable={mode === "BUILD"}
      onDragEnd={() => setDragged(null)}
      onDragStart={(e) => {
        setDragged(node.key);
        e.dataTransfer.setData("application/swordweave-reference", node.key);
        e.dataTransfer.effectAllowed = "link";
      }}
      onDragOver={(e) => {
        if (mode === "BUILD" && validDrop) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "link";
        }
      }}
      onDrop={(e) => {
        if (mode !== "BUILD") return;
        e.preventDefault();
        e.stopPropagation();
        const child = e.dataTransfer.getData(
          "application/swordweave-reference",
        ) as EntityKey;
        const destinationPath = edge
          ? [...(selected ? path : []), edge.id]
          : (paths[0]?.edges.map((e) => e.id) ?? []);
        addToDestination(child, node.key, destinationPath);
        setDragged(null);
      }}
    >
      {validDrop && (
        <p className="px-3 pt-2 text-xs text-primary">
          Drop to add a reference
        </p>
      )}
      <div className="v12-workspace-row-head flex flex-wrap items-center gap-2 px-3 py-3">
        {mode === "BUILD" && selecting && (
          <input
            type="checkbox"
            aria-label={`Select ${node.name}`}
            checked={selection.includes(node.key)}
            onChange={(e) =>
              setSelection((s) =>
                e.target.checked
                  ? [...s, node.key]
                  : s.filter((k) => k !== node.key),
              )
            }
          />
        )}
        <button
          className={`rounded p-1 hover:bg-secondary ${node.kind === "heritage" ? "v12-source-medallion" : ""}`}
          aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
          aria-expanded={open}
          onClick={() =>
            setExpanded((previous) =>
              open ? previous.filter((k) => k !== id) : [...previous, id],
            )
          }
        >
          {node.kind === "heritage" ? <span aria-hidden="true">{String(node.data["kind"]).toUpperCase() === "LINEAGE" ? "♜" : String(node.data["kind"]).toUpperCase() === "UPBRINGING" ? "⚔" : "✦"}</span> : <ChevronRight className={`size-4 ${open ? "rotate-90" : ""}`} />}
        </button>
        <button
          className="min-w-0 flex-1 text-left font-medium hover:text-primary"
          onClick={() => {
            const chosen = edge
              ? [...(selected ? path : []), edge.id]
              : (paths[0]?.edges.map((e) => e.id) ?? []);
            setPath(chosen);
            setComposer(null);
            setPreview(false);
          }}
        >
          {node.kind === "heritage" && <span className="v12-kicker block">{String(node.data["kind"] ?? "Heritage").replaceAll("_", " ")}</span>}
          <span className="v12-workspace-entry-name">{node.name}</span>
        </button>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <span className="v12-workspace-kind text-xs text-muted-foreground">
            {node.kind === "primitive"
              ? String(node.data["category"]).replaceAll("_", " ").toLowerCase()
              : node.kind}
          </span>
          <span className="min-w-12 text-right text-sm">
            {bundleBu(graph!, node.key)}{" "}
            {node.kind === "item" ? "Item BU" : "BU"}
          </span>
          <span
            className={`text-xs ${state.available ? "text-primary" : "text-muted-foreground"}`}
          >
            {state.available ? "Available" : "Unavailable"}
          </span>
          <button
            className={button}
            onClick={() => {
              const chosen = edge
                ? [...(selected ? path : []), edge.id]
                : (paths[0]?.edges.map((e) => e.id) ?? []);
              setPath(chosen);
              setComposer(null);
              setPreview(true);
            }}
          >
            Preview
          </button>
        </div>
      </div>
      {mode === "PLAY" && node.kind === "capability" && (
        <div className="px-4 pb-3">
          <button
            className={`${button} bg-primary/15 text-primary`}
            onClick={() => {
              setPath(
                edge
                  ? [...(selected ? path : []), edge.id]
                  : (paths[0]?.edges.map((e) => e.id) ?? []),
              );
              setComposer(null);
              setPreview(false);
            }}
          >
            Use {node.name}
          </button>
        </div>
      )}
      {mode === "PLAY" && node.kind === "effect" && (
        <div className="px-4 pb-3">
          <button
            className={button}
            aria-pressed={!toggles.offEffectIds.has(node.id)}
            onClick={() => {
              const key = effStorageKey(graph.characterId, node.id);
              if (toggles.offEffectIds.has(node.id))
                localStorage.removeItem(key);
              else localStorage.setItem(key, "1");
              notifyToggleChanged();
            }}
          >
            {toggles.offEffectIds.has(node.id)
              ? "Enable effect"
              : "Disable effect"}
          </button>
        </div>
      )}
      {node.kind === "primitive" && typeof node.data["mechanicalOutputText"] === "string" && node.data["mechanicalOutputText"] && node.data["mechanicalOutputText"] !== node.description && (
        <p className="v12-rule-text px-4 pb-3">{node.data["mechanicalOutputText"]}</p>
      )}
      {node.description && node.description !== "null" && !open && (
        <p className="line-clamp-2 px-4 pb-3 text-sm text-muted-foreground">
          {node.description}
        </p>
      )}
      {node.kind !== "primitive" && (
        <BundleContents
          node={node}
          graph={graph}
          onOpen={(childEdge, ancestors) => {
            const base = edge
              ? [...(selected ? path : []), edge.id]
              : (paths[0]?.edges.map((e) => e.id) ?? []);
            setPath([...base, ...ancestors, childEdge.id]);
            setComposer(null);
          }}
        />
      )}
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3 text-sm">
          {node.description && node.description !== "null" && (
            <p className="whitespace-pre-wrap">{node.description}</p>
          )}
          {(Array.isArray(node.data["hardModifiers"])
            ? node.data["hardModifiers"]
            : []
          ).map((m: Record<string, unknown>, i: number) => (
            <p key={i}>
              {String(m["target"])} · {String(m["operation"])}{" "}
              {formatEquationValue(m["value"] as never)}
            </p>
          ))}
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              Details · author, version and sources
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Author: {String(node.data["workspaceAuthor"] ?? "System")} ·
              Version:{" "}
              {node.data["workspaceVersionNumber"]
                ? `v${node.data["workspaceVersionNumber"]}`
                : "Unversioned"}{" "}
              {node.latestVersionId && node.versionId !== node.latestVersionId
                ? "· Update available"
                : "· Current"}{" "}
              ·{" "}
              {paths.some((p) => p.edges.some((e) => e.isMirrored))
                ? "Mirrored supply"
                : "Standard"}
            </p>
            <div>
              <p className="font-medium">Supplied by</p>
              {paths.map((p, i) => (
                <button
                  key={i}
                  className="block py-1 text-left text-xs text-primary hover:underline"
                  onClick={() => setPath(p.edges.slice(0, -1).map((e) => e.id))}
                >
                  {p.nodes
                    .slice(0, -1)
                    .map((k) => graph!.nodes.find((n) => n.key === k)?.name)
                    .join(" → ") || "Direct character instance"}
                  {p.item ? " · Item BU" : ""}
                </button>
              ))}
            </div>
          </details>
          {!state.available && (
            <p>{state.reasons.join("; ") || "No active supply path"}</p>
          )}
          {mode === "BUILD" && selected && edge && (
            <button
              className={button}
              onClick={async () => {
                try {
                  const members = graph!.edges
                    .filter((e) => e.parent === selected.key)
                    .sort((a, b) => a.order - b.order)
                    .map((e) => e.id);
                  const index = members.indexOf(edge.id);
                  if (index < 1) return;
                  const order = [...members];
                  order.splice(
                    index - 1,
                    2,
                    members[index]!,
                    members[index - 1]!,
                  );
                  const response = await command("reorder", { order });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  await changed();
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Reorder failed.",
                  );
                }
              }}
            >
              Move earlier
            </button>
          )}
          {mode === "BUILD" &&
            node.kind === "primitive" &&
            Boolean(node.data["isMirrorable"]) &&
            paths
              .filter((p) => p.edges.length === 1)
              .map((p) => {
                const root = p.edges[0]!;
                return (
                  <button
                    key={`mirror:${root.id}`}
                    className={button}
                    onClick={() => {
                      void command("mirror-instance", {
                        target: node.key,
                        path: [root.id],
                        expectedHash: node.data["contentHash"] ?? null,
                      })
                        .then(async (response) => {
                          const result = await response.json();
                          if (!response.ok) throw new Error(result.error);
                          onSaved(node.key);
                          await changed();
                        })
                        .catch((error) => setError(error.message));
                    }}
                  >
                    {root.isMirrored
                      ? "Use standard character instance"
                      : "Mirror character instance"}
                  </button>
                );
              })}
          {mode === "BUILD" &&
            selected &&
            edge &&
            node.kind === "primitive" &&
            Boolean(node.data["isMirrorable"]) && (
              <button
                className={button}
                onClick={() => {
                  void command("mirror-reference", { edgeId: edge.id })
                    .then(async (r) => {
                      const result = await r.json();
                      if (!r.ok) throw new Error(result.error);
                      onSaved(`${selected.kind}:${result.id}`);
                      await changed();
                    })
                    .catch((e) => setError(e.message));
                }}
              >
                {edge.isMirrored
                  ? "Use standard reference"
                  : "Mirror reference"}
              </button>
            )}
          {mode === "BUILD" && destinations.length > 0 && (
            <label className="block">
              Add reference to
              <select
                className={button}
                value=""
                onChange={(e) => {
                  const d = destinations[Number(e.target.value)];
                  if (d) addToDestination(node.key, d.node.key, d.path);
                }}
              >
                <option value="">Choose destination…</option>
                {destinations.map((d, i) => (
                  <option key={i} value={i}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "BUILD" && selected && edge && destinations.length > 0 && (
            <label className="block">
              Move membership to
              <select
                className={button}
                value=""
                onChange={(e) => {
                  const d = destinations[Number(e.target.value)];
                  if (d)
                    setPending({
                      child: node.key,
                      edgeId: edge.id,
                      operation: "move-reference",
                      destination: d.node.key,
                      destinationPath: d.path,
                      destinationHash:
                        typeof d.node.data["contentHash"] === "string"
                          ? d.node.data["contentHash"]
                          : null,
                    });
                }}
              >
                <option value="">Choose destination…</option>
                {destinations.map((d, i) => (
                  <option key={i} value={i}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "BUILD" && selected && edge && (
            <button
              className={button}
              onClick={() =>
                setPending({
                  child: node.key,
                  operation: "remove-reference",
                  edgeId: edge.id,
                })
              }
            >
              Remove reference
            </button>
          )}
        </div>
      )}
    </article>
  );
}

