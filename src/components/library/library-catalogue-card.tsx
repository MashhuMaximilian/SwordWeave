"use client";
import { CompositionMechanics } from "./composition-mechanics";
import type { ReactNode } from "react";
import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "./library-table";
import { libraryAuthorLabel, libraryOrigin } from "@/lib/publishing/library-classification";
import { libraryHeritageArt } from "@/lib/heritage/lineage-art";
import { IconDisplay } from "@/components/icons/icon-display";
import { LikeForkBar } from "@/components/engagement/like-fork-bar";
import { Markdown } from "@/components/ui/markdown";
import { CatalogueQuickLook } from "./catalogue-quick-look";
import { ArrowUpRight, Heart, GitFork } from "lucide-react";
import type { LibraryView } from "@/lib/preferences/library-prefs";
import "./catalogue-layout.css";

const ENTITY_ICONS: Record<string, string> = { PRIMITIVE: "delapouite/cube", EFFECT: "lorc/cubes", CAPABILITY: "lorc/cubeforce", LINEAGE_TEMPLATE: "lorc/dna2", UPBRINGING_TEMPLATE: "delapouite/plant-roots", MANIFEST_TEMPLATE: "caro-asercion/tarot-11-justice", ITEM: "lorc/battle-gear", MONSTER: "lorc/gluttonous-smile" };
export function LibraryEntityIcon({ item, size = 24 }: { item: LibraryItem; size?: number }) {
  return <IconDisplay portraitUrl={libraryHeritageArt(item)} iconSource={item.iconSource ?? "GAME_ICONS"} iconKey={item.iconSource ? item.iconKey : ENTITY_ICONS[item.targetType] ?? "delapouite/cube"} iconUrl={item.iconUrl} iconColor={item.iconSource ? item.iconColor : "#64c7c1"} size={size} alt="" />;
}
export function libraryCatalogueStatus(item: LibraryItem) {
  return item.definitionKind === "TEMPLATE" ? "Template" : libraryOrigin(item) === "system" ? "Canonical" : "Community";
}
/** The Library's catalogue material and interaction, shared by collection links and entries. */
export function LibraryCatalogueSurface({ glyph, title, status, badge, children, footer, selected = false, onSelect, rowId, className = "" }: { glyph: ReactNode; title: string; status?: ReactNode; badge?: ReactNode; children?: ReactNode; footer?: ReactNode; selected?: boolean; onSelect: () => void; rowId?: string; className?: string }) {
  return <article data-library-row-id={rowId} data-preview-trigger="true" aria-label={`Preview ${title}`} className={`v12-entry-row ${className}${selected ? " is-selected" : ""}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } }}>
    <span className="v12-entry-glyph" aria-hidden="true">{glyph}</span><div className="v12-entry-copy"><div className="v12-entry-title-line"><h3>{title}</h3>{status}</div>{children}{footer}</div>{badge}
  </article>;
}
export function LibraryCatalogueCard({ item, engagement, currentUserInternalId, selected, onSelect, children, view }: { item: LibraryItem; engagement?: LibraryEngagement; currentUserInternalId: string | null; selected?: boolean; onSelect: (item: LibraryItem) => void; children?: ReactNode; view?: LibraryView | undefined }) {
  if (view === "LIST") return <LibraryCatalogueSurface className="sw-catalogue-row" rowId={item.id} selected={selected ?? false} onSelect={() => onSelect(item)} glyph={<LibraryEntityIcon item={item} />} title={item.name}
    badge={<div className="sw-catalogue-row-end"><b>{item.buCost ?? 0} BU</b><CatalogueQuickLook name={item.name}>
      {item.description && <Markdown>{item.description}</Markdown>}
      {item.compositionPaths?.length ? item.compositionPaths.slice(0, 6).map((path, index) => <div className="sw-catalogue-peek-rule" key={index}><strong>{path.primitiveName}</strong><Markdown>{path.mechanicalDescription}</Markdown></div>) : item.mechanicalDescription ? <Markdown>{item.mechanicalDescription}</Markdown> : null}
      {!!item.compositionPaths?.length && <small>{item.compositionPaths.length} mechanical rules · Open preview for the full composition.</small>}
    </CatalogueQuickLook><ArrowUpRight size={14} aria-hidden="true" /></div>}>
    <span className="sw-catalogue-row-summary">{catalogueSummary(item)}</span>
    <div className="sw-catalogue-row-meta"><span>{item.targetType.replaceAll("_TEMPLATE", "").toLowerCase()} · {libraryCatalogueStatus(item)} · {libraryAuthorLabel(item)}</span><span className="sw-catalogue-engagement"><span aria-label={`${item.likesCount} likes`}><Heart size={11}/>{item.likesCount}</span><span aria-label={`${item.forkCount} forks`}><GitFork size={11}/>{item.forkCount}</span></span></div>
  </LibraryCatalogueSurface>;
  return <LibraryCatalogueSurface className={view === "GRID" ? "sw-catalogue-grid-card" : ""} rowId={item.id} selected={selected ?? false} onSelect={() => onSelect(item)} glyph={<LibraryEntityIcon item={item} />} title={item.name} status={<span className={`v12-tag ${libraryOrigin(item) === "community" ? "v12-tag--violet" : "v12-tag--teal"}`}>{libraryCatalogueStatus(item)}</span>} badge={<span className="v12-tag">{item.buCost ?? 0} BU</span>} footer={<div className="v12-entry-lineage"><span>{libraryAuthorLabel(item)}{item.versionNumber ? ` · v${item.versionNumber}` : ""}{item.descendantCount ? ` · ${item.descendantCount} descendants` : ""}</span><div onClick={event => event.stopPropagation()}><LikeForkBar targetType={item.targetType} targetId={item.targetId} initialLikes={item.likesCount} initialDislikes={item.dislikesCount} initialForks={item.forkCount} initialFlags={item.flagCount} initialUserReaction={item.viewerReaction !== undefined ? item.viewerReaction : engagement?.reactions[item.id] ?? null} initialFollowing={item.viewerFollowing ?? (item.authorId ? engagement?.following[item.authorId] : false) ?? false} authorId={item.authorId} authorUsername={libraryOrigin(item) === "system" ? null : item.authorUsername} currentUserId={currentUserInternalId} compact /></div></div>}>
    {children ?? <>{item.compositionPaths?.length ? <CompositionMechanics paths={item.compositionPaths} compact onPrimitive={() => onSelect(item)}/> : null}{!item.compositionPaths?.length && item.mechanicalDescription ? <Markdown className="v12-entry-mechanical" data-readable-rule>{item.mechanicalDescription}</Markdown> : null}</>}{item.description ? <Markdown className="v12-entry-summary">{item.description}</Markdown> : null}
  </LibraryCatalogueSurface>;
}

function catalogueSummary(item: LibraryItem) {
  return (item.description || item.verboseDescription || item.mechanicalDescription || item.compositionPaths?.[0]?.mechanicalDescription || "Open the preview to explore this entry.").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").slice(0, 240);
}
