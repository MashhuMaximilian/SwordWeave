import { describe, expect, it } from "vitest";
import { publicArtRedirects } from "../public-art";

describe("public catalog migration", () => {
  it("preserves existing catalog paths at the CDN", () => {
    expect(publicArtRedirects()).toEqual([
      { source: "/images/characters/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/characters/:path*", permanent: false },
      { source: "/images/lineages/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/lineages/:path*", permanent: false },
      { source: "/images/heritages/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/heritages/:path*", permanent: false },
    ]);
  });
  it("does not redirect private uploads or icon APIs", () => {
    expect(publicArtRedirects().map(rule => rule.source)).not.toContain("/api/icons/blob/:path*");
    expect(publicArtRedirects().every(rule => rule.source.startsWith("/images/"))).toBe(true);
  });
  it("allows a replacement CDN without committing a permanent redirect", () => {
    expect(publicArtRedirects("https://other.example")[0].destination).toBe("https://other.example/images/characters/:path*");
  });
  it("rejects malformed origins before deployment", () => {
    for (const origin of ["http://assets.example", "https://user:password@assets.example", "https://assets.example/private", "https://assets.example?key=value"]) {
      expect(() => publicArtRedirects(origin)).toThrow("HTTPS origin");
    }
  });
});
