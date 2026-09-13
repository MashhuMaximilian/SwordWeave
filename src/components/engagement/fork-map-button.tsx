"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { GitFork, LoaderCircle } from "lucide-react";
import { DetailModal } from "@/components/ui/detail-modal";
import type { ForkMapResult, ForkMapNode } from "@/lib/publishing/fork-map";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

function nodeHref(node: ForkMapNode) {
  return `/library/item/${node.targetType}:${encodeURIComponent(node.targetId)}`;
}

function ForkNode({ node, onExplore }: { node: ForkMapNode; onExplore: (node: ForkMapNode) => void }) {
  return (
    <button
      type="button" onClick={() => onExplore(node)}
      className={`v12-fork-node block w-full text-left min-w-0 border px-4 py-3 transition-colors hover:border-primary ${
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
    </button>
  );
}

function ForkGraph({ data, explore }: { data: ForkMapResult; explore: (node: ForkMapNode) => void }) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const height = Math.max(420, data.children.length * 108 + 50);
  const selectedX = data.ancestry.length * 240 + 30;
  const width = selectedX + 500;
  const nodes = [...data.ancestry.map((node, index) => ({ node, x: index * 240 + 30, y: height / 2 - 42 })), { node: data.selected, x: selectedX, y: height / 2 - 42 }, ...data.children.map((node, index) => ({ node, x: selectedX + 240, y: index * 108 + 30 }))];
  return <div className="v12-lineage-layout">
    <div className="v12-network-toolbar"><button type="button" onClick={() => setZoom(value => Math.max(.25, value - .15))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(value => Math.min(2, value + .15))} aria-label="Zoom in">＋</button><button type="button" onClick={() => setZoom(Math.min(1, (viewport.current?.clientWidth ?? width) / width))}>Fit</button><span>◇ Selected source · {data.totalChildren} direct descendants</span></div>
    <div className="v12-network-viewport" ref={viewport} tabIndex={0} aria-label="Fork lineage graph. Scroll to pan; select a node to explore it.">
      <div style={{ width: width * zoom, height: height * zoom }}><div className="v12-network-world" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg width={width} height={height} aria-hidden="true">{data.edges.map((edge, index) => { const from = nodes.find(n => n.node.key === edge.from), to = nodes.find(n => n.node.key === edge.to); if (!from || !to) return null; return <path key={`${edge.from}-${edge.to}-${index}`} d={`M ${from.x + 205} ${from.y + 42} C ${from.x + 225} ${from.y + 42}, ${to.x - 25} ${to.y + 42}, ${to.x} ${to.y + 42}`} />; })}</svg>
        {nodes.map(({node,x,y}) => <div key={node.key} style={{ position:"absolute", left:x, top:y, width:205 }}><ForkNode node={node} onExplore={explore} /></div>)}
      </div></div>
    </div>
    <aside className="v12-network-inspector"><p className="v12-kicker">Selected node</p><h3>{data.selected.name}</h3><p>{data.ancestry.length} ancestors · {data.totalChildren} direct forks</p><p>Forks create new entries. Versions remain part of each entry.</p><Link className="v12-metal-button" href={nodeHref(data.selected)}>Full source and versions ↗</Link></aside>
  </div>;
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
  const requestRef = useRef(0);
  const [focus, setFocus] = useState({ targetType, targetId });
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ForkMapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string | null, node = focus) => {
      const request = ++requestRef.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          targetType: node.targetType,
          targetId: node.targetId,
          limit: "20",
        });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/forks/map?${params.toString()}`);
        if (!response.ok) throw new Error("Fork map request failed");
        const next = (await response.json()) as ForkMapResult;
        if (request !== requestRef.current) return;
        setFocus(node);
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
        if (request === requestRef.current) setError("The fork map could not be loaded.");
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [focus],
  );

  const explore = (node: ForkMapNode) => { void load(null, node); };

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
        subtitle={data?.selected.name ?? targetName ?? `${targetType} ${targetId}`}
        size="lg"
      >
        {loading && !data ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading lineage…
          </div>
        ) : error ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm">
            {error}<button type="button" className="v12-metal-button ml-3" onClick={() => void load()}>Retry</button>
          </div>
        ) : data ? (
          <div className="v12-fork-explorer" aria-busy={loading}>
            <div className="v12-fork-toolbar"><button className="v12-metal-button" type="button" disabled={loading} onClick={() => void load(null, { targetType, targetId })}>Return to starting entry</button><Link className="v12-metal-button" href={nodeHref(data.selected)}>Open selected source ↗</Link></div>
            <p className="text-muted-foreground">Choose a node to follow its ancestry and explore its descendants.</p>
            <ForkGraph data={data} explore={explore} />
            {data.totalChildren === 0 ? <p className="text-muted-foreground">No direct descendants yet.</p> : null}
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
          </div>
        ) : null}
      </DetailModal>
    </>
  );
}
