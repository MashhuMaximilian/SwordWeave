"use client";

import { useMemo, useState, useTransition } from "react";
import { ToastViewport, useToasts } from "@/components/ui/toast";
import { IconSlot } from "@/components/icons/icon-slot";

/**
 * Build Composer
 *
 * Captures a complete character snapshot:
 *   - Identity (name, description, level, BU budget)
 *   - Race/Background (either refs to library heritage OR freeform text)
 *   - Archetype (optional snapshot field)
 *   - Attribute allocation (must sum to 10, each in [-1, +5])
 *   - Attribute proficiency (optional)
 *   - Capability grants
 *
 * "Archetype template" builds (isManifestTemplate=true) are pre-built
 * character heritage — a Use button on the Library creates an instant
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

type HeritageRow = {
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
  isManifestTemplate: boolean;
  lineageName: string | null;
  lineageDescription: string | null;
  lineageId: string | null;
  upbringingName: string | null;
  upbringingDescription: string | null;
  upbringingId: string | null;
  manifestName: string | null;
  attrPhysical: number | null;
  attrMental: number | null;
  attrMagical: number | null;
  attrProficient: string | null;
  practiceSlices: unknown;
  portraitUrl: string | null;
  // Phase 8: per-entity iconography. The system icon (always present,
  // tinted by iconColor) is separate from portraitUrl (free-form hero
  // art the user pastes in). Both can be set independently.
  iconSource: "GAME_ICONS" | "UPLOAD" | null;
  iconKey: string | null;
  iconUrl: string | null;
  iconColor: string;
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
  races: HeritageRow[];
  backgrounds: HeritageRow[];
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
        isManifestTemplate: editingBuild.isManifestTemplate,
        lineageId: editingBuild.lineageId ?? "",
        lineageName: editingBuild.lineageName ?? "",
        lineageDescription: editingBuild.lineageDescription ?? "",
        upbringingId: editingBuild.upbringingId ?? "",
        upbringingName: editingBuild.upbringingName ?? "",
        upbringingDescription: editingBuild.upbringingDescription ?? "",
        manifestName: editingBuild.manifestName ?? "",
        attrPhysical: editingBuild.attrPhysical ?? 0,
        attrMental: editingBuild.attrMental ?? 0,
        attrMagical: editingBuild.attrMagical ?? 0,
        attrProficient: (editingBuild.attrProficient as AttrProf | null) ?? null,
        portraitUrl: editingBuild.portraitUrl ?? "",
        iconSource: editingBuild.iconSource ?? null,
        iconKey: editingBuild.iconKey ?? null,
        iconUrl: editingBuild.iconUrl ?? null,
        iconColor: editingBuild.iconColor ?? "#ffffff",
        isPublic: editingBuild.isPublic,
      }
    : {
        name: "",
        description: "",
        level: 1,
        startingBu: 25,
        isManifestTemplate: false,
        lineageId: "",
        lineageName: "",
        lineageDescription: "",
        upbringingId: "",
        upbringingName: "",
        upbringingDescription: "",
        manifestName: "",
        attrPhysical: 0,
        attrMental: 0,
        attrMagical: 0,
        attrProficient: null,
        portraitUrl: "",
        iconSource: null,
        iconKey: null,
        iconUrl: null,
        iconColor: "#ffffff",
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
      isManifestTemplate: false,
      lineageId: "",
      lineageName: "",
      lineageDescription: "",
      upbringingId: "",
      upbringingName: "",
      upbringingDescription: "",
      manifestName: "",
      attrPhysical: 0,
      attrMental: 0,
      attrMagical: 0,
      attrProficient: null,
      portraitUrl: "",
      iconSource: null,
      iconKey: null,
      iconUrl: null,
      iconColor: "#ffffff",
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
            isManifestTemplate: form.isManifestTemplate,
            lineageId: form.lineageId || null,
            lineageName: form.lineageName.trim() || null,
            lineageDescription: form.lineageDescription.trim() || null,
            upbringingId: form.upbringingId || null,
            upbringingName: form.upbringingName.trim() || null,
            upbringingDescription: form.upbringingDescription.trim() || null,
            manifestName: form.manifestName.trim() || null,
            attrPhysical: form.attrPhysical,
            attrMental: form.attrMental,
            attrMagical: form.attrMagical,
            attrProficient: form.attrProficient,
            portraitUrl: form.portraitUrl.trim() || null,
            iconSource: form.iconSource,
            iconKey: form.iconKey,
            iconUrl: form.iconUrl,
            iconColor: form.iconColor,
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
          {form.isManifestTemplate ? "Forge an archetype." : "Capture a character."}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Builds are snapshots of a complete character. Toggle{" "}
          <strong>archetype template</strong> to author a pre-built character
          template that others can fork or use instantly.
        </p>
      </div>

      {/* Sticky preview bar.
          z-10: keep the bar above page background but BELOW the
          modal stack and BELOW the form's interactive controls
          above. The previous z-30 (Phase 8 default) caused the
          bar to cover the form's IconSlot on scroll — the bar
          uses bg-background/80 backdrop-blur-md, so the IconSlot
          was visible through it but clicks hit the bar (which has
          no click handler) and the modal never opened. z-10 puts
          the bar at the page-content layer; the modal stack lives
          at z-50+ so it still overlays correctly. */}
      <div className="sticky top-0 z-10 mt-6 -mx-5 border-y border-border bg-background/80 px-5 py-3 backdrop-blur-md">
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
            {form.isManifestTemplate && (
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
        className="relative z-20 mt-8 grid gap-4 lg:grid-cols-[360px_1fr]"
      >
        {/* LEFT: identity + attributes */}
        <section className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Identity</h2>
            <div className="mt-4 space-y-3">
              {/* Phase 8: build icon picker. Lives at the top of the
                  identity section so it's the first thing the user
                  picks — matches the other entity forms (primitive,
                  capability, template, item) where the IconSlot is
                  positioned at the top. portraitUrl is a separate
                  field below for hero art. */}
              <IconSlot
                iconSource={form.iconSource}
                iconKey={form.iconKey}
                iconUrl={form.iconUrl}
                iconColor={form.iconColor}
                onChange={(next) =>
                  setForm((f) => ({
                    ...f,
                    iconSource: next.iconSource,
                    iconKey: next.iconKey ?? null,
                    iconUrl: next.iconUrl ?? null,
                    iconColor: next.iconColor,
                  }))
                }
                size={72}
                label="Build icon"
                helper="Tinted at 72px. Stays separate from the portrait URL below."
              />
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
                  checked={form.isManifestTemplate}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, isManifestTemplate: v }))
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
                  value={form.lineageId}
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
                  value={form.lineageName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lineageName: e.target.value }))
                  }
                  placeholder="Freeform name if not using library"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Race Description">
                <textarea
                  value={form.lineageDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lineageDescription: e.target.value }))
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
                  value={form.upbringingId}
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
                  value={form.upbringingName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, upbringingName: e.target.value }))
                  }
                  placeholder="Freeform name if not using library"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                value={form.manifestName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, manifestName: e.target.value }))
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