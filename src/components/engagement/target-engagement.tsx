"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { LikeForkBar, type LikeForkBarProps } from "./like-fork-bar";

type Snapshot = { likes: number; dislikes: number; forks: number; flags: number; userReaction: "LIKE" | "DISLIKE" | null; currentUserInternalId: string | null };
type Props = { targetType: LikeForkBarProps["targetType"]; targetId: string; compact?: boolean };

/** Standalone cards share the same action bar and permission-checked viewer state. */
export function TargetEngagement(props: Props) {
  const { userId, isLoaded } = useAuth();
  if (!isLoaded) return <span role="status" className="sw-engagement-loading">Loading actions…</span>;
  return <AccountTargetEngagement key={`${userId ?? "anonymous"}:${props.targetType}:${props.targetId}`} {...props}/>;
}
function AccountTargetEngagement({ targetType, targetId, compact = true }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/engagement/lookup?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Actions unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) { setSnapshot(data); setError(false); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [targetType, targetId, attempt]);
  if (error) return <button type="button" className="sw-metal-button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Retry actions</button>;
  if (!snapshot) return <span role="status" className="sw-engagement-loading">Loading actions…</span>;
  return <LikeForkBar targetType={targetType} targetId={targetId} initialLikes={snapshot.likes} initialDislikes={snapshot.dislikes} initialForks={snapshot.forks} initialFlags={snapshot.flags} initialUserReaction={snapshot.userReaction} currentUserId={snapshot.currentUserInternalId} compact={compact}/>;
}
