"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Refresh server-backed pickers in this tab and other open Atelier/sheet tabs. */
export function LibraryRefresh() {
  const router = useRouter();
  useEffect(() => {
    let seen = localStorage.getItem("sw:library-revision");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };
    const changed = () => {
      seen = crypto.randomUUID();
      localStorage.setItem("sw:library-revision", seen);
      refresh();
    };
    const external = () => {
      const next = localStorage.getItem("sw:library-revision");
      if (next !== seen) {
        seen = next;
        refresh();
        window.dispatchEvent(new CustomEvent("sw:library-refresh"));
      }
    };
    window.addEventListener("sw:library-changed", changed);
    window.addEventListener("storage", external);
    window.addEventListener("focus", external);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("sw:library-changed", changed);
      window.removeEventListener("storage", external);
      window.removeEventListener("focus", external);
    };
  }, [router]);
  return null;
}
