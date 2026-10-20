"use client";

import { ReleaseBadge } from "@/components/layout/release-badge";
import "./public-nav.css";

// =============================================================================
// PublicNav — sticky editorial nav for the front-facing public pages.
//
// Public pages keep their editorial navigation; app-shell routes keep their
// existing FAB / user-menu chrome.
//
// Behavior:
//   • Tracks scroll position for the existing scrolled material treatment.
//   • Uses a Create disclosure to distinguish guides, tools and authoring.
//   • Highlights the active route and keeps the same destinations on mobile.
//
// Pure client component. Uses requestAnimationFrame + passive scroll listener,
// no external deps, no framer-motion.
// =============================================================================

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

type NavItem = {
  href: string;
  label: string;
  group: "core" | "content" | "project";
  disclosure?: "create" | "library" | "about";
};
type NavDisclosure = NonNullable<NavItem["disclosure"]>;

// Order matters. Top-tier pages first, project-meta last.
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/",         label: "Home",       group: "core" },
  { href: "/start",    label: "Walkthrough",group: "core" },
  { href: "/character",label: "Create",     group: "core", disclosure: "create" },
  { href: "/rules", label: "Rules", group: "core" },
  { href: "/combat",   label: "Combat",     group: "core" },
  { href: "/library/browse", label: "Library",    group: "content", disclosure: "library" },
  { href: "/books",label: "Books", group: "content" },
  { href: "/about",    label: "About",      group: "project", disclosure: "about" },
  { href: "/contact",  label: "Contact",    group: "project" },
  { href: "/press",    label: "Creator kit",group: "project" },
];

const CREATE_ITEMS = [
  { href: "/character", label: "Character guide" },
  { href: "/characters/new", label: "Build a character" },
  { href: "/creating", label: "Abilities & primitives" },
  { href: "/tutorials/create-a-primitive", label: "Primitive editor tutorial" },
  { href: "/atelier", label: "Open Atelier" },
] as const;

const DESKTOP_QUERY = "(min-width: 1200px)";

