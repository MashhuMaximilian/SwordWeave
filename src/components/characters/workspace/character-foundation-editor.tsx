"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { PortraitInput } from "@/components/characters/portrait-input";
import { normalizePortraitFrame, type PortraitFrame } from "@/lib/character/portrait-frame";
import { useCharacterFormRecovery } from "@/components/sandbox/character-authoring-context";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { BACKSTORY_FIELDS, parseBackstory } from "@/lib/character/character-backstory";
import { SIZE_BASE_SPEED, SIZE_CAPACITY } from "@/lib/engine/encumbrance";
import { computeProgressionPool } from "@/lib/engine/bu-balance";
import { getVolatilityCeiling, impliedLevelForBudget } from "@/lib/engine/bu";
import { proficiencyBonus } from "@/lib/engine/stats";
import type { DraftOperation } from "@/lib/character/workspace/draft-types";

type CharacterPayload = Extract<DraftOperation, { type: "character" }>["payload"];
export type FoundationSection = "concept" | "foundation" | "backstory";
export interface CharacterFoundationValues extends Omit<CharacterPayload, "backstory"> {
  backstory?: unknown;
  dmBonusBu?: number;
}
const SIZES = ["TINY", "SMALL", "MEDIUM", "LARGE", "HUGE", "GARGANTUAN"] as const;
const ATTRIBUTES = [
  { key: "attrPhysical", specialty: "PHYSICAL", title: "Physical", hint: "Strength, movement, and bodily effort." },
  { key: "attrMental", specialty: "MENTAL", title: "Mental", hint: "Reasoning, awareness, and resolve." },
  { key: "attrMagical", specialty: "MAGICAL", title: "Magical", hint: "Arcane force and supernatural expression." },
] as const;
const ROOTS = [
  { key: "lineage", title: "Lineage", hint: "What they are: inherited or created nature, body, senses, and innate traits.", placeholder: "A bear-like being with powerful senses" },
  { key: "upbringing", title: "Upbringing", hint: "What shaped them: community, history, work, education, and training.", placeholder: "Raised and trained for combat" },
  { key: "manifest", title: "Manifest", hint: "Who they are becoming: their chosen role, discipline, and evolving path.", placeholder: "An anti-magic hunter" },
] as const;

