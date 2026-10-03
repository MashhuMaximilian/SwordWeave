"use client";
import { LibraryTable, type LibraryTableProps } from "./library-table";
import { InfiniteLibraryResults } from "./infinite-library-results";

/** Atelier already has its source corpus; only nearby blocks need live cards. */
export function WindowedLibraryTable(props: LibraryTableProps) {
  if (!props.items.length) return <LibraryTable {...props} />;
  return <InfiniteLibraryResults items={props.items} hasMore={false} loading={false} loadMore={() => {}} retry={() => {}}
    render={items => <LibraryTable {...props} items={items} />} />;
}
