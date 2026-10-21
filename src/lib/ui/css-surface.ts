// Keep the public readers separate from the authoring and play tools. New
// public destinations must be added here and receive the reader layout.
const readerPaths = new Set([
  "/start", "/character", "/creating-a-character", "/creating",
  "/tutorials/create-a-primitive", "/press", "/rules", "/combat", "/books",
  "/about", "/contact", "/attributions", "/privacy",
]);

export function cssSurface(pathname: string | null): "home" | "reader" | "tool" {
  if (pathname === "/") return "home";
  return pathname && (readerPaths.has(pathname) || pathname.startsWith("/books/"))
    ? "reader" : "tool";
}
