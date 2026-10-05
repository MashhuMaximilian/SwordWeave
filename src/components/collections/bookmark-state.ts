"use client";
import { useEffect, useState } from "react";
type Ref = { targetType: string; targetId: string };
/** Collect mounted bookmark controls into one request instead of one request per row. */
export class BookmarkStore {
  private states = new Map<string, boolean>();
  private listeners = new Map<string, Set<(value: boolean) => void>>();
  private refs = new Map<string, { userId: string; ref: Ref }>();
  private queued = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private request: typeof fetch = (...args) => fetch(...args)) {}
  private key(userId: string, ref: Ref) {
    return `${userId}/${ref.targetType}:${ref.targetId}`;
  }
  subscribe(userId: string, ref: Ref, listener: (value: boolean) => void) {
    const key = this.key(userId, ref);
    this.refs.set(key, { userId, ref });
    const callbacks = this.listeners.get(key) ?? new Set();
    callbacks.add(listener);
    this.listeners.set(key, callbacks);
    listener(this.states.get(key) ?? false);
    if (!this.states.has(key)) this.enqueue(key);
    return () => {
      callbacks.delete(listener);
      if (!callbacks.size) {
        this.listeners.delete(key);
        this.refs.delete(key);
      }
    };
  }
  set(userId: string, ref: Ref, value: boolean) {
    const key = this.key(userId, ref);
    this.states.set(key, value);
    for (const listener of this.listeners.get(key) ?? []) listener(value);
  }
  invalidate() {
    for (const key of this.refs.keys()) this.enqueue(key);
  }
  private enqueue(key: string) {
    this.queued.add(key);
    if (this.timer === null)
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, 20);
  }
  private async flush() {
    const grouped = new Map<string, { key: string; ref: Ref }[]>();
    for (const key of this.queued) {
      const value = this.refs.get(key);
      if (value)
        grouped.set(value.userId, [
          ...(grouped.get(value.userId) ?? []),
          { key, ref: value.ref },
        ]);
    }
    this.queued.clear();
    await Promise.all(
      [...grouped].map(async ([userId, entries]) => {
        for (let i = 0; i < entries.length; i += 500) {
          const chunk = entries.slice(i, i + 500);
          try {
            const response = await this.request("/api/collections/matches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entries: chunk.map((e) => e.ref) }),
            });
            if (!response.ok) continue;
            const data = await response.json();
            if (data.userId !== userId) continue;
            const saved = new Set(
              (data.memberships ?? []).map(
                (m: Ref) => `${m.targetType}:${m.targetId}`,
              ),
            );
            for (const e of chunk)
              this.set(
                userId,
                e.ref,
                saved.has(`${e.ref.targetType}:${e.ref.targetId}`),
              );
          } catch {
            /* Keep current state until the next successful read. */
          }
        }
      }),
    );
  }
}
const bookmarks = new BookmarkStore();
let listening = false;
export function useBookmarkSaved(
  targetType: string,
  targetId: string,
  userId: string | undefined,
) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!userId) {
      setSaved(false);
      return;
    }
    if (!listening) {
      window.addEventListener("sw-collections-changed", () =>
        bookmarks.invalidate(),
      );
      listening = true;
    }
    return bookmarks.subscribe(userId, { targetType, targetId }, setSaved);
  }, [userId, targetType, targetId]);
  return {
    saved,
    setSaved: (value: boolean) => {
      if (userId) bookmarks.set(userId, { targetType, targetId }, value);
    },
  };
}
