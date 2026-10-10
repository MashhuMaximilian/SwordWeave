"use client";
import {TargetEngagement} from "@/components/engagement/target-engagement";
import { useState } from "react";
import Link from "next/link";
import { FolderTree, ArrowRight } from "lucide-react";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
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
            data-catalogue-row="true"
            className="sw-collections-directory-card"
          >
            <CatalogueQuickLook name={collection.name}><p>{collection.origin === "system" ? "System collection" : "Community collection"} · Curated by {collection.authorName}</p><p>Open the collection to browse its entries and branches.</p></CatalogueQuickLook>
            <Link
              data-quick-look-opener
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
            <div className="sw-collection-engagement"><TargetEngagement targetType="COLLECTION" targetId={collection.id}/></div>
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
