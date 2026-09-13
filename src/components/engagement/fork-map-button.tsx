"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GitFork, LoaderCircle } from "lucide-react";
import { mergeForkMap, layoutForkMap, type ForkMapSession } from "@/lib/publishing/fork-map-session";
import { ForkVersionInspector } from "./fork-version-inspector";
import { ForkNodeVersions } from "./fork-node-versions";
import { FetchedEntityPreview } from "@/components/preview/entity-preview";
import { DetailModal } from "@/components/ui/detail-modal";
import type { ForkMapResult, ForkMapNode } from "@/lib/publishing/fork-map";
import type { ForkTargetType } from "@/lib/publishing/forks-query";

function nodeHref(node: ForkMapNode) {
  return `/library/item/${node.targetType}:${encodeURIComponent(node.targetId)}`;
}

function ForkNode({ node, onExplore }: { node: ForkMapNode; onExplore: (node: ForkMapNode) => void }) {
  return (
    <div className="v12-fork-node-shell"><button
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
      <strong className="mt-1 block truncate font-normal" title={node.name ?? `${node.targetType} ${node.targetId}`}>
        {node.name ?? `${node.targetType} ${node.targetId}`}
      </strong>
      {node.authorName ? (
        <span className="mt-1 block truncate text-xs text-muted-foreground" title={node.authorName}>
          by {node.authorName}
        </span>
      ) : null}
    </button>
    </div>
  );
}

function SelectedEntryPreview({node}: {node: ForkMapNode}) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Full entry preview</summary>{open ? <FetchedEntityPreview targetType={node.targetType} targetId={node.targetId} /> : null}</details>;
}

