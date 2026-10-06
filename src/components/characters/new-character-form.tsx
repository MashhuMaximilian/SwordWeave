"use client";
import { ForgeProgressRail, ForgeWorkbench, QuickbuildSection } from "./forge-section";
import { useUser } from "@clerk/nextjs";
import { CreationAtelierAction } from "./creation-atelier-action";
import { availableLegacyCreationDrafts,claimLegacyCreationDraft,creationDraftKey,creationModeKey,readCreationReturn,writeCreationDraft } from "@/lib/character/creation-return/model";
import { useCreationAuthoringReturn } from "@/lib/character/creation-return/client";
import {
  quickbuildCost,
  shuffleQuickbuild,
  QUICKBUILD_KINDS,
  EMPTY_QUICKBUILD,
  type QuickbuildCatalog,
  type QuickbuildSelection,
  type QuickbuildKind,
  type QuickbuildShuffleLimits,
} from "@/lib/character/quickbuild";
import { creationBudget } from "@/lib/character/creation-budget";
import { missingCreationAccess } from "@/lib/character/creation-primitives";
import {
  QuickbuildLibraryPicker,
  QuickbuildEntityPreviewDialog,
} from "./quickbuild-library-picker";
import { PhoneSection } from "./workspace/phone-section";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import {
  parseBackstory,
  type CharacterBackstory,
} from "@/lib/character/character-backstory";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Shuffle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  cumulativeBuForLevel,
  impliedLevelForBudget,
  maxBuDebtForLevel,
} from "@/lib/engine/bu";
import { SIZE_BASE_SPEED, SIZE_CAPACITY } from "@/lib/engine/encumbrance";
import { PortraitInput, type PortraitFrame } from "./portrait-input";
import { IconDisplay } from "@/components/icons/icon-display";
import {
  MARKET_TEMPLATES,
  CANONICAL_EXPRESSIONS,
} from "@/lib/primitives/canonical-market";
import { PrimitiveForm } from "@/components/sandbox/primitive-form";
import { PrimitiveFormPreview } from "@/components/sandbox/primitive-form-preview";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useDrawerSlot } from "@/components/layout/build-preview-drawer";
import { useGlobalControls } from "@/components/layout/global-controls";
import {
  suggestStartingPackages,
  startingPackageTier,
} from "@/lib/character/starting-package-suggestions";
import {
  chooseMirrorSuggestions,
  eligibleMirrorCandidates,
  mirrorConsequence,
} from "@/lib/character/mirror-suggestions";

const SIZES = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;
const ATTRIBUTES = ["PHYSICAL", "MENTAL", "MAGICAL"] as const;
const STEPS = [
  {
    id: "identity",
    eyebrow: "01",
    label: "Your character",
    hint: "Concept and story",
  },
  {
    id: "foundation",
    eyebrow: "02",
    label: "Foundation",
    hint: "Level, size, strengths",
  },
  {
    id: "mirroring",
    eyebrow: "03",
    label: "Weakness",
    hint: "Optional drawbacks",
  },
  {
    id: "packages",
    eyebrow: "04",
    label: "Starting access",
    hint: "First abilities",
  },
  {
    id: "finishing",
    eyebrow: "05",
    label: "Ready to play",
    hint: "Review and continue",
  },
] as const;

const STEP_GUIDANCE: Record<StepId, { title: string; description: string }> = {
  identity: {
    title: "Imagine them before choosing rules",
    description:
      "Describe who they are, what they can do, and what shaped them. A few sentences are enough; you can return to any detail later.",
  },
  foundation: {
    title: "Give the idea a foundation",
    description:
      "Choose a starting level, physical size, and attribute strengths together. The defaults work for a first character; adjust them to fit your concept.",
  },
  mirroring: {
    title: "Does their story include a weakness?",
    description:
      "Choose any mechanical drawbacks that fit your level’s debt limit before you spend points. Each gives you more Build Units for the next step. Skipping this is fine.",
  },
  packages: {
    title: "Choose a starting foundation",
    description:
      "Pick a modest set of basic access rules. Save the rest of your points for the abilities, proficiencies, resistances, and other details you will build on the character sheet.",
  },
  finishing: {
    title: "Review your character",
    description:
      "Check the story and starting rules together. After creation, the character sheet is where your idea grows into heritages, capabilities, and items.",
  },
};

type StepId = (typeof STEPS)[number]["id"];
type Size = (typeof SIZES)[number];
type Attribute = (typeof ATTRIBUTES)[number];
type PackageSlot = "domain" | "verb" | "range" | "die";
type OriginFilter = "all" | "system" | "community";
type PackagePreset = {
  key: string;
  name: string;
  description: string;
  items: PrimitiveOption[];
  cost: number;
};

const FAMILY_KEYS: Record<PackageSlot, string> = {
  domain: "DOMAIN_ACCESS",
  verb: "VERB_ACCESS",
  range: "RANGE_SCALING",
  die: "INTENSITY_DICE",
};

const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

export interface PrimitiveOption {
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
  mechanicalRule?: {
    family?: string;
    bindings?: Record<string, unknown>;
  } | null;
  isMirrorable?: boolean | null;
  mirrorBuCredit?: number | null;
  hardModifiers?: unknown[] | null;
  mirrorVector?: string | null;
}

interface FormState {
  name: string;
  concept: string;
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
  backstory: CharacterBackstory;
}

const INITIAL_STATE: FormState = {
  name: "",
  concept: "",
  portraitUrl: "",
  portraitFrame: { x: 50, y: 50, zoom: 1 },
  size: "MEDIUM",
  notes: "",
  attrPhysical: 4,
  attrMental: 3,
  attrMagical: 3,
  attrProficient: "PHYSICAL",
  sizingMode: "level",
  level: 1,
  customBu: 25,
  backstory: parseBackstory(null),
};

function clamp(value: number, min: number, max: number) {
  return Math.max(
    min,
    Math.min(max, Number.isFinite(value) ? Math.floor(value) : min),
  );
}

