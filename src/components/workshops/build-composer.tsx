"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";

/**
 * Build Composer
 *
 * Captures a complete character snapshot:
 *   - Identity (name, description, level, BU budget)
 *   - Race/Background (either refs to library templates OR freeform text)
 *   - Archetype (optional snapshot field)
 *   - Attribute allocation (must sum to 10, each in [-1, +5])
 *   - Attribute proficiency (optional)
 *   - Capability grants
 *
 * "Archetype template" builds (isArchetypeTemplate=true) are pre-built
 * character templates — a Use button on the Library creates an instant
 * playable character from one.
 */

type PrimitiveRow = {
  id: number;
  name: string;
  category: string;
  buCost: number;
  narrativeRule: string;
};

type CapabilityRow = {
  id: string;
  name: string;
  type: string;
  sourceType: string;
};

type TemplateRow = {
  id: string;
  kind: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
};

type BuildCapabilityLink = {
  capabilityId: string;
  capability: CapabilityRow;
};

type BuildRow = {
  id: string;
  name: string;
  description: string | null;
  level: number;
  startingBu: number;
  isArchetypeTemplate: boolean;
  raceName: string | null;
  raceDescription: string | null;
  raceId: string | null;
  backgroundName: string | null;
  backgroundDescription: string | null;
  backgroundId: string | null;
  archetypeName: string | null;
  attrPhysical: number | null;
  attrMental: number | null;
  attrMagical: number | null;
  attrProficient: string | null;
  practiceSlices: unknown;
  portraitUrl: string | null;
  isPublic: boolean;
  sourceOrigin: string | null;
  capabilityLinks: BuildCapabilityLink[];
};

type AttrProf = "PHYSICAL" | "MENTAL" | "MAGICAL";

const ATTR_PROF: AttrProf[] = ["PHYSICAL", "MENTAL", "MAGICAL"];

function buildAttrTotal(phys: number, ment: number, mag: number): number {
  return phys + ment + mag;
}

