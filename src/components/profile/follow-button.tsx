"use client";

import { useState } from "react";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";

interface FollowButtonProps {
  targetUserId: string;
  initialFollowing: boolean;
}

export function FollowButton({
  targetUserId,
  initialFollowing,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (following) {
        const res = await fetch(
          `/api/follows?targetUserId=${encodeURIComponent(targetUserId)}`,
          { method: "DELETE" },
        );
        if (res.ok) setFollowing(false);
      } else {
        const res = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        if (res.ok) setFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border border-sword-border bg-sword-bg text-sword-fg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/40"
          : "bg-sword-accent text-white hover:bg-sword-accent/90"
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <UserMinus className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
