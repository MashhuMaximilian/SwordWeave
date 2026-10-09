"use client";

// Shared quick-access navigation, contextual workspaces and account utilities.

import {AccountMenu} from "@/components/account/account-menu";
import {useAccount} from "@/components/account/account-provider";
import {
  Plus,
  Columns2,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Sun,
  UserRound,
  Wrench,
  X,
  BookOpen,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fabCreationMode } from "@/lib/fab-visibility";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";



// A silhouette mask keeps navigation icons white in dark mode and ink in light.
// Shared CSS gives the same silhouette a gold finish on hover or keyboard focus.
export function FabIcon({ iconKey, alt }: { iconKey: string; alt: string }) {
  const bundled = ["lorc/cultist", "delapouite/spiked-dragon-head", "lorc/gluttonous-smile"].includes(iconKey);
  const mask = bundled ? `url("/icons/entity-types/${iconKey}.svg")` : `url("/api/icons/game/${iconKey}?color=%23ffffff&finish=metallic-v2-diagonal")`;
  return <span className="sw-fab-glyph" aria-hidden="true" title={alt}
    style={{ maskImage: mask, WebkitMaskImage: mask }} />;
}

/** Action button: toggles a state, calls onClick. */
export type FabAction = {
  kind?: "action";
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

/** Link button: navigates to a page. */
export type FabLink = {
  kind: "link";
  key: string;
  label: string;
  icon: ReactNode;
  href: string;
  external?: boolean;
};

/** Section divider: a thin label row. */
export type FabDivider = {
  kind: "divider";
  key: string;
  label: string;
};

/** Account submenu marker. */
export type FabUserMenu = {
  kind: "userMenu";
  key: string;
};

type FabAccountUser = NonNullable<FabSpeedDialProps["currentUser"]>;

export type FabItem = FabAction | FabLink | FabDivider | FabUserMenu;

interface FabSpeedDialProps {
  items: FabItem[];
  /** Primary button label (used for aria-label when closed). */
  primaryLabel?: string;
  /** Distance from the bottom of the viewport (includes safe-area). */
  bottomOffset?: number;
  /** Whether to render the primary FAB itself (false hides the entire FAB). */
  visible?: boolean;
  /** Render the user menu (only the FAB itself knows about the user's profile). */
  onUserMenu?: () => void;
  /** Currently signed-in user (for the user menu button in the FAB). */
  currentUser?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  /**
   * Number to show as a small notification dot on the Build & Preview
   * button in the bottom 2x3 grid. > 0 = show the dot. The build stash
   * is the in-progress sandbox form; a dot means "you have unsaved
   * changes — open the sheet to continue."
   *
   * Phase 8.1 batch 2: superseded by `actionBadgeCounts` for any action
   * key (Character FAB needs the same dot). Kept for back-compat — when
   * provided, merged into `actionBadgeCounts` under the "build" key.
   */
  buildStashCount?: number;
  /**
   * Per-action notification dot count, keyed by `FabItem.key`. > 0 shows
   * a small badge on the action button. Replaces the build-only
   * `buildStashCount` prop; both can be supplied and will merge.
   */
  actionBadgeCounts?: Record<string, number>;
}

export function FabSpeedDial({
  items,
  primaryLabel = "Open menu",
  bottomOffset = 16,
  visible = true,
  currentUser,
  buildStashCount = 0,
  actionBadgeCounts,
}: FabSpeedDialProps) {
  // Merge the legacy buildStashCount into the per-action map so callers
  // that still pass the old prop keep their dot, and callers that pass
  // the new map get per-key badges.
  const badgeCounts: Record<string, number> = useMemo(
    () => ({
      ...(buildStashCount > 0 ? { build: buildStashCount } : {}),
      ...(actionBadgeCounts ?? {}),
    }),
    [buildStashCount, actionBadgeCounts],
  );
  const {isGameMaster}=useAccount();
  const [accountOpen,setAccountOpen]=useState(false);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const creationMode = fabCreationMode(usePathname());
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const accountLabel = currentUser?.displayName ? `Account · ${currentUser.displayName}` : "Account";
  const action = (key: string) => items.find((item): item is FabAction => item.kind === "action" && item.key === key);
  const workspaces = [action("build"), action("character")].filter((item): item is FabAction => !!item);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) { setOpen(false); }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false); triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function navigate(href: string) {
    const event = new CustomEvent("sw-navigate-away", { detail: href, cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) { window.location.assign(href); setOpen(false); }
  }
  function followLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  function destination(key: string, description?: string, feature = false) {
    const item = items.find(item => item.key === key);
    if (!item || item.kind === "divider" || item.kind === "userMenu") return null;
    const label = key === "builds" ? "Characters" : item.label;
    const content = <><span className="sw-fab__destination-icon">{referenceIcon(key) ?? item.icon}</span><span className="sw-fab__copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>{!feature && <ChevronRight className="sw-fab__chevron" size={17}/>}</>;
    const className = cn("sw-fab__destination", feature && "sw-fab__feature", key === "atelier" && "sw-fab__atelier");
    return item.kind === "link" ? <Link key={key} data-fab-link={key} aria-label={label} className={className} href={item.href} onClick={event => followLink(event, item.href)}>{content}</Link>
      : <button key={key} type="button" data-fab-action={key} className={className} disabled={item.disabled} onClick={() => { item.onClick(); setOpen(false); }}>{content}</button>;
  }

  if (!visible) return null;
  return <div ref={containerRef} className="sw-fab fixed right-3 z-40 flex flex-col items-end gap-3 sm:right-4" data-fab-root style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }}>
      <svg className="sw-fab__metal-defs" aria-hidden="true"><defs><linearGradient id="sw-fab-gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="32" y2="32"><stop stopColor="var(--fab-gold-low, #b68b3f)"/><stop offset=".19" stopColor="var(--fab-gold-mid, #e8c47a)"/><stop offset=".36" stopColor="#fffbe1"/><stop offset=".46" stopColor="var(--fab-gold-low, #a87929)"/><stop offset=".65" stopColor="var(--fab-gold-mid, #e7c780)"/><stop offset=".84" stopColor="var(--fab-gold-low, #ad813c)"/><stop offset="1" stopColor="var(--fab-gold-mid, #f2d994)"/></linearGradient><linearGradient id="sw-fab-silver" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop stopColor="var(--fab-silver-low, #6e8589)"/><stop offset=".22" stopColor="var(--fab-silver-mid, #d8e3e3)"/><stop offset=".3" stopColor="#fff"/><stop offset=".38" stopColor="var(--fab-silver-low, #82999e)"/><stop offset=".6" stopColor="var(--fab-silver-mid, #edf5f4)"/><stop offset=".65" stopColor="#fff"/><stop offset=".72" stopColor="var(--fab-silver-low, #7e969b)"/><stop offset="1" stopColor="var(--fab-silver-mid, #d8e3e3)"/></linearGradient></defs></svg>
    {open && <div className="sw-fab__menu" data-fab-menu id="sw-quick-access" role="region" aria-label="Quick access" style={{ maxHeight: `calc(var(--sw-visible-height, 100dvh) - ${bottomOffset + 82}px - env(safe-area-inset-bottom, 0px))` }}>

      {accountOpen ? <AccountMenu back={()=>{setAccountOpen(false);requestAnimationFrame(()=>containerRef.current?.querySelector<HTMLButtonElement>('[data-fab-action="account"]')?.focus());}} close={()=>setOpen(false)} onLink={followLink}/> : <>
      <header className="sw-fab__heading"><Link href="/" className="sw-fab__brand" aria-label="SwordWeave home" onClick={event => followLink(event, "/")}><span className="sw-public-nav__brandmark" aria-hidden="true"/><span className="sw-public-nav__wordmark"><span>Sword</span><span>·</span><span>Weave</span></span></Link><span>Quick access</span></header>
      <div className="sw-fab__navigation">
        <section className="sw-fab__section"><h3>Browse & make</h3><div className="sw-fab__pair">{destination("library", "Public entries", true)}{destination("atelier", "Build & edit", true)}</div></section>
        <section className="sw-fab__section"><h3>Play sheets</h3><div className={cn("sw-fab__pair", !isGameMaster && creationMode !== "buttons" && "sw-fab__pair--single")}>{destination("builds")}{isGameMaster ? destination("monsters") : creationMode === "buttons" ? <Link className="sw-fab__creators" href="/characters/new" data-fab-action="create-character" onClick={event => followLink(event, "/characters/new")}><FabIcon iconKey="lorc/cultist" alt=""/><span>Create character</span></Link> : null}</div></section>
        {isGameMaster&&destination("encounters")}
        <section className="sw-fab__archive"><h3>My archive</h3>{destination("creations", "Authored records")}{destination("collections", "Discover public collections")}</section>
      </div>
      {workspaces.length > 0 && <div className="sw-fab__workspace-grid">
        {workspaces.map(item => <FabGridAction key={item.key} action={item} badgeCount={badgeCounts[item.key] ?? 0} onInvoke={() => setOpen(false)}/>)}
        {creationMode === "menu" && <div className="sw-fab__create-wrap"><button type="button" className="sw-fab__create-plus" data-fab-action="create" aria-label="Create a character or monster" aria-expanded={createOpen} aria-controls="sw-fab-create-menu" onClick={() => setCreateOpen(value => !value)}><Plus size={20}/></button>{createOpen && <div id="sw-fab-create-menu" className="sw-fab__create-menu" role="group" aria-label="Create"><Link href="/characters/new" onClick={event => followLink(event, "/characters/new")}><FabIcon iconKey="lorc/cultist" alt=""/><span>Create character</span></Link>{isGameMaster&&<Link href="/monsters/new" onClick={event => followLink(event, "/monsters/new")}><FabIcon iconKey="delapouite/spiked-dragon-head" alt=""/><span>Create monster</span></Link>}</div>}</div>}
      </div>}
      {creationMode === "buttons" && isGameMaster && <div className="sw-fab__pair sw-fab__creators"><Link href="/characters/new" data-fab-action="create-character" onClick={event => followLink(event, "/characters/new")}><FabIcon iconKey="lorc/cultist" alt=""/><span>Create character</span></Link>{isGameMaster&&<Link href="/monsters/new" data-fab-action="create-monster" onClick={event => followLink(event, "/monsters/new")}><FabIcon iconKey="delapouite/spiked-dragon-head" alt=""/><span>Create monster</span></Link>}</div>}
      <footer className="sw-fab__utilities">
        <div className="sw-fab__utility-strip">
          {destination("home")}{destination("rules")}
          <div className="sw-fab__utility-grid">
            {[action("dark"), action("fullscreen"), action("split")].filter((item): item is FabAction => !!item).map(item => <FabGridAction key={item.key} action={item} badgeCount={0} onInvoke={() => {if (isMobile && item.key === "split") setOpen(false);}}/>)}
            <FabGridAction action={{ kind: "action", key: "account", label: accountLabel, icon: currentUser ? <span className="sw-fab__account-rim"><FabAccountAvatar user={currentUser}/></span> : <UserRound size={22}/>, onClick: () => {setAccountOpen(true);setCreateOpen(false);} }} badgeCount={0}/>
          </div>
        </div>
        {items.filter((item): item is FabLink => item.kind === "link" && item.key === "buymeacoffee").map(item => <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" className="sw-fab__support" data-fab-link={item.key}>{item.icon}<span>{item.label}</span><ArrowUpRight size={16}/></a>)}
      </footer></>}
    </div>}
    <button ref={triggerRef} type="button" data-fab-trigger onClick={() => {setOpen(value => !value);setCreateOpen(false);setAccountOpen(false);}} aria-label={open ? "Close menu" : primaryLabel} aria-expanded={open} aria-controls="sw-quick-access" className="sw-fab__trigger">{open ? <X size={24}/> : <Menu size={24}/>}</button>
  </div>;
}

// The same fine outline glyphs used in the approved reference.
function referenceIcon(key: string) {
  if (key === "monsters") return <FabIcon iconKey="lorc/gluttonous-smile" alt="Monsters"/>;
  if (key === "home") return <span className="sw-fab__home-logo" aria-hidden="true"/>;
  if (key === "rules") return <BookOpen size={19} strokeWidth={1.4}/>;
  const paths: Record<string, string> = {
    library: "M3 4h5v25H3z M12 4h5v25h-5z M21 5l4-1 5 23-4 1z",
    atelier: "M4 21l12-12 7 7-12 12z M16 9l4-4 7 7-4 4 M5 8l3-3 18 18-3 3z",
    builds: "M11 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10 M3 28v-5c0-8 16-8 16 0v5 M23 6a4 4 0 0 1 0 8 M23 18c6 0 6 5 6 10",
    monsters: "M3 3l7 4 6-5 6 5 7-4-3 11 3 8-13 8L3 22l3-8z M9 13l5 3 M23 13l-5 3 M11 22h10",
    creations: "M16 2l11 6v16l-11 6L5 24V8z M5 8l11 7 11-7 M16 15v15",
    collections: "M2 8h10l3 4h15v17H2z",
  };
  return paths[key] ? <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[key]}/></svg> : null;
}

function FabGridAction({ action, badgeCount, onInvoke }: { action: FabAction; badgeCount: number; onInvoke?: () => void }) {
  return (
    <button
      type="button"
      data-fab-action={action.key}
      onClick={() => { action.onClick(); onInvoke?.(); }}
      disabled={action.disabled}
      aria-pressed={action.active}
      aria-label={action.label}
      title={action.label}
      className={cn(
        "relative flex w-full items-center justify-center rounded-md border text-xs font-medium",
        action.active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
      )}
    >
      {action.icon}
      <span className="sw-fab__action-label">{({split:"Split view",fullscreen:"Fullscreen",dark:"Theme",account:"Account",build:"Build & Preview",character:"Character"} as Record<string,string>)[action.key] ?? action.label}</span>
      {badgeCount > 0 ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background"
          aria-label={`${badgeCount} unsaved ${action.label.toLowerCase()} change${badgeCount === 1 ? "" : "s"}`}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
}

function FabAccountAvatar({ user }: { user: FabAccountUser }) {
  const fallback = (user.displayName ?? user.username).trim() || "?";
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        aria-hidden="true"
        className="sw-fab__account-avatar size-6 rounded-full border border-primary/60 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="sw-fab__account-avatar flex size-6 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-xs font-bold text-primary"
    >
      {fallback[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Pre-built item sets — consumers compose these or pass their own.
// -----------------------------------------------------------------------------

/**
 * Top-level navigation — slim 6-item set per the user's spec.
 * Home / Library / My Creations / Grammar / Templates / Builds.
 */
export const NAV_LINKS: FabItem[] = [
  {
    kind: "link",
    key: "home",
    // Logo placed here 2026-07-14 — replaces the lucide Home icon
    // for branded entry point into the app. Theme-aware via two
    // stacked <Image>s with `dark:` CSS swap: /logo-light.png is
    // teal-on-transparent (visible against the FAB's light-mode
    // button face), /logo-dark.png is white-on-transparent (visible
    // against the dark-mode button face). Sized at 32px (size-8)
    // to give the hex composition room against the 16px lucide
    // siblings. `priority` on both because the FAB sits in the
    // initial viewport on every route.
    label: "Home",
    icon: (
      <>
        <Image
          src="/logo-light.png"
          alt=""
          width={22}
          height={27}
          className="rounded-sm block dark:hidden"
          priority
        />
        <Image
          src="/logo-dark.png"
          alt=""
          width={22}
          height={27}
          className="rounded-sm hidden dark:block"
          priority
        />
      </>
    ),
    href: "/",
  },
  {
    kind: "link",
    key: "library",
    label: "Library",
    icon: (
      <FabIcon iconKey="delapouite/bookshelf" alt="Codex" />
    ),
    href: "/library/browse",
  },
  {
    kind: "link",
    key: "creations",
    label: "My creations",
    icon: (
      <FabIcon iconKey="delapouite/cosmic-egg" alt="My Creations" />
    ),
    href: "/creations",
  },
  {
    kind: "link",
    key: "atelier",
    label: "Atelier",
    icon: (
      <FabIcon iconKey="lorc/jigsaw-box" alt="Atelier" />
    ),
    href: "/atelier",
  },
  {
    kind: "link",
    key: "builds",
    label: "Characters",
    icon: (
      <FabIcon iconKey="seregacthtuf/armor-blueprint" alt="Builds" />
    ),
    href: "/characters",
  },
  { kind: "link", key: "collections", label: "Collections", icon: <FabIcon iconKey="delapouite/bookshelf" alt="Collections" />, href: "/library/collections" },
  { kind: "link", key: "monsters", label: "Monsters", icon: <FabIcon iconKey="lorc/gluttonous-smile" alt="Monsters" />, href: "/monsters" },
  { kind: "link", key: "rules", label: "Play guide", icon: <FabIcon iconKey="delapouite/rule-book" alt="Play guide" />, href: "/rules" },
];

/** Profile row at the bottom — opens the user menu modal. */
export const ACCOUNT_LINKS: FabItem[] = [
  {
    kind: "divider",
    key: "div-account",
    label: "Account",
  },
  {
    kind: "userMenu",
    key: "user-menu",
  },
];

// Re-export icons for convenience.
export const FabIcons = {
  Plus,
  Columns2,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Sun,
  UserRound,
  Wrench,
  X,
};