export function PublicNav() {
  const disclosureItems = {
    create: CREATE_ITEMS,
    library: [
      { href: "/library/browse", label: "Browse library" },
      { href: "/monsters", label: "Monsters" },
      { href: "/encounters", label: "Encounters" },
    ],
    about: [
      { href: "/about", label: "About SwordWeave" },
      { href: "/attributions", label: "Credits" },
    ],
  };
  const pathname = usePathname() || "/";
  const [scrolled, setScrolled] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openDisclosure, setOpenDisclosure] = useState<{ path: string; group: NavDisclosure } | null>(null);
  const mobileOpen = openPath === pathname;
  const activeDisclosure = openDisclosure?.path === pathname ? openDisclosure.group : null;
  const menuId = useId();
  const navRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const groupRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const disclosureToggleRef = useRef<HTMLButtonElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const tickingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Threshold for "scrolled enough to gain backdrop"
        setScrolled(y > 40);
        tickingRef.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen && !activeDisclosure) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeDisclosure) {
          setOpenDisclosure(null);
          disclosureToggleRef.current?.focus();
        } else {
          setOpenPath(null);
          toggleRef.current?.focus();
        }
        event.preventDefault();
      }
    };
    const closeOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!groupRefs.current[`desktop-${activeDisclosure}`]?.contains(target) && !groupRefs.current[`mobile-${activeDisclosure}`]?.contains(target)) {
        setOpenDisclosure(null);
      }
      if (!navRef.current?.contains(target) && !drawerRef.current?.contains(target)) {
        setOpenPath(null);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [mobileOpen, activeDisclosure]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const closeOnLayoutChange = () => {
      setOpenPath(null);
      setOpenDisclosure(null);
    };
    media.addEventListener("change", closeOnLayoutChange);
    return () => media.removeEventListener("change", closeOnLayoutChange);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const closeNavigation = () => {
    setOpenPath(null);
    setOpenDisclosure(null);
  };
  const closeDisclosureOnBlur = (event: FocusEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenDisclosure(null);
  };
  const onDisclosureKey = (event: ReactKeyboardEvent<HTMLButtonElement>, disclosure: NavDisclosure) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const group = event.currentTarget.parentElement;
    disclosureToggleRef.current = event.currentTarget;
    setOpenDisclosure({ path: pathname, group: disclosure });
    requestAnimationFrame(() => {
      const links = group?.querySelectorAll<HTMLAnchorElement>("a");
      if (links?.length) links[event.key === "ArrowUp" ? links.length - 1 : 0]?.focus();
    });
  };

  const groupedNavigation = (item: NavItem & { disclosure: NavDisclosure }, mobile: boolean) => {
    const surface = mobile ? "mobile" : "desktop";
    const panelId = `${menuId}-${item.disclosure}-${surface}`;
    const expanded = activeDisclosure === item.disclosure;
    const links = disclosureItems[item.disclosure];
    const groupActive = links.some((link) => isActive(link.href)) || (item.disclosure === "create" && isActive("/characters"));
    return (
      <li
        key={item.href}
        ref={(node) => { groupRefs.current[`${surface}-${item.disclosure}`] = node; }}
        className="sw-public-nav__group"
        onBlur={closeDisclosureOnBlur}
      >
        <button
          type="button"
          className={`${mobile ? "sw-public-nav__drawer-link" : "sw-public-nav__link"} sw-public-nav__group-toggle ${groupActive ? "is-active" : ""}`}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={(event) => {
            disclosureToggleRef.current = event.currentTarget;
            setOpenDisclosure(expanded ? null : { path: pathname, group: item.disclosure });
          }}
          onKeyDown={(event) => onDisclosureKey(event, item.disclosure)}
        >
          {mobile ? <span className="sw-public-nav__drawer-tag">{item.group}</span> : null}
          <span className={mobile ? "sw-public-nav__drawer-label" : undefined}>{item.label}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <ul
          id={panelId}
          className="sw-public-nav__group-links"
          hidden={!expanded}
          aria-label={item.label}
        >
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`sw-public-nav__group-link ${isActive(link.href) ? "is-active" : ""}`}
                aria-current={isActive(link.href) ? "page" : undefined}
                onClick={closeNavigation}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <>
      <nav
        ref={navRef}
        aria-label="SwordWeave public navigation"
        className={`sw-public-nav sw-public-nav--grouped ${scrolled ? "is-scrolled" : ""}`}
      >
        <div className="sw-public-nav__inner">
          {/* Logo */}
          <Link
            href="/"
            className="sw-public-nav__logo"
            aria-label="SwordWeave home"
            onClick={closeNavigation}
          >
            <span className="sw-public-nav__brandmark" aria-hidden="true" />
            <span className="sw-public-nav__wordmark"><span className="font-display text-foreground">Sword</span>
            <span className="text-primary">·</span>
            <span className="font-display text-foreground">Weave</span></span>
            <ReleaseBadge />
          </Link>

          {/* Desktop links */}
          <ul className="sw-public-nav__links" role="list">
            {NAV_ITEMS.map((item) => item.disclosure ? groupedNavigation({ ...item, disclosure: item.disclosure }, false) : (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sw-public-nav__link ${isActive(item.href) ? "is-active" : ""}`}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={closeNavigation}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side: sign-in chip + mobile toggle */}
          <div className="sw-public-nav__cta">
            <Link href="/sign-in" className="sw-public-nav__signin" onClick={closeNavigation}>
              Sign in
            </Link>
            <Link href="/sign-up" className="sw-public-nav__signup" onClick={closeNavigation}>
              Start
            </Link>
            <button
              ref={toggleRef}
              type="button"
              aria-controls={`${menuId}-navigation`}
              className="sw-public-nav__burger sw-public-nav__burger--icon"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => {
                setOpenPath(mobileOpen ? null : pathname);
                setOpenDisclosure(null);
              }}
            >
              {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer — only renders when open */}
      {mobileOpen && (
        <nav ref={drawerRef} id={`${menuId}-navigation`} className="sw-public-nav__drawer sw-public-nav__drawer--grouped" aria-label="Navigation menu">
          <ul className="sw-public-nav__drawer-list" role="list">
            {NAV_ITEMS.map((item) => item.disclosure ? groupedNavigation({ ...item, disclosure: item.disclosure }, true) : (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeNavigation}
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
            <Link href="/sign-in" className="sw-public-nav__signin sw-public-nav__signin--block" onClick={closeNavigation}>
              Sign in
            </Link>
            <Link href="/sign-up" className="sw-public-nav__signup sw-public-nav__signup--block" onClick={closeNavigation}>
              Start
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
