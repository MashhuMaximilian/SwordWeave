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

const ENTITY_ICONS: Record<string, string> = { PRIMITIVE: "delapouite/cube", EFFECT: "lorc/cubes", CAPABILITY: "lorc/cubeforce", LINEAGE_TEMPLATE: "lorc/dna2", UPBRINGING_TEMPLATE: "delapouite/plant-roots", MANIFEST_TEMPLATE: "caro-asercion/tarot-11-justice", ITEM: "lorc/battle-gear", MONSTER: "lorc/monster-grasp" };
export function LibraryEntityIcon({ item, size = 24 }: { item: LibraryItem; size?: number }) {
  return <IconDisplay portraitUrl={libraryHeritageArt(item)} iconSource={item.iconSource ?? "GAME_ICONS"} iconKey={item.iconSource ? item.iconKey : ENTITY_ICONS[item.targetType] ?? "delapouite/cube"} iconUrl={item.iconUrl} iconColor={item.iconSource ? item.iconColor : "#64c7c1"} size={size} alt="" />;
}
export function libraryCatalogueStatus(item: LibraryItem) {
  return item.definitionKind === "TEMPLATE" ? "Template" : libraryOrigin(item) === "system" ? "Canonical" : "Community";
}
/** The Library's catalogue material and interaction, shared by collection links and entries. */
export function LibraryCatalogueSurface({ glyph, title, status, badge, children, footer, selected = false, onSelect, rowId }: { glyph: ReactNode; title: string; status?: ReactNode; badge?: ReactNode; children?: ReactNode; footer?: ReactNode; selected?: boolean; onSelect: () => void; rowId?: string }) {
  return <article data-library-row-id={rowId} data-preview-trigger="true" className={`v12-entry-row${selected ? " is-selected" : ""}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } }}>
    <span className="v12-entry-glyph" aria-hidden="true">{glyph}</span><div className="v12-entry-copy"><div className="v12-entry-title-line"><h3>{title}</h3>{status}</div>{children}{footer}</div>{badge}
  </article>;
}
export function LibraryCatalogueCard({ item, engagement, currentUserInternalId, selected, onSelect, children }: { item: LibraryItem; engagement?: LibraryEngagement; currentUserInternalId: string | null; selected?: boolean; onSelect: (item: LibraryItem) => void; children?: ReactNode }) {
  return <LibraryCatalogueSurface rowId={item.id} selected={selected ?? false} onSelect={() => onSelect(item)} glyph={<LibraryEntityIcon item={item} />} title={item.name} status={<span className={`v12-tag ${libraryOrigin(item) === "community" ? "v12-tag--violet" : "v12-tag--teal"}`}>{libraryCatalogueStatus(item)}</span>} badge={<span className="v12-tag">{item.buCost ?? 0} BU</span>} footer={<div className="v12-entry-lineage"><span>{libraryAuthorLabel(item)}{item.versionNumber ? ` · v${item.versionNumber}` : ""}{item.descendantCount ? ` · ${item.descendantCount} descendants` : ""}</span><div onClick={event => event.stopPropagation()}><LikeForkBar targetType={item.targetType} targetId={item.targetId} initialLikes={item.likesCount} initialDislikes={item.dislikesCount} initialForks={item.forkCount} initialFlags={item.flagCount} initialUserReaction={item.viewerReaction !== undefined ? item.viewerReaction : engagement?.reactions[item.id] ?? null} initialFollowing={item.viewerFollowing ?? (item.authorId ? engagement?.following[item.authorId] : false) ?? false} authorId={item.authorId} authorUsername={libraryOrigin(item) === "system" ? null : item.authorUsername} currentUserId={currentUserInternalId} compact /></div></div>}>
    {children ?? <>{item.compositionPaths?.length ? <CompositionMechanics paths={item.compositionPaths} compact onPrimitive={() => onSelect(item)}/> : null}{!item.compositionPaths?.length && item.mechanicalDescription ? <Markdown className="v12-entry-mechanical" data-readable-rule>{item.mechanicalDescription}</Markdown> : null}</>}{item.description ? <Markdown className="v12-entry-summary">{item.description}</Markdown> : null}
  </LibraryCatalogueSurface>;
}
