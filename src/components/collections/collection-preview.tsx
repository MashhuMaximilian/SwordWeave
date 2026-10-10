"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TargetEngagement } from "@/components/engagement/target-engagement";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
import "./collections.css";

type CollectionData = { collection: { name: string; visibility: string }; entries: { name: string; targetType: string; targetId: string }[]; total: number };
export function CollectionPreview({ id }: { id: string }) {
  const { userId, isLoaded } = useAuth();
  if (!isLoaded) return <p role="status">Loading account…</p>;
  return <AccountCollectionPreview key={`${userId ?? "anonymous"}:${id}`} id={id}/>;
}
function AccountCollectionPreview({ id }: { id: string }) {
  const [data, setData] = useState<CollectionData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/collections/${id}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Collection unavailable");
      if (!controller.signal.aborted) setData(result);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading collection…</p>;
  return <section className="sw-collection-preview">
    <p className="v12-kicker">Collection · {data.collection.visibility.replaceAll("_", " ").toLowerCase()}</p>
    <h2>{data.collection.name}</h2>
    <TargetEngagement targetType="COLLECTION" targetId={id} compact={false}/>
    <p>{data.total} accessible entries. Each entry retains its own visibility.</p>
    <ul>{data.entries.slice(0, 10).map(entry => <li key={`${entry.targetType}:${entry.targetId}`}><EntityTypeIcon type={entry.targetType} size={20}/><span>{entry.name}</span></li>)}</ul>
    <Link href={`/collections/${id}`} className="sw-metal-button">Open collection ↗</Link>
  </section>;
}
