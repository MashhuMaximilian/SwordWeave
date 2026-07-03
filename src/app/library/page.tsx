import { Download, Library, Upload } from "lucide-react";

const packageKinds = [
  "primitive",
  "effect",
  "capability",
  "character",
  "item",
  "monster",
  "template",
] as const;

export default function LibraryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Library Exchange
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            Shared records, private saves, and JSON packages.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Library will become the place where users browse public creations,
            clone them into personal workspaces, and import or export complete
            SwordWeave packages.
          </p>
        </div>

        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Library className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Package Envelope</h2>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
            {`{
  "schemaVersion": "swordweave.package.v1",
  "kind": "primitive",
  "records": []
}`}
          </pre>
        </section>
      </div>

      <div className="grid gap-4 py-8 lg:grid-cols-[360px_1fr]">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Upload className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Import</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Imports should validate schema version, object kind, required
            fields, BU values, mirror metadata, and hard modifier targets before
            records are allowed into the database.
          </p>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Download className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Export Targets</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {packageKinds.map((kind) => (
              <span
                className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                key={kind}
              >
                {kind}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
