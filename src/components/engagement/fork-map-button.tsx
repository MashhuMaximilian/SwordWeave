"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { GitFork, LoaderCircle } from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import type { ForkMapResult, ForkMapNode } from "@/lib/publishing/fork-map";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

function nodeHref(node: ForkMapNode) {
  return `/library/item/${node.targetType}:${encodeURIComponent(node.targetId)}`;
}

function ForkNode({ node }: { node: ForkMapNode }) {
  return (
    <Link
      href={nodeHref(node)}
      className={`block min-w-0 border px-4 py-3 transition-colors hover:border-primary ${
        node.relation === "selected"
          ? "border-primary bg-primary/10"
          : "border-border bg-card/80"
      }`}
    >
      <span className="v12-kicker block text-[0.72rem]">
        {node.relation === "selected" ? "Selected source" : node.targetType.replaceAll("_", " ")}
      </span>
      <strong className="mt-1 block truncate font-normal">
        {node.name ?? `${node.targetType} ${node.targetId}`}
      </strong>
      {node.authorName ? (
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          by {node.authorName}
        </span>
      ) : null}
    </Link>
  );
}

export function ForkMapButton({
  targetType,
  targetId,
  targetName,
  className = "",
}: {
  targetType: ForkTargetType;
  targetId: string;
  targetName?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ForkMapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          targetType,
          targetId,
          limit: "20",
        });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/forks/map?${params.toString()}`);
        if (!response.ok) throw new Error("Fork map request failed");
        const next = (await response.json()) as ForkMapResult;
        setData((current) =>
          cursor && current
            ? {
                ...next,
                children: [...current.children, ...next.children],
                edges: [...current.edges, ...next.edges],
              }
            : next,
        );
      } catch {
        setError("The fork map could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [targetId, targetType],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!data && !loading) void load();
        }}
        className={`v12-metal-button inline-flex items-center gap-2 ${className}`}
      >
        <GitFork className="size-4" />
        Fork map
      </button>
      <DetailModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Fork map"
        subtitle={targetName ?? `${targetType} ${targetId}`}
        size="lg"
      >
        {loading && !data ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading lineage…
          </div>
        ) : error ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-8">
            <section>
              <p className="v12-kicker mb-3">Ancestry</p>
              <div className="grid gap-2">
                {data.ancestry.map((node) => (
                  <div key={node.key} className="grid gap-2">
                    <ForkNode node={node} />
                    <div className="mx-auto h-4 w-px bg-primary/60" aria-hidden="true" />
                  </div>
                ))}
                <ForkNode node={{ ...data.selected, name: data.selected.name ?? targetName ?? null }} />
              </div>
            </section>
            <section>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="v12-kicker">Direct descendants</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.totalChildren} recorded fork{data.totalChildren === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {data.children.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.children.map((node) => <ForkNode key={node.key} node={node} />)}
                </div>
              ) : (
                <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No direct descendants yet.
                </p>
              )}
              {data.nextCursor ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void load(data.nextCursor)}
                  className="v12-metal-button mt-4"
                >
                  {loading ? "Loading…" : "Load more descendants"}
                </button>
              ) : null}
            </section>
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}
