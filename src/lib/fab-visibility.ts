/** Contextual workspaces only exist on these routes. Creation routes are not sheets. */
export function fabWorkspaceVisibility(pathname: string | null, mobile: boolean, _readOnly = false) {
  const atelier = pathname === "/atelier" || pathname?.startsWith("/atelier/") === true;
  const characterSheet = /^\/characters\/(?!new(?:\/|$))[^/]+\/?$/.test(pathname ?? "");
  return { split: mobile && atelier, build: atelier, character: atelier, characterSheet };
}

/** Creation shortcuts belong to public discovery, never personal sheet/archive pages. */
export function fabCreationMode(pathname: string | null): "menu" | "buttons" | "none" {
  if (pathname === "/atelier" || pathname?.startsWith("/atelier/")) return "menu";
  if (pathname === "/" || pathname === "/library" || (pathname?.startsWith("/library/") && !pathname.startsWith("/library/collections")) || ["/rules", "/combat", "/about", "/attributions", "/start", "/character"].includes(pathname ?? "")) return "buttons";
  return "none";
}
