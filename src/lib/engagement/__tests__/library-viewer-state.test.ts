import { describe, expect, it } from "vitest";
import { applyViewerEngagement } from "../library-viewer-state";
import type { LibraryItem } from "@/lib/publishing/library-query";
it("hydrates subsequent chunks by composite reaction id and author follow id without mutating the corpus", () => {
  const items = [{id: "PRIMITIVE:1", authorId: "author"}, {id: "ITEM:2", authorId: null}] as LibraryItem[];
  const rows = applyViewerEngagement(items, {reactions: {"PRIMITIVE:1": "LIKE"}, following: {author: true}});
  expect(rows[0]).toMatchObject({viewerReaction: "LIKE", viewerFollowing: true});
  expect(rows[1]).toMatchObject({viewerReaction: null, viewerFollowing: false});
  expect(items[0]).not.toHaveProperty("viewerReaction");
});
