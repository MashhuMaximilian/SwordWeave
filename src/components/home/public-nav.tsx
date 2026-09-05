"use client";

// =============================================================================
// PublicNav — sticky editorial nav for the front-facing public pages.
//
// Lives at the top of the viewport on /, /start, /about. NOT applied to any
// app-shell routes (/library/browse, /codex, /creations, etc.) — those keep
// their existing FAB / user-menu chrome.
//
// Behavior:
//   • Transparent until the page scrolls more than 40px, then gains a hairline
//     border + backdrop blur so it stays legible over content.
//   • Hides on scroll DOWN past 200px, reveals on scroll UP. Best-practice
//     mobile pattern; desktop users can ignore it.
//   • Highlights the active route with a teal accent tick.
//
// Pure client component. Uses requestAnimationFrame + passive scroll listener,
// no external deps, no framer-motion.
// =============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  group: "core" | "content" | "project";
};

// Order matters. Top-tier pages first, project-meta last.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/",         label: "Home",       group: "core" },
  { href: "/start",    label: "Walkthrough",group: "core" },
  { href: "/character",label: "Create",     group: "core" },
  { href: "/combat",   label: "Combat",     group: "core" },
  { href: "/library/browse", label: "Library",    group: "content" },
  { href: "/codex",    label: "Codex",      group: "content" },
  { href: "/creations",label: "Creations",  group: "content" },
  { href: "/about",    label: "About",      group: "project" },
  { href: "/attributions", label: "Credits",group: "project" },
];

export function PublicNav() {
  const pathname = usePathname() || "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Threshold for "scrolled enough to gain backdrop"
        setScrolled(y > 40);
        lastYRef.current = y;
        tickingRef.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      <nav
        aria-label="SwordWeave public navigation"
        className={`sw-public-nav ${scrolled ? "is-scrolled" : ""}`}
      >
        <div className="sw-public-nav__inner">
          {/* Logo */}
          <Link
            href="/"
            className="sw-public-nav__logo"
            aria-label="SwordWeave home"
          >
            <span className="font-display text-foreground">Sword</span>
            <span className="text-primary">·</span>
            <span className="font-display text-foreground">Weave</span>
          </Link>

          {/* Desktop links */}
          <ul className="sw-public-nav__links" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sw-public-nav__link ${isActive(item.href) ? "is-active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side: sign-in chip + mobile toggle */}
          <div className="sw-public-nav__cta">
            <Link href="/sign-in" className="sw-public-nav__signin">
              Sign in
            </Link>
            <Link href="/sign-up" className="sw-public-nav__signup">
              Start
            </Link>
            <button
              type="button"
              className="sw-public-nav__burger"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span aria-hidden className={`sw-public-nav__burger-bar ${mobileOpen ? "is-open-1" : ""}`} />
              <span aria-hidden className={`sw-public-nav__burger-bar ${mobileOpen ? "is-open-2" : ""}`} />
              <span aria-hidden className={`sw-public-nav__burger-bar ${mobileOpen ? "is-open-3" : ""}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer — only renders when open */}
      {mobileOpen && (
        <div className="sw-public-nav__drawer" role="dialog" aria-label="Navigation menu">
          <ul className="sw-public-nav__drawer-list" role="list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sw-public-nav__drawer-link ${isActive(item.href) ? "is-active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <span className="sw-public-nav__drawer-tag">{item.group}</span>
                  <span className="sw-public-nav__drawer-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="sw-public-nav__drawer-foot">
            <Link href="/sign-in" className="sw-public-nav__signin sw-public-nav__signin--block">
              Sign in
            </Link>
            <Link href="/sign-up" className="sw-public-nav__signup sw-public-nav__signup--block">
              Start
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
