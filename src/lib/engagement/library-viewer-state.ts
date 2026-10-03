import type { LibraryItem } from "@/lib/publishing/library-query";
import type { LibraryEngagement } from "./library-engagement";
/** Viewer hints stay on this authenticated response, never in the shared corpus. */
export function applyViewerEngagement(items: LibraryItem[], engagement: LibraryEngagement): LibraryItem[] {
  return items.map(item => ({
    ...item,
    viewerReaction: engagement.reactions[item.id] ?? null,
    viewerFollowing: Boolean(item.authorId && engagement.following[item.authorId]),
  }));
}
