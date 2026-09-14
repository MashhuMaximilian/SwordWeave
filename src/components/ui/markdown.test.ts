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
});
