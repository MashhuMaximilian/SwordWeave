// Temporary test route to validate <SandboxLayout> without rewriting any real sandbox page.
// Delete this file once all 7 sandbox pages are wrapped.

import { SandboxLayout } from "@/components/sandbox/sandbox-layout";

export default function SandboxLayoutTestPage() {
  return (
    <SandboxLayout
      storageKey="test-sandbox"
      library={
        <div className="p-4">
          <h2 className="font-semibold">Library Column</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse primitives / templates / capabilities here.
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            <li>• Arcane Heritage</li>
            <li>• Berserker's Edge</li>
            <li>• Quick-Step</li>
            <li>• Slow Fall</li>
            <li>• Verdant Touch</li>
          </ul>
        </div>
      }
      builder={
        <div className="p-4">
          <h2 className="font-semibold">Build Column</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The composer lives here. Edit form for the entity.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <label className="block">
              <span className="text-xs text-muted-foreground">Name</span>
              <input
                type="text"
                defaultValue="Sample Entity"
                className="mt-1 w-full rounded border bg-background px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea
                rows={4}
                defaultValue="A long description that exercises the scroll behaviour."
                className="mt-1 w-full rounded border bg-background px-2 py-1"
              />
            </label>
            <button
              type="button"
              className="rounded bg-primary px-3 py-1 text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      }
      preview={
        <div className="p-4">
          <h2 className="font-semibold">Preview Column</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only render of the entity being edited.
          </p>
          <div className="mt-4 rounded border bg-muted/30 p-3 text-sm">
            <h3 className="font-semibold">Sample Entity</h3>
            <p className="mt-1 text-muted-foreground">
              A long description that exercises the scroll behaviour.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-2 text-xs">
              <dt className="text-muted-foreground">BU Cost</dt>
              <dd>12</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>Draft</dd>
            </dl>
          </div>
        </div>
      }
      topBar={
        <div className="flex items-center gap-3 px-4 py-2">
          <h1 className="text-lg font-semibold">Sandbox Layout — Test Page</h1>
          <span className="text-xs text-muted-foreground">
            (delete this route before production)
          </span>
        </div>
      }
    />
  );
}