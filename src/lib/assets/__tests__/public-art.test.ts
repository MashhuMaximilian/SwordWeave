import { describe, expect, it } from "vitest";
import { publicArtRedirects, publicBookRedirects } from "../public-art";

describe("public catalog migration", () => {
  it("preserves existing catalog paths at the CDN", () => {
    expect(publicArtRedirects()).toEqual([
      { source: "/images/characters/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/characters/:path*", permanent: false },
      { source: "/images/lineages/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/lineages/:path*", permanent: false },
      { source: "/images/heritages/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/heritages/:path*", permanent: false },
      { source: "/images/monsters/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/monsters/:path*", permanent: false },
      { source: "/art/monsters/:path*", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/images/monsters/:path*", permanent: false },
    ]);
  });
  it("does not redirect private uploads or icon APIs", () => {
    expect(publicArtRedirects().map(rule => rule.source)).not.toContain("/api/icons/blob/:path*");
    expect(publicArtRedirects().filter(rule=>!rule.source.startsWith("/images/")).map(rule=>rule.source)).toEqual(["/art/monsters/:path*"]);
  });
  it("allows a replacement CDN without committing a permanent redirect", () => {
    expect(publicArtRedirects("https://other.example")[0]?.destination).toBe("https://other.example/images/characters/:path*");
  });
  it("rejects malformed origins before deployment", () => {
    for (const origin of ["http://assets.example", "https://user:password@assets.example", "https://assets.example/private", "https://assets.example?key=value"]) {
      expect(() => publicArtRedirects(origin)).toThrow("HTTPS origin");
    }
  });
});

describe("verified book release delivery", () => {
  it("releases the illustrated PHB and preserves the other alpha editions", () => {
    const rules = publicBookRedirects();
    expect(rules).toHaveLength(23);
    expect(new Set(rules.map(rule => rule.source)).size).toBe(23);
    for (const book of ["players-handbook", "game-masters-guide", "srd"]) {
      for (const suffix of ["", "-dark"]) expect(rules).toContainEqual({
        source: `/books/v0.1-alpha/${book}${suffix}.pdf`,
        destination: `https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/${book === "players-handbook" && !suffix ? "interwoven-2026-10-19/" : book === "game-masters-guide" && !suffix ? "organic-2026-10-20/" : book === "srd" && !suffix ? "reference-2026-10-21/" : book === "srd" ? "" : "print-r2/"}${book}${suffix}.pdf`,
        permanent: false,
      });
    }
    expect(rules).toContainEqual({ source: "/books/v0.1-alpha/players-handbook-full.pdf", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/interwoven-2026-10-19/players-handbook-full.pdf", permanent: false });
    expect(rules).toContainEqual({ source: "/books/v0.1-alpha/game-masters-guide-full.pdf", destination: "https://swordweave-public-art.ionmariusc97.workers.dev/documents/swordweave/v0.1-alpha/organic-2026-10-20/game-masters-guide-full.pdf", permanent: false });
    expect(rules.find(rule => rule.source === "/books/art/tools.webp")?.destination).toBe("https://swordweave-public-art.ionmariusc97.workers.dev/images/books/v0.1-alpha/tools.webp");
    expect(rules.find(rule => rule.source === "/books/art/phb-cover.webp")?.destination).toBe("https://swordweave-public-art.ionmariusc97.workers.dev/images/books/v0.1-alpha/print-r2/phb-cover.webp");
    expect(rules.every(rule => !rule.source.includes(":path"))).toBe(true);
  });
  it("validates a replacement origin for books too", () => {
    expect(publicBookRedirects("https://assets.example")[0]?.destination).toBe("https://assets.example/documents/swordweave/v0.1-alpha/interwoven-2026-10-19/players-handbook.pdf");
    expect(() => publicBookRedirects("https://assets.example/private")).toThrow("HTTPS origin");
  });
});
