/** Reproduce the runtime metal finish from the committed official silhouettes. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_ICONS, homeIconSources } from "../src/lib/icons/home-icons";
import { metallicSvg } from "../src/lib/icons/metallic-svg";

const check = process.argv.includes("--check");
for (const [key, icon] of Object.entries(HOME_ICONS)) {
  const sources = homeIconSources(key as keyof typeof HOME_ICONS);
  const source = readFileSync(join(process.cwd(), "public", sources.mask), "utf8");
  const expected = metallicSvg(source, icon.color);
  const target = join(process.cwd(), "public", sources.metallic);
  if (check) {
    if (readFileSync(target, "utf8") !== expected) throw new Error(`Regenerate homepage icon: ${key}`);
  } else writeFileSync(target, expected);
}
console.log(`${check ? "Checked" : "Generated"} ${Object.keys(HOME_ICONS).length} homepage metallic icons.`);
