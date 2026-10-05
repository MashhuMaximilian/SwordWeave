"use client";
import { useEffect, useState } from "react";
export function SourceCollectionLink({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const [collection, setCollection] = useState<{
    id: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/collections/source?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((d) => setCollection(d.collection ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [targetType, targetId]);
  return collection ? (
    <a href={`/collections/${collection.id}`} className="text-xs text-primary">
      Source: {collection.name}
    </a>
  ) : null;
}
