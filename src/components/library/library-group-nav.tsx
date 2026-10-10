"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { EntityTypeIcon } from "@/components/icons/entity-type-icon";
export function LibraryGroupNav({ active }: { active: string }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = nav.current;
    const selected = container?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (!container || !selected) return;
    const reveal = () => { if (container.scrollWidth > container.clientWidth) container.scrollLeft = Math.max(
        0,
        selected.offsetLeft -
          container.offsetLeft -
          (container.clientWidth - selected.offsetWidth) / 2,
      ); };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [active]);
  const creations = [
    "EFFECT",
    "CAPABILITY",
    "LINEAGE_TEMPLATE",
    "UPBRINGING_TEMPLATE",
    "MANIFEST_TEMPLATE",
    "ITEM",
  ];
  return (
    <nav
      ref={nav}
      className="v12-library-modes"
      aria-label="Library record groups"
    >
      {[
        ["PRIMITIVE", "Market primitives"],
        ["CAPABILITY", "Creations"],
        ["CHARACTER", "Characters"],
        ["MONSTER", "Monsters & NPCs"],
        ["ENCOUNTER", "Encounters"],
      ].map(([type, label]) => (
        <Link
          key={type}
          aria-current={
            type === active ||
            (type === "CAPABILITY" && creations.includes(active))
              ? "page"
              : undefined
          }
          className={
            type === active ||
            (type === "CAPABILITY" && creations.includes(active))
              ? "is-active"
              : ""
          }
          href={`/library/browse?type=${type}`}
        >
          <EntityTypeIcon type={type!} />
          {label}
        </Link>
      ))}
      <Link
        aria-current={active === "COLLECTION" ? "page" : undefined}
        className={active === "COLLECTION" ? "is-active" : ""}
        href="/library/collections"
      >
        <EntityTypeIcon type="COLLECTION" />
        Public collections
      </Link>
      <Link href="/library" aria-current={active === "HUB" ? "page" : undefined} className={active === "HUB" ? "is-active" : ""}>Library hub ↗</Link>
    </nav>
  );
}
