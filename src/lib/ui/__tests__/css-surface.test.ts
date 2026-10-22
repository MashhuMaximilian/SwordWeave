import { describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import pages from "../../seo/pages.json";
import { cssSurface } from "../css-surface";

vi.mock("next/navigation", () => ({ usePathname: () => "/books" }));
vi.mock("next/link", () => ({default: ({prefetch,...props}:ComponentProps<"a"> & {prefetch?:false|null}) =>
  createElement("a", {...props,"data-next-link":true,"data-prefetch":String(prefetch)})}));

const app = join(process.cwd(), "src/app");
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? pageFiles(join(dir, entry.name)) :
      entry.name === "page.tsx" ? [join(dir, entry.name)] : [],
  );
}

describe("CSS surface ownership", () => {
  it("gives Home and Books separate surfaces while preserving all other reader/tool ownership", () => {
    expect(cssSurface("/")).toBe("home");
    for (const route of [...Object.keys(pages), "/books/players-handbook", "/books/game-masters-guide", "/books/srd"]) {
      expect(cssSurface(route), route).toBe(route === "/" ? "home" : route === "/books" || route.startsWith("/books/") ? "books" : "reader");
    }
    expect(cssSurface("/characters/demo")).toBe("tool");
    expect(cssSurface("/characters/new")).toBe("tool");
    expect(cssSurface(null)).toBe("tool");
    expect(cssSurface("/books/not-a-book")).toBe("books");
    expect(cssSurface("/bookshelf")).toBe("tool");
  });

  it("loads the surface stylesheet for every HTML page before its component styles", () => {
    for (const file of pageFiles(app)) {
      const route = "/" + relative(app, dirname(file)).replaceAll("\\", "/").replace(/^\.$/, "");
      const family = cssSurface(route);
      if (route === "/") {
        expect(readFileSync(file, "utf8")).toContain("./generated/home-surface.css");
        continue;
      }
      let parent = dirname(file);
      let owner = "";
      while (parent !== app) {
        const layout = join(parent, "layout.tsx");
        if (existsSync(layout) && readFileSync(layout, "utf8").includes(`generated/${family}-surface.css`)) {
          owner = layout;
          break;
        }
        parent = dirname(parent);
      }
      expect(owner, `Missing ${family} CSS layout for ${route}`).not.toBe("");
    }
  });

  it("keeps the full reader/tool sheets out of the shared root and 404 import graph", () => {
    expect(readFileSync(join(app, "layout.tsx"), "utf8")).not.toContain("root-styles.css");
    expect(readFileSync(join(app, "not-found.tsx"), "utf8")).not.toContain("generated/");
    const fallback = readFileSync(join(process.cwd(), "src/components/layout/not-found-theme.tsx"), "utf8");
    expect(fallback).toContain('dynamic(() => import("./tool-theme"))');
    expect(fallback).toContain('dynamic(() => import("./home-theme"))');
    expect(fallback).toContain('dynamic(() => import("./books-theme"))');
  });

  it("does not prefetch other route themes or book bodies before Books navigation intent", async () => {
    const {default:BooksPage}=await import("@/app/books/page");
    const $=load(renderToStaticMarkup(createElement(BooksPage)));
    const links=$("a[data-next-link]");
    expect(links.length).toBeGreaterThan(20);
    expect(links.toArray().every(link=>$(link).attr("data-prefetch")==="false")).toBe(true);
    expect($(".sw-book-card a[data-next-link]")).toHaveLength(6);
    expect(links.toArray().map(link=>$(link).attr("href"))).toEqual(expect.arrayContaining([
      "/", "/rules", "/books/players-handbook", "/books/game-masters-guide", "/books/srd",
    ]));
    const pdfs=$(".sw-book-downloads a,.sw-quick-core__action a");
    expect(pdfs.length).toBeGreaterThan(3);
    expect(pdfs.toArray().every(link=>!$(link).attr("data-next-link"))).toBe(true);
    const {BookCards}=await import("@/components/publications/book-cards");
    const defaultCards=load(renderToStaticMarkup(createElement(BookCards,{placement:"home"})));
    expect(defaultCards("a[data-next-link]").toArray().every(link=>defaultCards(link).attr("data-prefetch")==="null")).toBe(true);
  });
});
