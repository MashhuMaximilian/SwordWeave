import { describe, expect, it } from "vitest";
import { DEFAULT_ICON_COLOR, metallicSvg } from "../metallic-svg";

const svg = '<svg viewBox="0 0 512 512"><path fill="#fff" d="M0 0h10v10H0z"/><path style="fill:#ffffff" d="M20 0h10v10H20z"/></svg>';

describe("metallic game icon finish", () => {
  it("uses a bright and dark gradient in the selected color", () => {
    const red = metallicSvg(svg, "#db0f0f");
    expect(red).toContain('id="sw-metal"');
    expect(red).toContain('x1="0" y1="0" x2="0.7" y2="1"');
    expect(red).toContain('stop-color="#db0f0f"');
    expect(red).toContain('fill="url(#sw-metal)"');
    expect(red).toContain('style="fill:url(#sw-metal)"');
    expect(red).not.toContain('fill="#fff"');
  });

  it("keeps an outline hollow while tinting its stroke", () => {
    const outlined = metallicSvg(svg, DEFAULT_ICON_COLOR, true);
    expect(outlined).toContain('stroke="url(#sw-metal)"');
    expect(outlined).toContain('fill="none"');
  });
});
