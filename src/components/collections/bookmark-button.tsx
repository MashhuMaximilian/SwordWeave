"use client";
import { useEffect, useRef, useState, useId } from "react";
import { useClerk, useSession } from "@clerk/nextjs";
import { Bookmark } from "lucide-react";
import { createPortal } from "react-dom";
import { InstrumentDialogFrame } from "@/components/ui/instrument-dialog";
import { useBookmarkSaved } from "./bookmark-state";
type Collection = {
  id: string;
  name: string;
  system_kind: string | null;
  owner_id: string;
};
export function BookmarkButton({
  targetType,
  targetId,
  compact = true,
}: {
  targetType: string;
  targetId: string;
  compact?: boolean;
}) {
  const clerk = useClerk();
  const { session } = useSession();
  const { saved, setSaved } = useBookmarkSaved(
    targetType,
    targetId,
    session?.user.id,
  );
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open || !panel.current) return;
    const element = panel.current;
    element
      .querySelector<HTMLElement>("input, button")
      ?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
        ),
      );
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
      event.stopImmediatePropagation();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);
  async function show() {
    if (!session) {
      clerk.openSignIn();
      return;
    }
    setPending(true);
    setError("");
    try {
      await session.getToken({ skipCache: true });
      const response = await fetch(
        `/api/collections?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const editable = data.collections.filter(
        (c: Collection) =>
          (!c.system_kind || c.system_kind === "FAVORITES") &&
          c.owner_id === session.user.id,
      );
      setRows(editable);
      setSelected(
        data.membershipIds.length
          ? data.membershipIds
          : editable
              .filter((c: Collection) => c.system_kind === "FAVORITES")
              .map((c: Collection) => c.id),
      );
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load collections");
    } finally {
      setPending(false);
    }
  }
  async function save() {
    setPending(true);
    try {
      const response = await fetch("/api/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, collectionIds: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSaved(selected.length > 0);
      setOpen(false);
      window.dispatchEvent(new Event("sw-collections-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save bookmark");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void show();
        }}
        disabled={pending}
        aria-label={saved ? "Edit saved collections" : "Save to collections"}
        title={saved ? "Saved to collections" : "Save to collections"}
        aria-pressed={saved}
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded border border-border px-1 text-muted-foreground hover:text-primary ${compact ? "h-6 min-w-6" : "px-2 py-2 text-sm"}`}
      >
        <Bookmark
          className={compact ? "h-3 w-3" : "h-4 w-4"}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
        {!compact && "Save"}
      </button>
      {error && !open && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
            onClick={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <InstrumentDialogFrame
              ref={panel}
              title="Save to collections"
              titleId={titleId}
              onClose={() => setOpen(false)}
              phoneBackLabel="Back to entry"
              className="max-h-[90dvh] max-w-md"
              bodyClassName="p-5"
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Bookmarks are independent from likes. Select every collection
                where this entry belongs.
              </p>
              <div className="max-h-72 space-y-2 overflow-auto">
                {rows.map((c) => (
                  <label key={c.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, c.id]
                            : selected.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <a
                className="mt-3 block text-xs text-primary"
                href="/collections"
              >
                Manage collections
              </a>
              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void save()}
                  className="rounded bg-primary px-4 py-2 text-primary-foreground"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </InstrumentDialogFrame>
          </div>,
          document.body,
        )}
    </>
  );
}