export function BuildComposer({
  races,
  backgrounds,
  capabilities,
  editingBuild,
}: {
  races: TemplateRow[];
  backgrounds: TemplateRow[];
  capabilities: CapabilityRow[];
  editingBuild?: BuildRow | null;
}) {
  const isEditMode = Boolean(editingBuild);

  const initialForm = editingBuild
    ? {
        name: editingBuild.name,
        description: editingBuild.description ?? "",
        level: editingBuild.level,
        startingBu: editingBuild.startingBu,
        isArchetypeTemplate: editingBuild.isArchetypeTemplate,
        raceId: editingBuild.raceId ?? "",
        raceName: editingBuild.raceName ?? "",
        raceDescription: editingBuild.raceDescription ?? "",
        backgroundId: editingBuild.backgroundId ?? "",
        backgroundName: editingBuild.backgroundName ?? "",
        backgroundDescription: editingBuild.backgroundDescription ?? "",
        archetypeName: editingBuild.archetypeName ?? "",
        attrPhysical: editingBuild.attrPhysical ?? 0,
        attrMental: editingBuild.attrMental ?? 0,
        attrMagical: editingBuild.attrMagical ?? 0,
        attrProficient: (editingBuild.attrProficient as AttrProf | null) ?? null,
        portraitUrl: editingBuild.portraitUrl ?? "",
        isPublic: editingBuild.isPublic,
      }
    : {
        name: "",
        description: "",
        level: 1,
        startingBu: 25,
        isArchetypeTemplate: false,
        raceId: "",
        raceName: "",
        raceDescription: "",
        backgroundId: "",
        backgroundName: "",
        backgroundDescription: "",
        archetypeName: "",
        attrPhysical: 0,
        attrMental: 0,
        attrMagical: 0,
        attrProficient: null,
        portraitUrl: "",
        isPublic: false,
      };

  const initialCapabilityIds = editingBuild
    ? editingBuild.capabilityLinks.map((l) => l.capabilityId)
    : [];

  const [form, setForm] = useState(initialForm);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>(
    initialCapabilityIds,
  );
  const [isPending, startTransition] = useTransition();
  const { toasts, showToast, dismissToast } = useToasts();

  const attrSum = buildAttrTotal(
    form.attrPhysical,
    form.attrMental,
    form.attrMagical,
  );
  const attrValid = attrSum === 10;

  const progressionPool = useMemo(
    () => form.startingBu + (form.level - 1) * 5,
    [form.startingBu, form.level],
  );

  function pickRace(id: string) {
    const race = races.find((r) => r.id === id);
    if (race) {
      setForm((f) => ({
        ...f,
        raceId: id,
        raceName: race.name,
        raceDescription: race.description ?? "",
      }));
    } else {
      setForm((f) => ({ ...f, raceId: "" }));
    }
  }

  function pickBackground(id: string) {
    const bg = backgrounds.find((b) => b.id === id);
    if (bg) {
      setForm((f) => ({
        ...f,
        backgroundId: id,
        backgroundName: bg.name,
        backgroundDescription: bg.description ?? "",
      }));
    } else {
      setForm((f) => ({ ...f, backgroundId: "" }));
    }
  }

  function toggleCapability(id: string) {
    setSelectedCapabilityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      level: 1,
      startingBu: 25,
      isArchetypeTemplate: false,
      raceId: "",
      raceName: "",
      raceDescription: "",
      backgroundId: "",
      backgroundName: "",
      backgroundDescription: "",
      archetypeName: "",
      attrPhysical: 0,
      attrMental: 0,
      attrMagical: 0,
      attrProficient: null,
      portraitUrl: "",
      isPublic: false,
    });
    setSelectedCapabilityIds([]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      showToast("Build name is required.", "error");
      return;
    }
    if (!attrValid) {
      showToast(
        `Attributes must sum to exactly 10 (currently ${attrSum}).`,
        "error",
      );
      return;
    }

    startTransition(async () => {
      try {
        const url =
          isEditMode && editingBuild
            ? `/api/builds/${editingBuild.id}`
            : "/api/builds";
        const method = isEditMode ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            level: form.level,
            startingBu: form.startingBu,
            isArchetypeTemplate: form.isArchetypeTemplate,
            raceId: form.raceId || null,
            raceName: form.raceName.trim() || null,
            raceDescription: form.raceDescription.trim() || null,
            backgroundId: form.backgroundId || null,
            backgroundName: form.backgroundName.trim() || null,
            backgroundDescription: form.backgroundDescription.trim() || null,
            archetypeName: form.archetypeName.trim() || null,
            attrPhysical: form.attrPhysical,
            attrMental: form.attrMental,
            attrMagical: form.attrMagical,
            attrProficient: form.attrProficient,
            portraitUrl: form.portraitUrl.trim() || null,
            isPublic: form.isPublic,
            capabilityIds: selectedCapabilityIds,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error ?? "Failed to save build.";
          showToast(errMsg, "error");
          return;
        }

        const successMsg = isEditMode
          ? `Updated build "${form.name}".`
          : `Created build "${form.name}" L${form.level}.`;
        showToast(successMsg, "success");
        if (!isEditMode) resetForm();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error.";
        showToast(errMsg, "error");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Build Composer
        </p>
        <h1 className="mt-3 text-4xl font-semibold">
          {form.isArchetypeTemplate ? "Forge an archetype." : "Capture a character."}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Builds are snapshots of a complete character. Toggle{" "}
          <strong>archetype template</strong> to author a pre-built character
          template that others can fork or use instantly.
        </p>
      </div>

      {/* Sticky preview bar */}
      <div className="sticky top-0 z-30 mt-6 -mx-5 border-y border-border bg-background/80 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Level
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-base font-bold text-primary">
                {form.level}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                BU Pool
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {progressionPool}
              </span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                attrValid
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Attr sum
              </span>
              <span className="font-mono font-bold">{attrSum} / 10</span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isEditMode
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-green-500/10 text-green-700 dark:text-green-300"
                }`}
              >
                {isEditMode ? "Editing" : "New"}
              </span>
            </div>
            {form.isArchetypeTemplate && (
              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300">
                Archetype
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card"
            >
              Reset
            </button>
            <button
              type="submit"
              form="build-form"
              disabled={isPending || !attrValid}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending
                ? "Saving..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Build"}
            </button>
          </div>
        </div>
      </div>

      <form
        id="build-form"
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]"
      >
        {/* LEFT: identity + attributes */}
        <section className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Identity</h2>
            <div className="mt-4 space-y-3">
              <Field label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Glass Cannon Mage L5"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="Portrait URL (optional)">
                <input
                  type="url"
                  value={form.portraitUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, portraitUrl: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <div className="pt-2 space-y-1.5">
                <Checkbox
                  label="Archetype template (others can fork / use this)"
                  checked={form.isArchetypeTemplate}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, isArchetypeTemplate: v }))
                  }
                />
                <Checkbox
                  label="Public (visible in Library)"
                  checked={form.isPublic}
                  onChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
                />
              </div>
            </div>
          </div>

          {/* Attributes */}
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Attributes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each in [-1, +5], sum must equal 10.
            </p>
            <div className="mt-4 space-y-3">
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
              <Field label="Proficient Attribute">
                <select
                  value={form.attrProficient ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      attrProficient:
                        (e.target.value as AttrProf) || null,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {ATTR_PROF.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* RIGHT: race/bg/archetype + capabilities */}
        <section className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Race</h2>
            <div className="mt-4 space-y-3">
              <Field label="From Library (optional)">
                <select
                  value={form.raceId}
                  onChange={(e) => pickRace(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                  value={form.raceName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, raceName: e.target.value }))
                  }
                  placeholder="Freeform name if not using library"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Race Description">
                <textarea
                  value={form.raceDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, raceDescription: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Background</h2>
            <div className="mt-4 space-y-3">
              <Field label="From Library (optional)">
                <select
                  value={form.backgroundId}
                  onChange={(e) => pickBackground(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                  value={form.backgroundName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, backgroundName: e.target.value }))
                  }
                  placeholder="Freeform name if not using library"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Background Description">
                <textarea
                  value={form.backgroundDescription}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      backgroundDescription: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Archetype (optional)</h2>
            <Field label="Archetype Name">
              <input
                type="text"
                value={form.archetypeName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, archetypeName: e.target.value }))
                }
                placeholder="e.g. Bladesinger, Hexblade, Lorekeeper"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Capability grants */}
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Capability Grants</h2>
              <span className="text-xs text-muted-foreground">
                {selectedCapabilityIds.length} selected
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Capabilities granted to a character created from this build.
            </p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {capabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No capabilities in the library yet.
                </p>
              ) : (
                capabilities.map((c) => {
                  const selected = selectedCapabilityIds.includes(c.id);
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
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.type} · {c.sourceType}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </form>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border"
      />
      <span className="text-sm">{label}</span>
    </label>
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
      <span className="w-24 text-sm font-medium">{label}</span>
      <input
        type="range"
        min={-1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-10 rounded-md border border-border bg-background py-1 text-center font-mono text-sm font-bold">
        {value >= 0 ? `+${value}` : value}
      </span>
    </div>
  );
}