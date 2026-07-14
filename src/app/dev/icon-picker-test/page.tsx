// DEV-ONLY: Phase 12 test harness for the icon picker. Renders
// IconSlot in isolation so we can click around without navigating
// into an auth-protected route. Delete before production.
"use client";

import { useState } from "react";
import { IconSlot } from "@/components/icons/icon-slot";
import type { IconSource } from "@/components/icons/icon-display";

export default function IconPickerTestPage() {
  const [iconSource, setIconSource] = useState<IconSource | null>(null);
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<string>("#ffffff");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 text-foreground">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold uppercase">
          Icon Picker Test
        </h1>
        <p className="text-sm text-muted-foreground">
          Phase 12 dev harness — verifies Filters modal &amp; ColorPicker
          in isolation. Delete this route before production.
        </p>
      </header>

      <section className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <IconSlot
          iconSource={iconSource}
          iconKey={iconKey}
          iconUrl={iconUrl}
          iconColor={iconColor}
          label="Test Entity"
          onChange={(next) => {
            setIconSource(next.iconSource);
            setIconKey(next.iconKey ?? null);
            setIconUrl(next.iconUrl ?? null);
            setIconColor(next.iconColor);
          }}
        />
        <div className="text-sm">
          <div>
            <span className="font-mono text-muted-foreground">source:</span>{" "}
            {iconSource ?? "—"}
          </div>
          <div>
            <span className="font-mono text-muted-foreground">key:</span>{" "}
            {iconKey ?? "—"}
          </div>
          <div>
            <span className="font-mono text-muted-foreground">color:</span>{" "}
            {iconColor}
          </div>
        </div>
      </section>
    </div>
  );
}
