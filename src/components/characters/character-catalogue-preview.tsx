"use client";
import "@/components/library/catalogue-layout.css";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BookmarkButton } from "@/components/collections/bookmark-button";
import { IconDisplay } from "@/components/icons/icon-display";
type CharacterRecord = {
  name: string;
  level: number;
  size: string;
  portraitUrl: string | null;
  lineageName: string | null;
  upbringingName: string | null;
  manifestName: string | null;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  primitiveLinks?: { primitive?: { id: number; name: string } }[];
  capabilityLinks?: { capability?: { id: string; name: string } }[];
};
/** Permission-checked read summary; gameplay remains on the existing sheet. */
export function CharacterCataloguePreview({ id }: { id: string }) {
  const { userId, isLoaded } = useAuth();
  return isLoaded ? (
    <AccountCharacterPreview key={`${userId ?? "anonymous"}:${id}`} id={id} />
  ) : (
    <p role="status">Loading character…</p>
  );
}
function AccountCharacterPreview({ id }: { id: string }) {
  const [character, setCharacter] = useState<CharacterRecord | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/characters/${id}/catalogue`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Character unavailable.");
        if (!controller.signal.aborted) setCharacter(data.character);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!character) return <p role="status">Loading character…</p>;
  const entries = [
    ...(character.primitiveLinks ?? []).flatMap((link) =>
      link.primitive ? [{ kind: "PRIMITIVE", ...link.primitive }] : [],
    ),
    ...(character.capabilityLinks ?? []).flatMap((link) =>
      link.capability ? [{ kind: "CAPABILITY", ...link.capability }] : [],
    ),
  ];
  return (
    <div className="sw-character-catalogue-preview v12-fetched-preview">
      <header>
        <IconDisplay portraitUrl={character.portraitUrl} size={80} alt="" />
        <div>
          <p className="v12-kicker">
            Character · Level {character.level} · {character.size.toLowerCase()}
          </p>
          <h2>{character.name}</h2>
          <p>
            {[
              character.lineageName,
              character.upbringingName,
              character.manifestName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>
      <dl>
        {[
          ["Physical", character.attrPhysical],
          ["Mental", character.attrMental],
          ["Magical", character.attrMagical],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="sw-character-catalogue-links">
        <Link
          className="sw-metal-button"
          href={`/characters/${id}?view=public`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open character sheet
          <ArrowUpRight size={16} />
        </Link>
        <BookmarkButton targetType="CHARACTER" targetId={id} />
      </div>
      {entries.length > 0 && (
        <section>
          <h3 className="v12-kicker">Primitives & capabilities</h3>
          <ul>
            {entries.map((entry) => (
              <li key={`${entry.kind}:${entry.id}`}>
                <Link href={`/library/item/${entry.kind}:${entry.id}`}>
                  {entry.name}
                  <ArrowUpRight size={12} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
