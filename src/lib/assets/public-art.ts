/** Only the public, versioned catalog moves to the asset CDN. User uploads do not. */
export const PUBLIC_ART_ORIGIN = "https://swordweave-public-art.ionmariusc97.workers.dev";
export const PUBLIC_ART_ROOTS = ["characters", "lineages", "heritages", "monsters"] as const;

export function publicArtRedirects(origin: string = PUBLIC_ART_ORIGIN) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SW_PUBLIC_ART_ORIGIN must be an HTTPS origin without credentials or a path");
  }
  return [...PUBLIC_ART_ROOTS.map(root => ({
    source: `/images/${root}/:path*`,
    destination: `${url.origin}/images/${root}/:path*`,
    // Keep the migration reversible; versioned CDN object URLs can be cached.
    permanent: false,
  })), {
    source: "/art/monsters/:path*",
    destination: `${url.origin}/images/monsters/:path*`,
    permanent: false,
  }];
}
