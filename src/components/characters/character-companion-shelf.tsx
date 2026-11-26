"use client";

import Link from "next/link";
import { ExternalLink, PawPrint } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { MonsterTemplatePreview } from "@/components/monsters/monster-template-preview";
import {
  characterCompanionBestiaryPath,
  characterCompanionPlayPath,
  type CharacterCompanionSummary,
} from "@/lib/character/companion-types";

interface CompanionShelfProps {
  characterId: string;
  companions: CharacterCompanionSummary[];
}

export function CharacterCompanionShelf({ characterId, companions }: CompanionShelfProps) {
  if (companions.length === 1 && companions[0]) {
    return <CompanionPanel characterId={characterId} companion={companions[0]} />;
  }

  return (
    <Tabs className="min-w-0 space-y-2">
      <TabList aria-label="Choose a companion" className="flex max-w-full gap-2 overflow-x-auto p-1" items={companions}>
        {companion => (
          <Tab id={companion.id} className={({ isSelected }) =>
            `sheet-button max-w-[80vw] shrink-0 cursor-pointer${isSelected ? " is-gold" : ""}`
          }>
            <span className="truncate">{companion.name}</span>
          </Tab>
        )}
      </TabList>
      {companions.map(companion => (
        <TabPanel key={companion.id} id={companion.id} className="min-w-0">
          <CompanionPanel characterId={characterId} companion={companion} />
        </TabPanel>
      ))}
    </Tabs>
  );
}

function CompanionPanel({ characterId, companion }: { characterId: string; companion: CharacterCompanionSummary }) {
  const { bestiary, name, playCopyId } = companion;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-2">
        {playCopyId && (
          <Link className="sheet-button is-gold" href={characterCompanionPlayPath(playCopyId, characterId)}
            target="_blank" rel="noopener noreferrer">
            Open play sheet <ExternalLink size={15} aria-hidden="true" />
            <span className="sr-only"> for {name} in a new tab</span>
          </Link>
        )}
        {bestiary && (
          <Link className="sheet-button" href={characterCompanionBestiaryPath(bestiary.id, bestiary.version)}>
            Open Bestiary entry <span className="sr-only">for {bestiary.name}</span>
          </Link>
        )}
      </div>
      {bestiary ? (
        <MonsterTemplatePreview id={bestiary.id} version={bestiary.version} displayName={name}
          compact hideActions initialSection="story" />
      ) : (
        <article className="sw-creature-preview">
          <header className="sw-creature-identity">
            <span className="sw-creature-emblem"><PawPrint size={28} aria-hidden="true" /></span>
            <div>
              <h2>{name}</h2>
              <p>Open the play sheet to see this companion’s pinned rules.</p>
            </div>
          </header>
        </article>
      )}
    </div>
  );
}
