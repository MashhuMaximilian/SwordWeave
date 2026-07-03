"use client";

import { Moon, Sun } from "lucide-react";

const storageKey = "swordweave-theme";

export function ThemeToggle() {
  function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      aria-label="Toggle color mode"
      className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      onClick={toggleTheme}
      type="button"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
