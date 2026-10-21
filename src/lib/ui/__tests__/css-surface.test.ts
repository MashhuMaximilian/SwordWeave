import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import pages from "../../seo/pages.json";
import { cssSurface } from "../css-surface";

const app = join(process.cwd(), "src/app");
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? pageFiles(join(dir, entry.name)) :
      entry.name === "page.tsx" ? [join(dir, entry.name)] : [],
  );
}

describe("CSS surface ownership", () => {
  it("gives the homepage its own surface and every other curated reader/book a reader surface", () => {
    expect(cssSurface("/")).toBe("home");
    for (const route of [...Object.keys(pages), "/books/players-handbook", "/books/game-masters-guide", "/books/srd"]) {
      expect(cssSurface(route), route).toBe(route === "/" ? "home" : "reader");
    }
    expect(cssSurface("/characters/demo")).toBe("tool");
    expect(cssSurface("/characters/new")).toBe("tool");
    expect(cssSurface(null)).toBe("tool");
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
  });
});
