"use client";
import { useState } from "react";
import Link from "next/link";
import { FolderTree, ArrowRight } from "lucide-react";
import { CatalogueViewToggle } from "@/components/library/catalogue-view-toggle";
import type { PublicCollection } from "@/lib/collections/public-directory";
import type { LibraryView } from "@/lib/preferences/library-prefs";

export function PublicCollectionResults({
  collections,
}: {
  collections: PublicCollection[];
}) {
  const [view, setView] = useState<LibraryView>("GRID");
  return (
    <section aria-label="Public collections">
      <div className="sw-collections-section-heading">
        <p>{collections.length} collections on this page</p>
        <CatalogueViewToggle view={view} onChange={setView} />
      </div>
      <div
        className={`sw-collections-directory-grid${view === "LIST" ? " is-list" : ""}`}
      >
        {collections.map((collection) => (
          <article
            key={collection.id}
            className="sw-collections-directory-card"
          >
            <Link
              href={`/collections/${collection.id}`}
              className="sw-collections-directory-open"
            >
              <span className="sw-collections-directory-eyebrow">
                <FolderTree size={18} aria-hidden="true" />{" "}
                {collection.origin === "system"
                  ? "System collection"
                  : "Community collection"}
              </span>
              <h2>{collection.name}</h2>
              <span className="sw-collections-directory-author">
                Curated by {collection.authorName}
              </span>
              <span className="sw-collections-directory-card-action">
                Explore collection <ArrowRight size={17} aria-hidden="true" />
              </span>
            </Link>
            {collection.authorUsername && collection.origin === "community" && (
              <Link
                className="sw-collections-directory-curator"
                href={`/u/${encodeURIComponent(collection.authorUsername)}`}
              >
                View curator
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
