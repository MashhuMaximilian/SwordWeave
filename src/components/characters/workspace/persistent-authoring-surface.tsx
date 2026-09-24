"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";
import { useGlobalControls } from "@/components/layout/global-controls";

/** Move one mounted editor between the sheet and its focus dialog. A second
 * rendering of an uncontrolled Atelier form would have independent field state. */
export function PersistentAuthoringSurface({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const inline = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const { drawerOpen } = useGlobalControls();
  useEffect(() => {
    const element = document.createElement("div");
    element.dataset["drawerBuild"] = "";
    // A DOM host is only available after client mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(element);
    return () => element.remove();
  }, []);
  const bindFocused = useCallback((element: HTMLDivElement | null) => {
    focused.current = element;
    if (element && host && drawerOpen) element.appendChild(host);
  }, [host, drawerOpen]);
  const slot = useMemo(() => ({ build: <div ref={bindFocused} />, preview }), [preview, bindFocused]);
  useDrawerSlot(slot);
  useLayoutEffect(() => {
    if (!host) return;
    const destination = drawerOpen ? focused.current : inline.current;
    destination?.appendChild(host);
  }, [drawerOpen, host]);
  return <><div ref={inline} />{host && createPortal(children, host)}</>;
}
