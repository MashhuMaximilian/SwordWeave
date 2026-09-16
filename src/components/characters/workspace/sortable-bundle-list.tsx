"use client";

import type { ReactNode } from "react";

/** Static, compact recipe membership. Stored ordering is preserved. */
export function SortableBundleList({ children, className }: {
  ids: string[];
  onOrder: (ids: string[]) => void;
  children: ReactNode;
  className?: string;
}) {
  return <ul className={className}>{children}</ul>;
}

export function SortableMember({ children, className }: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return <li className={className}>{children}</li>;
}
