"use client";
import Link from "next/link";
import { Check, Plus, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { CatalogueQuickLook } from "@/components/library/catalogue-quick-look";
import { ColumnSearchBar } from "@/components/library/column-search-bar";
import { portraitFrameStyle } from "@/lib/character/portrait-frame";
import type { LibraryView } from "@/lib/preferences/library-prefs";
export type PartyDirectoryCharacter = {
  id: string;
  name: string;
  level: number;
  size: string;
  portraitUrl: string | null;
  portraitFrame: unknown;
  physical: number;
  mental: number;
  magical: number;
  shared: boolean;
};
export function EncounterPartyDirectory({
  characters,
  selected,
  search,
  pending,
  onSearch,
  onToggle,
}: {
  characters: PartyDirectoryCharacter[];
  selected: string[];
  search: string;
  pending: boolean;
  onSearch: (search: string) => void;
  onToggle: (id: string) => void;
}) {
  const [view, setView] = useState<LibraryView>("GRID");
  return (
    <div className="sw-encounter-party-directory">
      <ColumnSearchBar
        search={search}
        onSearchChange={onSearch}
        placeholder="Search owned or shared characters…"
        view={view}
        onViewChange={setView}
      />
      <div className="sw-encounter-catalogue-heading">
        <small>
          {selected.length} linked · link sheets without changing them
        </small>
        {pending && <small role="status">Loading characters…</small>}
      </div>
      <div
        className={`sw-encounter-party-records ${view === "GRID" ? "is-grid" : "is-list"}`}
      >
        {characters.map((character) => (
          <article
            key={character.id}
            data-preview-trigger="true"
            className={`sw-encounter-party-record${selected.includes(character.id) ? " is-selected" : ""}`}
          >
            <CatalogueQuickLook name={character.name}>
              <p>
                Level {character.level} · {character.size.toLowerCase()} ·{" "}
                {character.shared ? "Shared with you" : "Your character"}
              </p>
              <p>
                Base Physical {character.physical} · Mental {character.mental} ·
                Magical {character.magical}
              </p>
              <p>
                Link the character, then calculate to review their current
                progression BU and separate Item BU before applying totals.
              </p>
            </CatalogueQuickLook>
            <div className="v12-roster-avatar-frame">
              <div className="v12-roster-avatar-crop">
                {character.portraitUrl ? (
                  <img
                    src={character.portraitUrl}
                    alt=""
                    loading="lazy"
                    style={portraitFrameStyle(character.portraitFrame)}
                  />
                ) : (
                  <span>{character.name[0]?.toUpperCase()}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              data-quick-look-opener
              className="sw-encounter-party-link"
              disabled={
                pending ||
                (!selected.includes(character.id) && selected.length >= 30)
              }
              aria-pressed={selected.includes(character.id)}
              aria-label={`${selected.includes(character.id) ? "Unlink" : "Link"} ${character.name}`}
              onClick={() => onToggle(character.id)}
            >
              <strong>{character.name}</strong>
              <small>
                Level {character.level} · {character.size.toLowerCase()}
              </small>
              <small>
                {character.shared ? "Shared with you" : "Your character"}
              </small>
            </button>
            <div className="sw-encounter-party-record-actions">
              <button
                type="button"
                className="sw-metal-button sw-encounter-icon-action"
                disabled={
                  pending ||
                  (!selected.includes(character.id) && selected.length >= 30)
                }
                aria-label={`${selected.includes(character.id) ? "Unlink" : "Link"} ${character.name}`}
                aria-pressed={selected.includes(character.id)}
                onClick={() => onToggle(character.id)}
              >
                {selected.includes(character.id) ? (
                  <Check size={17} />
                ) : (
                  <Plus size={17} />
                )}
              </button>
              <Link
                href={`/characters/${character.id}`}
                className="sw-metal-button"
                aria-label={`Open ${character.name} sheet`}
              >
                Open sheet <ArrowUpRight size={14} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!pending && !characters.length && (
        <p>No matching owned or shared characters.</p>
      )}
    </div>
  );
}
