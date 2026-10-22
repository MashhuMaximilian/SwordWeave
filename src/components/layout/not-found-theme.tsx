"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { cssSurface } from "@/lib/ui/css-surface";

// The global not-found entry is part of every Next route. A static CSS import
// here would put the full tool theme back on every public reader. Load this
// theme only when the not-found component itself is rendered (including SSR).
const ToolTheme = dynamic(() => import("./tool-theme"));
const ReaderTheme = dynamic(() => import("./reader-theme"));
const HomeTheme = dynamic(() => import("./home-theme"));
const BooksTheme = dynamic(() => import("./books-theme"));

export function NotFoundTheme() {
  const surface = cssSurface(usePathname());
  return surface === "home" ? <HomeTheme /> : surface === "books" ? <BooksTheme /> : surface === "reader" ? <ReaderTheme /> : <ToolTheme />;
}
