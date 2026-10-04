"use client";

import { FetchedEntityPreview } from "@/components/preview/entity-preview";
import { useModalStack } from "@/components/ui/modal-stack";

/** Names open the same preview used in Library; the surrounding row expands controls. */
export function CharacterComponentName({ name, targetType, targetId }: {
  name: string;
  targetType: string;
  targetId: string | number;
}) {
  const stack = useModalStack();
  return <button type="button" className="sw-character-component-name" title={`Preview ${name}`}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      stack.push({
        key: `character-preview:${targetType}:${targetId}`,
        label: name,
        category: targetType,
        global: true,
        content: <FetchedEntityPreview targetType={targetType} targetId={String(targetId)} />,
      });
    }}>
    {name}<span aria-hidden="true" className="sw-character-preview-mark">↗</span>
  </button>;
}
