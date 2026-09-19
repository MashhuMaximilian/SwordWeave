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
import { InstrumentDialogFrame } from "@/components/ui/instrument-dialog";

const ParentSurface = createContext<((covered: boolean) => void) | null>(null);

/** One dialog for browsing, nested details, and authoring; contents change in place. */
export function WorkspaceSurface({
  modal,
  title,
  kicker = "Character archive",
  onClose,
  children,
}: {
  modal: boolean;
  title: string;
  kicker?: string;
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
        className="v12-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-5"
        data-character-surface
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <InstrumentDialogFrame
          ref={panel}
          title={title}
          kicker={kicker}
          onClose={onClose}
          className="v12-workspace-modal max-h-[94dvh] max-w-6xl"
          bodyClassName="v12-workspace-modal-body"
        >
          {children}
        </InstrumentDialogFrame>
      </div>
    </ParentSurface.Provider>,
    document.body,
  );
}
