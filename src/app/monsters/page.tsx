import { LibraryCatalogue, type LibraryCatalogueProps } from "@/components/library/library-catalogue";
export const dynamic = "force-dynamic";
export default function MonsterCataloguePage(props: LibraryCatalogueProps) { return <LibraryCatalogue {...props} monsterCatalogue/>; }