export function NewCharacterForm() { const {user}=useUser();return <AccountNewCharacterForm key={user?.id??"loading"} accountId={user?.id??null}/>; }
function AccountNewCharacterForm({accountId}:{accountId:string|null}) {
  const [legacyDrafts,setLegacyDrafts]=useState<("complete"|"quick")[]>([]);
  useEffect(()=>{
    if(!accountId)return;
    const timer=window.setTimeout(()=>{try{setLegacyDrafts(availableLegacyCreationDrafts(localStorage));}catch{}},0);
    return ()=>window.clearTimeout(timer);
  },[accountId]);
  const legacyResume=legacyDrafts.length>0&&accountId?<aside className="sw-forge-draft-recovery"><p>An earlier draft is saved on this device. Resume it to assign it to your signed-in account.</p>{legacyDrafts.map(mode=><button key={mode} type="button" onClick={()=>{try{claimLegacyCreationDraft(localStorage,accountId,mode,crypto.randomUUID());window.location.assign(`/characters/new?resume=${mode}`);}catch(error){setReturnNotice(error instanceof Error?error.message:"Unable to resume earlier draft.");}}}>Resume earlier {mode==="quick"?"Quickbuild":"complete"} draft</button>)}</aside>:null;
  const draftKey=accountId?creationDraftKey(accountId,"complete"):null;
  const [returnNotice,setReturnNotice]=useState("");
  const [hydratedAccount,setHydratedAccount]=useState<string|null>(null);
  const [creationDraftId,setCreationDraftId]=useState<string|null>(null);
  const [creationMode, setCreationMode] = useState<"complete" | "quick" | null>(
    null,
  );
  const router = useRouter();
  const phone = useIsMobile();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [step, setStep] = useState<StepId>("identity");
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [selectedPrimitiveIds, setSelectedPrimitiveIds] = useState<number[]>(
    [],
  );
  const [mirroredPrimitiveIds, setMirroredPrimitiveIds] = useState<number[]>(
    [],
  );
  const [savedMirrorIds, setSavedMirrorIds] = useState<number[]>([]);
  const [mirrorSuggestionIds, setMirrorSuggestionIds] = useState<
    number[] | null
  >(null);
  const [mirrorShuffleSeed, setMirrorShuffleSeed] = useState(0);
  const [mirrorSeenIds, setMirrorSeenIds] = useState<number[]>([]);
  const [savedPackages, setSavedPackages] = useState<PackagePreset[]>([]);
  const [packageSuggestions, setPackageSuggestions] = useState<
    PackagePreset[] | null
  >(null);
  const [packageShuffleSeed, setPackageShuffleSeed] = useState(0);
  const [packageShuffleBudget, setPackageShuffleBudget] = useState<
    number | null
  >(null);
  const [primitives, setPrimitives] = useState<PrimitiveOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const starterApplied = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef<StepId>("identity");
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if(!accountId||!draftKey)return;
    const timer = window.setTimeout(() => {
      try {
        const params=new URL(window.location.href).searchParams;
        const token=params.get("creationReturn");
        const returned=readCreationReturn(localStorage,token,accountId);
        // New Character always offers both paths. Explicit returns resume their
        // mode; choosing either path still restores its account-scoped draft.
        const resumeMode=returned?.mode??params.get("resume");
        if(resumeMode==="complete"||resumeMode==="quick")setCreationMode(resumeMode);
        const saved = window.localStorage.getItem(returned?.mode==="complete"?`${draftKey}:${returned.draftId}`:draftKey);
        if (saved) {
          const draft = JSON.parse(saved) as {
            draftId?:string;
            state?: FormState;
            selectedPrimitiveIds?: number[];
            mirroredPrimitiveIds?: number[];
            mirroredPrimitiveId?: number | null;
            savedMirrorIds?: number[];
            savedPackages?: PackagePreset[];
            packageShuffleBudget?: number | null;
            step?: StepId;
          };
          setCreationDraftId(draft.draftId??crypto.randomUUID());
          if (
            draft.state &&
            typeof draft.state.name === "string" &&
            draft.state.backstory
          )
            setState({
              ...INITIAL_STATE,
              ...draft.state,
              concept: draft.state.concept ?? "",
              backstory: parseBackstory(draft.state.backstory),
            });
          if (Array.isArray(draft.selectedPrimitiveIds)) {
            setSelectedPrimitiveIds(
              draft.selectedPrimitiveIds.filter(Number.isInteger),
            );
            if (draft.selectedPrimitiveIds.length)
              starterApplied.current = true;
          }
          if (Array.isArray(draft.mirroredPrimitiveIds))
            setMirroredPrimitiveIds([
              ...new Set(draft.mirroredPrimitiveIds.filter(Number.isInteger)),
            ]);
          else if (typeof draft.mirroredPrimitiveId === "number")
            setMirroredPrimitiveIds([draft.mirroredPrimitiveId]);
          if (Array.isArray(draft.savedMirrorIds))
            setSavedMirrorIds(draft.savedMirrorIds.filter(Number.isInteger));
          if (Array.isArray(draft.savedPackages))
            setSavedPackages(
              draft.savedPackages
                .filter(
                  (item) =>
                    item &&
                    typeof item.key === "string" &&
                    Array.isArray(item.items),
                )
                .slice(-4),
            );
          if (typeof draft.packageShuffleBudget === "number")
            setPackageShuffleBudget(draft.packageShuffleBudget);
          if (STEPS.some((item) => item.id === draft.step))
            setStep(draft.step!);
        }
      } catch {
        /* A damaged or unavailable local draft should never block creation. */
      }
      setCreationDraftId(current=>current??crypto.randomUUID());setHydratedAccount(accountId);setDraftLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountId,draftKey]);

  useEffect(()=>{if(accountId&&draftLoaded&&hydratedAccount===accountId){if(creationMode)localStorage.setItem(creationModeKey(accountId),creationMode);else localStorage.removeItem(creationModeKey(accountId));}},[accountId,draftLoaded,hydratedAccount,creationMode]);
  useEffect(() => {
    if (!draftLoaded||!draftKey||hydratedAccount!==accountId) return;
    try {
      writeCreationDraft(window.localStorage,
        draftKey,creationDraftId,
        JSON.stringify({
          draftId:creationDraftId,
          state,
          selectedPrimitiveIds,
          mirroredPrimitiveIds,
          savedMirrorIds,
          savedPackages,
          packageShuffleBudget,
          step,
        }),
      );
    } catch {
      /* Browser storage may be unavailable. */
    }
  }, [
    draftLoaded,
    accountId,
    draftKey,
    hydratedAccount,
    creationDraftId,
    state,
    selectedPrimitiveIds,
    mirroredPrimitiveIds,
    savedMirrorIds,
    savedPackages,
    packageShuffleBudget,
    step,
  ]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepHeading.current?.focus();
  }, [step]);

  const loadPrimitives = useCallback(async () => {
    const response = await fetch("/api/primitives");
    if (!response.ok)
      throw new Error("The primitive library could not be opened.");
    const payload = (await response.json()) as {
      primitives?: PrimitiveOption[];
    };
    setPrimitives(payload.primitives ?? []);
    return payload.primitives ?? [];
  }, []);

  useCreationAuthoringReturn(accountId,"complete",draftLoaded&&hydratedAccount===accountId,creationDraftId,async entry=>{
    if(entry.targetType!=="PRIMITIVE")throw new Error("This creation step accepts primitives. You can add other entries from the character sheet.");
    const refreshed=await loadPrimitives();if(!refreshed.some(p=>p.id===Number(entry.targetId)))throw new Error("The saved primitive could not be loaded. Try returning again.");setSelectedPrimitiveIds(previous=>[...new Set([...previous,Number(entry.targetId)])]);starterApplied.current=true;setReturnNotice(`${entry.name} selected for your character.`);
  },message=>setError(message));
  useEffect(() => {
    let current = true;
    fetch("/api/primitives")
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The primitive library could not be opened.");
        return response.json() as Promise<{ primitives?: PrimitiveOption[] }>;
      })
      .then((payload) => {
        if (current) setPrimitives(payload.primitives ?? []);
      })
      .catch((reason) => {
        if (current)
          setError(
            reason instanceof Error
              ? reason.message
              : "The primitive library could not be opened.",
          );
      })
      .finally(() => {
        if (current) setCatalogLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const options = useMemo(() => {
    const usable = primitives.filter((primitive) => {
      const family = primitive.mechanicalRule?.family;
      const bindings = primitive.mechanicalRule?.bindings ?? {};
      if (primitive.category === "DOMAIN")
        return family === "DOMAIN_ACCESS" && Boolean(bindings["domain"]);
      if (primitive.category === "VERB_TIER") return family === "VERB_ACCESS";
      if (primitive.category === "RANGE") return family === "RANGE";
      if (primitive.category === "INTENSITY_DICE") return family === "DICE";
      return false;
    });
    const sort = (items: PrimitiveOption[]) =>
      [...items].sort(
        (a, b) => a.buCost - b.buCost || a.name.localeCompare(b.name),
      );
    return {
      domain: sort(usable.filter((item) => item.category === "DOMAIN")),
      verb: sort(usable.filter((item) => item.category === "VERB_TIER")),
      range: sort(usable.filter((item) => item.category === "RANGE")),
      die: sort(usable.filter((item) => item.category === "INTENSITY_DICE")),
    } satisfies Record<PackageSlot, PrimitiveOption[]>;
  }, [primitives]);

  const packageCost = useMemo(
    () =>
      selectedPrimitiveIds.reduce(
        (sum, id) =>
          sum +
          (primitives.find((primitive) => primitive.id === id)?.buCost ?? 0),
        0,
      ),
    [selectedPrimitiveIds, primitives],
  );
  const budget =
    state.sizingMode === "level"
      ? cumulativeBuForLevel(state.level)
      : state.customBu;
  const effectiveLevel =
    state.sizingMode === "level"
      ? state.level
      : impliedLevelForBudget(state.customBu);
  const mirrorCeiling = maxBuDebtForLevel(effectiveLevel);
  const mirrorOptions = useMemo(
    () => eligibleMirrorCandidates(primitives, mirrorCeiling),
    [primitives, mirrorCeiling],
  );
  const selectedMirrors = primitives.filter((primitive) =>
    mirroredPrimitiveIds.includes(primitive.id),
  );
  const mirrorCredit = selectedMirrors.reduce(
    (sum, primitive) => sum + (primitive.mirrorBuCredit ?? primitive.buCost),
    0,
  );
  const budgetLedger = creationBudget({ level: effectiveLevel, budget, positiveSpent: packageCost, mirrorCredit });
  const attrSum = state.attrPhysical + state.attrMental + state.attrMagical;
  const packageComplete = (["domain", "verb"] as PackageSlot[]).every(
    (slot) =>
      options[slot].some((item) => selectedPrimitiveIds.includes(item.id)),
  );
  const mirrorsValid =
    selectedMirrors.length === mirroredPrimitiveIds.length &&
    mirroredPrimitiveIds.every(id => mirrorOptions.some(option => option.id === id)) &&
    mirrorCredit <= mirrorCeiling;
  const formValid =
    state.name.trim().length > 0 &&
    state.concept.trim().length > 0 &&
    attrSum === 10 &&
    mirrorsValid &&
    packageComplete &&
    budgetLedger.canCreate &&
    !isPending;
  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const completedSteps: Record<StepId, boolean> = {
    identity: Boolean(state.name.trim() && state.concept.trim()),
    foundation: currentIndex > 1 && attrSum === 10,
    mirroring: currentIndex > 2 || selectedMirrors.length > 0,
    packages:
      currentIndex > 3 &&
      packageComplete &&
      budgetLedger.canCreate,
    finishing: currentIndex === 4 && formValid,
  };

  useEffect(() => {
    if (
      starterApplied.current ||
      !draftLoaded ||
      catalogLoading ||
      selectedPrimitiveIds.length
    )
      return;
    const curated = beginnerStartingOptions(options);
    const first = recommendedPackages(
      curated,
      effectiveLevel,
      Math.min(budget, 14 + (levelBracket(effectiveLevel).tier - 1) * 8),
      0,
    )[0];
    if (!first) return;
    const timer = window.setTimeout(() => {
      if (starterApplied.current) return;
      starterApplied.current = true;
      setSelectedPrimitiveIds(first.items.map((item) => item.id));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    draftLoaded,
    catalogLoading,
    selectedPrimitiveIds.length,
    options,
    effectiveLevel,
    budget,
  ]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const togglePrimitive = useCallback((primitiveId: number) => {
    setSelectedPrimitiveIds((current) =>
      current.includes(primitiveId)
        ? current.filter((id) => id !== primitiveId)
        : [...current, primitiveId],
    );
  }, []);

  const handleDomainSaved = useCallback(
    async (primitiveId: number) => {
      try {
        await loadPrimitives();
        setSelectedPrimitiveIds((current) =>
          current.includes(primitiveId) ? current : [...current, primitiveId],
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The new Domain was saved, but the Library could not refresh.",
        );
      }
    },
    [loadPrimitives],
  );

  function goNext() {
    if (step === "identity" && !state.name.trim()) {
      setError("Give the character a name before continuing.");
      return;
    }
    if (step === "identity" && !state.concept.trim()) {
      setError("Describe your character in a sentence before choosing rules.");
      return;
    }
    if (step === "foundation" && attrSum !== 10) {
      setError("Your Physical, Mental, and Magical scores must add up to 10.");
      return;
    }
    if (step === "mirroring" && !mirrorsValid) {
      setError(
        `Your chosen drawbacks exceed the ${mirrorCeiling} BU debt limit, or are no longer available at this level. Remove one before continuing.`,
      );
      return;
    }
    if (step === "packages" && !packageComplete) {
      setError(
        "Choose a domain and verb tier in a starting set or Make your own set. Touch range and a 1d4 die are included when no other range or die is chosen.",
      );
      return;
    }
    if (step === "packages" && budgetLedger.aboveNextLevel) {
      setError(
        "These purchases exceed the next level’s BU ceiling. Remove a choice or adjust the budget.",
      );
      return;
    }
    setError(null);
    setStep(STEPS[Math.min(currentIndex + 1, STEPS.length - 1)]!.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function keepMirror(id: number | null) {
    if (id === null) {
      setMirroredPrimitiveIds([]);
      return;
    }
    const candidate = mirrorOptions.find((item) => item.id === id);
    if (!candidate) return;
    setMirroredPrimitiveIds((current) => {
      if (current.includes(id))
        return current.filter((selected) => selected !== id);
      const currentCredit = current.reduce((sum, selected) => {
        const item = mirrorOptions.find((option) => option.id === selected);
        return sum + (item ? (item.mirrorBuCredit ?? item.buCost) : 0);
      }, 0);
      if (
        currentCredit + (candidate.mirrorBuCredit ?? candidate.buCost) >
        mirrorCeiling
      )
        return current;
      return [...current, id];
    });
    setSavedMirrorIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function removeMirror(id: number) {
    setSavedMirrorIds((current) => current.filter((saved) => saved !== id));
    setMirroredPrimitiveIds((current) =>
      current.filter((selected) => selected !== id),
    );
  }

  function shuffleMirrors() {
    const nextSeed = Math.floor(Math.random() * 0x1_0000_0000);
    setMirrorShuffleSeed(nextSeed);
    const excluded = [...new Set([...savedMirrorIds, ...mirroredPrimitiveIds])];
    const affordable = mirrorOptions.filter(
      (item) =>
        (item.mirrorBuCredit ?? item.buCost) <= mirrorCeiling - mirrorCredit,
    );
    const previous =
      mirrorSuggestionIds ??
      chooseMirrorSuggestions(affordable, state.name, 0, excluded).map(
        (item) => item.id,
      );
    const seen = [...new Set([...mirrorSeenIds, ...previous])];
    const next = chooseMirrorSuggestions(
      affordable,
      state.name,
      nextSeed,
      excluded,
      previous,
      3,
      seen,
    ).map((item) => item.id);
    setMirrorSuggestionIds(next);
    setMirrorSeenIds([...new Set([...seen, ...next])]);
  }

  function keepPackage(preset: PackagePreset) {
    setSelectedPrimitiveIds(preset.items.map((item) => item.id));
    setSavedPackages((current) =>
      current.some((item) => item.key === preset.key)
        ? current
        : [...current, preset].slice(-4),
    );
  }

  function removePackage(preset: PackagePreset) {
    setSavedPackages((current) =>
      current.filter((item) => item.key !== preset.key),
    );
    if (
      selectedPrimitiveIds.length === preset.items.length &&
      preset.items.every((item) => selectedPrimitiveIds.includes(item.id))
    )
      setSelectedPrimitiveIds([]);
  }

  function shufflePackages(requestedBudget: number) {
    const cap = Math.min(Math.max(0, requestedBudget), budget + mirrorCredit);
    setPackageShuffleBudget(cap);
    const nextSeed = packageShuffleSeed + 1;
    setPackageShuffleSeed(nextSeed);
    const previous =
      packageSuggestions ??
      recommendedPackages(options, effectiveLevel, cap, 0);
    const excluded = savedPackages.map((item) => item.key);
    const fresh = recommendedPackages(options, effectiveLevel, cap, nextSeed, [
      ...excluded,
      ...previous.map((item) => item.key),
    ]);
    setPackageSuggestions(
      fresh.length
        ? fresh
        : recommendedPackages(options, effectiveLevel, cap, nextSeed, excluded),
    );
  }

  function startOver() {
    if (
      !window.confirm(
        "Start a new character? This will clear the draft on this device.",
      )
    )
      return;
    try {
      if(draftKey)window.localStorage.removeItem(draftKey);
    } catch {
      /* Storage may be unavailable. */
    }
    setState(INITIAL_STATE);
    setSelectedPrimitiveIds([]);
    setMirroredPrimitiveIds([]);
    setSavedMirrorIds([]);
    setMirrorSuggestionIds(null);
    setMirrorSeenIds([]);
    setSavedPackages([]);
    setPackageSuggestions(null);
    setPackageShuffleBudget(null);
    setError(null);
    setStep("identity");
    starterApplied.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!formValid) {
      if (!state.name.trim() || !state.concept.trim()) setStep("identity");
      else if (attrSum !== 10) setStep("foundation");
      else if (!mirrorsValid) setStep("mirroring");
      else if (!packageComplete || budgetLedger.aboveNextLevel)
        setStep("packages");
      else setStep("finishing");
      setError(
        !state.name.trim()
          ? "Add a character name before creating."
          : !state.concept.trim()
            ? "Describe your character in a sentence before creating."
            : attrSum !== 10
              ? "Your three attributes must add up to 10. Adjust them below."
              : !mirrorsValid
                ? "Your selected weaknesses no longer fit the debt limit for this level."
                : !packageComplete
                  ? "Choose a domain and verb tier in a starting set or make your own."
                  : budgetLedger.aboveNextLevel
                    ? "Your selected access exceeds the next level’s BU ceiling."
                    : "Complete the required character fields.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: state.name.trim(),
            portraitUrl: state.portraitUrl.trim(),
            portraitFrame: state.portraitFrame,
            size: state.size,
            notes: state.notes.trim(),
            level: effectiveLevel,
            startingBu: 25,
            buBudget: state.sizingMode === "bu" ? state.customBu : null,
            buSpent: packageCost,
            dmBonusBu: 0,
            attrPhysical: state.attrPhysical,
            attrMental: state.attrMental,
            attrMagical: state.attrMagical,
            attrProficient: state.attrProficient,
            backstory: {
              ...Object.fromEntries(
                Object.entries(state.backstory).map(([key, value]) => [
                  key,
                  value.trim(),
                ]),
              ),
              origin: [
                `**Character concept:** ${state.concept.trim()}`,
                state.backstory.origin.trim(),
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
            sourceOrigin: "manual",
            primitiveInstances: [
              ...selectedPrimitiveIds.map((primitiveId) => ({
                primitiveId,
                isMirrored: false,
              })),
              ...selectedMirrors.map((primitive) => ({
                primitiveId: primitive.id,
                isMirrored: true,
              })),
            ],
            capabilityIds: [],
            itemIds: [],
            practiceSlices: {},
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          character?: { id: string };
          error?: string;
        };
        if (!response.ok || !payload.character?.id)
          throw new Error(
            payload.error ?? "The character could not be created.",
          );
        try {
          if(draftKey)window.localStorage.removeItem(draftKey);
        } catch {
          /* Storage may be unavailable. */
        }
        await fetch(`/api/characters/${payload.character.id}/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "BUILD" }),
        }).catch(() => undefined);
        router.push(`/characters/${payload.character.id}?mode=BUILD`);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The character could not be created.",
        );
      }
    });
  }

  if (creationMode === null)
    return (
      <section
        className="sw-creation-choice"
        aria-labelledby="creation-mode-heading"
      >
        {legacyResume}
        {returnNotice&&<p role="status">{returnNotice}</p>}
        <span className="sw-creation-choice__eyebrow">Your next adventure</span>
        <h2 id="creation-mode-heading">How would you like to begin?</h2>
        <p>
          You play one person in a shared story. Start with an idea, choose their strengths and abilities, then keep developing them on the character sheet.
        </p>
        <div className="sw-creation-choice__options">
          <button type="button" onClick={() => setCreationMode("complete")}>
            <span>01 · Take your time</span>
            <strong>Complete character</strong>
            <em>Guide me through each choice</em>
            <small>
              Shape their story, foundation and starting rules, step by step.
            </small>
            <ArrowRight aria-hidden />
          </button>
          <button type="button" onClick={() => setCreationMode("quick")}>
            <span>02 · Straight to the adventure</span>
            <strong>Quickbuild</strong>
            <em>Help me get ready to play</em>
            <small>
              Choose ready-made roots and abilities, or shuffle ideas. Every choice has a preview.
            </small>
            <Shuffle aria-hidden />
          </button>
        </div>
      </section>
    );
  if (creationMode === "quick")
    return (
      <>{legacyResume}
      <QuickBuildForm
        key={accountId??"loading"}
        accountId={accountId}
        primitives={primitives}
        options={options}
        primitivesLoading={catalogLoading}
        onRefreshPrimitives={loadPrimitives}
        onChangeMode={() => setCreationMode(null)}
      />
    </>);

  return (
    <div className="sw-character-forge">
      {legacyResume}
      {phone&&<div className="sw-forge-authoring-return"><CreationAtelierAction accountId={draftLoaded&&hydratedAccount===accountId?accountId:null} draftId={creationDraftId} mode="complete" persistDraft={()=>{if(!draftKey)throw new Error("Wait for your account to load.");const data=JSON.stringify({draftId:creationDraftId,state,selectedPrimitiveIds,mirroredPrimitiveIds,savedMirrorIds,savedPackages,packageShuffleBudget,step});localStorage.setItem(draftKey,data);localStorage.setItem(`${draftKey}:${creationDraftId}`,data);}}/></div>}
      {returnNotice&&<p role="status" className="sw-forge-return-notice text-sm text-primary">{returnNotice}</p>}
      <ForgeProgressRail label="Character creation progress">
        {phone && (
          <button
            className="sw-phone-step-picker"
            type="button"
            aria-expanded={stepsOpen}
            onClick={() => setStepsOpen((value) => !value)}
          >
            Step {currentIndex + 1} of {STEPS.length} ·{" "}
            {STEPS[currentIndex]!.label}
            <ChevronDown size={16} />
          </button>
        )}
        <div className="sw-character-forge__rail-title">
          <span>Character instrument</span>
          <strong>First adventure</strong>
        </div>
        <nav hidden={phone && !stepsOpen}>
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-current={step === item.id ? "step" : undefined}
              className={
                step === item.id
                  ? "is-active"
                  : completedSteps[item.id]
                    ? "is-complete"
                    : ""
              }
              onClick={() => {
                if (
                  index > 0 &&
                  (!state.name.trim() || !state.concept.trim())
                ) {
                  setStep("identity");
                  setError(
                    "Name and describe your character before choosing rules.",
                  );
                  return;
                }
                if (index > 1 && attrSum !== 10) {
                  setStep("foundation");
                  setError("Your three attributes must add up to 10 first.");
                  return;
                }
                if (index > 2 && !mirrorsValid) {
                  setStep("mirroring");
                  setError(
                    "Your selected weaknesses no longer fit this level’s debt limit.",
                  );
                  return;
                }
                if (
                  index > 3 &&
                  (!packageComplete || budgetLedger.aboveNextLevel)
                ) {
                  setStep("packages");
                  setError(
                    "Choose a complete starting set within your point budget first.",
                  );
                  return;
                }
                setError(null);
                setStep(item.id);
                setStepsOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span className="sw-character-forge__step-number">
                {completedSteps[item.id] ? <Check aria-hidden /> : item.eyebrow}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>
        <div
          className="sw-character-forge__reading"
          hidden={phone && !stepsOpen}
        >
          {step === "foundation" || step === "mirroring" ? (
            <>
              <span>For starting choices</span>
              <strong>{budget + mirrorCredit} BU</strong>
              <small>
                {budget} base · {mirrorCredit} weakness credit
              </small>
            </>
          ) : step !== "identity" ? (
            <>
              <span>Build points left</span>
              <strong>{budget + mirrorCredit - packageCost} BU</strong>
              <small>
                {packageCost} spent · {mirrorCredit} bonus
              </small>
            </>
          ) : null}
          <small>Draft saves on this device</small>
          <button type="button" className="sw-forge-reset" onClick={startOver}>
            Start over
          </button>
        </div>
      </ForgeProgressRail>

      <ForgeWorkbench header={<>
        {phone ? (
          <button
            type="button"
            className="sw-forge-reset"
            onClick={() => setCreationMode(null)}
          >
            Change creation mode
          </button>
        ) : null}
        <header className="sw-character-forge__header" hidden={phone}>
          <button
            type="button"
            className="sw-forge-reset"
            onClick={() => setCreationMode(null)}
          >
            Change creation mode
          </button>
          <div>
            <span>
              Step {currentIndex + 1} of {STEPS.length}
            </span>
            <h2 ref={stepHeading} tabIndex={-1}>
              {STEPS[currentIndex]!.label}
            </h2>
          </div>
        </header>

 </>} footer={        <footer className="sw-character-forge__footer">
          <CreationBudgetDisclosure remaining={budgetLedger.remaining} warning={budgetLedger.needsDmApproval}>
          <div
            className="sw-character-forge__footer-reading"
          >
            <span>{state.name.trim() || "Your character"}</span>
            {step === "identity" ? (
              <>
                <strong>Start with their story</strong>
                <small>Rules come next</small>
              </>
            ) : step === "foundation" || step === "mirroring" ? (
              <>
                <strong>{budget + mirrorCredit} BU for choices</strong>
                <small>
                  {mirrorCredit
                    ? `${mirrorCredit} BU from weakness`
                    : `${budget} BU at level ${effectiveLevel}`}
                </small>
              </>
            ) : (
              <>
                <strong>{budgetLedger.remaining} BU left</strong>
                <small>
                  {budgetLedger.baseUsed}/{budget} normal BU · {budgetLedger.debtUsed}/{mirrorCredit} drawback BU · {budgetLedger.overflow} overflow BU
                </small>
              </>
            )}
          </div>
          {budgetLedger.needsDmApproval ? <small className="sw-budget-warning">{budgetLedger.aboveNextLevel ? `Above next level’s ${budgetLedger.nextLevelBudget} BU ceiling.` : "Over agreed budget — check with your DM before creating."}</small> : null}
          </CreationBudgetDisclosure>
          <div className="sw-character-forge__footer-actions">
            {currentIndex > 0 ? (
              <button
                type="button"
                className="sw-metal-button sw-metal-button--secondary"
                onClick={() => {
                  setStep(STEPS[currentIndex - 1]!.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <ArrowLeft aria-hidden /> Back
              </button>
            ) : null}
            {currentIndex < STEPS.length - 1 ? (
              <button
                type="button"
                className="sw-metal-button sw-metal-button--primary"
                onClick={goNext}
              >
                {step === "identity"
                  ? "Foundation"
                  : step === "foundation"
                    ? "Drawbacks"
                    : step === "mirroring"
                      ? "Starting access"
                      : "Review"}{" "}
                <ArrowRight aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className={`sw-metal-button sw-metal-button--primary${budgetLedger.needsDmApproval ? " sw-budget-overflow" : ""}`}
                onClick={submit}
                disabled={isPending || budgetLedger.aboveNextLevel}
              >
                {isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Check aria-hidden />
                )}
                {isPending ? "Creating…" : "Create character"}
              </button>
            )}
          </div>
        </footer>}>
          <details className="sw-forge-step-help" open={!phone}>
            <summary>Help with this step</summary>
            <div className="sw-forge-guidance">
              <span aria-hidden>✦</span>
              <div>
                <strong>{STEP_GUIDANCE[step].title}</strong>
                <p>{STEP_GUIDANCE[step].description}</p>
              </div>
            </div>
          </details>
          {error ? (
            <p className="sw-forge-error" role="alert">
              {error}
            </p>
          ) : null}
          {step === "foundation" ? <CreationGuidance /> : null}
          {step === "packages" ? (
            <StartingAccessStep
              selectionLimit={budgetLedger.nextLevelBudget + mirrorCredit}
              options={options}
              selectedIds={selectedPrimitiveIds}
              mirrorCredit={mirrorCredit}
              loading={catalogLoading}
              togglePrimitive={togglePrimitive}
              onClearSelection={() => setSelectedPrimitiveIds([])}
              packageCost={packageCost}
              budget={budget}
              effectiveLevel={effectiveLevel}
              shuffleBudget={Math.min(
                packageShuffleBudget ?? 25,
                budget + mirrorCredit,
              )}
              onShuffleBudgetChange={setPackageShuffleBudget}
              suggestions={packageSuggestions}
              savedPackages={savedPackages}
              onChoosePackage={keepPackage}
              onRemovePackage={removePackage}
              onShuffle={shufflePackages}
            />
          ) : null}
          {step === "identity" ? (
            <IdentityStep
              state={state}
              setField={setField}
              setState={setState}
            />
          ) : null}
          {step === "foundation" ? (
            <FoundationStep
              state={state}
              setField={setField}
              setState={setState}
              attrSum={attrSum}
              budget={budget}
              effectiveLevel={effectiveLevel}
            />
          ) : null}
          {step === "mirroring" ? (
            <MirroringStep
              selectedOptions={primitives}
              options={mirrorOptions}
              selectedIds={mirroredPrimitiveIds}
              onSelect={keepMirror}
              onRemove={removeMirror}
              savedIds={savedMirrorIds}
              suggestionIds={mirrorSuggestionIds}
              shuffleSeed={mirrorShuffleSeed}
              onShuffle={shuffleMirrors}
              budget={budget}
              ceiling={mirrorCeiling}
              characterName={state.name}
            />
          ) : null}
          {step === "finishing" ? (
            <FinishingStep
              state={state}
              setField={setField}
              budget={budget}
              effectiveLevel={effectiveLevel}
              selected={primitives.filter((item) =>
                selectedPrimitiveIds.includes(item.id),
              )}
              packageCost={packageCost}
              mirrorCredit={mirrorCredit}
              mirrorName={
                selectedMirrors.map((item) => item.name).join(", ") || null
              }
              onEditFoundation={() => {
                setStep("foundation");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onEditAccess={() => {
                setStep("packages");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ) : null}
      </ForgeWorkbench>
      <DomainAuthoringDrawer onSaved={handleDomainSaved} />
    </div>
  );
}

const HERITAGE_LABELS: Record<QuickbuildKind, string> = {
  LINEAGE: "Lineage",
  UPBRINGING: "Upbringing",
  MANIFEST: "Manifest",
};
type QuickItem = {
  id: string;
  name: string;
  description?: string;
  itemType?: string;
  size?: string;
  slotCost?: number;
  isTwoHanded?: boolean;
  iconSource?: string | null;
  iconKey?: string | null;
  iconUrl?: string | null;
  iconColor?: string | null;
  unavailable?: boolean;
  buCost?: number;
  computedBu?: number;
};

function BudgetBadge({ amount, label, tone = "gold" }: { amount: number | string; label: string; tone?: "gold" | "teal" | "copper" | "warning" }) {
  return <span className={`sw-bu-badge sw-bu-badge--${tone}`}><b>{amount}<i> BU</i></b><span>{label}</span></span>;
}

/** Keep the action and remaining budget visible; reveal the detailed ledger on demand. */
function CreationBudgetDisclosure({ remaining, items, warning = false, children }: { remaining: number; items?: number; warning?: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return <div className={`sw-creation-budget${warning ? " has-warning" : ""}${expanded ? " is-expanded" : ""}`}>
    <button type="button" className="sw-creation-budget__toggle" aria-expanded={expanded} aria-controls={panelId} aria-label={`${remaining} Build Units remaining${items !== undefined ? `, ${items} item Build Units separately` : ""}. ${warning ? "Budget needs DM review. " : ""}${expanded ? "Hide" : "Show"} budget details`} onClick={() => setExpanded(value => !value)}>
      <span><b>{remaining} BU</b><small>{warning ? "DM review" : "remaining"}</small></span>
      {items !== undefined ? <span className="sw-creation-budget__items"><b>{items}</b><small>item BU</small></span> : null}
      <ChevronDown size={15} aria-hidden />
    </button>
    <div id={panelId} className="sw-creation-budget__details">{children}</div>
  </div>;
}

function CreationGuidance() {
  return <details className="sw-creation-guidance">
    <summary><span>New to SwordWeave?</span><ChevronDown size={16} aria-hidden /></summary>
    <div>
      <p><strong>Build a starting point.</strong> You do not need to plan a whole character at once. Choose a name and a simple idea; library previews explain what each choice lets you do.</p>
      <p><strong>Build Units (BU) buy primitives.</strong> Primitives are the building blocks of your abilities. Heritages and capabilities gather them into ready-to-use ideas, and a shared primitive is paid for once.</p>
      <p><strong>Leave room to grow.</strong> We recommend keeping some BU unspent. On the sheet, you can buy or invent a primitive during play—even in combat when it fits the scene and your table agrees—and combine what you own into new actions.</p>
      <p><strong>Choose your start together.</strong> Level 1 gives you a small foundation. Consider level 3–6 for more choices, or level 10 if your group already knows tabletop games. Levels are a familiar reference for budgets, not a complete measure of power; there is no level-20 maximum.</p>
      <a href="/rules" target="_blank" rel="noopener noreferrer">Read the play guide <ArrowRight size={14} aria-hidden /></a>
    </div>
  </details>;
}


function QuickBuildForm({
  accountId,
  primitives,
  options,
  onChangeMode,
  onRefreshPrimitives,
  primitivesLoading,
}: {
  accountId:string|null;
  primitives: PrimitiveOption[];
  options: Record<PackageSlot, PrimitiveOption[]>;
  onChangeMode: () => void;
  onRefreshPrimitives: () => Promise<unknown>;
  primitivesLoading: boolean;
}) {
  const router = useRouter();
  const draftKey=accountId?creationDraftKey(accountId,"quick"):null;
  const [returnNotice,setReturnNotice]=useState("");
  const [creationDraftId,setCreationDraftId]=useState<string|null>(null);
  const phone = useIsMobile();
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [selection, setSelection] = useState<QuickbuildSelection>({
    ...EMPTY_QUICKBUILD,
  });
  const [catalog, setCatalog] = useState<QuickbuildCatalog | null>(null);
  const [packageIds, setPackageIds] = useState<number[]>([]);
  const [mirrorIds, setMirrorIds] = useState<number[]>([]);
  const [shuffleLimits, setShuffleLimits] = useState<QuickbuildShuffleLimits>({ mode: "total", bu: null, overrides: {} });
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [kindLimitsOpen, setKindLimitsOpen] = useState<QuickbuildKind | null>(null);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [itemDetails, setItemDetails] = useState<Record<string, QuickItem>>({});
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [picker, setPicker] = useState<QuickbuildKind | "ITEM" | null>(null);
  const [preview, setPreview] = useState<{
    kind: "heritage" | "item";
    id: string;
  } | null>(null);
  const [savedPackages, setSavedPackages] = useState<PackagePreset[]>([]);
  const [packageSuggestions, setPackageSuggestions] = useState<
    PackagePreset[] | null
  >(null);
  const [packageSeed, setPackageSeed] = useState(0);
  const [packageShuffleBudget, setPackageShuffleBudget] = useState<
    number | null
  >(null);
  const [savedMirrorIds, setSavedMirrorIds] = useState<number[]>([]);
  const [mirrorSuggestionIds, setMirrorSuggestionIds] = useState<
    number[] | null
  >(null);
  const [mirrorSeed, setMirrorSeed] = useState(0);
  const [mirrorSeenIds, setMirrorSeenIds] = useState<number[]>([]);
  const budget =
    state.sizingMode === "bu"
      ? state.customBu
      : cumulativeBuForLevel(state.level);
  const effectiveLevel =
    state.sizingMode === "bu"
      ? impliedLevelForBudget(state.customBu)
      : state.level;
  const ceiling = maxBuDebtForLevel(effectiveLevel);
  const mergedCatalog = useMemo<QuickbuildCatalog>(
    () => ({
      heritages: catalog?.heritages ?? [],
      primitives: [
        ...new Map(
          [
            ...(catalog?.primitives ?? []),
            ...primitives.map((p) => ({
              id: p.id,
              buCost: p.buCost,
              mirrorBuCredit: p.mirrorBuCredit ?? p.buCost,
              category: p.category,
            })),
          ].map((p) => [p.id, p]),
        ).values(),
      ],
    }),
    [catalog, primitives],
  );
  const cost = useMemo(
    () => quickbuildCost(mergedCatalog, selection, packageIds, mirrorIds),
    [mergedCatalog, selection, packageIds, mirrorIds],
  );
  const heritageCost = useMemo(
    () => quickbuildCost(mergedCatalog, selection),
    [mergedCatalog, selection],
  );
  const packageCost = Math.max(0, cost.positiveCost - heritageCost.positiveCost);
  const budgetLedger = creationBudget({ level: effectiveLevel, budget, positiveSpent: cost.positiveCost, mirrorCredit: cost.mirrorCredit });
  const itemBu = (item?: QuickItem) => Math.max(0, Number(item?.buCost ?? 0)) + Math.abs(Number(item?.computedBu ?? 0));
  const itemBudget = itemIds.reduce((sum, id) => sum + itemBu(itemDetails[id]), 0);
  const heritageSplit = QUICKBUILD_KINDS.map((kind, index) => {
    const before = { ...EMPTY_QUICKBUILD };
    const after = { ...EMPTY_QUICKBUILD };
    QUICKBUILD_KINDS.forEach((k, i) => { if (i < index) before[k] = selection[k]; if (i <= index) after[k] = selection[k]; });
    return { kind, cost: quickbuildCost(mergedCatalog, after).netCost - quickbuildCost(mergedCatalog, before).netCost };
  });
  const missingAccess = missingCreationAccess(cost.expansion, mergedCatalog.primitives);
  const inheritedIds = useMemo(() => new Set(heritageCost.expansion.primitives.filter(p => !p.isMirrored).map(p => p.primitiveId)), [heritageCost]);
  const quickOptions = useMemo(() => Object.fromEntries(Object.entries(options).map(([slot, entries]) => [slot, entries.map(p => inheritedIds.has(p.id) ? { ...p, buCost: 0 } : p)])) as Record<PackageSlot, PrimitiveOption[]>, [options, inheritedIds]);
  const accessBudget = Math.max(0, budget - heritageCost.positiveCost);
  const availableAccess = Math.max(
    0,
    budget - heritageCost.positiveCost + cost.mirrorCredit,
  );
  const remainingMirrorCeiling = Math.max(
    0,
    ceiling - heritageCost.mirrorCredit,
  );
  const mirrorOptions = useMemo(
    () => eligibleMirrorCandidates(primitives, remainingMirrorCeiling),
    [primitives, remainingMirrorCeiling],
  );
  const attrSum = state.attrPhysical + state.attrMental + state.attrMagical;
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((previous) => ({ ...previous, [key]: value }));
  const nameInput = useRef<HTMLInputElement>(null);
  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/characters/quickbuild/catalog", {
        signal: signal ?? null,
      });
      if (!response.ok)
        throw Error("The heritage library could not be loaded.");
      const next = (await response.json()) as QuickbuildCatalog;
      if (!signal?.aborted) {
        setCatalog(next);
        setCatalogError(null);
      }
      return next;
    } catch (reason) {
      if (!signal?.aborted)
        setCatalogError(
          reason instanceof Error
            ? reason.message
            : "The heritage library could not be loaded.",
        );
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadCatalog(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadCatalog]);
  useEffect(() => {
    if(!draftKey)return;
    const timer = window.setTimeout(() => {
      try {
        const record=accountId?readCreationReturn(localStorage,new URL(window.location.href).searchParams.get("creationReturn"),accountId):null;
        const raw = window.localStorage.getItem(record?.mode==="quick"?`${draftKey}:${record.draftId}`:draftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          setCreationDraftId(draft.draftId??crypto.randomUUID());
          if (draft.state)
            setState({
              ...INITIAL_STATE,
              ...draft.state,
              backstory: parseBackstory(draft.state.backstory),
            });
          if (draft.shuffleLimits) {
            const raw = draft.shuffleLimits;
            const overrides: QuickbuildShuffleLimits["overrides"] = {};
            for (const kind of QUICKBUILD_KINDS) {
              const value = raw.overrides?.[kind];
              if (typeof value === "number" && Number.isFinite(value) && value >= 0) overrides[kind] = value;
            }
            setShuffleLimits({ mode: raw.mode === "each" ? "each" : "total", bu: typeof raw.bu === "number" && Number.isFinite(raw.bu) && raw.bu >= 0 ? raw.bu : null, overrides });
          }
          if (draft.selection)
            setSelection({ ...EMPTY_QUICKBUILD, ...draft.selection });
          if (Array.isArray(draft.packageIds))
            setPackageIds(draft.packageIds.filter(Number.isInteger));
          if (Array.isArray(draft.mirrorIds))
            setMirrorIds(draft.mirrorIds.filter(Number.isInteger));
          if (Array.isArray(draft.itemIds))
            setItemIds(
              draft.itemIds.filter((id: unknown) => typeof id === "string"),
            );
          if (Array.isArray(draft.savedMirrorIds))
            setSavedMirrorIds(draft.savedMirrorIds.filter(Number.isInteger));
          if (Array.isArray(draft.savedPackages))
            setSavedPackages(
              draft.savedPackages
                .filter((p: PackagePreset) => p && Array.isArray(p.items))
                .slice(-4),
            );
        }
      } catch {
        /* A local draft is optional. */
      }
      setCreationDraftId(current=>current??crypto.randomUUID());setLoaded(true);
      if (window.matchMedia("(min-width:768px)").matches)
        nameInput.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountId,draftKey]);
  useEffect(() => {
    if (loaded&&draftKey)
      try {
        writeCreationDraft(window.localStorage,
          draftKey,creationDraftId,
          JSON.stringify({
            draftId:creationDraftId,
            state,
            selection,
            shuffleLimits,
            packageIds,
            mirrorIds,
            itemIds,
            savedMirrorIds,
            savedPackages,
          }),
        );
      } catch {
        /* Storage can be unavailable. */
      }
  }, [
    loaded,
    draftKey,
    creationDraftId,
    state,
    selection,
    shuffleLimits,
    packageIds,
    mirrorIds,
    itemIds,
    savedMirrorIds,
    savedPackages,
  ]);
  useCreationAuthoringReturn(accountId,"quick",loaded,creationDraftId,async entry=>{
    if(entry.targetType==="PRIMITIVE"){await onRefreshPrimitives();setPackageIds(previous=>[...new Set([...previous,Number(entry.targetId)])]);}
    else if(entry.targetType==="ITEM"){setItemIds(previous=>[...new Set([...previous,entry.targetId])]);}
    else if(entry.targetType.endsWith("_TEMPLATE")){const refreshed=await loadCatalog();if(!refreshed?.heritages.some(h=>h.id===entry.targetId))throw new Error("The saved heritage could not be loaded. Try returning again.");const kind=entry.targetType.replace("_TEMPLATE","") as QuickbuildKind;setSelection(previous=>({...previous,[kind]:entry.targetId}));}
    else throw new Error("Add this entry from the character sheet after creation.");
    setReturnNotice(`${entry.name} selected for your character.`);
  },message=>setError(message));
  useEffect(() => {
    const missing = itemIds.filter((id) => !itemDetails[id]);
    if (!missing.length) return;
    const controller = new AbortController();
    void Promise.all(
      missing.map(async (id) => {
        try {
          const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw Error("Item unavailable");
          const data = await response.json();
          if (!data.item?.id) throw Error("Item unavailable");
          return [id, data.item as QuickItem] as const;
        } catch {
          return [
            id,
            { id, name: "Unavailable item", unavailable: true } as QuickItem,
          ] as const;
        }
      }),
    ).then((entries) => {
      if (!controller.signal.aborted)
        setItemDetails((previous) => ({
          ...previous,
          ...Object.fromEntries(entries),
        }));
    });
    return () => controller.abort();
  }, [itemIds, itemDetails]);

  function shuffle(only?: QuickbuildKind) {
    setSelection(
      shuffleQuickbuild(
        mergedCatalog,
        budget,
        selection,
        packageIds,
        mirrorIds,
        only,
        Math.random,
        ceiling,
        shuffleLimits,
      ),
    );
    setError(null);
  }
  function keepMirror(id: number | null) {
    if (id === null) {
      setMirrorIds([]);
      return;
    }
    if (!mirrorOptions.some((p) => p.id === id)) return;
    const next = mirrorIds.includes(id)
      ? mirrorIds.filter((p) => p !== id)
      : [...mirrorIds, id];
    if (
      quickbuildCost(mergedCatalog, selection, packageIds, next).mirrorCredit >
      ceiling
    )
      return;
    setMirrorIds(next);
    setSavedMirrorIds((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }
  function shuffleMirrors() {
    const seed = Math.floor(Math.random() * 0x1_0000_0000);
    const excluded = [...new Set([...savedMirrorIds, ...mirrorIds])];
    const affordable = mirrorOptions.filter(
      (p) => (p.mirrorBuCredit ?? p.buCost) <= ceiling - cost.mirrorCredit,
    );
    const previous =
      mirrorSuggestionIds ??
      chooseMirrorSuggestions(affordable, state.name, mirrorSeed, excluded).map(
        (p) => p.id,
      );
    const seen = [...new Set([...mirrorSeenIds, ...previous])];
    const next = chooseMirrorSuggestions(
      affordable,
      state.name,
      seed,
      excluded,
      previous,
      3,
      seen,
    ).map((p) => p.id);
    setMirrorSeed(seed);
    setMirrorSuggestionIds(next);
    setMirrorSeenIds([...new Set([...seen, ...next])]);
  }
  function repricePackage(preset: PackagePreset): PackagePreset {
    const items = preset.items.map(p => inheritedIds.has(p.id) ? { ...p, buCost: 0 } : { ...p, buCost: primitives.find(definition => definition.id === p.id)?.buCost ?? p.buCost });
    return { ...preset, items, cost: items.reduce((sum, p) => sum + p.buCost, 0) };
  }
  function keepPackage(preset: PackagePreset) {
    setPackageIds(preset.items.map((p) => p.id));
    setSavedPackages((previous) =>
      previous.some((p) => p.key === preset.key)
        ? previous
        : [...previous, preset].slice(-4),
    );
  }
  function shufflePackages(requested: number) {
    const cap = Math.min(Math.max(0, requested), availableAccess);
    const seed = packageSeed + 1;
    const previous =
      packageSuggestions ??
      recommendedPackages(quickOptions, effectiveLevel, cap, 0);
    const excluded = savedPackages.map((p) => p.key);
    const fresh = recommendedPackages(quickOptions, effectiveLevel, cap, seed, [
      ...excluded,
      ...previous.map((p) => p.key),
    ]);
    setPackageShuffleBudget(cap);
    setPackageSeed(seed);
    setPackageSuggestions(
      fresh.length
        ? fresh
        : recommendedPackages(quickOptions, effectiveLevel, cap, seed, excluded),
    );
  }
  const handleDomainSaved = useCallback(
    (id: number) => {
      void onRefreshPrimitives();
      setPackageIds((previous) =>
        previous.includes(id) ? previous : [...previous, id],
      );
    },
    [onRefreshPrimitives],
  );

  function submit() {
    const missing = QUICKBUILD_KINDS.some(
      (kind) =>
        selection[kind] &&
        !mergedCatalog.heritages.some(
          (h) => h.id === selection[kind] && h.kind === kind,
        ),
    );
    const invalidMirror = mirrorIds.some(
      (id) => !mirrorOptions.some((p) => p.id === id),
    );
    const missingItems = itemIds.some(
      (id) => !itemDetails[id] || itemDetails[id]?.unavailable,
    );
    if (
      !state.name.trim() ||
      attrSum !== 10 ||
      !catalog ||
      missing ||
      invalidMirror ||
      missingItems ||
      cost.mirrorCredit > ceiling ||
      budgetLedger.aboveNextLevel ||
      missingAccess.length > 0
    ) {
      setError(
        !state.name.trim()
          ? "Give your character a name."
          : attrSum !== 10
            ? "Your attributes must add up to 10."
            : !catalog
              ? "Wait for the heritage library to load."
              : missing
                ? "A selected heritage is no longer available. Choose another."
                : missingItems
                  ? "Remove unavailable equipment or wait for its preview to load."
                  : invalidMirror || cost.mirrorCredit > ceiling
                    ? "Choose drawbacks within this level’s debt limit."
                    : missingAccess.length
                      ? `Choose a ${missingAccess.join(" and ")} in your heritages or starting access before creating. Items do not grant starting access.`
                    : "These purchases exceed the next level’s BU ceiling. Remove a choice or adjust the budget.",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creationMode: "quick",
            name: state.name.trim(),
            portraitUrl: state.portraitUrl.trim(),
            portraitFrame: state.portraitFrame,
            level: effectiveLevel,
            startingBu: 25,
            buBudget: state.sizingMode === "bu" ? state.customBu : null,
            buSpent: cost.positiveCost,
            attrPhysical: state.attrPhysical,
            attrMental: state.attrMental,
            attrMagical: state.attrMagical,
            attrProficient: state.attrProficient,
            backstory: {
              ...state.backstory,
              origin: [state.concept.trim(), state.backstory.origin.trim()]
                .filter(Boolean)
                .join("\n\n"),
            },
            heritages: QUICKBUILD_KINDS.filter((kind) => selection[kind]).map(
              (kind) => ({ id: selection[kind] }),
            ),
            primitiveInstances: [
              ...packageIds.map((primitiveId) => ({
                primitiveId,
                isMirrored: false,
              })),
              ...mirrorIds.map((primitiveId) => ({
                primitiveId,
                isMirrored: true,
              })),
            ],
            itemsBySource: {
              PERSONAL: itemIds.map((id) => ({ id, quantity: 1 })),
            },
            sourceOrigin: "manual",
            isPublic: false,
            practiceSlices: {},
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.character?.id)
          throw Error(data.error ?? "Your character could not be created.");
        try {
          if(draftKey)window.localStorage.removeItem(draftKey);
        } catch {
          /* Storage can be unavailable. */
        }
        router.push(`/characters/${data.character.id}?mode=PLAY`);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Your character could not be created.",
        );
      }
    });
  }

  return (
    <div className="sw-quickbuild">
      {phone&&<CreationAtelierAction accountId={loaded?accountId:null} draftId={creationDraftId} mode="quick" quick persistDraft={()=>{if(!draftKey)throw new Error("Wait for your account to load.");const data=JSON.stringify({draftId:creationDraftId,state,selection,shuffleLimits,packageIds,mirrorIds,itemIds,savedMirrorIds,savedPackages});localStorage.setItem(draftKey,data);localStorage.setItem(`${draftKey}:${creationDraftId}`,data);}}/>}
      {returnNotice&&<p role="status" className="sw-forge-return-notice text-sm text-primary">{returnNotice}</p>}
      <header className="sw-quickbuild__heading">
        <h2>Quickbuild</h2>
        <button type="button" className="sw-forge-reset" onClick={onChangeMode}>
          Change creation mode
        </button>
      </header>
      <CreationGuidance />
      <QuickbuildSection number="01" title="Your character" className="sw-quickbuild__identity" reading={<>Level {effectiveLevel}<BudgetBadge amount={budget} label="budget" /></>} subtitle="Choose a name and starting budget. A portrait and a short backstory are optional.">
        <div className="sw-quickbuild__identity-grid">
          <div className="sw-quickbuild__identity-fields">
            <ForgeField label="Character name" required>
              <input
                value={state.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="e.g. Vex the Quick"
                ref={nameInput}
              />
            </ForgeField>
            <BudgetControl
              state={state}
              setField={setField}
              effectiveLevel={effectiveLevel}
            />
            <p className="sw-quickbuild__starting-budget">
              Level {effectiveLevel} · <strong>{budget} BU</strong> before
              optional drawback credit
            </p>
            <p className="sw-creation-start-note">Keep some BU unspent for abilities you discover on the sheet or during play.</p>
            <ForgeField
              label="Backstory"
              hint="One paragraph is enough. You can develop their story on the sheet."
            >
              <textarea
                rows={4}
                value={state.concept}
                onChange={(event) => setField("concept", event.target.value)}
                placeholder="Who are they, and what brings them to this adventure?"
              />
            </ForgeField>
          </div>
          <div className="sw-quickbuild__identity-portrait">
            <PortraitInput
              value={state.portraitUrl}
              onChange={(value) => setField("portraitUrl", value)}
              frame={state.portraitFrame}
              onFrameChange={(value) => setField("portraitFrame", value)}
              characterName={state.name}
            />
          </div>
        </div>
      </QuickbuildSection>
        <QuickbuildSection number="02" title="Consider drawbacks" reading={<BudgetBadge amount={Math.max(0, cost.mirrorCredit - heritageCost.mirrorCredit)} label="credit" tone="copper" />} subtitle="Optional: accept a weakness to gain extra Build Units before choosing your heritages.">
          <div className="sw-forge-disclosure__body">
            {heritageCost.mirrorCredit ? (
              <p>
                Your heritages use {heritageCost.mirrorCredit} of the {ceiling}{" "}
                BU credit allowance. {remainingMirrorCeiling} BU remains for
                optional drawbacks.
              </p>
            ) : null}
            <MirroringStep
              options={mirrorOptions}
              selectedOptions={primitives}
              selectedIds={mirrorIds}
              onSelect={keepMirror}
              onRemove={(id) => {
                setSavedMirrorIds((previous) =>
                  previous.filter((p) => p !== id),
                );
                setMirrorIds((previous) => previous.filter((p) => p !== id));
              }}
              savedIds={savedMirrorIds}
              suggestionIds={mirrorSuggestionIds}
              shuffleSeed={mirrorSeed}
              onShuffle={shuffleMirrors}
              budget={budget}
              ceiling={remainingMirrorCeiling}
              inheritedCredit={heritageCost.mirrorCredit}
              characterName={state.name}
              quick
            />
            {!primitivesLoading &&
            mirrorIds.some((id) => !mirrorOptions.some((p) => p.id === id)) ? (
              <p role="alert">
                A chosen drawback no longer fits this level or heritage.{" "}
                <button type="button" onClick={() => setMirrorIds([])}>
                  Clear drawbacks
                </button>
              </p>
            ) : null}
          </div>
      </QuickbuildSection>
      <QuickbuildSection number="03" title="Choose your heritages" className="sw-quickbuild__heritages" reading={<><BudgetBadge amount={heritageCost.netCost} label="heritages total" />{heritageSplit.map(({ kind, cost: part }) => <BudgetBadge key={kind} amount={part} label={HERITAGE_LABELS[kind]} tone="teal" />)}</>} subtitle="Browse and preview each library, or shuffle for a combination that fits your budget.">
        <header>
          <div className="sw-quickbuild__shuffle-actions">
            <button type="button" className="sw-quickbuild__limit-toggle" aria-label="Set heritage shuffle BU limits" aria-expanded={limitsOpen} onClick={() => setLimitsOpen(!limitsOpen)}><SlidersHorizontal size={17} /><span>BU limits</span></button>
            <button type="button" className="sw-metal-button sw-metal-button--secondary" onClick={() => shuffle()} disabled={!catalog}><Shuffle size={18} /> Shuffle all</button>
          </div>
        </header>
        {limitsOpen ? <div className="sw-quickbuild__shuffle-limits">
          <label><span>Maximum BU</span><input type="number" min="0" step="1" aria-label="Heritage shuffle maximum BU" placeholder={String(budget)} value={shuffleLimits.bu ?? ""} onChange={event => setShuffleLimits(previous => ({ ...previous, bu: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <div role="group" aria-label="Heritage shuffle budget mode"><button type="button" aria-pressed={shuffleLimits.mode === "total"} onClick={() => setShuffleLimits(previous => ({ ...previous, mode: "total" }))}>Total budget</button><button type="button" aria-pressed={shuffleLimits.mode === "each"} onClick={() => setShuffleLimits(previous => ({ ...previous, mode: "each" }))}>For each heritage</button></div>
          <p>{shuffleLimits.mode === "total" ? "The combined heritage cost stays within this limit. Individual limits also apply." : "Each heritage uses this limit unless you override it on its card."} Shared primitives are paid once. Shuffling always respects your character budget and drawback allowance.</p>
          <button type="button" onClick={() => setShuffleLimits({ mode: "total", bu: null, overrides: {} })}>Reset heritage shuffle limits</button>
        </div> : null}
        {catalogError ? (
          <p role="alert">
            {catalogError}{" "}
            <button type="button" onClick={() => void loadCatalog()}>
              Retry library
            </button>
          </p>
        ) : null}
        {!catalog && !catalogError ? (
          <p role="status">
            <Loader2 size={16} className="animate-spin" /> Opening the heritage
            library…
          </p>
        ) : null}
        <div className="sw-quickbuild__roots">
          {QUICKBUILD_KINDS.map((kind) => {
            const selected = catalog?.heritages.find(
              (h) => h.id === selection[kind] && h.kind === kind,
            );
            const label = HERITAGE_LABELS[kind];
            const rootActions = (
                <div className="sw-quickbuild__root-actions">
                  <button
                    type="button"
                    className="sw-metal-button sw-metal-button--secondary"
                    onClick={() => setPicker(kind)}
                    disabled={!catalog}
                  >
                    <Search size={16} />{" "}
                    {selected ? <>Change <span className="sw-quickbuild__change-kind">{label.toLowerCase()}</span></> : `Browse ${label.toLowerCase()}s`}
                  </button>
                  {selected ? (
                    <button
                      type="button"
                      className="sw-quickbuild__remove"
                      aria-label={`Remove ${selected.name}`}
                      onClick={() =>
                        setSelection((previous) => ({
                          ...previous,
                          [kind]: "",
                        }))
                      }
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
            );
            return (
              <details open
                key={kind}
                className={`sw-quickbuild__root${selected ? " is-chosen" : ""}`}
              >
                <summary className="sw-quickbuild__root-summary"><span><b>{label}</b><small>{selected?.name ?? "None chosen"}<BudgetBadge amount={heritageSplit.find(part => part.kind === kind)?.cost ?? 0} label="toward total" tone="teal" /></small></span><ChevronDown aria-hidden /></summary>
                <div className="sw-quickbuild__root-body">
                <div className="sw-quickbuild__root-heading">
                  <span>Shuffle & limits</span>
                  <div className="sw-quickbuild__shuffle-actions">
                  <button type="button" className="sw-quickbuild__limit-toggle" aria-label={`Set ${label.toLowerCase()} BU limit`} aria-expanded={kindLimitsOpen === kind} onClick={() => setKindLimitsOpen(kindLimitsOpen === kind ? null : kind)}><SlidersHorizontal size={15} />{shuffleLimits.overrides[kind] !== undefined ? <small>{shuffleLimits.overrides[kind]} BU</small> : null}</button>
                  <button
                    type="button"
                    aria-label={`Shuffle ${label.toLowerCase()}`}
                    onClick={() => shuffle(kind)}
                    disabled={!catalog}
                  >
                    <Shuffle size={17} />
                  </button>
                  </div>
                </div>
                {kindLimitsOpen === kind ? <div className="sw-quickbuild__kind-limit"><label><span>{label} maximum BU</span><input type="number" min="0" step="1" aria-label={`${label} maximum BU`} placeholder={shuffleLimits.mode === "each" ? String(shuffleLimits.bu ?? budget) : "No individual limit"} value={shuffleLimits.overrides[kind] ?? ""} onChange={event => setShuffleLimits(previous => { const overrides = { ...previous.overrides }; if (event.target.value === "") delete overrides[kind]; else overrides[kind] = Math.max(0, Number(event.target.value) || 0); return { ...previous, overrides }; })} /></label><small>{shuffleLimits.mode === "total" ? "Also respects the combined total limit." : "Overrides the shared per-heritage limit."} Leave blank to inherit.</small></div> : null}
                {selected ? (
                  <>
                    <button
                      type="button"
                      className="sw-quickbuild__selected-portrait"
                      data-preview-trigger="true"
                      aria-label={`Preview ${selected.name}`}
                      onClick={() =>
                        setPreview({ kind: "heritage", id: selected.id })
                      }
                    >
                      {selected.imageUrl ? (
                        <img src={selected.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden>◇</span>
                      )}
                      <span className="sw-quickbuild__portrait-hint">
                        View full preview <Search size={14} />
                      </span>
                    </button>
                    <div className="sw-quickbuild__root-copy">
                    <div className="sw-quickbuild__root-title">
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({ kind: "heritage", id: selected.id })
                        }
                      >
                        {selected.name}
                      </button>
                      <span>{selected.cost} BU</span>
                    </div>
                    <details className="sw-quickbuild__root-description"><summary>About {selected.name}</summary><p>{selected.description || "Open the preview to explore this heritage."}</p></details>
                    <details className="sw-quickbuild__rules" open={!phone}>
                      <summary>Rules & abilities <small>{selected.rules?.length ?? 0}</small></summary>
                      {selected.rules?.length ? (
                        <ul>
                          {selected.rules.slice(0, 4).map((rule, index) => (
                            <li key={`${rule.primitiveId}:${index}`}>
                              <span data-copy={rule.mechanical ? "mechanical" : "narrative"}>{rule.text}</span>
                              {rule.source !== "primitive" ? (
                                <small>
                                  In{" "}
                                  {rule.source === "effect"
                                    ? "an effect"
                                    : "a capability"}
                                </small>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Read the complete composition in its preview.</p>
                      )}
                      {(selected.rules?.length ?? 0) > 4 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({ kind: "heritage", id: selected.id })
                          }
                        >
                          View all {selected.rules!.length} rules
                        </button>
                      ) : null}
                    </details>
                    {rootActions}
                    </div>
                  </>
                ) : (
                  <div className="sw-quickbuild__root-empty">
                    <span aria-hidden>◇</span>
                    <strong>
                      {kind === "LINEAGE"
                        ? "What they are"
                        : kind === "UPBRINGING"
                          ? "What shaped them"
                          : "How they play"}
                    </strong>
                    <p>
                      {kind === "LINEAGE"
                        ? "Their species, body and innate traits."
                        : kind === "UPBRINGING"
                          ? "Their background and learned skills."
                          : "Their main discipline, role or build."}
                    </p>
                  </div>
                )}
                {!selected ? rootActions : null}
                </div>
              </details>
            );
          })}
        </div>
        <div className="sw-quickbuild__lineage-size">
          <span>
            <strong>{cost.size.toLowerCase()}</strong> ·{" "}
            {selection.LINEAGE
              ? "from your lineage"
              : "default without a lineage"}
          </span>
          <span>
            {SIZE_CAPACITY[cost.size]} base Load · {SIZE_BASE_SPEED[cost.size]}{" "}
            ft walk · {Math.ceil(SIZE_BASE_SPEED[cost.size] / 2)} ft swim/climb
          </span>
        </div>
        <div className="sw-quickbuild__ledger" aria-live="polite">
          <strong>
            {heritageCost.netCost} BU in heritages
          </strong>
          <span>
            {heritageSplit.map(({ kind, cost: part }) => `${HERITAGE_LABELS[kind]} ${part} BU`).join(" · ")}
            <small>Shared primitives counted once across heritages.</small>
          </span>
        </div>
      </QuickbuildSection>
      <QuickbuildSection number="04" title="Choose your strengths" reading={`${state.attrPhysical} Physical · ${state.attrMental} Mental · ${state.attrMagical} Magical`}><AttributesStep
        hideHeading
        state={{ ...state, size: cost.size }}
        setField={setField}
        setState={setState}
        attrSum={attrSum}
        number="03"
      /></QuickbuildSection>
      <section
        className="sw-quickbuild__extras"
        aria-label="Optional starting choices"
      >
        <details open className="sw-forge-disclosure">
          <summary>
            <span>
              <b>Starting access{missingAccess.length ? " · required" : ""}</b>
              <small>
                {missingAccess.length ? `Choose a ${missingAccess.join(" and ")}` : "Domain and verb ready · optional additions"}
                <BudgetBadge amount={packageCost} label="starting access" />
              </small>
            </span>
            <ChevronDown aria-hidden />
          </summary>
          <div className="sw-forge-disclosure__body">
            <p>A domain and verb tier are required through your heritages or starting access. Touch range and a 1d4 die are included when no other range or die is chosen. Items do not count toward this requirement.</p>
              <StartingAccessStep
                options={quickOptions}
                selectedIds={packageIds}
                mirrorCredit={cost.mirrorCredit}
                loading={primitivesLoading}
                togglePrimitive={(id) =>
                  setPackageIds((previous) =>
                    previous.includes(id)
                      ? previous.filter((p) => p !== id)
                      : [...previous, id],
                  )
                }
                onClearSelection={() => setPackageIds([])}
                packageCost={packageCost}
                budget={accessBudget}
                availableBudget={availableAccess}
                selectionLimit={Math.max(0, budgetLedger.nextLevelBudget - heritageCost.positiveCost + cost.mirrorCredit)}
                effectiveLevel={effectiveLevel}
                shuffleBudget={Math.min(
                  packageShuffleBudget ?? 25,
                  availableAccess,
                )}
                onShuffleBudgetChange={setPackageShuffleBudget}
                suggestions={packageSuggestions?.map(repricePackage) ?? null}
                savedPackages={savedPackages.map(repricePackage)}
                onChoosePackage={keepPackage}
                onRemovePackage={(preset) => {
                  setSavedPackages((previous) =>
                    previous.filter((p) => p.key !== preset.key),
                  );
                  if (
                    preset.items.length === packageIds.length &&
                    preset.items.every((p) => packageIds.includes(p.id))
                  )
                    setPackageIds([]);
                }}
                onShuffle={shufflePackages}
                quick
              />
            {packageIds.length ? (
              <button
                type="button"
                className="sw-forge-reset"
                onClick={() => setPackageIds([])}
              >
                Remove optional access
              </button>
            ) : null}
          </div>
        </details>
        <details open className="sw-forge-disclosure">
          <summary>
            <span>
              <b>Equipment</b>
              <small>
                Optional · carried items, separate from character BU
                {` · ${itemIds.length} chosen`}<BudgetBadge amount={itemBudget} label="items" tone="teal" />
              </small>
            </span>
            <ChevronDown aria-hidden />
          </summary>
          <div className="sw-forge-disclosure__body">
            <div className="sw-quickbuild__equipment-heading">
              <p>
                Browse equipment and inspect its primitives, capabilities and
                effects. Chosen items start in your inventory.
              </p>
              <button
                type="button"
                className="sw-metal-button sw-metal-button--secondary"
                onClick={() => setPicker("ITEM")}
              >
                <Search size={16} /> Browse items
              </button>
            </div>
            {itemIds.length ? (
              <div className="sw-quickbuild__equipment">
                {itemIds.map((id) => {
                  const item = itemDetails[id];
                  return (
                    <article key={id}>
                      <div className="sw-quickbuild__equipment-icon">
                        {item?.iconSource === "GAME_ICONS" ||
                        item?.iconSource === "UPLOAD" ? (
                          <IconDisplay
                            iconSource={item.iconSource}
                            iconKey={item.iconKey ?? null}
                            iconUrl={item.iconUrl ?? null}
                            iconColor={item.iconColor ?? null}
                            size={38}
                            alt=""
                          />
                        ) : (
                          <span aria-hidden>◇</span>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="sw-quickbuild__item-name"
                          data-preview-trigger="true"
                          onClick={() => setPreview({ kind: "item", id })}
                        >
                          {item?.name ?? "Loading item…"}
                          {item && !item.unavailable ? <span className="sw-quickbuild__cost">{itemBu(item)} item BU</span> : null}
                        </button>
                        <p>
                          {item?.unavailable
                            ? "This item is unavailable. Remove it to continue."
                            : [
                                item?.itemType?.toLowerCase(),
                                item?.size?.toLowerCase(),
                                item
                                  ? `${Math.max(item.slotCost ?? 1, item.isTwoHanded ? 2 : 1)} ${Math.max(item.slotCost ?? 1, item.isTwoHanded ? 2 : 1) === 1 ? "slot" : "slots"} when equipped`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                        {item?.description ? (
                          <small>{item.description}</small>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="sw-quickbuild__remove"
                        aria-label={`Remove ${item?.name ?? "item"}`}
                        onClick={() =>
                          setItemIds((previous) =>
                            previous.filter((p) => p !== id),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="sw-quickbuild__equipment-empty">
                No equipment chosen. You can add it on the sheet later.
              </p>
            )}
          </div>
        </details>
      </section>
      {cost.netCost > budget ? (
        <p role="alert" className="sw-forge-error">
          {budgetLedger.aboveNextLevel ? `These purchases exceed the next level’s ${budgetLedger.nextLevelBudget} BU ceiling.` : `${budgetLedger.overflow} BU above your agreed budget. Check with your DM before creating.`}
        </p>
      ) : null}
      {cost.mirrorCredit > ceiling ? (
        <p role="alert" className="sw-forge-error">
          Drawback credit exceeds this level’s {ceiling} BU limit.
        </p>
      ) : null}
      {attrSum !== 10 ? (
        <p role="alert" className="sw-forge-error">
          Your three attributes must add up to 10.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="sw-forge-error">
          {error}
        </p>
      ) : null}
      <footer className="sw-quickbuild__footer">
        <CreationBudgetDisclosure remaining={budgetLedger.remaining} items={itemBudget} warning={budgetLedger.needsDmApproval}>
        <div>
          <strong>{state.name.trim() || "Your character"}</strong>
          <span>
            Level {effectiveLevel} · {cost.size.toLowerCase()}
          </span>
          <div className="sw-budget-strip" aria-label="Character and equipment budgets">
            <BudgetBadge amount={budgetLedger.remaining} label="remaining" tone="teal" />
            <BudgetBadge amount={`${budgetLedger.baseUsed}/${budget}`} label="normal budget" />
            <BudgetBadge amount={`${budgetLedger.debtUsed}/${cost.mirrorCredit}`} label="drawback credit" tone="copper" />
            <BudgetBadge amount={budgetLedger.overflow} label="overflow" tone={budgetLedger.overflow ? "warning" : "gold"} />
            <BudgetBadge amount={itemBudget} label="items · separate" tone="teal" />
          </div>
          <span className={budgetLedger.needsDmApproval ? "sw-budget-warning" : ""}>
            {budgetLedger.aboveNextLevel ? `Above next level’s ${budgetLedger.nextLevelBudget} BU ceiling — remove choices to continue.` : budgetLedger.needsDmApproval ? "Over agreed budget — check with your DM before creating." : "Items use a separate budget agreed with your DM."}
          </span>
        </div>
        </CreationBudgetDisclosure>
        <button
          type="button"
          className={`sw-metal-button sw-metal-button--primary${budgetLedger.needsDmApproval ? " sw-budget-overflow" : ""}`}
          onClick={submit}
          disabled={isPending || !catalog || budgetLedger.aboveNextLevel}
        >
          {isPending ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}{" "}
          {isPending ? "Creating…" : "Create & play"}
        </button>
      </footer>
      {picker ? (
        <QuickbuildLibraryPicker
          key={picker}
          kind={picker === "ITEM" ? "item" : "heritage"}
          {...(picker !== "ITEM"
            ? {
                heritageKind: picker,
                selectedId: selection[picker] || null,
                budget: Math.max(
                  0,
                  budget -
                    cost.netCost +
                    (catalog?.heritages.find((h) => h.id === selection[picker])
                      ?.cost ?? 0),
                ),
              }
            : {})}
          onClose={() => setPicker(null)}
          onChoose={(id, entry) => {
            if (picker === "ITEM") {
              const itemId = String(id);
              if (entry?.kind === "item")
                setItemDetails((previous) => ({
                  ...previous,
                  [itemId]: entry.row,
                }));
              setItemIds((previous) =>
                previous.includes(itemId) ? previous : [...previous, itemId],
              );
            } else {
              const heritageId = String(id);
              if (
                !catalog?.heritages.some(
                  (h) => h.id === heritageId && h.kind === picker,
                )
              ) {
                setError(
                  "This heritage is not available for creation. Refresh the library and choose again.",
                );
                void loadCatalog();
                return;
              }
              setSelection((previous) => ({
                ...previous,
                [picker]: heritageId,
              }));
            }
            setPicker(null);
            setError(null);
          }}
        />
      ) : null}
      {preview ? (
        <QuickbuildEntityPreviewDialog
          kind={preview.kind}
          id={preview.id}
          onClose={() => setPreview(null)}
        />
      ) : null}
      <DomainAuthoringDrawer onSaved={handleDomainSaved} />
    </div>
  );
}

function BudgetControl({
  state,
  setField,
  effectiveLevel,
}: {
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  effectiveLevel: number;
}) {
  return (
    <div className="sw-forge-budget-control">
      <div className="sw-forge-budget-control__heading">
        <label htmlFor="sw-forge-budget-value">
          {state.sizingMode === "level"
            ? "Starting level"
            : "Agreed Build Units"}
        </label>
        <div
          className="sw-forge-mode"
          role="group"
          aria-label="Starting budget source"
        >
          <button
            type="button"
            aria-pressed={state.sizingMode === "level"}
            className={state.sizingMode === "level" ? "is-active" : ""}
            onClick={() => setField("sizingMode", "level")}
          >
            By level
          </button>
          <button
            type="button"
            aria-pressed={state.sizingMode === "bu"}
            className={state.sizingMode === "bu" ? "is-active" : ""}
            onClick={() => setField("sizingMode", "bu")}
          >
            Custom BU
          </button>
        </div>
      </div>
      <small>
        {state.sizingMode === "level"
          ? "Agree on a starting level with your group. Level 1 starts small; level 3–6 gives a first character more options."
          : `This budget implies level ${effectiveLevel} for the drawback limit. Items use a separate budget agreed with your group.`}
      </small>
      <EditableBudgetInput
        key={state.sizingMode}
        value={state.sizingMode === "level" ? state.level : state.customBu}
        min={state.sizingMode === "level" ? 1 : 25}
        onChange={(value) =>
          setField(state.sizingMode === "level" ? "level" : "customBu", value)
        }
      />
    </div>
  );
}

function IdentityStep({
  state,
  setField,
  setState,
  quick = false,
}: {
  quick?: boolean;
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia("(min-width:768px)").matches)
      nameInput.current?.focus();
  }, []);
  return (
    <div className="sw-forge-stack sw-forge-identity">
      <section className="sw-forge-panel sw-forge-panel--brass sw-forge-identity__main">
        <PanelTitle
          number="01"
          title="Bring your character to life"
          subtitle="Start with the idea, not the numbers. A sentence is enough to begin."
        />
        <ForgeField label="Character name" required>
          <input
            value={state.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="e.g. Vex the Quick"
            ref={nameInput}
          />
        </ForgeField>
        <ForgeField
          label={quick ? "Backstory" : "Your character in one sentence"}
          hint="What are they, and what is special about them? You can change this later."
          required={!quick}
        >
          <textarea
            rows={quick ? 3 : 2}
            value={state.concept}
            onChange={(event) => setField("concept", event.target.value)}
            placeholder="A bear-like warrior bred for combat who learned to resist magic…"
          />
        </ForgeField>
      </section>
      {!quick ? (
        <PhoneSection
          title="Backstory"
          summary="Optional · personality, history, ties and goals"
          className="sw-forge-story-section"
        >
          <header>
            <span>THE STORY SO FAR</span>
            <h3>Give them a past and a purpose</h3>
            <p>
              These prompts are optional, but answering one or two will help you
              choose rules that fit the character. A story flaw does not have to
              become a mechanical weakness later.
            </p>
          </header>
          <BackstoryStep state={state} setState={setState} />
        </PhoneSection>
      ) : (
        <details open className="sw-forge-disclosure">
          <summary>Allies & other details (optional)</summary>
          <div className="sw-forge-disclosure__body">
            <BackstoryStep state={state} setState={setState} />
          </div>
        </details>
      )}
      <details className="sw-forge-disclosure" open={quick}>
        <summary>
          <span>
            <b>Add a portrait</b>
            <small>Optional · upload an image or use a link</small>
          </span>
          <ChevronDown aria-hidden />
        </summary>
        <div className="sw-forge-disclosure__body">
          <PortraitInput
            value={state.portraitUrl}
            onChange={(value) => setField("portraitUrl", value)}
            frame={state.portraitFrame}
            onFrameChange={(value) => setField("portraitFrame", value)}
            characterName={state.name}
          />
        </div>
      </details>
      {!quick ? (
        <PhoneSection
          title="Understanding heritages"
          summary="Lineage, Upbringing and Manifest"
          className="sw-forge-heritages"
        >
          <header>
            <span>THE THREE ROOTS OF A CHARACTER</span>
            <h3 id="sw-forge-heritages-title">
              Where do their abilities come from?
            </h3>
            <p>
              Heritages explain the story behind your character’s abilities.
              Describe these ideas in ordinary words now. On the character
              sheet, you can turn them into Lineage, Upbringing, and Manifest
              bundles with actual rules.
            </p>
          </header>
          <div className="sw-forge-heritages__grid">
            <article>
              <span>01 · WHAT THEY ARE</span>
              <h4>Lineage</h4>
              <p>
                Their inherited or created nature: body, ancestry, senses, and
                innate traits. A constructed or transformed person has a Lineage
                too.
              </p>
              <small>Example: a bear-like being with powerful senses.</small>
            </article>
            <article>
              <span>02 · WHAT SHAPED THEM</span>
              <h4>Upbringing</h4>
              <p>
                The people, place, work, and training that formed them before
                adventuring.
              </p>
              <small>Example: raised and trained for combat.</small>
            </article>
            <article>
              <span>03 · WHO THEY ARE BECOMING</span>
              <h4>Manifest</h4>
              <p>
                The role or discipline they pursue now. This is similar to a
                class, but it can grow and change with their story.
              </p>
              <small>Example: an anti-magic hunter.</small>
            </article>
          </div>
        </PhoneSection>
      ) : null}
    </div>
  );
}

function FoundationStep({
  state,
  setField,
  setState,
  attrSum,
  budget,
  effectiveLevel,
  quick = false,
}: {
  quick?: boolean;
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
  attrSum: number;
  budget: number;
  effectiveLevel: number;
}) {
  const speed = SIZE_BASE_SPEED[state.size];
  return (
    <div className="sw-forge-stack sw-forge-foundation">
      <section className="sw-forge-panel sw-forge-panel--brass sw-forge-identity__frame">
        <PanelTitle
          number="01"
          title={quick ? "Foundation" : "Their physical frame"}
          subtitle={
            quick
              ? "Start at level 1, or use your group’s level or agreed budget."
              : "Size, level, and Build Units belong together. The defaults fit a new level-1 character."
          }
        />
        <div className="sw-forge-identity__basics">
          {!quick ? (
            <ForgeField label="Size" hint="Choose what fits your concept.">
              <select
                value={state.size}
                onChange={(event) =>
                  setField("size", event.target.value as Size)
                }
              >
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} — {SIZE_CAPACITY[size]} load ·{" "}
                    {SIZE_BASE_SPEED[size]} ft walk ·{" "}
                    {Math.ceil(SIZE_BASE_SPEED[size] / 2)} ft swim/climb
                  </option>
                ))}
              </select>
            </ForgeField>
          ) : null}
          <div className="sw-forge-budget-control">
            <div className="sw-forge-budget-control__heading">
              <label htmlFor="sw-forge-budget-value">
                {state.sizingMode === "level"
                  ? "Starting level"
                  : "Agreed Build Units"}
              </label>
              <div
                className="sw-forge-mode"
                role="group"
                aria-label="Starting budget source"
              >
                <button
                  type="button"
                  aria-pressed={state.sizingMode === "level"}
                  className={state.sizingMode === "level" ? "is-active" : ""}
                  onClick={() => setField("sizingMode", "level")}
                >
                  By level
                </button>
                <button
                  type="button"
                  aria-pressed={state.sizingMode === "bu"}
                  className={state.sizingMode === "bu" ? "is-active" : ""}
                  onClick={() => setField("sizingMode", "bu")}
                >
                  Custom BU
                </button>
              </div>
            </div>
            <small>
              {state.sizingMode === "level"
                ? "Agree on a starting level with your group. Level 1 starts small; level 3–6 gives a first character more options."
                : `Only if your group agreed on a budget. This implies level ${effectiveLevel} for eligible weaknesses.`}
            </small>
            <EditableBudgetInput
              key={state.sizingMode}
              value={
                state.sizingMode === "level" ? state.level : state.customBu
              }
              min={state.sizingMode === "level" ? 1 : 25}
              onChange={(value) =>
                setField(
                  state.sizingMode === "level" ? "level" : "customBu",
                  value,
                )
              }
            />
          </div>
        </div>
        <div className="sw-forge-size-reading">
          <span>
            <small>{quick ? "Base carry" : "Carry"}</small>
            {SIZE_CAPACITY[state.size]} load
          </span>
          <span>
            <small>Walk</small>
            {speed} ft
          </span>
          <span>
            <small>Swim</small>
            {Math.ceil(speed / 2)} ft
          </span>
          <span>
            <small>Climb</small>
            {Math.ceil(speed / 2)} ft
          </span>
        </div>
        <p className="sw-forge-foundation__budget">
          Level {effectiveLevel} · {budget} BU before an optional weakness.{" "}
          {quick
            ? `Size ${state.size.toLowerCase()} comes from your lineage; you can change it later on the sheet.`
            : "You will choose what to spend in step 4."}
        </p>
        <p className="sw-creation-start-note">You do not need to spend every BU now. Keep room to add or invent primitives on your character sheet as you play.</p>
      </section>
      <AttributesStep
        state={state}
        setField={setField}
        setState={setState}
        attrSum={attrSum}
      />
    </div>
  );
}

function AttributesStep({
  hideHeading = false,
  state,
  setField,
  setState,
  attrSum,
  number = "02",
}: {
  number?: string;
  hideHeading?: boolean;
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
  attrSum: number;
}) {
  const fields = [
    ["PHYSICAL", "attrPhysical"],
    ["MENTAL", "attrMental"],
    ["MAGICAL", "attrMagical"],
  ] as const;
  const meanings: Record<Attribute, string> = {
    PHYSICAL: "Strength, movement, and endurance",
    MENTAL: "Awareness, reasoning, and resolve",
    MAGICAL: "Arcane control and expression",
  };
  const presets: Array<{
    name: string;
    hint: string;
    values: [number, number, number];
    specialty: Attribute;
  }> = [
    {
      name: "Balanced",
      hint: "Good all around",
      values: [4, 3, 3],
      specialty: "PHYSICAL",
    },
    {
      name: "Physical",
      hint: "Move and endure",
      values: [5, 3, 2],
      specialty: "PHYSICAL",
    },
    {
      name: "Mental",
      hint: "Notice and reason",
      values: [3, 5, 2],
      specialty: "MENTAL",
    },
    {
      name: "Magical",
      hint: "Shape the arcane",
      values: [3, 2, 5],
      specialty: "MAGICAL",
    },
  ];
  return (
    <section className="sw-forge-panel sw-forge-panel--silver sw-forge-attribute-choice">
      {!hideHeading ? <PanelTitle
        number={number}
        title="Choose your strengths"
        subtitle="Balanced is ready to use. Pick a focus only if you want one."
      /> : null}
      <p className="sw-forge-attribute-explainer">Physical describes movement and endurance, Mental describes thought and awareness, and Magical describes arcane control. Pick a focus or keep Balanced; the three starting scores share 10 points.</p>
      <div
        className="sw-forge-attribute-presets"
        role="group"
        aria-label="Attribute starting arrangements"
      >
        {presets.map((preset) => {
          const active =
            state.attrPhysical === preset.values[0] &&
            state.attrMental === preset.values[1] &&
            state.attrMagical === preset.values[2] &&
            state.attrProficient === preset.specialty;
          return (
            <button
              type="button"
              key={preset.name}
              className={active ? "is-active" : ""}
              aria-pressed={active}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  attrPhysical: preset.values[0],
                  attrMental: preset.values[1],
                  attrMagical: preset.values[2],
                  attrProficient: preset.specialty,
                }))
              }
            >
              <strong>{preset.name}</strong>
              <small>{preset.hint}</small>
              <span>{preset.values.join(" / ")}</span>
            </button>
          );
        })}
      </div>
      <details className="sw-forge-attribute-choice__fine">
        <summary>
          Adjust individual scores and specialty <ChevronDown aria-hidden />
        </summary>
        <p>
          Your three scores must total 10. Your specialty adds a proficiency
          bonus to its related practices and saves.
        </p>
        <div className={`sw-forge-sum${attrSum === 10 ? " is-valid" : ""}`}>
          <span>Points assigned</span>
          <strong>{attrSum} / 10</strong>
          <small>
            {attrSum === 10
              ? "Ready"
              : `${10 - attrSum > 0 ? "+" : ""}${10 - attrSum} remaining`}
          </small>
        </div>
        <div className="sw-forge-attributes">
          {fields.map(([label, key]) => (
            <div
              key={key}
              className={state.attrProficient === label ? "is-proficient" : ""}
            >
              <button
                type="button"
                onClick={() => setField("attrProficient", label)}
                aria-pressed={state.attrProficient === label}
              >
                {state.attrProficient === label
                  ? "Specialty chosen"
                  : "Choose specialty"}
              </button>
              <label>
                <span>{label}</span>
                <small>{meanings[label]}</small>
                <EditableNumberInput
                  type="number"
                  min={-1}
                  max={5}
                  value={state[key]}
                  onChange={(event) =>
                    setField(key, clamp(Number(event.target.value), -1, 5))
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function BackstoryStep({
  state,
  setState,
  hideMotivation = false,
}: {
  state: FormState;
  setState: React.Dispatch<React.SetStateAction<FormState>>;
  hideMotivation?: boolean;
}) {
  const fields: Array<[keyof FormState["backstory"], string, string, string]> =
    [
      [
        "description",
        "Full description",
        "What makes them recognizable",
        "Appearance, voice, movement, clothing, and distinguishing details…",
      ],
      [
        "personality",
        "Personality",
        "How they think and act",
        "Temperament, habits, values, and contradictions…",
      ],
      [
        "origin",
        "Origin & history",
        "Where from, what happened",
        "Family, birthplace, culture, and defining events…",
      ],
      [
        "motivation",
        "Motivation & goals",
        "What drives them now",
        "What do they want, and why can’t they let it go?",
      ],
      [
        "ties",
        "Ties & allies",
        "Who matters",
        "Friends, rivals, family, patrons, promises…",
      ],
      [
        "flaw",
        "Flaw & conflict",
        "What gets in their way",
        "A fear, contradiction, obligation, or recurring mistake…",
      ],
    ];
  return (
    <div className="sw-forge-story-grid">
      {fields
        .filter(([key]) => !hideMotivation || key !== "motivation")
        .map(([key, label, hint, placeholder], index) => (
          <PhoneSection
            key={key}
            title={label}
            summary={
              state.backstory[key]?.trim()
                ? "Has story · tap to edit"
                : "Optional · tap to write"
            }
            className={`sw-forge-panel ${index % 2 ? "sw-forge-panel--teal" : "sw-forge-panel--brass"}`}
          >
            <PanelTitle
              number={String.fromCharCode(65 + index)}
              title={label}
              subtitle={hint}
            />
            <MarkdownEditor
              className="sw-forge-markdown"
              rows={3}
              ariaLabel={label}
              value={state.backstory[key] ?? ""}
              onChange={(value) =>
                setState((current) => ({
                  ...current,
                  backstory: { ...current.backstory, [key]: value },
                }))
              }
              placeholder={placeholder}
            />
          </PhoneSection>
        ))}
    </div>
  );
}

interface FinishingProps {
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  budget: number;
  effectiveLevel: number;
  selected: PrimitiveOption[];
  packageCost: number;
  mirrorCredit: number;
  mirrorName: string | null;
  onEditFoundation: () => void;
  onEditAccess: () => void;
}

function FinishingStep({
  state,
  setField,
  budget,
  effectiveLevel,
  selected,
  packageCost,
  mirrorCredit,
  mirrorName,
  onEditFoundation,
  onEditAccess,
}: FinishingProps) {
  const subject = selected
    .filter((item) => item.category === "DOMAIN")
    .map((item) => item.name.replace(/^Domain of\s+/i, ""))
    .join(", ");
  const verb = selected
    .filter((item) => item.category === "VERB_TIER")
    .map(displayActionTier)
    .join(", ");
  const range = selected
    .filter((item) => item.category === "RANGE")
    .map((item) => item.name.replace(/\s+Range$/i, ""))
    .join(", ");
  const die = selected
    .filter((item) => item.category === "INTENSITY_DICE")
    .map(displayDie)
    .join(", ");
  return (
    <div className="sw-forge-stack sw-forge-finish">
      <section className="sw-forge-review" aria-label="Character summary">
        <header>
          <span>FOUNDATION READY</span>
          <h3>{state.name.trim() || "Your character"}</h3>
          <small>
            Level {effectiveLevel} · {state.size.toLowerCase()} ·{" "}
            {state.attrProficient.toLowerCase()} specialty
          </small>
          <p>{state.concept}</p>
          <p>
            Physical {state.attrPhysical} · Mental {state.attrMental} · Magical{" "}
            {state.attrMagical}{" "}
            <button
              type="button"
              className="sw-forge-review__edit"
              onClick={onEditFoundation}
            >
              Edit foundation
            </button>
          </p>
          {mirrorName ? (
            <p className="sw-forge-review__weakness">
              Weakness: {mirrorName} · +{mirrorCredit} BU
            </p>
          ) : null}
        </header>
        <div className="sw-forge-review__grid">
          <div>
            <small>Subjects</small>
            <strong>{subject || "Choose one"}</strong>
          </div>
          <div>
            <small>Actions</small>
            <strong>{verb || "Choose a tier"}</strong>
          </div>
          <div>
            <small>Reach</small>
            <strong>{range || "Choose a range"}</strong>
          </div>
          <div>
            <small>Effect dice</small>
            <strong>{die || "Choose a die"}</strong>
          </div>
        </div>
        <footer>
          <span>
            <b>{packageCost} BU used</b> of {budget + mirrorCredit} ·{" "}
            {budget + mirrorCredit - packageCost} left
          </span>
          <button type="button" onClick={onEditAccess}>
            Change starting access <ArrowRight aria-hidden />
          </button>
        </footer>
      </section>
      <div className="sw-forge-finish__optional">
        <span>THE NEXT CHAPTER</span>
        <p>
          This is only the foundation. On the character sheet, you can turn your
          concept into Lineage, Upbringing, and Manifest heritages, make
          capabilities and items, and spend your remaining points on
          proficiencies, resistances, advantages, or other rules.
        </p>
      </div>
      <details open className="sw-forge-disclosure">
        <summary>
          <span>
            <b>Private notes</b>
            <small>Optional · voice, mannerisms, or table reminders</small>
          </span>
          <ChevronDown aria-hidden />
        </summary>
        <div className="sw-forge-disclosure__body">
          <ForgeField label="Notes">
            <textarea
              rows={4}
              value={state.notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Anything else you want to remember…"
            />
          </ForgeField>
        </div>
      </details>
    </div>
  );
}

const ACCESS_FAMILIES: Array<[PackageSlot, string, string]> = [
  ["verb", "Verb tiers", "How deeply they may act"],
  ["range", "Ranges", "How far their actions may reach"],
  ["die", "Output dice", "Damage and healing dice they may use"],
  ["domain", "Domains", "What parts of reality they may affect"],
];

function tierOf(item: PrimitiveOption) {
  return startingPackageTier(item);
}

function displayActionTier(item: PrimitiveOption) {
  const tier = tierOf(item);
  return tier === 1
    ? "Basic actions (Tier I)"
    : `Tier ${ROMAN[tier] || tier} actions`;
}

function originOf(item: PrimitiveOption): Exclude<OriginFilter, "all"> {
  return !item.sourceOrigin ||
    item.sourceOrigin.toLowerCase().startsWith("system")
    ? "system"
    : "community";
}

function beginnerStartingOptions(
  options: Record<PackageSlot, PrimitiveOption[]>,
): Record<PackageSlot, PrimitiveOption[]> {
  const familiarDomains = options.domain.filter(
    (item) =>
      originOf(item) === "system" &&
      /^Domain of (Fire|Water|Air|Earth|Metal|Stone|Wood|Ice|Light|Lightning|Cold)$/i.test(
        item.name,
      ),
  );
  return familiarDomains.length >= 3
    ? {
        verb: options.verb.filter((item) => originOf(item) === "system"),
        range: options.range.filter((item) => originOf(item) === "system"),
        die: options.die.filter((item) => originOf(item) === "system"),
        domain: familiarDomains,
      }
    : options;
}

function levelBracket(level: number) {
  if (level <= 4) return { label: "Levels 1–4", tier: 1 };
  if (level <= 8) return { label: "Levels 5–8", tier: 2 };
  if (level <= 12) return { label: "Levels 9–12", tier: 3 };
  if (level <= 16) return { label: "Levels 13–16", tier: 4 };
  return { label: "Levels 17–20", tier: 5 };
}

function recommendedPackages(
  options: Record<PackageSlot, PrimitiveOption[]>,
  effectiveLevel: number,
  availableBu: number,
  seed: number,
  excludedKeys: string[] = [],
): PackagePreset[] {
  return suggestStartingPackages({
    options,
    availableBu,
    seed: seed + levelBracket(effectiveLevel).tier * 1000,
    excludedKeys,
  }).map((suggestion, index) => {
    const domains = suggestion.items
      .filter((item) => item.category === "DOMAIN")
      .map((item) => item.name.replace(/^Domain of\s+/i, ""));
    const ranges = suggestion.items
      .filter((item) => item.category === "RANGE")
      .map((item) => item.name.replace(/\s+Range$/i, ""));
    const subjects = domains.length
      ? new Intl.ListFormat("en", {
          style: "short",
          type: "conjunction",
        }).format(domains.slice(0, 2))
      : "a chosen subject";
    const reach = ranges.length ? ranges[0]!.toLowerCase() : "touch";
    return {
      ...suggestion,
      name: domains.length
        ? `${domains.slice(0, 2).join(" & ")}${domains.length > 2 ? " + more" : ""}`
        : `Starting set ${index + 1}`,
      description: `Build actions about ${subjects} within ${reach} range.`,
    };
  });
}

function packageSummary(items: PrimitiveOption[]) {
  const matching = (category: PrimitiveOption["category"]) =>
    items.filter((candidate) => candidate.category === category);
  const binding = (primitive: PrimitiveOption | undefined, key: string) =>
    String(primitive?.mechanicalRule?.bindings?.[key] ?? "").trim();
  const list = (values: string[]) => values.join(" + ");
  const verbs = matching("VERB_TIER").map((verb) => {
    const tier =
      binding(verb, "tier") || `Tier ${ROMAN[tierOf(verb)] || tierOf(verb)}`;
    return tier.replace(/^Tier\s*/i, "");
  });
  const ranges = matching("RANGE").map((range) =>
    (binding(range, "range") || range.name)
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/\s+Range$/i, ""),
  );
  const dice = matching("INTENSITY_DICE").map(displayDie);
  const domains = matching("DOMAIN").map((domain) =>
    domain.name.replace(/^Domain of\s+/i, ""),
  );
  return [
    `Verb ${verbs.length === 1 ? "Tier" : "Tiers"} ${list(verbs)}`,
    `${list(ranges)} ${ranges.length === 1 ? "range" : "ranges"}`,
    `${list(dice)} ${dice.length === 1 ? "die" : "dice"}`,
    `${domains.length === 1 ? "Domain of" : "Domains of"} ${list(domains)}`,
  ].join(" · ");
}

function displayDie(primitive: PrimitiveOption) {
  const notation = String(
    primitive.mechanicalRule?.bindings?.["dice"] ??
      primitive.mechanicalOutputText.match(/\d*d\d+/i)?.[0] ??
      primitive.name.match(/\d*d\d+/i)?.[0] ??
      primitive.name,
  );
  return notation.replace(/^1(?=d\d+$)/i, "");
}

function startingExample(items: PrimitiveOption[]) {
  const domains = items.filter((item) => item.category === "DOMAIN");
  const verbs = items.filter((item) => item.category === "VERB_TIER");
  const ranges = items.filter((item) => item.category === "RANGE");
  const exampleObjects: Record<string, string> = {
    air: "a gust of air",
    cold: "a patch of frost",
    earth: "loose soil",
    fire: "an existing flame",
    ice: "a piece of ice",
    light: "a beam of light",
    lightning: "a spark",
    metal: "a metal latch",
    stone: "a stone",
    water: "water in a cup",
    wood: "a wooden branch",
  };
  const domain = domains[0]?.name.replace(/^Domain of\s+/i, "").toLowerCase();
  if (
    domains.length === 1 &&
    verbs.some((item) => tierOf(item) === 1) &&
    ranges.length === 1 &&
    domain &&
    exampleObjects[domain]
  ) {
    const reach = ranges[0]!.name.toLowerCase().includes("touch")
      ? "I can touch"
      : "within my reach";
    return `“I try to move ${exampleObjects[domain]} ${reach}.” Tier I includes move; ${domains[0]!.name} is the subject; ${ranges[0]!.name} sets the reach.`;
  }
  return "Describe an action using one of your subjects. Your action tiers say what you can do; your purchased range and effect dice set your reach and damage or healing.";
}

interface StartingAccessProps {
  availableBudget?: number;
  selectionLimit?: number;
  quick?: boolean;
  options: Record<PackageSlot, PrimitiveOption[]>;
  selectedIds: number[];
  mirrorCredit: number;
  loading: boolean;
  togglePrimitive: (id: number) => void;
  onClearSelection: () => void;
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

function PackageCard({
  preset,
  index,
  active,
  onChoose,
}: {
  preset: PackagePreset;
  index: number;
  active: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-pressed={active}
      onClick={onChoose}
    >
      <i aria-hidden>{String(index + 1).padStart(2, "0")}</i>
      <span>
        <b>{preset.name}</b>
        <small>{preset.description}</small>
        <small className="sw-access-preset-summary">
          {packageSummary(preset.items)}
        </small>
      </span>
      <em>{preset.cost} BU</em>
      <strong>{active ? "Chosen" : "Choose this set"}</strong>
    </button>
  );
}

function StartingAccessStep({
  availableBudget,
  selectionLimit,
  quick = false,
  options,
  selectedIds,
  mirrorCredit,
  loading,
  togglePrimitive,
  onClearSelection,
  packageCost,
  budget,
  effectiveLevel,
  shuffleBudget,
  onShuffleBudgetChange,
  suggestions: shuffledSuggestions,
  savedPackages,
  onChoosePackage,
  onRemovePackage,
  onShuffle,
}: StartingAccessProps) {
  const [family, setFamily] = useState<PackageSlot>("verb");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [consideredDomainIds, setConsideredDomainIds] = useState<number[]>([]);
  const shuffleExternal = String(shuffleBudget);
  const [shuffleDraft, setShuffleDraft] = useState({ external: shuffleExternal, text: shuffleExternal });
  if (shuffleDraft.external !== shuffleExternal) setShuffleDraft({ external: shuffleExternal, text: shuffleExternal });
  const shuffleBudgetDraft = shuffleDraft.external === shuffleExternal ? shuffleDraft.text : shuffleExternal;
  const setShuffleBudgetDraft = (text: string) => setShuffleDraft({ external: shuffleExternal, text });
  const { openDrawer } = useGlobalControls();
  const bracket = levelBracket(effectiveLevel);
  const availableBu = availableBudget ?? budget + mirrorCredit;
  const beginnerOptions = useMemo(
    () => beginnerStartingOptions(options),
    [options],
  );
  const minimumPackageCost = (Object.keys(options) as PackageSlot[]).reduce(
    (sum, slot) => sum + (options[slot][0]?.buCost ?? 0),
    0,
  );
  const commitShuffleBudget = () => {
    const parsed = Number(shuffleBudgetDraft);
    const next =
      shuffleBudgetDraft.trim() && Number.isFinite(parsed)
        ? clamp(parsed, Math.min(minimumPackageCost, availableBu), availableBu)
        : shuffleBudget;
    setShuffleBudgetDraft(String(next));
    onShuffleBudgetChange(next);
    return next;
  };
  const initialSuggestions = useMemo(
    () =>
      recommendedPackages(beginnerOptions, effectiveLevel, shuffleBudget, 0),
    [beginnerOptions, effectiveLevel, shuffleBudget],
  );
  const validPackage = (preset: PackagePreset) => preset.cost <= (selectionLimit ?? availableBu);
  const availableSuggestions = (
    shuffledSuggestions ?? initialSuggestions
  ).filter(
    (preset) =>
      validPackage(preset) &&
      !savedPackages.some((item) => item.key === preset.key),
  );
  const freshSuggestions =
    availableSuggestions.length < 3
      ? recommendedPackages(
          shuffledSuggestions ? options : beginnerOptions,
          effectiveLevel,
          shuffleBudget,
          4999 + savedPackages.length,
          [
            ...savedPackages.map((item) => item.key),
            ...availableSuggestions.map((item) => item.key),
          ],
        ).filter(validPackage)
      : [];
  const packages = [...availableSuggestions, ...freshSuggestions].slice(0, 3);
  const packageActive = (preset: PackagePreset) =>
    preset.items.length === selectedIds.length &&
    preset.items.every((item) => selectedIds.includes(item.id));
  const saved = savedPackages.filter((preset) => !packageActive(preset));
  const choosePackage = (preset: PackagePreset) => {
    onChoosePackage(preset);
    setBuilderOpen(false);
  };
  const availableTiers = [...new Set(options[family].map(tierOf))].sort(
    (a, b) => a - b,
  );
  const visible = options[family].filter(
    (item) =>
      `${item.name} ${item.mechanicalOutputText} ${item.narrativeRule}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (tierFilter === null || tierOf(item) === tierFilter) &&
      (originFilter === "all" || originOf(item) === originFilter),
  );
  const selected = ACCESS_FAMILIES.flatMap(([slot]) => options[slot]).filter(
    (item) => selectedIds.includes(item.id),
  );
  const selectedSubjects = selected
    .filter((item) => item.category === "DOMAIN")
    .map((item) => item.name.replace(/^Domain of\s+/i, ""))
    .join(" · ");
  const selectedFacts = [
    ["Subjects", selectedSubjects],
    [
      "Actions",
      selected
        .filter((item) => item.category === "VERB_TIER")
        .map(displayActionTier)
        .join(" · "),
    ],
    [
      "Reach",
      selected
        .filter((item) => item.category === "RANGE")
        .map((item) => item.name.replace(/\s+Range$/i, ""))
        .join(" · "),
    ],
    [
      "Effect dice",
      selected
        .filter((item) => item.category === "INTENSITY_DICE")
        .map(displayDie)
        .join(" · "),
    ],
  ];
  const consideredDomains = consideredDomainIds
    .map((id) => options.domain.find((item) => item.id === id))
    .filter((item): item is PrimitiveOption => Boolean(item));
  const chooseDomain = (id: number) => {
    if (!selectedIds.includes(id))
      setConsideredDomainIds((current) =>
        current.includes(id) ? current : [...current, id].slice(-4),
      );
    togglePrimitive(id);
  };
  const removeConsideredDomain = (id: number) => {
    setConsideredDomainIds((current) =>
      current.filter((saved) => saved !== id),
    );
    if (selectedIds.includes(id)) togglePrimitive(id);
  };
  const definitions = [...MARKET_TEMPLATES, ...CANONICAL_EXPRESSIONS].filter(
    (item) => item.familyKey === FAMILY_KEYS[family],
  );

  return (
    <div className="sw-forge-stack">
      {loading ? (
        <div className="sw-forge-loading">
          <Loader2 className="animate-spin" aria-hidden /> Opening the primitive
          library…
        </div>
      ) : (
        <>
          {selected.length ? (
            <section className="sw-forge-current-set" aria-live="polite">
              <div className="sw-forge-current-set__head">
                <div>
                  <span>
                    <Check aria-hidden /> SELECTED STARTER
                  </span>
                  <h3>{selectedSubjects || "Your starting vocabulary"}</h3>
                  <p>
                    This is your opening set, not your whole character. Keep
                    some BU for proficiencies, resistances, bonuses,
                    capabilities, and other choices on the sheet.
                  </p>
                </div>
                <div>
                  <b>{packageCost} BU</b>
                  <small>spent of {availableBu}</small>
                  <strong>{packageCost > availableBu ? `${packageCost - availableBu} BU above agreed allocation` : `${availableBu - packageCost} BU left for later`}</strong>
                </div>
              </div>
              <div className="sw-forge-current-set__facts">
                {selectedFacts.map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{value || "Not chosen"}</strong>
                  </div>
                ))}
              </div>
              <div className="sw-forge-current-set__example">
                <span>AT THE TABLE</span>
                <p>{startingExample(selected)}</p>
                <p>
                  Your subjects and action tiers come from purchased primitives.
                  Reaching beyond Touch or using an output die also needs its
                  matching primitive. Targets, shape, size, placement, effect
                  duration, and casting time can be described without buying one
                  for each detail: for example, spread a gust across several
                  targets or hold a metal door for longer. Those choices scale
                  through the action’s intrinsic cost.
                </p>
                <p>
                  Greater scale, impact, complexity, or compressed time raises
                  Strain. The cost might be Vitality, a resource, a hazard, a
                  narrative twist, lost access, or a condition negotiated with
                  the DM. You can accept it, reduce your intent, suggest another
                  cost, or stop before rolling.
                </p>
              </div>
            </section>
          ) : null}
          <section className="sw-access-presets">
            <header>
              <div>
                <span>Recommended for {bracket.label}</span>
                <h3>
                  {selected.length
                    ? "Or try another set"
                    : "Pick a starting set"}
                </h3>
                <p>
                  Each set combines a subject, action tier, reach, and effect
                  die. They are building blocks for actions, not a fixed spell
                  list. You have {availableBu} BU
                  {quick ? " left after heritages" : ""}
                  {mirrorCredit
                    ? ` including ${mirrorCredit} from your weakness`
                    : ""}
                  ; these suggestions deliberately leave room for later choices.
                </p>
              </div>
              <div className="sw-access-presets__actions">
                <button
                  type="button"
                  onClick={() => onShuffle(commitShuffleBudget())}
                  disabled={!initialSuggestions.length}
                >
                  <Shuffle aria-hidden /> Different ideas
                </button>
                <details className="sw-access-presets__budget-advanced">
                  <summary><SlidersHorizontal size={16} aria-hidden /> BU limit</summary>
                  <div className="sw-access-limit-panel">
                  <label className="sw-access-presets__budget">
                    <span>Shuffle up to</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Shuffle budget in BU"
                      value={shuffleBudgetDraft}
                      onChange={(event) =>
                        setShuffleBudgetDraft(
                          event.target.value.replace(/\D/g, ""),
                        )
                      }
                      onBlur={commitShuffleBudget}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                    <small>BU of {availableBu}</small>
                  </label>
                  <button type="button" className="sw-access-limit-reset" aria-label="Reset package shuffle limit" onClick={() => { const defaultLimit = Math.min(25, availableBu); setShuffleBudgetDraft(String(defaultLimit)); onShuffleBudgetChange(defaultLimit); onShuffle(defaultLimit); }}>Reset limit</button>
                  <small className="sw-access-limit-hint">Default: up to {Math.min(25, availableBu)} BU from your available budget.</small>
                  </div>
                </details>
              </div>
            </header>
            <div>
              {packages.map((preset, index) => (
                <PackageCard
                  key={preset.key}
                  preset={preset}
                  index={index}
                  active={packageActive(preset)}
                  onChoose={() => choosePackage(preset)}
                />
              ))}
              {!packages.length ? (
                <p className="sw-access-presets__empty">
                  All new suggestions are already saved below. Remove a saved
                  set or change the shuffle limit to see more.
                </p>
              ) : null}
              <button
                type="button"
                className={`sw-access-presets__custom${builderOpen ? " is-active" : ""}`}
                aria-expanded={builderOpen}
                aria-controls="sw-starting-access-library"
                onClick={() => setBuilderOpen((open) => !open)}
              >
                <i aria-hidden>
                  <Plus />
                </i>
                <span>
                  <b>Make your own set</b>
                  <small>
                    Open the Library to add, remove, or replace the selected
                    parts.
                  </small>
                  <small className="sw-access-preset-summary">
                    Subjects · Actions · Reach · Effect dice
                  </small>
                </span>
                <strong>
                  {builderOpen ? "Close Library" : "Open Library"}
                </strong>
              </button>
            </div>
          </section>
          {saved.length ? (
            <section className="sw-forge-comparison sw-forge-comparison--packages">
              <header>
                <div>
                  <span>Saved ideas</span>
                  <h3>Sets you kept</h3>
                </div>
                <small>{saved.length} / 4 kept</small>
              </header>
              <div className="sw-access-presets__saved-grid">
                {saved.map((preset, index) => (
                  <div className="sw-forge-considered-item" key={preset.key}>
                    <PackageCard
                      preset={preset}
                      index={index}
                      active={packageActive(preset)}
                      onChoose={() =>
                        validPackage(preset) && choosePackage(preset)
                      }
                    />
                    <button
                      type="button"
                      className="sw-forge-considered-item__remove"
                      aria-label={`Remove ${preset.name} from considered packages`}
                      onClick={() => onRemovePackage(preset)}
                    >
                      <X aria-hidden />
                    </button>
                    {!validPackage(preset) ? (
                      <span className="sw-access-presets__over-budget">
                        Above next-level ceiling
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {builderOpen ? (
            <section
              id="sw-starting-access-library"
              className="sw-access-library"
            >
              <nav
                className="sw-access-library__families"
                aria-label="Starting access families"
              >
                {ACCESS_FAMILIES.map(([id, label, hint], index) => (
                  <button
                    type="button"
                    key={id}
                    className={family === id ? "is-active" : ""}
                    onClick={() => {
                      setFamily(id);
                      setQuery("");
                      setTierFilter(null);
                    }}
                  >
                    <i aria-hidden>◇</i>
                    <span>{label}</span>
                    <small>
                      {
                        selected.filter((item) =>
                          options[id].some((option) => option.id === item.id),
                        ).length
                      }{" "}
                      chosen · {hint}
                    </small>
                    <em>{String(index + 1).padStart(2, "0")}</em>
                  </button>
                ))}
              </nav>
              <div className="sw-access-library__corpus">
                <header>
                  <div>
                    <span>Lexicon category · canonical family</span>
                    <h3>
                      {ACCESS_FAMILIES.find(([id]) => id === family)?.[1]}
                    </h3>
                  </div>
                  {family === "domain" ? (
                    <button
                      type="button"
                      className="sw-domain-create"
                      onClick={() => openDrawer("build")}
                    >
                      <span aria-hidden>
                        <Plus />
                      </span>
                      <span>
                        <small>Build & preview</small>
                        <strong>Create Domain</strong>
                      </span>
                      <em aria-hidden>›</em>
                    </button>
                  ) : null}
                </header>
                <CanonicalDefinitions definitions={definitions} />
                <div className="sw-access-results-heading">
                  <div>
                    <span>Exact entries</span>
                    <h4>Canonical references and community expressions</h4>
                  </div>
                  <b>{visible.length} records</b>
                </div>
                <div className="sw-access-filter-row">
                  <div>
                    {[null, ...availableTiers].map((tier) => (
                      <button
                        type="button"
                        key={tier ?? "all"}
                        aria-pressed={tierFilter === tier}
                        onClick={() => setTierFilter(tier)}
                      >
                        {tier === null
                          ? "All tiers"
                          : `Tier ${ROMAN[tier] || tier}`}
                      </button>
                    ))}
                  </div>
                  <div>
                    {(["all", "system", "community"] as OriginFilter[]).map(
                      (origin) => (
                        <button
                          type="button"
                          key={origin}
                          aria-pressed={originFilter === origin}
                          onClick={() => setOriginFilter(origin)}
                        >
                          {origin === "all"
                            ? "All origins"
                            : origin[0]!.toUpperCase() + origin.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <label className="sw-access-search">
                  <Search aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${family === "die" ? "output dice" : family + "s"}…`}
                  />
                </label>
                <div className="sw-access-library__entries">
                  {visible.map((item) => (
                    <PrimitiveSelectCard
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(item.id)}
                      onToggle={() =>
                        family === "domain"
                          ? chooseDomain(item.id)
                          : togglePrimitive(item.id)
                      }
                    />
                  ))}
                  {visible.length === 0 ? (
                    <p className="sw-access-library__empty">
                      No entries match these filters.
                    </p>
                  ) : null}
                </div>
                {family === "domain" && consideredDomains.length ? (
                  <section className="sw-access-domains-considered">
                    <header>
                      <span>Kept for comparison</span>
                      <strong>Domains you considered</strong>
                      <small>{consideredDomains.length} / 4 kept</small>
                    </header>
                    <div>
                      {consideredDomains.map((item) => (
                        <div
                          key={item.id}
                          className="sw-access-domains-considered__item"
                        >
                          <button
                            type="button"
                            onClick={() => chooseDomain(item.id)}
                            aria-pressed={selectedIds.includes(item.id)}
                          >
                            <strong>{item.name}</strong>
                            <small data-copy="mechanical">
                              {item.mechanicalOutputText}
                            </small>
                            <em>
                              {selectedIds.includes(item.id)
                                ? "Selected"
                                : "Choose Domain"}{" "}
                              · {item.buCost} BU
                            </em>
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${item.name} from considered domains`}
                            onClick={() => removeConsideredDomain(item.id)}
                          >
                            <X aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
              <aside className="sw-access-ledger">
                <header>
                  <span>Selected parts</span>
                  <strong>{selected.length}</strong>
                </header>
                {selected.length ? (
                  <>
                    <button
                      type="button"
                      className="sw-access-ledger__clear"
                      onClick={onClearSelection}
                    >
                      Clear all and start fresh
                    </button>
                    <div>
                      {selected.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => togglePrimitive(item.id)}
                        >
                          <span>{item.name}</span>
                          <small>{item.buCost} BU · remove</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>
                    Choose one or more from each family: subjects, actions,
                    reach, and effect dice.
                  </p>
                )}
              </aside>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MirrorOptionCard({
  item,
  active,
  disabled,
  onSelect,
  showCredit = true,
}: {
  item: PrimitiveOption;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  showCredit?: boolean;
}) {
  const credit = item.mirrorBuCredit ?? item.buCost;
  const mechanicalCopy = item.mechanicalOutputText
    .replace(/\bwhen is when\b/gi, "when")
    .trim();
  return (
    <button
      type="button"
      className={active ? "is-active" : ""}
      aria-pressed={active}
      data-selection-card="drawback"
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="sw-mirror-choices__icon">
        {item.iconSource ? (
          <IconDisplay
            iconSource={item.iconSource}
            iconKey={item.iconKey ?? null}
            iconUrl={item.iconUrl ?? null}
            iconColor={item.iconColor ?? null}
            size={30}
            alt=""
          />
        ) : (
          "◇"
        )}
      </span>
      <span className="sw-mirror-choices__copy">
        <span title={item.category.replaceAll("_", " ")}>Optional drawback</span>
        <strong>{item.name}</strong>
        <small>{mirrorConsequence(item)}</small>
        {mechanicalCopy ? <em>Original benefit: {mechanicalCopy}</em> : null}
      </span>
      {showCredit && <span className="sw-mirror-choices__credit">
        +{credit}
        <small>BU credit</small>
      </span>}
      <b>
        {active
          ? "Remove drawback"
          : disabled
            ? (showCredit ? "Above debt limit" : "Unavailable")
            : "Choose drawback"}
      </b>
    </button>
  );
}

function MirroringStep({
  selectedOptions,
  inheritedCredit = 0,
  quick = false,
  options,
  selectedIds,
  onSelect,
  onRemove,
  savedIds,
  suggestionIds,
  shuffleSeed,
  onShuffle,
  budget,
  ceiling,
  characterName,
}: {
  selectedOptions?: PrimitiveOption[];
  inheritedCredit?: number;
  quick?: boolean;
  options: PrimitiveOption[];
  selectedIds: number[];
  onSelect: (id: number | null) => void;
  onRemove: (id: number) => void;
  savedIds: number[];
  suggestionIds: number[] | null;
  shuffleSeed: number;
  onShuffle: () => void;
  budget: number;
  ceiling: number;
  characterName: string;
}) {
  const selected = (selectedOptions ?? options).filter((item) => selectedIds.includes(item.id));
  const credit = selected.reduce(
    (sum, item) => sum + (item.mirrorBuCredit ?? item.buCost),
    0,
  );
  const excluded = [...new Set([...savedIds, ...selectedIds])];
  const affordable = options.filter(
    (item) => (item.mirrorBuCredit ?? item.buCost) <= ceiling - credit,
  );
  const currentSuggestions =
    suggestionIds === null
      ? []
      : suggestionIds
          .map((id) => affordable.find((item) => item.id === id))
          .filter(
            (item): item is PrimitiveOption =>
              item !== undefined && !excluded.includes(item.id),
          );
  const suggestions =
    currentSuggestions.length === 3
      ? currentSuggestions
      : [
          ...currentSuggestions,
          ...chooseMirrorSuggestions(
            affordable,
            characterName,
            shuffleSeed,
            excluded,
            currentSuggestions.map((item) => item.id),
          ).filter(
            (item) =>
              !currentSuggestions.some((current) => current.id === item.id),
          ),
        ].slice(0, 3);
  const saved = [...new Set([...selectedIds, ...savedIds])]
    .map((id) => (selectedOptions ?? options).find((item) => item.id === id))
    .filter((item): item is PrimitiveOption => Boolean(item));
  const canShuffle = affordable.some((item) => !excluded.includes(item.id));
  const canAdd = (item: PrimitiveOption) =>
    selectedIds.includes(item.id) ||
    credit + (item.mirrorBuCredit ?? item.buCost) <= ceiling;

  return (
    <div className="sw-forge-stack sw-mirror-step">
      <section className="sw-mirror-principle">
        <div>
          <span>Optional choice</span>
          <h3>Take drawbacks for more abilities</h3>
          <p>
            A drawback turns one helpful rule into the weakness shown on its
            card. You can choose several, as long as their total credit stays
            within your level’s debt limit. You can also skip this and decide
            later.
          </p>
          <details className="sw-mirror-rules">
            <summary>How do drawbacks and extra points work?</summary>
            <p>
              Each drawback costs no BU and grants the credit shown on its card.
              At your level, their combined credit may be up to {ceiling + inheritedCredit} BU.{" "}
              {quick
                ? "The budget above includes this credit immediately."
                : "The next step adds that credit to your available points."}
            </p>
            <p>A drawback is a primitive used in reverse: for example, a Vitality increase becomes a decrease. You accept that consequence for the extra budget. A primitive you own can be used in either direction when composing an action; you do not purchase a second mirrored copy. Agree the action’s strain and consequences at the table.</p>
          </details>
        </div>
        <div className="sw-mirror-ledger">
          <span>
            <small>Base budget</small>
            <strong>{budget} BU</strong>
          </span>
          <span>
            <small>Drawback credit</small>
            <strong>
              +{credit + inheritedCredit} / {ceiling + inheritedCredit} BU
            </strong>
          </span>
          <span>
            <small>Available together</small>
            <strong>{budget + credit + inheritedCredit} BU</strong>
          </span>
        </div>
      </section>
      <button
        type="button"
        className={`sw-mirror-skip${selectedIds.length === 0 ? " is-active" : ""}`}
        aria-pressed={selectedIds.length === 0}
        onClick={() => onSelect(null)}
      >
        <span>
          {selectedIds.length ? "Clear drawbacks" : "No drawback for now"}
        </span>
        <small>Continue with {budget} BU. You can add drawbacks later.</small>
        <ArrowRight aria-hidden />
      </button>
      <section className="sw-mirror-choices">
        <header>
          <div>
            <span>{options.length} available at this level</span>
            <h3>Explore drawbacks</h3>
            <p>
              Choose as many as fit within {ceiling} BU total credit. Compare
              them below, or shuffle for new ideas.
            </p>
          </div>
          <button type="button" onClick={onShuffle} disabled={!canShuffle}>
            <Shuffle aria-hidden /> New suggestions
          </button>
        </header>
        {suggestions.length ? (
          <div className="sw-mirror-choices__grid">
            {suggestions.map((item) => (
              <MirrorOptionCard
                key={item.id}
                item={item}
                active={false}
                onSelect={() => onSelect(item.id)}
              />
            ))}
          </div>
        ) : (
          <p className="sw-mirror-choices__empty">
            {credit >= ceiling
              ? "You have reached this level’s debt limit. Remove a chosen drawback to explore more."
              : "No remaining drawbacks fit your available debt credit. Continue or remove one to explore again."}
          </p>
        )}
      </section>
      {saved.length ? (
        <section className="sw-forge-comparison">
          <header>
            <div>
              <span>Chosen and saved</span>
              <h3>Drawbacks you considered</h3>
            </div>
            <small>
              {selected.length} chosen · {credit} / {ceiling} BU credit
            </small>
          </header>
          <div className="sw-mirror-choices__grid">
            {saved.map((item) => (
              <div className="sw-forge-considered-item" key={item.id}>
                <MirrorOptionCard
                  item={item}
                  active={selectedIds.includes(item.id)}
                  disabled={!canAdd(item)}
                  onSelect={() => onSelect(item.id)}
                />
                <button
                  type="button"
                  className="sw-forge-considered-item__remove"
                  aria-label={`Remove ${item.name} from considered weaknesses`}
                  onClick={() => onRemove(item.id)}
                >
                  <X aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CanonicalDefinitions({
  definitions,
}: {
  definitions: Array<{
    key: string;
    name: string;
    tier: number | null;
    buCost: number;
    verboseDescription: string;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const unique = definitions
    .filter(
      (item, index, all) =>
        all.findIndex((candidate) => candidate.tier === item.tier) === index,
    )
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
  if (!unique.length) return null;
  return (
    <section className={`sw-access-definitions${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="sw-access-definitions__title"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <b>Definitions</b>
          <small>What each canonical tier permits</small>
        </span>
        <em>{unique.length} tiers</em>
        <ChevronDown aria-hidden />
      </button>
      {open ? (
        <div className="sw-access-definitions__body">
          {unique.map((definition) => (
            <div key={definition.key}>
              <b>{definition.tier === null ? "—" : `T${definition.tier}`}</b>
              <span>
                <strong>{definition.name}</strong>
                <small>{definition.verboseDescription}</small>
              </span>
              <em>{definition.buCost} BU</em>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DomainAuthoringDrawer({
  onSaved,
}: {
  onSaved: (primitiveId: number) => void;
}) {
  const [preview, setPreview] = useState<ReactNode>(
    <div className="v12-workspace-preview-empty">
      <span>Live preview</span>
      <strong>Create a Domain</strong>
      <p>The preview updates as you define its access and meaning.</p>
    </div>,
  );
  const handlePreview = useCallback<
    NonNullable<ComponentProps<typeof PrimitiveForm>["onStateChange"]>
  >(
    (state) =>
      setPreview(
        <PrimitiveFormPreview form={state.form} modifiers={state.modifiers} />,
      ),
    [],
  );
  const handleSaved = useCallback<
    NonNullable<ComponentProps<typeof PrimitiveForm>["onSaved"]>
  >((primitive) => onSaved(primitive.id), [onSaved]);
  const build = useMemo(
    () => (
      <div className="sw-domain-author">
        <header>
          <span>Starting access author</span>
          <h2>Create a Domain</h2>
          <p>
            Save it to the Library and it will be added to this character’s
            starting access.
          </p>
        </header>
        <PrimitiveForm
          initialCategory="DOMAIN_ACCESS"
          onStateChange={handlePreview}
          onSaved={handleSaved}
        />
      </div>
    ),
    [handlePreview, handleSaved],
  );
  useDrawerSlot(useMemo(() => ({ build, preview }), [build, preview]));
  return null;
}

export function PrimitiveSelectCard({
  item,
  selected,
  onToggle,
  showOrigin = true,
}: {
  item: PrimitiveOption;
  selected: boolean;
  onToggle: () => void;
  showOrigin?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sw-access-entry${selected ? " is-selected" : ""}`}
      data-selection-card="starting-access"
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className="sw-access-entry__icon">
        {item.iconSource ? (
          <IconDisplay
            iconSource={item.iconSource}
            iconKey={item.iconKey ?? null}
            iconUrl={item.iconUrl ?? null}
            iconColor={item.iconColor ?? null}
            size={30}
            alt=""
          />
        ) : (
          "◇"
        )}
      </span>
      <span className="sw-access-entry__copy">
        <span>
          <strong>{item.name}</strong>
          {selected ? (
            <em>
              <Check aria-hidden /> Selected
            </em>
          ) : null}
        </span>
        <small>
          {item.costTier || item.category.replaceAll("_", " ")}
          {showOrigin ? <> · {originOf(item) === "community" ? "Community" : "System"}</> : null}
          {item.version ? ` · v${item.version}` : ""}
        </small>
        {item.mechanicalOutputText ? (
          <span data-copy="mechanical">{item.mechanicalOutputText}</span>
        ) : null}
        {item.narrativeRule ? (
          <span data-copy="narrative">{item.narrativeRule}</span>
        ) : null}
      </span>
      <span className="sw-access-entry__cost">
        {item.buCost}
        <small>BU</small>
      </span>
    </button>
  );
}

function PanelTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  const phone = useIsMobile();
  return (
    <header className="sw-forge-panel__title">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        {phone ? (
          <details className="sw-forge-title-help">
            <summary>Guidance</summary>
            <p>{subtitle}</p>
          </details>
        ) : (
          <p>{subtitle}</p>
        )}
      </div>
    </header>
  );
}
function ForgeField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="sw-forge-field">
      <span>
        {label}
        {required ? <b>Required</b> : null}
      </span>
      {hint ? <small>{hint}</small> : null}
      {children}
    </label>
  );
}

/** Keep the input text separate from the valid build value so it can be cleared. */
function EditableBudgetInput({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  const external = String(value);
  const [draft, setDraft] = useState({ external, text: external });
  if (draft.external !== external) setDraft({ external, text: external });
  const text = draft.external === external ? draft.text : external;
  const setText = (text: string) => setDraft({ external, text });
  return (
    <input
      id="sw-forge-budget-value"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setText(next);
        const number = Number(next);
        if (next && Number.isSafeInteger(number) && number >= min)
          onChange(number);
      }}
      onBlur={() => {
        const number =
          text === ""
            ? value
            : clamp(Number(text), min, Number.MAX_SAFE_INTEGER);
        setText(String(number));
        onChange(number);
      }}
    />
  );
}
