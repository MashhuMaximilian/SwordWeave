"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EntityPreview } from "@/components/preview/entity-preview";
import { useModalStack } from "@/components/ui/modal-stack";
import { loadEntityPreview, previewKind } from "@/components/characters/workspace/workspace-entity-preview";
import type { SandboxPreviewItem } from "@/components/library/library-item-preview";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";

export function CollectionEntryPreview({ targetType, targetId }: { targetType: string; targetId: string }) {
  const stack = useModalStack();
  const [item, setItem] = useState<SandboxPreviewItem | null>(null);
  const [error, setError] = useState("");
  const supported = ["PRIMITIVE", "EFFECT", "CAPABILITY", "ITEM", "LINEAGE_TEMPLATE", "UPBRINGING_TEMPLATE", "MANIFEST_TEMPLATE"].includes(targetType);
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    void loadEntityPreview(previewKind(targetType), targetId, controller.signal).then(data => {
      if (!controller.signal.aborted) setItem(data);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to open entry.");
    });
    return () => controller.abort();
  }, [targetType, targetId, supported]);
  if (targetType === "MONSTER") return <MonsterTemplatePreview id={targetId} compact />;
  if (!supported) return <p>Open the complete record on its <Link href={targetType === "CHARACTER" ? `/characters/${targetId}` : `/library/item/${encodeURIComponent(`${targetType}:${targetId}`)}`}>source page</Link>.</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!item) return <p role="status">Loading entry details…</p>;
  return <div className="v12-fetched-preview"><EntityPreview item={item} variant="read" callbacks={{ preferLocalSubLinks: true, onSubLinkClick: link => {
    if (stack.canPush) stack.push({ key: `collection-entry:${link.targetType}:${link.targetId}`, label: link.label, category: link.targetType, content: <CollectionEntryPreview targetType={link.targetType} targetId={String(link.targetId)} /> });
  } }} /></div>;
}
