"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Plus, Search, Shuffle, X } from "lucide-react";
import { cumulativeBuForLevel, impliedLevelForBudget, maxBuDebtForLevel } from "@/lib/engine/bu";
import { SIZE_BASE_SPEED, SIZE_CAPACITY } from "@/lib/engine/encumbrance";
import { PortraitInput, type PortraitFrame } from "./portrait-input";
import { IconDisplay } from "@/components/icons/icon-display";
import { MARKET_TEMPLATES, CANONICAL_EXPRESSIONS } from "@/lib/primitives/canonical-market";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { PrimitiveFormPreview } from "@/components/sandbox/primitive-form-preview";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";
import { useGlobalControls } from "@/components/layout/global-controls";
import { suggestStartingPackages, startingPackageTier } from "@/lib/character/starting-package-suggestions";
import { chooseMirrorSuggestions, eligibleMirrorCandidates, mirrorConsequence } from "@/lib/character/mirror-suggestions";

const SIZES = ["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const;
const ATTRIBUTES = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
const STEPS = [
  { id: "identity", eyebrow: "01", label: "Identity", hint: "Who they are" },
  { id: "backstory", eyebrow: "02", label: "Backstory", hint: "What drives them" },
  { id: "attributes", eyebrow: "03", label: "Attributes", hint: "Their foundation" },
  { id: "mirroring", eyebrow: "04", label: "Mirroring", hint: "An optional weakness" },
  { id: "packages", eyebrow: "05", label: "Starting access", hint: "What they can do" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type Size = (typeof SIZES)[number];
type Attribute = (typeof ATTRIBUTES)[number];
type PackageSlot = "domain" | "verb" | "range" | "die";
type OriginFilter = "all" | "system" | "community";
type PackagePreset = { key: string; name: string; description: string; items: PrimitiveOption[]; cost: number };

const FAMILY_KEYS: Record<PackageSlot, string> = {
  domain: "DOMAIN_ACCESS",
  verb: "VERB_ACCESS",
  range: "RANGE_SCALING",
  die: "INTENSITY_DICE",
};

const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

interface PrimitiveOption {
  id: number;
  name: string;
  category: string;
  buCost: number;
  mechanicalOutputText: string;
  narrativeRule: string;
  costTier?: string;
  iconSource?: "GAME_ICONS" | "UPLOAD" | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string | null;
  sourceOrigin?: string | null;
  version?: number;
  mechanicalRule?: { family?: string; bindings?: Record<string, unknown> } | null;
  isMirrorable?: boolean | null;
  mirrorBuCredit?: number | null;
  hardModifiers?: unknown[] | null;
  mirrorVector?: string | null;
}

interface FormState {
  name: string;
  portraitUrl: string;
  portraitFrame: PortraitFrame;
  size: Size;
  notes: string;
  attrPhysical: number;
  attrMental: number;
  attrMagical: number;
  attrProficient: Attribute;
  sizingMode: "level" | "bu";
  level: number;
  customBu: number;
  backstory: { origin: string; motivation: string; ties: string; flaw: string };
}

const INITIAL_STATE: FormState = {
  name: "", portraitUrl: "", portraitFrame: { x: 50, y: 50, zoom: 1 }, size: "MEDIUM", notes: "",
  attrPhysical: 4, attrMental: 3, attrMagical: 3, attrProficient: "PHYSICAL",
  sizingMode: "level", level: 1, customBu: 25,
  backstory: { origin: "", motivation: "", ties: "", flaw: "" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min));
}

export function NewCharacterForm() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("identity");
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [selectedPrimitiveIds, setSelectedPrimitiveIds] = useState<number[]>([]);
  const [mirroredPrimitiveId, setMirroredPrimitiveId] = useState<number | null>(null);
  const [mirrorReviewed, setMirrorReviewed] = useState(false);
  const [savedMirrorIds, setSavedMirrorIds] = useState<number[]>([]);
  const [mirrorSuggestionIds, setMirrorSuggestionIds] = useState<number[] | null>(null);
  const [mirrorShuffleSeed, setMirrorShuffleSeed] = useState(0);
  const [savedPackages, setSavedPackages] = useState<PackagePreset[]>([]);
  const [packageSuggestions, setPackageSuggestions] = useState<PackagePreset[] | null>(null);
  const [packageShuffleSeed, setPackageShuffleSeed] = useState(0);
  const [packageShuffleBudget, setPackageShuffleBudget] = useState<number | null>(null);
  const [primitives, setPrimitives] = useState<PrimitiveOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPrimitives = useCallback(async () => {
    const response = await fetch("/api/primitives");
    if (!response.ok) throw new Error("The primitive library could not be opened.");
    const payload = await response.json() as { primitives?: PrimitiveOption[] };
    setPrimitives(payload.primitives ?? []);
    return payload.primitives ?? [];
  }, []);

  useEffect(() => {
    let current = true;
    fetch("/api/primitives")
      .then(async (response) => {
        if (!response.ok) throw new Error("The primitive library could not be opened.");
        return response.json() as Promise<{ primitives?: PrimitiveOption[] }>;
      })
      .then((payload) => { if (current) setPrimitives(payload.primitives ?? []); })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "The primitive library could not be opened."); })
      .finally(() => { if (current) setCatalogLoading(false); });
    return () => { current = false; };
  }, []);

  const options = useMemo(() => {
    const usable = primitives.filter((primitive) => {
      const family = primitive.mechanicalRule?.family;
      const bindings = primitive.mechanicalRule?.bindings ?? {};
      if (primitive.category === "DOMAIN") return family === "DOMAIN_ACCESS" && Boolean(bindings["domain"]);
      if (primitive.category === "VERB_TIER") return family === "VERB_ACCESS";
      if (primitive.category === "RANGE") return family === "RANGE";
      if (primitive.category === "INTENSITY_DICE") return family === "DICE";
      return false;
    });
    const sort = (items: PrimitiveOption[]) => [...items].sort((a, b) => a.buCost - b.buCost || a.name.localeCompare(b.name));
    return {
      domain: sort(usable.filter((item) => item.category === "DOMAIN")),
      verb: sort(usable.filter((item) => item.category === "VERB_TIER")),
      range: sort(usable.filter((item) => item.category === "RANGE")),
      die: sort(usable.filter((item) => item.category === "INTENSITY_DICE")),
    } satisfies Record<PackageSlot, PrimitiveOption[]>;
  }, [primitives]);

  const packageCost = useMemo(
    () => selectedPrimitiveIds.reduce((sum, id) => sum + (primitives.find((primitive) => primitive.id === id)?.buCost ?? 0), 0),
    [selectedPrimitiveIds, primitives],
  );
  const budget = state.sizingMode === "level" ? cumulativeBuForLevel(state.level) : state.customBu;
  const effectiveLevel = state.sizingMode === "level" ? state.level : impliedLevelForBudget(state.customBu);
  const mirrorCeiling = maxBuDebtForLevel(effectiveLevel);
  const mirrorOptions = useMemo(() => eligibleMirrorCandidates(primitives, mirrorCeiling), [primitives, mirrorCeiling]);
  const selectedMirror = mirrorOptions.find((primitive) => primitive.id === mirroredPrimitiveId);
  const mirrorCredit = selectedMirror ? selectedMirror.mirrorBuCredit ?? selectedMirror.buCost : 0;
  const attrSum = state.attrPhysical + state.attrMental + state.attrMagical;
  const packageComplete = (Object.keys(options) as PackageSlot[]).every((slot) => options[slot].some((item) => selectedPrimitiveIds.includes(item.id)));
  const formValid = state.name.trim().length > 0 && attrSum === 10 && packageComplete && packageCost <= budget + mirrorCredit && !isPending;
  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const completedSteps: Record<StepId, boolean> = {
    identity: Boolean(state.name.trim()),
    attributes: attrSum === 10,
    backstory: Object.values(state.backstory).some((value) => value.trim().length > 0),
    packages: packageComplete && packageCost <= budget + mirrorCredit,
    mirroring: mirrorReviewed,
  };

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);

  const togglePrimitive = useCallback((primitiveId: number) => {
    setSelectedPrimitiveIds((current) => current.includes(primitiveId) ? current.filter((id) => id !== primitiveId) : [...current, primitiveId]);
  }, []);

  const handleDomainSaved = useCallback(async (primitiveId: number) => {
    try {
      await loadPrimitives();
      setSelectedPrimitiveIds((current) => current.includes(primitiveId) ? current : [...current, primitiveId]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The new Domain was saved, but the Library could not refresh.");
    }
  }, [loadPrimitives]);

  function goNext() {
    if (step === "identity" && !state.name.trim()) { setError("Give the character a name before continuing."); return; }
    if (step === "attributes" && attrSum !== 10) { setError(`Attributes must total 10. They currently total ${attrSum}.`); return; }
    setError(null);
    setStep(STEPS[Math.min(currentIndex + 1, STEPS.length - 1)]!.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function keepMirror(id: number | null) {
    setMirroredPrimitiveId(id);
    setMirrorReviewed(true);
    if (id !== null) setSavedMirrorIds((current) => current.includes(id) ? current : [...current, id].slice(-4));
  }

  function removeMirror(id: number) {
    setSavedMirrorIds((current) => current.filter((saved) => saved !== id));
    if (mirroredPrimitiveId === id) setMirroredPrimitiveId(null);
  }

  function shuffleMirrors() {
    const nextSeed = mirrorShuffleSeed + 1;
    setMirrorShuffleSeed(nextSeed);
    const previous = mirrorSuggestionIds ?? chooseMirrorSuggestions(mirrorOptions, state.name, 0, savedMirrorIds).map((item) => item.id);
    setMirrorSuggestionIds(chooseMirrorSuggestions(mirrorOptions, state.name, nextSeed, savedMirrorIds, previous).map((item) => item.id));
  }

  function keepPackage(preset: PackagePreset) {
    setSelectedPrimitiveIds(preset.items.map((item) => item.id));
    setSavedPackages((current) => current.some((item) => item.key === preset.key) ? current : [...current, preset].slice(-4));
  }

  function removePackage(preset: PackagePreset) {
    setSavedPackages((current) => current.filter((item) => item.key !== preset.key));
    if (selectedPrimitiveIds.length === preset.items.length && preset.items.every((item) => selectedPrimitiveIds.includes(item.id))) setSelectedPrimitiveIds([]);
  }

  function shufflePackages(requestedBudget: number) {
    const cap = Math.min(Math.max(0, requestedBudget), budget + mirrorCredit);
    setPackageShuffleBudget(cap);
    const nextSeed = packageShuffleSeed + 1;
    setPackageShuffleSeed(nextSeed);
    const previous = packageSuggestions ?? recommendedPackages(options, effectiveLevel, cap, 0);
    const excluded = savedPackages.map((item) => item.key);
    const fresh = recommendedPackages(options, effectiveLevel, cap, nextSeed, [...excluded, ...previous.map((item) => item.key)]);
    setPackageSuggestions(fresh.length ? fresh : recommendedPackages(options, effectiveLevel, cap, nextSeed, excluded));
  }

  function submit() {
    if (!formValid) {
      setError(!packageComplete ? "Choose at least one Domain, Verb Tier, Range, and Output Die." : packageCost > budget + mirrorCredit ? "The selected access exceeds the available BU, including mirror credit." : "Complete the required character fields.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: state.name.trim(), portraitUrl: state.portraitUrl.trim(), portraitFrame: state.portraitFrame, size: state.size, notes: state.notes.trim(),
            level: effectiveLevel, startingBu: 25, buBudget: state.sizingMode === "bu" ? state.customBu : null, buSpent: packageCost, dmBonusBu: 0,
            attrPhysical: state.attrPhysical, attrMental: state.attrMental, attrMagical: state.attrMagical, attrProficient: state.attrProficient,
            backstory: Object.fromEntries(Object.entries(state.backstory).map(([key, value]) => [key, value.trim()])),
            sourceOrigin: "manual", primitiveInstances: [
              ...selectedPrimitiveIds.map((primitiveId) => ({ primitiveId, isMirrored: false })),
              ...(selectedMirror ? [{ primitiveId: selectedMirror.id, isMirrored: true }] : []),
            ],
            capabilityIds: [], itemIds: [], practiceSlices: {},
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as { character?: { id: string }; error?: string };
        if (!response.ok || !payload.character?.id) throw new Error(payload.error ?? "The character could not be created.");
        await fetch(`/api/characters/${payload.character.id}/mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "BUILD" }) }).catch(() => undefined);
        router.push(`/characters/${payload.character.id}?mode=BUILD`);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The character could not be created.");
      }
    });
  }

  return (
    <div className="sw-character-forge">
      <aside className="sw-character-forge__rail" aria-label="Character creation progress">
        <div className="sw-character-forge__rail-title"><span>Character instrument</span><strong>Foundation</strong></div>
        <nav>
          {STEPS.map((item, index) => (
            <button key={item.id} type="button" className={step === item.id ? "is-active" : completedSteps[item.id] ? "is-complete" : ""} onClick={() => { setError(null); setStep(item.id); }}>
              <span className="sw-character-forge__step-number">{completedSteps[item.id] ? <Check aria-hidden /> : item.eyebrow}</span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
        </nav>
        <div className="sw-character-forge__reading"><span>Available</span><strong>{budget + mirrorCredit - packageCost} BU</strong><small>{packageCost} spent · {mirrorCredit} mirror credit</small></div>
      </aside>

      <div className="sw-character-forge__workbench">
        <header className="sw-character-forge__header">
          <div><span>Stage {String(currentIndex + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span><h2>{STEPS[currentIndex]!.label}</h2></div>
          <p>{step === "identity" ? "Give the character a face and a place in the world." : step === "attributes" ? "Set the three foundations that every practice and save reads from." : step === "backstory" ? "Record the truths that make the character playable at the table." : step === "packages" ? "Choose their starting vocabulary directly from the Library." : "Take an optional weakness to expand the build."}</p>
        </header>

        <div className="sw-character-forge__content">
          {step === "identity" ? <IdentityStep state={state} setField={setField} /> : null}
          {step === "attributes" ? <AttributesStep state={state} setField={setField} attrSum={attrSum} budget={budget} effectiveLevel={effectiveLevel} /> : null}
          {step === "backstory" ? <BackstoryStep state={state} setState={setState} /> : null}
          {step === "mirroring" ? <MirroringStep options={mirrorOptions} selectedId={selectedMirror?.id ?? null} onSelect={keepMirror} onRemove={removeMirror} savedIds={savedMirrorIds} suggestionIds={mirrorSuggestionIds} shuffleSeed={mirrorShuffleSeed} onShuffle={shuffleMirrors} budget={budget} ceiling={mirrorCeiling} characterName={state.name} /> : null}
          {step === "packages" ? <StartingAccessStep options={options} selectedIds={selectedPrimitiveIds} mirrorCredit={mirrorCredit} loading={catalogLoading} togglePrimitive={togglePrimitive} packageCost={packageCost} budget={budget} effectiveLevel={effectiveLevel} shuffleBudget={Math.min(packageShuffleBudget ?? budget + mirrorCredit, budget + mirrorCredit)} onShuffleBudgetChange={setPackageShuffleBudget} suggestions={packageSuggestions} savedPackages={savedPackages} onChoosePackage={keepPackage} onRemovePackage={removePackage} onShuffle={shufflePackages} /> : null}
          {error ? <p className="sw-forge-error" role="alert">{error}</p> : null}
        </div>

        <footer className="sw-character-forge__footer">
          <div className="sw-character-forge__footer-reading"><span>{state.name.trim() || "Unnamed character"}</span><strong>{packageCost - mirrorCredit} / {budget} BU</strong><small>{packageCost} purchased · −{mirrorCredit} mirror · ceiling {mirrorCeiling}</small></div>
          <div className="sw-character-forge__footer-actions">
            {currentIndex > 0 ? <button type="button" className="sw-metal-button sw-metal-button--secondary" onClick={() => setStep(STEPS[currentIndex - 1]!.id)}><ArrowLeft aria-hidden /> Previous</button> : null}
            {currentIndex < STEPS.length - 1 ? <button type="button" className="sw-metal-button sw-metal-button--primary" onClick={goNext}>Continue <ArrowRight aria-hidden /></button> : <button type="button" className="sw-metal-button sw-metal-button--primary" onClick={submit} disabled={!formValid}>{isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}{isPending ? "Forging…" : "Forge character"}</button>}
          </div>
        </footer>
      </div>
      <DomainAuthoringDrawer onSaved={handleDomainSaved} />
    </div>
  );
}

function IdentityStep({ state, setField }: { state: FormState; setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  const speed = SIZE_BASE_SPEED[state.size];
  return <div className="sw-forge-grid sw-forge-grid--identity"><section className="sw-forge-panel sw-forge-panel--brass"><PanelTitle number="A" title="Identity record" subtitle="Required character details" /><ForgeField label="Name" required><input value={state.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. Vex the Quick" autoFocus /></ForgeField><ForgeField label="Size"><select value={state.size} onChange={(event) => setField("size", event.target.value as Size)}>{SIZES.map((size) => <option key={size} value={size}>{size} — {SIZE_CAPACITY[size]} load · {SIZE_BASE_SPEED[size]} ft walk · {Math.ceil(SIZE_BASE_SPEED[size] / 2)} ft swim/climb</option>)}</select><div className="sw-forge-size-reading"><span><small>Carry</small>{SIZE_CAPACITY[state.size]} load</span><span><small>Walk</small>{speed} ft</span><span><small>Swim</small>{Math.ceil(speed / 2)} ft</span><span><small>Climb</small>{Math.ceil(speed / 2)} ft</span></div></ForgeField><ForgeField label="Private notes" hint="A quick reminder; backstory comes next."><textarea rows={5} value={state.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Voice, mannerisms, table notes…" /></ForgeField></section><section className="sw-forge-panel sw-forge-panel--teal"><PanelTitle number="B" title="Portrait" subtitle="Upload, then drag and zoom to frame it" /><PortraitInput value={state.portraitUrl} onChange={(value) => setField("portraitUrl", value)} frame={state.portraitFrame} onFrameChange={(value) => setField("portraitFrame", value)} characterName={state.name} /></section></div>;
}

function AttributesStep({ state, setField, attrSum, budget, effectiveLevel }: { state: FormState; setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void; attrSum: number; budget: number; effectiveLevel: number }) {
  const fields = [["PHYSICAL", "attrPhysical"], ["MENTAL", "attrMental"], ["MAGICAL", "attrMagical"]] as const;
  return <div className="sw-forge-stack"><section className="sw-forge-panel sw-forge-panel--silver"><PanelTitle number="A" title="Core attributes" subtitle="Each score is −1 to +5; together they equal 10" /><div className={`sw-forge-sum${attrSum === 10 ? " is-valid" : ""}`}><span>Attribute balance</span><strong>{attrSum} / 10</strong><small>{attrSum === 10 ? "Ready" : `${10 - attrSum > 0 ? "+" : ""}${10 - attrSum} remaining`}</small></div><div className="sw-forge-attributes">{fields.map(([label, key]) => <div key={key} className={state.attrProficient === label ? "is-proficient" : ""}><button type="button" onClick={() => setField("attrProficient", label)} aria-pressed={state.attrProficient === label}>{state.attrProficient === label ? "Proficient" : "Set proficient"}</button><label><span>{label}</span><input type="number" min={-1} max={5} value={state[key]} onChange={(event) => setField(key, clamp(Number(event.target.value), -1, 5))} /></label></div>)}</div></section><section className="sw-forge-panel sw-forge-panel--brass"><PanelTitle number="B" title="Build allowance" subtitle="Use standard level progression or an agreed custom BU pool" /><div className="sw-forge-mode" role="tablist"><button type="button" className={state.sizingMode === "level" ? "is-active" : ""} onClick={() => setField("sizingMode", "level")}>By level</button><button type="button" className={state.sizingMode === "bu" ? "is-active" : ""} onClick={() => setField("sizingMode", "bu")}>Custom BU</button></div><div className="sw-forge-budget"><ForgeField label={state.sizingMode === "level" ? "Character level" : "Agreed BU pool"}><input type="number" min={state.sizingMode === "level" ? 1 : 25} value={state.sizingMode === "level" ? state.level : state.customBu} onChange={(event) => state.sizingMode === "level" ? setField("level", clamp(Number(event.target.value), 1, 9999)) : setField("customBu", clamp(Number(event.target.value), 25, 100000))} /></ForgeField><div className="sw-forge-budget__reading"><span>Starting allowance</span><strong>{budget} BU</strong><small>{state.sizingMode === "bu" ? `Approximately level ${effectiveLevel}` : `Debt ceiling ${maxBuDebtForLevel(effectiveLevel)} BU`}</small></div></div></section></div>;
}

function BackstoryStep({ state, setState }: { state: FormState; setState: React.Dispatch<React.SetStateAction<FormState>> }) {
  const fields: Array<[keyof FormState["backstory"], string, string, string]> = [["origin", "Origin & history", "Where from, what happened", "Family, birthplace, culture, and defining events…"], ["motivation", "Motivation & goals", "What drives them now", "What do they want, and why can’t they let it go?"], ["ties", "Ties & allies", "Who matters", "Friends, rivals, family, patrons, promises…"], ["flaw", "Flaw & conflict", "What gets in their way", "A fear, contradiction, obligation, or recurring mistake…"]];
  return <div className="sw-forge-story-grid">{fields.map(([key, label, hint, placeholder], index) => <section key={key} className={`sw-forge-panel ${index % 2 ? "sw-forge-panel--teal" : "sw-forge-panel--brass"}`}><PanelTitle number={String.fromCharCode(65 + index)} title={label} subtitle={hint} /><MarkdownEditor className="sw-forge-markdown" rows={7} value={state.backstory[key]} onChange={(value) => setState((current) => ({ ...current, backstory: { ...current.backstory, [key]: value } }))} placeholder={placeholder} /></section>)}</div>;
}

const ACCESS_FAMILIES: Array<[PackageSlot, string, string]> = [["verb", "Verb tiers", "How deeply they may act"], ["range", "Ranges", "How far their actions may reach"], ["die", "Output dice", "Damage and healing dice they may use"], ["domain", "Domains", "What parts of reality they may affect"]];

function tierOf(item: PrimitiveOption) {
  return startingPackageTier(item);
}

function originOf(item: PrimitiveOption): Exclude<OriginFilter, "all"> {
  return !item.sourceOrigin || item.sourceOrigin.toLowerCase().startsWith("system") ? "system" : "community";
}

function levelBracket(level: number) {
  if (level <= 4) return { label: "Levels 1–4", tier: 1 };
  if (level <= 8) return { label: "Levels 5–8", tier: 2 };
  if (level <= 12) return { label: "Levels 9–12", tier: 3 };
  if (level <= 16) return { label: "Levels 13–16", tier: 4 };
  return { label: "Levels 17–20", tier: 5 };
}

function recommendedPackages(options: Record<PackageSlot, PrimitiveOption[]>, effectiveLevel: number, availableBu: number, seed: number, excludedKeys: string[] = []): PackagePreset[] {
  const names = [
    ["Vanguard", "Direct, forceful access for decisive action."],
    ["Wayfinder", "Flexible reach and a broad practical vocabulary."],
    ["Arcanist", "Focused expression with a different Domain foundation."],
  ] as const;
  return suggestStartingPackages({ options, availableBu, seed: seed + levelBracket(effectiveLevel).tier * 1000, excludedKeys })
    .map((suggestion, index) => ({ ...suggestion, name: names[index]?.[0] ?? "Foundation", description: names[index]?.[1] ?? "A different starting vocabulary." }));
}

function packageSummary(items: PrimitiveOption[]) {
  const matching = (category: PrimitiveOption["category"]) => items.filter((candidate) => candidate.category === category);
  const binding = (primitive: PrimitiveOption | undefined, key: string) => String(primitive?.mechanicalRule?.bindings?.[key] ?? "").trim();
  const list = (values: string[]) => values.join(" + ");
  const verbs = matching("VERB_TIER").map((verb) => {
    const tier = binding(verb, "tier") || `Tier ${ROMAN[tierOf(verb)] || tierOf(verb)}`;
    return tier.replace(/^Tier\s*/i, "");
  });
  const ranges = matching("RANGE").map((range) => (binding(range, "range") || range.name).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+Range$/i, ""));
  const dice = matching("INTENSITY_DICE").map((die) => (binding(die, "dice") || die.name.match(/\d*d\d+/i)?.[0] || die.name).replace(/^1(?=d\d+$)/i, ""));
  const domains = matching("DOMAIN").map((domain) => domain.name.replace(/^Domain of\s+/i, ""));
  return [
    `Verb ${verbs.length === 1 ? "Tier" : "Tiers"} ${list(verbs)}`,
    `${list(ranges)} ${ranges.length === 1 ? "range" : "ranges"}`,
    `${list(dice)} ${dice.length === 1 ? "die" : "dice"}`,
    `${domains.length === 1 ? "Domain of" : "Domains of"} ${list(domains)}`,
  ].join(" · ");
}

interface StartingAccessProps {
  options: Record<PackageSlot, PrimitiveOption[]>;
  selectedIds: number[];
  mirrorCredit: number;
  loading: boolean;
  togglePrimitive: (id: number) => void;
  packageCost: number;
  budget: number;
  effectiveLevel: number;
  suggestions: PackagePreset[] | null;
  savedPackages: PackagePreset[];
  onChoosePackage: (preset: PackagePreset) => void;
  onRemovePackage: (preset: PackagePreset) => void;
  shuffleBudget: number;
  onShuffleBudgetChange: (budget: number) => void;
  onShuffle: (budget: number) => void;
}

function PackageCard({ preset, index, active, onChoose }: { preset: PackagePreset; index: number; active: boolean; onChoose: () => void }) {
  return <button type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={onChoose}>
    <i aria-hidden>{String(index + 1).padStart(2, "0")}</i>
    <span><b>{preset.name}</b><small>{preset.description}</small><small className="sw-access-preset-summary">{packageSummary(preset.items)}</small></span>
    <em>{preset.cost} BU</em><strong>{active ? "Chosen" : "Use package"}</strong>
  </button>;
}

function StartingAccessStep({ options, selectedIds, mirrorCredit, loading, togglePrimitive, packageCost, budget, effectiveLevel, shuffleBudget, onShuffleBudgetChange, suggestions: shuffledSuggestions, savedPackages, onChoosePackage, onRemovePackage, onShuffle }: StartingAccessProps) {
  const [family, setFamily] = useState<PackageSlot>("verb");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [consideredDomainIds, setConsideredDomainIds] = useState<number[]>([]);
  const [shuffleBudgetDraft, setShuffleBudgetDraft] = useState(String(shuffleBudget));
  const { openDrawer } = useGlobalControls();
  const bracket = levelBracket(effectiveLevel);
  const availableBu = budget + mirrorCredit;
  const minimumPackageCost = (Object.keys(options) as PackageSlot[]).reduce((sum, slot) => sum + (options[slot][0]?.buCost ?? 0), 0);
  const commitShuffleBudget = () => {
    const parsed = Number(shuffleBudgetDraft);
    const next = shuffleBudgetDraft.trim() && Number.isFinite(parsed)
      ? clamp(parsed, minimumPackageCost, availableBu)
      : shuffleBudget;
    setShuffleBudgetDraft(String(next));
    onShuffleBudgetChange(next);
    return next;
  };
  const initialSuggestions = useMemo(() => recommendedPackages(options, effectiveLevel, availableBu, 0), [options, effectiveLevel, availableBu]);
  const validPackage = (preset: PackagePreset) => preset.cost <= availableBu;
  const currentPackages = (shuffledSuggestions ?? initialSuggestions).filter(validPackage);
  const packages = currentPackages.length === 3 ? currentPackages : [
    ...currentPackages,
    ...initialSuggestions.filter((preset) => validPackage(preset) && !currentPackages.some((item) => item.key === preset.key)),
  ].slice(0, 3);
  const saved = savedPackages.filter(validPackage);
  const packageActive = (preset: PackagePreset) => preset.items.length === selectedIds.length && preset.items.every((item) => selectedIds.includes(item.id));
  const choosePackage = (preset: PackagePreset) => { onChoosePackage(preset); setBuilderOpen(false); };
  const availableTiers = [...new Set(options[family].map(tierOf))].sort((a, b) => a - b);
  const visible = options[family].filter((item) => `${item.name} ${item.mechanicalOutputText} ${item.narrativeRule}`.toLowerCase().includes(query.toLowerCase()) && (tierFilter === null || tierOf(item) === tierFilter) && (originFilter === "all" || originOf(item) === originFilter));
  const selected = ACCESS_FAMILIES.flatMap(([slot]) => options[slot]).filter((item) => selectedIds.includes(item.id));
  const consideredDomains = consideredDomainIds.map((id) => options.domain.find((item) => item.id === id)).filter((item): item is PrimitiveOption => Boolean(item));
  const chooseDomain = (id: number) => {
    if (!selectedIds.includes(id)) setConsideredDomainIds((current) => current.includes(id) ? current : [...current, id].slice(-4));
    togglePrimitive(id);
  };
  const removeConsideredDomain = (id: number) => {
    setConsideredDomainIds((current) => current.filter((saved) => saved !== id));
    if (selectedIds.includes(id)) togglePrimitive(id);
  };
  const definitions = [...MARKET_TEMPLATES, ...CANONICAL_EXPRESSIONS].filter((item) => item.familyKey === FAMILY_KEYS[family]);

  return <div className="sw-forge-stack">
    <section className="sw-forge-package-intro">
      <div><span>Starting access · Library instrument</span><h3>Choose a foundation</h3><p>BU (Build Units) pay for primitives. Your chosen weakness adds {mirrorCredit} BU credit, giving you {availableBu} BU in total. Any tier is available at any level if it fits your BU budget. Choose a package or build your own. After creation, you can add more primitives and arrange them into Lineage, Upbringing, Manifest, or capabilities on the character sheet.</p></div>
      <div className={packageCost > availableBu ? "is-over" : ""}><span>Available to spend</span><strong>{availableBu} BU</strong><small>{budget} base · +{mirrorCredit} mirror credit</small></div>
    </section>
    {loading ? <div className="sw-forge-loading"><Loader2 className="animate-spin" aria-hidden /> Opening the primitive library…</div> : <>
      <section className="sw-access-presets">
        <header><div><span>Recommended foundations</span><h3>Choose a package for {bracket.label}</h3></div><div className="sw-access-presets__actions"><label className="sw-access-presets__budget"><span>Shuffle up to</span><input type="text" inputMode="numeric" pattern="[0-9]*" aria-label="Shuffle budget in BU" value={shuffleBudgetDraft} onChange={(event) => setShuffleBudgetDraft(event.target.value.replace(/\D/g, ""))} onBlur={commitShuffleBudget} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><small>BU of {availableBu}</small></label><button type="button" onClick={() => onShuffle(commitShuffleBudget())} disabled={!initialSuggestions.length}><Shuffle aria-hidden /> Shuffle packages</button></div></header>
        <div>
          {packages.map((preset, index) => <PackageCard key={preset.key} preset={preset} index={index} active={packageActive(preset)} onChoose={() => choosePackage(preset)} />)}
          <button type="button" className={`sw-access-presets__custom${builderOpen ? " is-active" : ""}`} aria-expanded={builderOpen} aria-controls="sw-starting-access-library" onClick={() => setBuilderOpen((open) => !open)}>
            <i aria-hidden><Plus /></i><span><b>Or create your own</b><small>Choose any combination of access primitives.</small><small className="sw-access-preset-summary">Verb tiers · Ranges · Output dice · Domains</small></span><strong>{builderOpen ? "Close Library" : selectedIds.length ? "Customize selection" : "Open Library"}</strong>
          </button>
        </div>
      </section>
      {savedPackages.length ? <section className="sw-forge-comparison sw-forge-comparison--packages"><header><div><span>Kept for comparison</span><h3>Packages you considered</h3></div><small>{savedPackages.length} / 4 kept</small></header>{saved.length ? <div className="sw-access-presets__saved-grid">{saved.map((preset, index) => <div className="sw-forge-considered-item" key={preset.key}><PackageCard preset={preset} index={index} active={packageActive(preset)} onChoose={() => choosePackage(preset)} /><button type="button" className="sw-forge-considered-item__remove" aria-label={`Remove ${preset.name} from considered packages`} onClick={() => onRemovePackage(preset)}><X aria-hidden /></button></div>)}</div> : <p>Your saved packages exceed the current BU limit.</p>}</section> : null}
      {builderOpen ? <section id="sw-starting-access-library" className="sw-access-library">
        <nav className="sw-access-library__families" aria-label="Starting access families">{ACCESS_FAMILIES.map(([id, label, hint], index) => <button type="button" key={id} className={family === id ? "is-active" : ""} onClick={() => { setFamily(id); setQuery(""); setTierFilter(null); }}><i aria-hidden>◇</i><span>{label}</span><small>{selected.filter((item) => options[id].some((option) => option.id === item.id)).length} chosen · {hint}</small><em>{String(index + 1).padStart(2, "0")}</em></button>)}</nav>
        <div className="sw-access-library__corpus">
          <header><div><span>Lexicon category · canonical family</span><h3>{ACCESS_FAMILIES.find(([id]) => id === family)?.[1]}</h3></div>{family === "domain" ? <button type="button" className="sw-domain-create" onClick={() => openDrawer("build")}><span aria-hidden><Plus /></span><span><small>Build & preview</small><strong>Create Domain</strong></span><em aria-hidden>›</em></button> : null}</header>
          <CanonicalDefinitions definitions={definitions} />
          <div className="sw-access-results-heading"><div><span>Exact entries</span><h4>Canonical references and community expressions</h4></div><b>{visible.length} records</b></div>
          <div className="sw-access-filter-row"><div>{[null, ...availableTiers].map((tier) => <button type="button" key={tier ?? "all"} aria-pressed={tierFilter === tier} onClick={() => setTierFilter(tier)}>{tier === null ? "All tiers" : `Tier ${ROMAN[tier] || tier}`}</button>)}</div><div>{(["all", "system", "community"] as OriginFilter[]).map((origin) => <button type="button" key={origin} aria-pressed={originFilter === origin} onClick={() => setOriginFilter(origin)}>{origin === "all" ? "All origins" : origin[0]!.toUpperCase() + origin.slice(1)}</button>)}</div></div>
          <label className="sw-access-search"><Search aria-hidden /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${family === "die" ? "output dice" : family + "s"}…`} /></label>
          <div className="sw-access-library__entries">{visible.map((item) => <PrimitiveSelectCard key={item.id} item={item} selected={selectedIds.includes(item.id)} onToggle={() => family === "domain" ? chooseDomain(item.id) : togglePrimitive(item.id)} />)}{visible.length === 0 ? <p className="sw-access-library__empty">No entries match these filters.</p> : null}</div>
          {family === "domain" && consideredDomains.length ? <section className="sw-access-domains-considered"><header><span>Kept for comparison</span><strong>Domains you considered</strong><small>{consideredDomains.length} / 4 kept</small></header><div>{consideredDomains.map((item) => <div key={item.id} className="sw-access-domains-considered__item"><button type="button" onClick={() => chooseDomain(item.id)} aria-pressed={selectedIds.includes(item.id)}><strong>{item.name}</strong><small data-copy="mechanical">{item.mechanicalOutputText}</small><em>{selectedIds.includes(item.id) ? "Selected" : "Choose Domain"} · {item.buCost} BU</em></button><button type="button" aria-label={`Remove ${item.name} from considered domains`} onClick={() => removeConsideredDomain(item.id)}><X aria-hidden /></button></div>)}</div></section> : null}
        </div>
        <aside className="sw-access-ledger"><header><span>Character ledger</span><strong>{selected.length}</strong></header>{selected.length ? <div>{selected.map((item) => <button type="button" key={item.id} onClick={() => togglePrimitive(item.id)}><span>{item.name}</span><small>{item.buCost} BU · remove</small></button>)}</div> : <p>Selections appear here as you add them.</p>}</aside>
      </section> : null}
    </>}
  </div>;
}

function MirrorOptionCard({ item, active, onSelect }: { item: PrimitiveOption; active: boolean; onSelect: () => void }) {
  const credit = item.mirrorBuCredit ?? item.buCost;
  const mechanicalCopy = item.mechanicalOutputText.replace(/\bwhen is when\b/gi, "when").trim();
  return <button type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={onSelect}>
    <span className="sw-mirror-choices__icon">{item.iconSource ? <IconDisplay iconSource={item.iconSource} iconKey={item.iconKey ?? null} iconUrl={item.iconUrl ?? null} iconColor={item.iconColor ?? null} size={30} alt="" /> : "◇"}</span>
    <span className="sw-mirror-choices__copy"><span>Mirrored primitive · {item.category.replaceAll("_", " ")}</span><strong>{item.name}</strong><small>{mirrorConsequence(item)}</small>{mechanicalCopy ? <em>Original rule: {mechanicalCopy}</em> : null}</span>
    <span className="sw-mirror-choices__credit">+{credit}<small>BU credit</small></span><b>{active ? "Selected weakness" : "Choose weakness"}</b>
  </button>;
}

function MirroringStep({ options, selectedId, onSelect, onRemove, savedIds, suggestionIds, shuffleSeed, onShuffle, budget, ceiling, characterName }: { options: PrimitiveOption[]; selectedId: number | null; onSelect: (id: number | null) => void; onRemove: (id: number) => void; savedIds: number[]; suggestionIds: number[] | null; shuffleSeed: number; onShuffle: () => void; budget: number; ceiling: number; characterName: string }) {
  const selected = options.find((item) => item.id === selectedId);
  const credit = selected ? selected.mirrorBuCredit ?? selected.buCost : 0;
  const currentSuggestions = suggestionIds === null ? [] : suggestionIds.map((id) => options.find((item) => item.id === id)).filter((item): item is PrimitiveOption => item !== undefined && !savedIds.includes(item.id));
  const suggestions = currentSuggestions.length === 3 ? currentSuggestions : [
    ...currentSuggestions,
    ...chooseMirrorSuggestions(options, characterName, shuffleSeed, savedIds, currentSuggestions.map((item) => item.id))
      .filter((item) => !currentSuggestions.some((current) => current.id === item.id)),
  ].slice(0, 3);
  const saved = savedIds.map((id) => options.find((item) => item.id === id)).filter((item): item is PrimitiveOption => Boolean(item));
  const canShuffle = options.filter((item) => !savedIds.includes(item.id)).length > 1;

  return <div className="sw-forge-stack sw-mirror-step">
    <section className="sw-mirror-principle">
      <div><span>Optional · Volatility instrument</span><h3>Choose a weakness. Gain room to build.</h3><p>A mirrored primitive costs nothing to acquire. Its benefit becomes a weakness and grants BU credit, up to this level’s debt ceiling. Choose one or skip it now; the next step uses the credit when suggesting packages.</p></div>
      <div className="sw-mirror-ledger"><span><small>Base budget</small><strong>{budget} BU</strong></span><span><small>Debt ceiling</small><strong>{ceiling} BU</strong></span><span><small>Mirror credit</small><strong>+{credit} BU</strong></span><span><small>Starting access budget</small><strong>{budget + credit} BU</strong></span></div>
    </section>
    <section className="sw-mirror-choices"><header><div><span>{options.length} eligible within your mirror debt ceiling</span><h3>Explore weaknesses</h3><p>Choose a weakness to keep it below. Shuffle draws up to three fresh suggestions from the remaining primitives with a working mirrored effect.</p></div><button type="button" onClick={onShuffle} disabled={!canShuffle}><Shuffle aria-hidden /> Shuffle all suggestions</button></header>
      {suggestions.length ? <div className="sw-mirror-choices__grid">{suggestions.map((item) => <MirrorOptionCard key={item.id} item={item} active={item.id === selectedId} onSelect={() => onSelect(item.id)} />)}</div> : <p className="sw-mirror-choices__empty">No eligible weaknesses at this level. Continue without mirroring.</p>}
    </section>
    {savedIds.length ? <section className="sw-forge-comparison"><header><div><span>Kept for comparison</span><h3>Weaknesses you considered</h3></div><small>{savedIds.length} / 4 kept</small></header><div className="sw-mirror-choices__grid">{saved.map((item) => <div className="sw-forge-considered-item" key={item.id}><MirrorOptionCard item={item} active={item.id === selectedId} onSelect={() => onSelect(item.id)} /><button type="button" className="sw-forge-considered-item__remove" aria-label={`Remove ${item.name} from considered weaknesses`} onClick={() => onRemove(item.id)}><X aria-hidden /></button></div>)}</div></section> : null}
    <button type="button" className={`sw-mirror-skip${selectedId === null ? " is-active" : ""}`} aria-pressed={selectedId === null} onClick={() => onSelect(null)}><span>Skip mirroring for now</span><small>Continue with the standard BU budget; you can add a weakness later from Build mode.</small><ArrowRight aria-hidden /></button>
  </div>;
}

function CanonicalDefinitions({ definitions }: { definitions: Array<{ key: string; name: string; tier: number | null; buCost: number; verboseDescription: string }> }) {
  const [open, setOpen] = useState(false);
  const unique = definitions.filter((item, index, all) => all.findIndex((candidate) => candidate.tier === item.tier) === index).sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
  if (!unique.length) return null;
  return <section className={`sw-access-definitions${open ? " is-open" : ""}`}><button type="button" className="sw-access-definitions__title" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span><b>Definitions</b><small>What each canonical tier permits</small></span><em>{unique.length} tiers</em><ChevronDown aria-hidden /></button>{open ? <div className="sw-access-definitions__body">{unique.map((definition) => <div key={definition.key}><b>{definition.tier === null ? "—" : `T${definition.tier}`}</b><span><strong>{definition.name}</strong><small>{definition.verboseDescription}</small></span><em>{definition.buCost} BU</em></div>)}</div> : null}</section>;
}

function DomainAuthoringDrawer({ onSaved }: { onSaved: (primitiveId: number) => void }) {
  const [preview, setPreview] = useState<ReactNode>(<div className="v12-workspace-preview-empty"><span>Live preview</span><strong>Create a Domain</strong><p>The preview updates as you define its access and meaning.</p></div>);
  const handlePreview = useCallback<NonNullable<ComponentProps<typeof PrimitiveForm>["onStateChange"]>>((state) => setPreview(<PrimitiveFormPreview form={state.form} modifiers={state.modifiers} />), []);
  const handleSaved = useCallback<NonNullable<ComponentProps<typeof PrimitiveForm>["onSaved"]>>((primitive) => onSaved(primitive.id), [onSaved]);
  const build = useMemo(() => <div className="sw-domain-author"><header><span>Starting access author</span><h2>Create a Domain</h2><p>Save it to the Library and it will be added to this character’s starting access.</p></header><PrimitiveForm initialCategory="DOMAIN_ACCESS" onStateChange={handlePreview} onSaved={handleSaved} /></div>, [handlePreview, handleSaved]);
  useDrawerSlot(useMemo(() => ({ build, preview }), [build, preview]));
  return null;
}

function PrimitiveSelectCard({ item, selected, onToggle }: { item: PrimitiveOption; selected: boolean; onToggle: () => void }) {
  return <button type="button" className={`sw-access-entry${selected ? " is-selected" : ""}`} onClick={onToggle} aria-pressed={selected}><span className="sw-access-entry__icon">{item.iconSource ? <IconDisplay iconSource={item.iconSource} iconKey={item.iconKey ?? null} iconUrl={item.iconUrl ?? null} iconColor={item.iconColor ?? null} size={30} alt="" /> : "◇"}</span><span className="sw-access-entry__copy"><span><strong>{item.name}</strong>{selected ? <em><Check aria-hidden /> Selected</em> : null}</span><small>{item.costTier || item.category.replaceAll("_", " ")} · {originOf(item) === "community" ? "Community" : "System"}{item.version ? ` · v${item.version}` : ""}</small>{item.mechanicalOutputText ? <span data-copy="mechanical">{item.mechanicalOutputText}</span> : null}{item.narrativeRule ? <span data-copy="narrative">{item.narrativeRule}</span> : null}</span><span className="sw-access-entry__cost">{item.buCost}<small>BU</small></span></button>;
}

function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <header className="sw-forge-panel__title"><span>{number}</span><div><h3>{title}</h3><p>{subtitle}</p></div></header>; }
function ForgeField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) { return <label className="sw-forge-field"><span>{label}{required ? <b>Required</b> : null}</span>{hint ? <small>{hint}</small> : null}{children}</label>; }