/** One contextual editor; every write becomes a parent-owned character draft operation. */
export function CharacterFoundationEditor({ character, characterId, operations = [], initialSection = "concept", busy = false, onSave, onClose, onDirtyChange }: {
  character: CharacterFoundationValues;
  characterId?: string;
  operations?: DraftOperation[];
  initialSection?: FoundationSection;
  busy?: boolean;
  onSave: (payload: CharacterPayload) => Promise<void>;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const prefix = useId();
  const [initial] = useState<CharacterFoundationValues>(() => operations.reduce((values, operation) => operation.type === "character" ? { ...values, ...operation.payload } : values, character));
  const [section, setSection] = useState<FoundationSection>(initialSection);
  const [name, setName] = useState(initial.name ?? "");
  const [portraitUrl, setPortraitUrl] = useState(initial.portraitUrl ?? "");
  const [portraitFrame, setPortraitFrame] = useState<PortraitFrame>(() => normalizePortraitFrame(initial.portraitFrame));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [backstory, setBackstory] = useState(() => parseBackstory(initial.backstory));
  const [roots, setRoots] = useState(() => ({ lineageName: initial.lineageName ?? "", lineageDescription: initial.lineageDescription ?? "", upbringingName: initial.upbringingName ?? "", upbringingDescription: initial.upbringingDescription ?? "", manifestName: initial.manifestName ?? "" }));
  const [size, setSize] = useState<NonNullable<CharacterPayload["size"]>>(initial.size ?? "MEDIUM");
  const [mode, setMode] = useState<"level" | "bu">((initial.startingBu ?? 25) === 25 ? "level" : "bu");
  const [levelText, setLevelText] = useState(String(initial.level ?? 1));
  const [buText, setBuText] = useState(String(initial.startingBu ?? 25));
  const [scores, setScores] = useState({ attrPhysical: String(initial.attrPhysical ?? 0), attrMental: String(initial.attrMental ?? 0), attrMagical: String(initial.attrMagical ?? 0) });
  const [specialty, setSpecialty] = useState<CharacterPayload["attrProficient"]>(initial.attrProficient ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editorState = { name, notes, backstory, roots, size, mode, levelText, buText, scores, specialty, portraitUrl, portraitFrame };
  const fingerprint = JSON.stringify(editorState);
  const [baseline, setBaseline] = useState(fingerprint);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = fingerprint !== baseline;
  const recovery = useCharacterFormRecovery("foundation", editorState, dirty, (saved) => {
    setName(saved.name); setNotes(saved.notes); setBackstory(parseBackstory(saved.backstory)); setRoots(saved.roots); setSize(saved.size); setMode(saved.mode); setLevelText(saved.levelText); setBuText(saved.buText); setScores(saved.scores); setSpecialty(saved.specialty); setPortraitUrl(saved.portraitUrl); setPortraitFrame(normalizePortraitFrame(saved.portraitFrame)); setNotice("Restored your unfinished foundation changes.");
  }, characterId ? `character:${characterId}:foundation` : undefined);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  function requestClose() { if (dirty) setConfirmClose(true); else onClose(); }
  const level = Number(levelText), startingBu = Number(buText);
  const validLevel = levelText.trim() !== "" && Number.isSafeInteger(level) && level >= 1;
  const validBu = buText.trim() !== "" && Number.isSafeInteger(startingBu) && startingBu >= 0;
  const numbers = ATTRIBUTES.map(({ key }) => Number(scores[key]));
  const sum = numbers.reduce((total, value) => total + value, 0);
  const validAttributes = numbers.every((value, index) => scores[ATTRIBUTES[index]!.key].trim() !== "" && Number.isInteger(value) && value >= -1 && value <= 5) && sum === 10;
  const budget = validLevel && validBu ? computeProgressionPool(startingBu, level, initial.dmBonusBu ?? 0) : null;
  const basePb = validLevel ? proficiencyBonus(level) : null;
  const debt = validLevel ? getVolatilityCeiling(level).maxNegativeBu : null;
  const disabled = busy || saving;

  function changeMode(next: "level" | "bu") {
    setMode(next);
    if (next === "level") setBuText("25");
    else if (budget !== null) setBuText(String(budget - (initial.dmBonusBu ?? 0)));
  }
  function changeBudget(value: string) {
    setBuText(value);
    const amount = Number(value);
    if (value.trim() && Number.isSafeInteger(amount) && amount >= 0) setLevelText(String(impliedLevelForBudget(amount)));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (!name.trim()) { setSection("concept"); setError("Give this character a name."); return; }
    if (!validLevel || !validBu || !validAttributes) {
      setSection("foundation");
      setError(!validLevel ? "Enter a whole level of 1 or higher." : !validBu ? "Enter a whole BU amount of zero or higher." : "Each base attribute must be between −1 and +5, and the three scores must total 10.");
      return;
    }
    const previousBackstory = initial.backstory && typeof initial.backstory === "object" && !Array.isArray(initial.backstory)
      ? Object.fromEntries(Object.entries(initial.backstory).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
    const updated: CharacterPayload = { name: name.trim(), portraitUrl: portraitUrl.trim() || null, portraitFrame, notes, ...roots, backstory: { ...previousBackstory, ...backstory }, size, level, startingBu, attrPhysical: numbers[0]!, attrMental: numbers[1]!, attrMagical: numbers[2]!, attrProficient: specialty ?? null };
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updated)) {
      const previous = initial[key as keyof CharacterFoundationValues];
      const equal = key === "portraitUrl" ? (value ?? "") === (previous ?? "") : key === "portraitFrame" ? JSON.stringify(value) === JSON.stringify(normalizePortraitFrame(previous)) : key === "backstory" ? JSON.stringify(value) === JSON.stringify({ ...previousBackstory, ...parseBackstory(previous) }) : value === previous || (value === "" && previous == null);
      if (!equal) payload[key] = value;
    }
    if (!Object.keys(payload).length) { setNotice("No changes to add to the draft."); return; }
    setSaving(true);
    try { await onSave(payload as CharacterPayload); recovery.clear(); setBaseline(fingerprint); onDirtyChange?.(false); setNotice("Saved to your character draft. Review changes before applying."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save these changes to the draft."); }
    finally { setSaving(false); }
  }

  return <form className="sheet-foundation-editor" onSubmit={(event) => void save(event)}>
    <header className="sheet-foundation-heading"><div><span className="sheet-kicker">Character foundation</span><h3>Who they are, and how they begin</h3><p>Shape the concept here. Your rules, capabilities, and items stay in the workshop.</p></div><button type="button" className="sheet-button" aria-label="Close foundation editor" disabled={disabled} onClick={requestClose}><X size={16}/></button></header>
    {confirmClose && <div className="sheet-foundation-close-confirm" role="alert"><strong>Keep these unfinished changes?</strong><p>They have not been added to your character draft yet.</p><div><button type="button" className="sheet-button is-gold" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" className="sheet-button" onClick={() => { recovery.clear(); onDirtyChange?.(false); onClose(); }}>Discard and close</button></div></div>}
    <nav className="sheet-foundation-tabs" aria-label="Foundation sections">{(["concept", "foundation", "backstory"] as const).map((tab) => <button type="button" key={tab} aria-pressed={section === tab} onClick={() => setSection(tab)}>{tab === "concept" ? "Concept & roots" : tab === "foundation" ? "Body & strengths" : "Backstory"}</button>)}</nav>
    {error && <p className="sheet-error" role="alert">{error}</p>}{notice && <p className="sheet-notice" role="status">{notice}</p>}
    <fieldset disabled={disabled} hidden={section !== "concept"} className="sheet-foundation-section">
      <label htmlFor={`${prefix}-name`}>Character name<input id={`${prefix}-name`} value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="What do people call them?"/></label>
      <details className="sheet-foundation-portrait"><summary>Portrait <small>Upload or link an image, then position it in the frame</small></summary><PortraitInput value={portraitUrl} onChange={setPortraitUrl} frame={portraitFrame} onFrameChange={setPortraitFrame} characterName={name}/></details>
      <section><h4>Character concept</h4><p>Describe their identity, signature ideas, and what you imagine them doing. These notes do not purchase rules.</p><MarkdownEditor ariaLabel="Character concept and notes" value={notes} onChange={setNotes} rows={4} placeholder="A bear-like warrior bred for combat who hunts dangerous magic…"/></section>
      <section><h4>The three roots of a character</h4><p>These describe where abilities come from. Naming a root does not add a bundle or spend BU.</p><div className="sheet-foundation-roots">{ROOTS.map((root) => <article key={root.key}><h5>{root.title}</h5><p>{root.hint}</p><label htmlFor={`${prefix}-${root.key}`}>{root.title} name<input id={`${prefix}-${root.key}`} maxLength={200} value={roots[`${root.key}Name`]} onChange={(event) => setRoots((value) => ({ ...value, [`${root.key}Name`]: event.target.value }))} placeholder={root.placeholder}/></label>{root.key !== "manifest" && <MarkdownEditor ariaLabel={`${root.title} description`} value={roots[`${root.key}Description`]} onChange={(description) => setRoots((value) => ({...value,[`${root.key}Description`]:description}))} rows={2} placeholder="What does this part of their story mean?"/>}</article>)}</div></section>
    </fieldset>
    <fieldset disabled={disabled} hidden={section !== "foundation"} className="sheet-foundation-section">
      <div className="sheet-foundation-basics"><label htmlFor={`${prefix}-size`}>Physical frame<select id={`${prefix}-size`} value={size} onChange={(event) => setSize(event.target.value as typeof size)}>{SIZES.map((value) => <option key={value} value={value}>{value.toLowerCase()} · {SIZE_CAPACITY[value]} load · {SIZE_BASE_SPEED[value]} ft walk</option>)}</select><small>{SIZE_BASE_SPEED[size]} ft walk · {Math.ceil(SIZE_BASE_SPEED[size]/2)} ft swim/climb · {SIZE_CAPACITY[size]} load, before rules.</small></label><div><div className="sheet-foundation-budget-mode" role="group" aria-label="Budget source"><button type="button" aria-pressed={mode === "level"} onClick={() => changeMode("level")}>By level</button><button type="button" aria-pressed={mode === "bu"} onClick={() => changeMode("bu")}>Custom BU</button></div><label htmlFor={`${prefix}-budget`}>{mode === "level" ? "Character level" : "Agreed starting budget"}<input id={`${prefix}-budget`} inputMode="numeric" type="text" value={mode === "level" ? levelText : buText} onChange={(event) => mode === "level" ? setLevelText(event.target.value) : changeBudget(event.target.value)}/></label><small>{mode === "level" ? "Levels have no game-imposed upper limit." : `The agreed budget determines level ${validLevel ? level : "…"}. Existing custom level settings stay unchanged until you edit this amount.`}</small></div></div>
      <dl className="sheet-foundation-readings"><div><dt>Rules budget</dt><dd>{budget ?? "—"} BU</dd></div><div><dt>Drawback limit</dt><dd>{debt ?? "—"} BU</dd></div><div><dt>Base proficiency</dt><dd>{basePb === null ? "—" : `+${basePb}`}</dd></div><div><dt>Base Max Vitality</dt><dd>{basePb === null ? "—" : (10 + basePb) * level}</dd></div></dl><p className="sheet-foundation-hint">Budget is the larger of your starting BU and the level’s allowance, plus any DM bonus. Vitality is (10 + PB) × level. Your rules can change the final values; review shows the full result.</p>
      <section><h4>Choose their strengths</h4><p>Distribute exactly 10 points across Physical, Mental, and Magical. Each base score is between −1 and +5.</p><div className="sheet-foundation-attributes">{ATTRIBUTES.map((attribute) => <label htmlFor={`${prefix}-${attribute.key}`} key={attribute.key}>{attribute.title}<input id={`${prefix}-${attribute.key}`} inputMode="numeric" type="text" value={scores[attribute.key]} onChange={(event) => setScores((value) => ({...value,[attribute.key]:event.target.value}))}/><small>{attribute.hint}</small></label>)}</div><p className={validAttributes ? "sheet-foundation-total is-valid" : "sheet-foundation-total"}>Total: {Number.isFinite(sum) ? sum : "—"} / 10</p><div className="sheet-foundation-specialty" role="group" aria-label="Proficient attribute"><span>Specialty</span>{ATTRIBUTES.map((attribute) => <button type="button" key={attribute.key} aria-pressed={specialty === attribute.specialty} onClick={() => setSpecialty(attribute.specialty)}>{attribute.title}</button>)}<button type="button" aria-pressed={specialty === null} onClick={() => setSpecialty(null)}>None</button></div><p className="sheet-foundation-hint">A proficient attribute adds your Proficiency Bonus to practices under that attribute. Purchased rules are added on top of these base scores.</p></section>
    </fieldset>
    <fieldset disabled={disabled} hidden={section !== "backstory"} className="sheet-foundation-section"><p>Optional story prompts. A personal flaw does not have to become a mechanical drawback.</p>{BACKSTORY_FIELDS.map((field) => <section key={field.key}><h4>{field.label}</h4><p>{field.description}</p><MarkdownEditor ariaLabel={field.label} value={backstory[field.key]} onChange={(value) => setBackstory((current) => ({...current,[field.key]:value}))} rows={3}/></section>)}</fieldset>
    <footer className="sheet-foundation-footer"><span>Your live character changes only after review.</span><button type="button" className="sheet-button" disabled={disabled} onClick={requestClose}>Close</button><button type="submit" className="sheet-button is-gold" disabled={disabled}><Check size={15}/>{disabled ? "Saving…" : "Add changes to draft"}</button></footer>
  </form>;
}
