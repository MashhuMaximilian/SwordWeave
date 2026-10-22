// Keep the public readers separate from the authoring and play tools. New
// public destinations must be added here and receive the reader layout.
const readerPaths = new Set([
  "/start", "/character", "/creating-a-character", "/creating",
  "/tutorials/create-a-primitive", "/press", "/rules", "/combat",
  "/about", "/contact", "/attributions", "/privacy",
]);

export function cssSurface(pathname: string | null): "home" | "books" | "reader" | "tool" {
  if (pathname === "/") return "home";
  if (pathname === "/books" || pathname?.startsWith("/books/")) return "books";
  return pathname && readerPaths.has(pathname)
    ? "reader" : "tool";
}
