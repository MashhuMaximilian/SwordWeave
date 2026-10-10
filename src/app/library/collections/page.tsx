import { LibraryHeader } from "@/components/library/library-header";
import Link from "next/link";
import { PublicCollectionResults } from "@/components/collections/public-collection-results";
import { ArrowLeft, ArrowRight, FolderTree, Search } from "lucide-react";
import { publicCollectionDirectory, type CollectionDirectoryQuery } from "@/lib/collections/public-directory";
import "./public-collections.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public collections · SwordWeave" };

export default async function PublicCollectionsPage({ searchParams }: {
  searchParams: Promise<CollectionDirectoryQuery>;
}) {
  const { filters, collections, hasMore } = await publicCollectionDirectory(await searchParams);
  const active = Boolean(filters.q || filters.origin !== "all" || filters.sort !== "recent");
  function pageLink(page: number) {
    const params = new URLSearchParams({ q: filters.q, origin: filters.origin, sort: filters.sort, page: String(page) });
    return `/library/collections?${params}`;
  }
  return <main className="sw-public-collections">
    <LibraryHeader active="COLLECTION"/>

    <form className="sw-collections-directory-search" action="/library/collections">
      <label className="sw-collections-directory-query"><span>Find a collection</span><div><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Search collection names…" /></div></label>
      <label><span>Origin</span><select name="origin" defaultValue={filters.origin}><option value="all">All origins</option><option value="community">Community</option><option value="system">System</option></select></label>
      <label><span>Sort</span><select name="sort" defaultValue={filters.sort}><option value="recent">Newest</option><option value="name">Name A–Z</option></select></label>
      <button className="sw-metal-button sw-collections-directory-action">Search</button>
      {active && <Link href="/library/collections" className="sw-collections-directory-clear">Clear filters</Link>}
    </form>
    {collections.length ? <PublicCollectionResults collections={collections} /> : <section className="sw-collections-directory-empty">
      <FolderTree size={32} aria-hidden="true" /><h2>{active ? "No matching collections" : "The shared shelves are ready"}</h2>
      <p>{active ? "Try another name or origin, or clear the filters." : "Make a collection public and it will appear here for other tables to discover."}</p>
      <Link href={active ? "/library/collections" : "/collections"} className="sw-metal-button sw-collections-directory-action">{active ? "Clear filters" : "Create a collection"}</Link>
    </section>}
    {(filters.page > 1 || hasMore) && <nav className="sw-collections-directory-pagination" aria-label="Collection pages">
      {filters.page > 1 && <Link href={pageLink(filters.page - 1)} className="sw-metal-button sw-collections-directory-action">Previous</Link>}
      <span>Page {filters.page}</span>
      {hasMore && <Link href={pageLink(filters.page + 1)} className="sw-metal-button sw-collections-directory-action">Next</Link>}
    </nav>}
  </main>;
}
