import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { HOME_ICONS, homeIconSources, type HomeIconKey } from "../home-icons";
import { metallicSvg } from "../metallic-svg";
import { HomePieceIcon } from "@/components/home/home-piece-icon";
import { IconDisplay } from "@/components/icons/icon-display";

describe("fixed homepage icon delivery", () => {
  it("keeps all five finishes identical to the runtime formatter and authored hues", () => {
    expect(Object.values(HOME_ICONS).map(icon => icon.color)).toEqual([
      "#f6dc9d", "#efb88e", "#94e9d8", "#f6dc9d", "#e2e6de",
    ]);
    for (const key of Object.keys(HOME_ICONS) as HomeIconKey[]) {
      const sources = homeIconSources(key);
      const raw = readFileSync(join(process.cwd(), "public", sources.mask), "utf8");
      const finished = readFileSync(join(process.cwd(), "public", sources.metallic), "utf8");
      expect(finished, key).toBe(metallicSvg(raw, HOME_ICONS[key].color));
      expect(raw, key).toContain('viewBox="0 0 512 512"');
    }
  });

  it("changes only the image URL, retaining the original image semantics and geometry", () => {
    for (const key of Object.keys(HOME_ICONS) as HomeIconKey[]) {
      const original = load(renderToStaticMarkup(createElement(IconDisplay, {
        iconSource: "GAME_ICONS", iconKey: key, iconColor: HOME_ICONS[key].color, size: 38, alt: "",
      })))("img").attr()!;
      const bundled = load(renderToStaticMarkup(createElement(HomePieceIcon, { iconKey: key })))("img").attr()!;
      expect(bundled["src"]).toBe(homeIconSources(key).metallic);
      delete original["src"];
      delete bundled["src"];
      expect(bundled, key).toEqual(original);
    }
  });
});
