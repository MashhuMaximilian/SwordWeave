import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

describe("Markdown", () => {
  it("renders the formatting supported by Library descriptions", () => {
    const source = `**Bold** *italic* ~~removed~~ ++underlined++

- first
- second

> quoted

| Name | BU |
| --- | ---: |
| Fire | 4 |`;
    const html = renderToStaticMarkup(createElement(Markdown, null, source));

    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<s>removed</s>");
    expect(html).toContain("<u>underlined</u>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>quoted</blockquote>");
    expect(html).toContain("<table>");
    expect(html).not.toContain("**Bold**");
  });

  it("shows formatted prose inside a control without nesting links or blocks", () => {
    const source = "## River guide\n\n- **Scout** via [the bridge](https://example.com)";
    const html = renderToStaticMarkup(createElement("button", null,
      createElement(Markdown, { inline: true, copyRole: "narrative", children: source }),
    ));

    expect(html).toContain("River guide <strong>Scout</strong> via the bridge");
    expect(html).toContain('data-copy="narrative"');
    expect(html).not.toMatch(/<(a|h2|ul|div)\b/);
  });

  it("keeps raw HTML as text in authored Markdown", () => {
    const html = renderToStaticMarkup(createElement(Markdown, null,
      "<b>literal text</b> and [a reference](https://example.com)",
    ));

    expect(html).toContain("&lt;b&gt;literal text&lt;/b&gt;");
    expect(html).toContain('href="https://example.com"');
  });
});
