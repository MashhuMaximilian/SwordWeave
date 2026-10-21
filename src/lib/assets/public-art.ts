/** Only the public, versioned catalog moves to the asset CDN. User uploads do not. */
export const PUBLIC_ART_ORIGIN = "https://swordweave-public-art.ionmariusc97.workers.dev";
export const PUBLIC_ART_ROOTS = ["characters", "lineages", "heritages", "monsters"] as const;

function publicOrigin(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SW_PUBLIC_ART_ORIGIN must be an HTTPS origin without credentials or a path");
  }
  return url.origin;
}

export function publicArtRedirects(origin: string = PUBLIC_ART_ORIGIN) {
  const assetOrigin = publicOrigin(origin);
  return [...PUBLIC_ART_ROOTS.map(root => ({
    source: `/images/${root}/:path*`,
    destination: `${assetOrigin}/images/${root}/:path*`,
    // Keep the migration reversible; versioned CDN object URLs can be cached.
    permanent: false,
  })), {
    source: "/art/monsters/:path*",
    destination: `${assetOrigin}/images/monsters/:path*`,
    permanent: false,
  }];
}

/** Stable book links resolve to the verified R2 release, without copying large PDFs into each deployment. */
export function publicBookRedirects(origin: string = PUBLIC_ART_ORIGIN) {
  const assetOrigin = publicOrigin(origin);
  const filenames = ["players-handbook", "game-masters-guide", "srd"].flatMap(book => [`${book}.pdf`, `${book}-dark.pdf`]);
  const artwork = ["bridge", "workshop", "camp", "tools", "watcher", "grazer", "custodian"];
  return [
    ...filenames.map(filename => ({
      source: `/books/v0.1-alpha/${filename}`,
      destination: `${assetOrigin}/documents/swordweave/v0.1-alpha/${filename === "players-handbook.pdf" ? "interwoven-2026-10-19/" : filename === "game-masters-guide.pdf" ? "organic-2026-10-20/" : filename === "srd.pdf" ? "reference-2026-10-21/" : filename.startsWith("srd") ? "" : "print-r2/"}${filename}`,
      permanent: false,
    })),
    {
      source: "/books/v0.1-alpha/players-handbook-full.pdf",
      destination: `${assetOrigin}/documents/swordweave/v0.1-alpha/interwoven-2026-10-19/players-handbook-full.pdf`,
      permanent: false,
    },
    {
      source: "/books/v0.1-alpha/game-masters-guide-full.pdf",
      destination: `${assetOrigin}/documents/swordweave/v0.1-alpha/organic-2026-10-20/game-masters-guide-full.pdf`,
      permanent: false,
    },
    ...artwork.map(name => ({
      source: `/books/art/${name}.webp`,
      destination: `${assetOrigin}/images/books/v0.1-alpha/${name}.webp`,
      permanent: false,
    })),
    ...["phb-cover", "gm-cover", "party-cutout", "custodian-cutout", "skyborn-cutout", "surgeon-cutout", "guardian-cutout", "artificer-cutout"].map(name => ({
      source: `/books/art/${name}.webp`,
      destination: `${assetOrigin}/images/books/v0.1-alpha/print-r2/${name}.webp`,
      permanent: false,
    })),
  ];
}
