// =============================================================================
// Tiny markdown renderer — handles the subset we actually use:
// - **bold** → <strong>
// - *italic* → <em>
// - [text](url) → <a>
// - blank lines → paragraph breaks
//
// Avoids the react-markdown dependency. Output is sanitized via React's
// default escaping (no dangerouslySetInnerHTML).
// =============================================================================

import { Fragment } from "react";

interface MarkdownProps {
  children: string;
}

interface Block {
  type: "p" | "ul";
  content: string[];
}

/**
 * Parse a markdown string into block-level chunks. We don't support nested
 * lists, code blocks, or headings — content authoring rules will reject
 * those during publish.
 */
function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");

  let currentPara: string[] = [];
  let currentList: string[] = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: "p", content: [currentPara.join(" ")] });
      currentPara = [];
    }
  };
  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({ type: "ul", content: [...currentList] });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushPara();
      flushList();
      continue;
    }
    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushPara();
      currentList.push(listMatch[1]!);
      continue;
    }
    flushList();
    currentPara.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Render inline markdown: **bold**, *italic*, [text](url).
 * Returns React nodes — children are rendered via React's default escaping.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  // Order matters: links before emphasis (no nested links in our content)
  // and bold before italic (so ** doesn't get partially eaten).
  const segments: React.ReactNode[] = [];
  let remaining = text;
  let counter = 0;

  const pushNode = (node: React.ReactNode) => {
    segments.push(<Fragment key={`${keyPrefix}-${counter++}`}>{node}</Fragment>);
  };

  // Regex order: link | bold | italic
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = pattern.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      pushNode(remaining.slice(lastIndex, match.index));
    }
    if (match[1] != null && match[2] != null) {
      pushNode(
        <a
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 underline"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3] != null) {
      pushNode(
        <strong className="font-semibold text-foreground">{match[3]}</strong>,
      );
    } else if (match[4] != null) {
      pushNode(<em className="italic">{match[4]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < remaining.length) {
    pushNode(remaining.slice(lastIndex));
  }
  return <>{segments}</>;
}

export function Markdown({ children }: MarkdownProps) {
  if (!children) return null;
  const blocks = parseBlocks(children);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "ul") {
          return (
            <ul
              key={i}
              className="my-3 ml-5 list-disc space-y-1 text-sm leading-7"
            >
              {block.content.map((item, j) => (
                <li key={j}>{renderInline(item, `b${i}-li${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mb-3 text-sm leading-7 last:mb-0">
            {renderInline(block.content[0] ?? "", `b${i}`)}
          </p>
        );
      })}
    </>
  );
}