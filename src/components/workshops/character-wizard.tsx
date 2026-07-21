"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";

/**
 * Character Wizard
 *
 * Stepped creation flow:
 *   1. Identity — name, size, portrait
 *   2. Attributes — physical/mental/magical, must sum to 10, pick proficiency
 *   3. Race / Background — pick from library OR freeform text
 *   4. Capabilities — pick from library + starting items
 *   5. Review — show totals, submit
 *
 * On submit, POST /api/characters.
 */

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
};

type HeritageRow = {
  id: string;
  kind: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
};

type ItemRow = {
  id: string;
  name: string;
  itemType: string;
  rarity: string;
};

type AttrProf = "PHYSICAL" | "MENTAL" | "MAGICAL";

const SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;

const STEPS = [
  { id: 1, title: "Identity", description: "Who is this character?" },
  { id: 2, title: "Attributes", description: "Body, mind, magic" },
  { id: 3, title: "Race / Background", description: "Heritage and history" },
  { id: 4, title: "Capabilities & Items", description: "What you can do" },
  { id: 5, title: "Review", description: "Confirm and create" },
] as const;

export function CharacterWizard({
  races,
  backgrounds,
  capabilities,
  items,
  /**
   * Phase 8.1 batch 3: optional override for what happens after a
   * successful create. The default (when not provided, e.g. on the
   * legacy /sandbox/characters page) is `window.location.href` to the
   * new character sheet. The character modal passes a handler that
   * closes the modal + opens the preview in a new tab (per spec:
   * "preview should always open in a new tab").
   */
  onCreated,
}: {
  races: HeritageRow[];
  backgrounds: HeritageRow[];
  capabilities: CapabilityRow[];
  items: ItemRow[];
  onCreated?: (characterId: string, characterName: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    size: "MEDIUM" as (typeof SIZES)[number],
    portraitUrl: "",
    notes: "",
    level: 1,
    startingBu: 25,
    attrPhysical: 0,
    attrMental: 0,
    attrMagical: 0,
    attrProficient: null as AttrProf | null,
    lineageId: "",
    lineageName: "",
    lineageDescription: "",
    upbringingId: "",
    upbringingName: "",
    upbringingDescription: "",
    manifestName: "",
    enforceTemplateCaps: false,
  });
  // Track capabilities with their mirrored state (for debt expansion)
  type SelectedCapability = { id: string; is_mirrored: boolean };
  const [selectedCapabilities, setSelectedCapabilities] = useState<SelectedCapability[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

  const attrSum = form.attrPhysical + form.attrMental + form.attrMagical;
  const attrValid = attrSum === 10;

  const progressionPool = form.startingBu + (form.level - 1) * 5;

  // Per-step validation
  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return form.name.trim().length > 0;
      case 2:
        return attrValid;
      case 3:
        // Race/bg are optional — character can be freeform
        return true;
      case 4:
        return true;
      case 5:
        return form.name.trim().length > 0 && attrValid;
      default:
        return true;
    }
  }, [step, form, attrValid]);

  function pickRace(id: string) {
    const race = races.find((r) => r.id === id);
    if (race) {
      setForm((f) => ({
        ...f,
        lineageId: id,
        lineageName: race.name,
        lineageDescription: race.description ?? "",
      }));
    } else {
      setForm((f) => ({ ...f, lineageId: "" }));
    }
  }

  function pickBackground(id: string) {
    const bg = backgrounds.find((b) => b.id === id);
    if (bg) {
      setForm((f) => ({
        ...f,
        upbringingId: id,
        upbringingName: bg.name,
        upbringingDescription: bg.description ?? "",
      }));
    } else {
      setForm((f) => ({ ...f, upbringingId: "" }));
    }
  }

  function toggleCapability(id: string) {
    setSelectedCapabilities((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        return prev.filter((c) => c.id !== id);
      }
      return [...prev, { id, is_mirrored: false }];
    });
  }

  function toggleCapabilityMirror(id: string) {
    setSelectedCapabilities((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, is_mirrored: !c.is_mirrored } : c,
      ),
    );
  }

  function toggleItem(id: string) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      showToast("Name is required.", "error");
      setStep(1);
      return;
    }
    if (!attrValid) {
      showToast(`Attributes must sum to exactly 10 (currently ${attrSum}).`, "error");
      setStep(2);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            size: form.size,
            portraitUrl: form.portraitUrl.trim() || null,
            notes: form.notes.trim() || null,
            level: form.level,
            startingBu: form.startingBu,
            attrPhysical: form.attrPhysical,
            attrMental: form.attrMental,
            attrMagical: form.attrMagical,
            attrProficient: form.attrProficient,
            lineageName: form.lineageName.trim() || null,
            lineageImageUrl: null,
            lineageDescription: form.lineageDescription.trim() || null,
            upbringingName: form.upbringingName.trim() || null,
            upbringingImageUrl: null,
            upbringingDescription: form.upbringingDescription.trim() || null,
            manifestName: form.manifestName.trim() || null,
            enforceTemplateCaps: form.enforceTemplateCaps,
            practiceSlices: {},
            capabilitySlots: selectedCapabilities,
            itemIds: selectedItemIds,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error ?? "Failed to create character.";
          showToast(errMsg, "error");
          return;
        }

        showToast(`Created character "${data.character?.name}"!`, "success");
        const createdId = data.character?.id as string | undefined;
        const createdName = (data.character?.name as string | undefined) ?? form.name.trim();
        if (!createdId) {
          showToast("Character created but no id returned.", "error");
          return;
        }
        if (onCreated) {
          onCreated(createdId, createdName);
        } else {
          // Default legacy behavior for /sandbox/characters — same-tab
          // redirect to the new sheet.
          window.location.href = `/characters/${createdId}`;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Character Wizard
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Forge a character.</h1>
      </div>

      {/* Step indicator */}
      <ol className="mt-8 grid gap-2 sm:grid-cols-5">
        {STEPS.map((s) => {
          const isCurrent = step === s.id;
          const isDone = step > s.id;
          return (
            <li
              key={s.id}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                isCurrent
                  ? "border-primary bg-primary/10"
                  : isDone
                    ? "border-green-500/30 bg-green-500/10"
                    : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? "✓" : s.id}
                </span>
                <span className="font-medium">{s.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground hidden sm:block">
                {s.description}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Sticky action bar — always visible */}
      <div className="sticky bottom-0 z-30 mt-6 -mx-5 border-y border-border bg-background/80 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                attrValid
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Attr
              </span>
              <span className="font-mono font-bold">{attrSum} / 10</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Level
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 font-mono text-sm font-bold">
                {form.level}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Pool
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {progressionPool} BU
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card disabled:opacity-30"
            >
              ← Back
            </button>
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!stepValid}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !stepValid}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Character"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="mt-8 rounded-md border border-border bg-card p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Step 1: Identity</h2>
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vex the Quick"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                autoFocus
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Size">
                <select
                  value={form.size}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, size: e.target.value as typeof form.size }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Portrait URL (optional)">
                <input
                  type="url"
                  value={form.portraitUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, portraitUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Personality, backstory, anything notable..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Step 2: Attributes</h2>
            <p className="text-sm text-muted-foreground">
              Distribute 10 points across physical, mental, and magical. Each
              attribute ranges from -1 to +5. PB applies to all practices under
              your proficient attribute.
            </p>
            <div className="space-y-3">
              <AttrInput
                label="Physical"
                value={form.attrPhysical}
                onChange={(v) => setForm((f) => ({ ...f, attrPhysical: v }))}
              />
              <AttrInput
                label="Mental"
                value={form.attrMental}
                onChange={(v) => setForm((f) => ({ ...f, attrMental: v }))}
              />
              <AttrInput
                label="Magical"
                value={form.attrMagical}
                onChange={(v) => setForm((f) => ({ ...f, attrMagical: v }))}
              />
            </div>
            <Field label="Proficient Attribute (PB applies to all practices under this)">
              <select
                value={form.attrProficient ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    attrProficient: (e.target.value as AttrProf) || null,
                  }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
              >
                <option value="">— None yet —</option>
                <option value="PHYSICAL">Physical</option>
                <option value="MENTAL">Mental</option>
                <option value="MAGICAL">Magical</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Level">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.level}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      level: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
              <Field label="Starting BU">
                <input
                  type="number"
                  min={0}
                  value={form.startingBu}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      startingBu: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={form.enforceTemplateCaps}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enforceTemplateCaps: e.target.checked }))
                }
                className="size-4 rounded border-border"
              />
              <span className="text-sm">
                Enforce template hard caps (race ≤ 12 BU, background ≤ 8 BU)
              </span>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Step 3: Race / Background</h2>
            <p className="text-sm text-muted-foreground">
              Pick from the library or write your own. Both fields are optional.
            </p>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Race</h3>
              <Field label="From Library">
                <select
                  value={form.lineageId}
                  onChange={(e) => pickRace(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                >
                  <option value="">— Custom / freeform —</option>
                  {races.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Race Name">
                <input
                  type="text"
                  value={form.lineageName}
                  onChange={(e) => setForm((f) => ({ ...f, lineageName: e.target.value }))}
                  placeholder="Freeform name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
              <Field label="Race Description">
                <textarea
                  value={form.lineageDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lineageDescription: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-lg font-semibold">Background</h3>
              <Field label="From Library">
                <select
                  value={form.upbringingId}
                  onChange={(e) => pickBackground(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                >
                  <option value="">— Custom / freeform —</option>
                  {backgrounds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Background Name">
                <input
                  type="text"
                  value={form.upbringingName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, upbringingName: e.target.value }))
                  }
                  placeholder="Freeform name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
              <Field label="Background Description">
                <textarea
                  value={form.upbringingDescription}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      upbringingDescription: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
                />
              </Field>
            </div>

            <Field label="Archetype (optional)">
              <input
                type="text"
                value={form.manifestName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, manifestName: e.target.value }))
                }
                placeholder="e.g. Bladesinger, Hexblade"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Step 4: Capabilities & Items</h2>
            <p className="text-sm text-muted-foreground">
              Pick what this character can do and what they carry. You can edit
              later.
            </p>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Capabilities</h3>
                <span className="text-xs text-muted-foreground">
                  {selectedCapabilities.length} selected
                </span>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {capabilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No capabilities in the library yet.
                  </p>
                ) : (
                  capabilities.map((c) => {
                    const selected = selectedCapabilities.find((sc) => sc.id === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCapability(c.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <div>
                          <div className="font-medium">
                            {c.name}
                            {selected?.is_mirrored && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                (mirrored: debt expansion)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.type} · {c.sourceType}
                          </div>
                        </div>
                        {selected && (
                          <label
                            className="flex cursor-pointer items-center gap-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selected.is_mirrored}
                              onChange={() => toggleCapabilityMirror(c.id)}
                              className="size-3"
                            />
                            Mirrored
                          </label>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Starting Items</h3>
                <span className="text-xs text-muted-foreground">
                  {selectedItemIds.length} selected
                </span>
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items in the library yet.
                  </p>
                ) : (
                  items.map((i) => {
                    const selected = selectedItemIds.includes(i.id);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => toggleItem(i.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{i.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {i.itemType} · {i.rarity}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Step 5: Review</h2>
            <p className="text-sm text-muted-foreground">
              Confirm the snapshot. You can edit everything after creation.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewBlock label="Name" value={form.name} />
              <ReviewBlock label="Level" value={`L${form.level}`} />
              <ReviewBlock label="Size" value={form.size} />
              <ReviewBlock
                label="Attribute Sum"
                value={`${attrSum} / 10 ${attrValid ? "✓" : "✗ INVALID"}`}
              />
              <ReviewBlock label="Lineage" value={form.lineageName || "—"} />
              <ReviewBlock
                label="Upbringing"
                value={form.upbringingName || "—"}
              />
              <ReviewBlock
                label="Manifest"
                value={form.manifestName || "—"}
              />
              <ReviewBlock
                label="Proficient"
                value={form.attrProficient || "—"}
              />
              <ReviewBlock
                label="BU Pool"
                value={`${progressionPool} (${form.startingBu} start + ${
                  (form.level - 1) * 5
                } levels)`}
              />
              <ReviewBlock
                label="Capabilities"
                value={`${selectedCapabilities.length} picked`}
              />
              <ReviewBlock
                label="Items"
                value={`${selectedItemIds.length} picked`}
              />
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function AttrInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-base font-medium">{label}</span>
      <input
        type="range"
        min={-1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 rounded-md border border-border bg-background py-1 text-center font-mono text-base font-bold">
        {value >= 0 ? `+${value}` : value}
      </span>
    </div>
  );
}