export function ForkGraph({ data, session, explore }: { data: ForkMapResult; session: ForkMapSession; explore: (node: ForkMapNode) => void }) {
  const [version, setVersion] = useState<{key:string;number:number}|null>(null);
  const selectedVersion = version?.key === data.selected.key ? version.number : null;
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState("");
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({left:0,top:0,width:600,height:420});
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setView({left:element.scrollLeft,top:element.scrollTop,width:element.clientWidth,height:element.clientHeight});
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, {passive:true});
    update();
    return () => {observer.disconnect();element.removeEventListener("scroll",update);};
  }, []);
  const nodes = layoutForkMap(session);
  const height = Math.max(420, ...nodes.map(n => n.y + 140));
  const width = Math.max(600, ...nodes.map(n => n.x + 235));
  const fit = () => {
    setZoom(Math.min(1, (viewport.current?.clientWidth ?? width) / width, (viewport.current?.clientHeight ?? height) / height));
    viewport.current?.scrollTo({left:0,top:0});
  };
  const centerNode = (x:number,y:number) => viewport.current?.scrollTo({left:Math.max(0,(x+102)*zoom-view.width/2),top:Math.max(0,(y+50)*zoom-view.height/2),behavior:"smooth"});
  return <div className="v12-lineage-layout">
    <div className="v12-network-toolbar"><button type="button" onClick={() => setZoom(value => Math.max(.02, value - .15))} aria-label="Zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(value => Math.min(2, value + .15))} aria-label="Zoom in">＋</button><button type="button" onClick={fit}>Fit</button><span>◇ Selected source · {data.totalChildren} direct descendants</span></div>
    <div className="v12-network-search"><label>Search loaded nodes<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Entry or author…" /></label>{search.trim() ? <div>{nodes.filter(({node}) => `${node.name ?? ""} ${node.authorName ?? ""}`.toLowerCase().includes(search.toLowerCase().trim())).map(({node,x,y}) => <button key={node.key} type="button" onClick={() => { viewport.current?.scrollTo({left:Math.max(0,x*zoom-30),top:Math.max(0,y*zoom-30),behavior:"smooth"}); }}>{node.name ?? node.key}</button>)}</div> : null}</div>
    <div className="v12-network-viewport" ref={viewport} onPointerDown={event => {
      if (event.pointerType === "touch" || (event.target as HTMLElement).closest("button,a,input")) return;
      drag.current = { x:event.clientX, y:event.clientY, left:event.currentTarget.scrollLeft, top:event.currentTarget.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => { if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX; event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY; }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} tabIndex={0} aria-label="Fork lineage graph. Scroll to pan; select a node to explore it.">
      <div style={{ width: width * zoom, height: height * zoom }}><div className="v12-network-world" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg width={width} height={height} aria-hidden="true">{session.edges.map((edge, index) => { const from = nodes.find(n => n.node.key === edge.from), to = nodes.find(n => n.node.key === edge.to); if (!from || !to) return null; return <path key={`${edge.from}-${edge.to}-${index}`} d={`M ${from.x + 205} ${from.y + 42} C ${from.x + 225} ${from.y + 42}, ${to.x - 25} ${to.y + 42}, ${to.x} ${to.y + 42}`} />; })}</svg>
        {nodes.map(({node,x,y}) => <div key={node.key} style={{ position:"absolute", left:x, top:y, width:205 }}><ForkNode node={node} onExplore={explore} /></div>)}
      </div></div>
    </div>
    <nav className="v12-network-minimap" aria-label="Lineage overview">
      <p className="v12-kicker">Loaded lineage · {nodes.length} entries</p>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Choose an entry to center the graph">
        {session.edges.map(edge => {const from=nodes.find(n=>n.node.key===edge.from),to=nodes.find(n=>n.node.key===edge.to);return from && to ? <path key={`${edge.from}:${edge.to}`} d={`M${from.x+102} ${from.y+50} L${to.x+102} ${to.y+50}`} /> : null;})}
        <rect className="v12-minimap-view" x={view.left/zoom} y={view.top/zoom} width={Math.min(width,view.width/zoom)} height={Math.min(height,view.height/zoom)} />
        {nodes.map(({node,x,y})=><rect key={node.key} className={node.key===data.selected.key ? "selected" : ""} x={x} y={y} width={205} height={100} rx={12} role="button" tabIndex={0} aria-label={`Center ${node.name ?? node.key}`} onClick={()=>centerNode(x,y)} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();centerNode(x,y);}}}><title>{node.name ?? node.key}</title></rect>)}
      </svg>
    </nav>
    <aside className="v12-network-inspector"><p className="v12-kicker">Selected node</p><h3>{data.selected.name}</h3><p>{data.ancestry.length} ancestors · {data.totalChildren} direct forks</p><p>Forks create new entries. Versions remain part of each entry.</p>{data.selected.targetType !== "BUILD_TEMPLATE" ? <ForkNodeVersions key={`versions:${data.selected.key}`} targetType={data.selected.targetType} targetId={data.selected.targetId} onSelect={number => setVersion({key:data.selected.key,number})} selectedVersion={selectedVersion} /> : null}{selectedVersion ? <><button type="button" onClick={() => setVersion(null)}>Back to current entry</button><ForkVersionInspector key={`${data.selected.key}:v${selectedVersion}`} targetType={data.selected.targetType} targetId={data.selected.targetId} versionNumber={selectedVersion} /></> : null}{!["CHARACTER", "BUILD_TEMPLATE"].includes(data.selected.targetType) ? <SelectedEntryPreview key={data.selected.key} node={data.selected} /> : null}<Link className="v12-metal-button" href={nodeHref(data.selected)}>Full source and versions ↗</Link></aside>
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
  const [session, setSession] = useState<ForkMapSession>({nodes:[],edges:[]});
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
        setSession(current => mergeForkMap(current, next));
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
        size="xl"
      >
        {loading && !data ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading lineage…
          </div>
        ) : error && !data ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm">
            {error}<button type="button" className="v12-metal-button ml-3" onClick={() => void load()}>Retry</button>
          </div>
        ) : data ? (
          <div className="v12-fork-explorer" aria-busy={loading}>
            {error ? <p role="alert">{error} The loaded graph is still available; select the node again to retry.</p> : null}
            <div className="v12-fork-toolbar"><button className="v12-metal-button" type="button" disabled={loading} onClick={() => void load(null, { targetType, targetId })}>Return to starting entry</button><Link className="v12-metal-button" href={nodeHref(data.selected)}>Open selected source ↗</Link></div>
            <p className="text-muted-foreground">Choose a node to inspect it and expand its descendants. Opened branches stay on the canvas.</p>
            <ForkGraph data={data} session={session} explore={explore} />
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
