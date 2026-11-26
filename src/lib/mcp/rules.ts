import { createHash } from "node:crypto";
import { GUIDE_BOOK_REFERENCES } from "@/lib/publications/book-links";
import { PLAY_GUIDE, searchGuide } from "@/lib/rules/play-guide";

const contentRevision = createHash("sha256").update(JSON.stringify(PLAY_GUIDE)).digest("hex").slice(0, 12);

export function readGuideRules(question: string, resource: string) {
  const topics = searchGuide(question);
  const entries = topics.slice(0, 5).map(topic => {
    const book = GUIDE_BOOK_REFERENCES[topic.id];
    const foundation = topic.id === "first-character"
      ? topic.blocks.find(block => block.title === "Make sure the foundation can act") : undefined;
    const drawbacks = topic.id === "first-character"
      ? topic.blocks.find(block => block.title === "Choose strengths and any real drawbacks") : undefined;
    return {
      topicId: topic.id,
      title: topic.title,
      summary: topic.summary,
      url: new URL(`/rules#${topic.id}`, resource).href,
      ...(book ? { bookUrl: new URL(`/books/${book.slug}#${book.anchor}`, resource).href } : {}),
      ...(foundation ? { startingAccess: [foundation.body, ...foundation.details?.map(detail => detail.body) ?? [], drawbacks?.body].filter((rule): rule is string => !!rule) } : {}),
      ...(topic.id === "vitality" ? { ruleDetails: topic.blocks } : {}),
      contentRevision,
    };
  });
  return { entries, incomplete: entries.length === 0 || topics.length > entries.length };
}
