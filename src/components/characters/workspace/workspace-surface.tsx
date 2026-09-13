"use client";
import {
  useEffect,
  useRef,
  useState,
  useContext,
  createContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ParentSurface = createContext<((covered: boolean) => void) | null>(null);

/** One dialog for browsing, nested details, and authoring; contents change in place. */
export function WorkspaceSurface({
  modal,
  title,
  onClose,
  children,
}: {
  modal: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const coverParent = useContext(ParentSurface);
  const [covered, setCovered] = useState(false);
  const coveredRef = useRef(covered);
  useEffect(() => {
    coveredRef.current = covered;
  }, [covered]);
  useEffect(() => {
    if (!modal) return;
    coverParent?.(true);
    return () => coverParent?.(false);
  }, [modal, coverParent]);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (coveredRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key !== "Tab") return;
      const controls = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard, true);
      previous?.focus();
    };
  }, [modal]);
  if (!modal) return <>{children}</>;
  return createPortal(
    <ParentSurface.Provider value={setCovered}>
      <div
        aria-hidden={covered || undefined}
        style={covered ? { visibility: "hidden" } : undefined}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-5"
        data-character-surface
        onClick={onClose}
      >
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="v12-instrument flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl outline-none sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="v12-section-head flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-subtitle font-medium">{title}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close workspace dialog"
              className="rounded p-2 hover:bg-secondary"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </ParentSurface.Provider>,
    document.body,
  );
}
