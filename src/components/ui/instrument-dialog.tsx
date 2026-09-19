"use client";

import { forwardRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type InstrumentDialogFrameProps = {
  title: string;
  kicker?: string | null;
  subtitle?: string | null;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  titleId?: string;
};

/** Shared visual and semantic shell for every focused SwordWeave instrument. */
export const InstrumentDialogFrame = forwardRef<HTMLDivElement, InstrumentDialogFrameProps>(
  function InstrumentDialogFrame(
    { title, kicker, subtitle, onClose, children, className, bodyClassName, titleId },
    ref,
  ) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        className={cn(
          "v12-instrument-dialog v12-modal-surface v12-instrument relative flex min-h-0 w-full flex-col overflow-hidden outline-none",
          className,
        )}
      >
        <header className="v12-instrument-dialog-head">
          <div className="v12-instrument-dialog-identity">
            {kicker ? <span>{kicker}</span> : null}
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <X className="size-4" />
          </button>
        </header>
        <div className={cn("v12-instrument-dialog-body min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
          {children}
        </div>
      </div>
    );
  },
);
