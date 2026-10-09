"use client";
import type { LibraryItem } from "@/lib/publishing/library-query";
import { Markdown } from "@/components/ui/markdown";
import { MonsterQuickDetails } from "@/components/monsters/monster-quick-details";
import { CatalogueQuickLook } from "./catalogue-quick-look";

export function LibraryQuickDetails({ item }: { item: LibraryItem }) {
  const narrative = [
    ...new Set([item.verboseDescription, item.description].filter(Boolean)),
  ];
  return (
    <CatalogueQuickLook name={item.name}>
      <small>
        {item.targetType.replaceAll("_TEMPLATE", "").replaceAll("_", " ")} ·{" "}
        {item.buCost ?? 0} BU
      </small>
      {item.targetType === "MONSTER" ? (
        <MonsterQuickDetails
          id={item.targetId}
          concept={item.description ?? ""}
        />
      ) : (
        <>
          {narrative.map((text, i) => (
            <Markdown key={i} copyRole="narrative">
              {text!}
            </Markdown>
          ))}
          {item.compositionPaths?.length ? (
            item.compositionPaths.map((path, i) => (
              <div className="sw-catalogue-peek-rule" key={i}>
                <strong>{path.primitiveName}</strong>
                <Markdown copyRole="mechanical">
                  {path.mechanicalDescription}
                </Markdown>
              </div>
            ))
          ) : item.mechanicalDescription ? (
            <div className="sw-catalogue-peek-rule">
              <Markdown copyRole="mechanical">
                {item.mechanicalDescription}
              </Markdown>
            </div>
          ) : null}
        </>
      )}
      <small>Open the preview for the complete entry and actions.</small>
    </CatalogueQuickLook>
  );
}
