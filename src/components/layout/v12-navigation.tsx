import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

/** Workbench navigation from V12; Character retains its existing drawers. */
export function V12Navigation({ page }: { page: "Library" | "Atelier" }) {
  return <header className="v12-navigation">
    <Link href={page === "Library" ? "/library/browse" : "/atelier"} className="v12-navigation-brand"><span aria-hidden="true">{page === "Library" ? "⌕" : "✦"}</span>SwordWeave <i>/ {page}</i></Link>
    <nav aria-label="Workbench navigation">
      <Link aria-current={page === "Library" ? "page" : undefined} href="/library/browse">Library</Link>
      <Link aria-current={page === "Atelier" ? "page" : undefined} href="/atelier">Atelier</Link>
      <Link href="/characters">Character</Link>
      <Link href="/atelier?build=primitive&new=1">Author</Link>
      <Link className="v12-navigation-collection" href="/creations">My collection</Link>
      <ThemeToggle />
    </nav>
  </header>;
}
