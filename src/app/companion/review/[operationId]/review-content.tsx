import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import styles from "./review.module.css";

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function words(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll(".", " · ");
  const label = text === text.toUpperCase() ? text.toLowerCase() : text;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function entries(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

const prose = /backstory|description|markdown|narrativeRule|mechanicalOutputText|note|reason|rationale|^concept$|^recovery$|^text$|^addition$/i;
const id = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function ReviewValue({ value, field = "" }: { value: unknown; field?: string }) {
  if (Array.isArray(value)) return value.length
    ? <ul className={styles["list"]}>{value.map((item, index) => <li key={index}><ReviewValue value={item} field={field} /></li>)}</ul>
    : <span>None</span>;
  if (value && typeof value === "object") {
    return <dl className={styles["fields"]}>{Object.entries(value).map(([key, item]) => (
      <div key={key}>
        <dt>{words(key)}</dt>
        <dd><ReviewValue value={item} field={/backstory/i.test(field) ? field : key} /></dd>
      </div>
    ))}</dl>;
  }
  if (value === null || value === undefined || value === "") return <span>None</span>;
  if (typeof value === "string" && prose.test(field)) return <Markdown>{value}</Markdown>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span className={styles["value"]}>{String(value)}</span>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles["section"]}>
    <h2>{title}</h2>
    {children}
  </section>;
}

export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return <details className={styles["disclosure"]}>
    <summary>{label}<ChevronDown size={17} aria-hidden="true" /></summary>
    <div className={styles["details"]}>{children}</div>
  </details>;
}

export function ExactDetails({ summary, payload }: { summary: unknown; payload: unknown }) {
  return <Disclosure label="View exact save details">
    <ReviewValue value={summary} />
    {payload !== null && payload !== undefined && <>
      <h3>Save data</h3>
      <ReviewValue value={payload} />
    </>}
  </Disclosure>;
}

function Attributes({ value, proficiency }: { value: unknown; proficiency?: unknown }) {
  const attrs = record(value);
  return <dl className={styles["attributes"]}>
    {(["physical", "mental", "magical"] as const).map(key => (
      <div key={key}>
        <dt>{words(key)}</dt>
        <dd>{typeof attrs[key] === "number" ? attrs[key] : "—"}
          {String(proficiency ?? attrs["proficient"]).toLowerCase() === key && <small>Proficient</small>}
        </dd>
      </div>
    ))}
  </dl>;
}

const startingRules = [
  ["verbTier", "VERB_TIER", "Verb tier", ""],
  ["domain", "DOMAIN", "Domain", ""],
  ["range", "RANGE", "Range", "Touch"],
  ["dieType", "INTENSITY_DICE", "Die type", "1d4"],
] as const;

function PieceList({ pieces }: { pieces: Record<string, unknown>[] }) {
  return <ul className={styles["pieces"]}>{pieces.map((piece, index) => {
    const authored = record(piece["authored"]);
    const drawback = record(piece["drawback"]);
    const fork = record(authored["forkedFrom"])["name"];
    const credit = piece["mirrorCredit"] ?? drawback["mirrorCredit"];
    const cost = piece["isMirrored"] && typeof credit === "number" ? `${credit} BU credit`
      : typeof piece["buCost"] === "number" ? `${piece["buCost"]} BU` : "";
    const mechanics = authored["mechanicalOutputText"];
    const description = drawback["description"] ?? authored["narrativeRule"] ?? authored["verboseDescription"];
    const eligibility = drawback["eligibilityNotes"];
    return <li key={index}>
      <div className={styles["pieceHeading"]}>
        <strong>{typeof piece["name"] === "string" && !id.test(piece["name"]) ? piece["name"] : words(piece["kind"]) || "Build component"}</strong>
        {cost && <span>{cost}</span>}
      </div>
      {typeof piece["placement"] === "string" && <p className={styles["muted"]}>{words(piece["placement"])}{piece["isMirrored"] ? " · Mirrored" : ""}</p>}
      {typeof fork === "string" ? <p className={styles["muted"]}>Private fork of {fork}</p>
        : piece["authored"] ? <p className={styles["muted"]}>New private {typeof piece["kind"] === "string" ? piece["kind"].toLowerCase() : piece["members"] ? "capability" : "primitive"}</p> : null}
      {typeof description === "string" && <Markdown>{description}</Markdown>}
      {typeof mechanics === "string" && mechanics !== description && <Markdown>{mechanics}</Markdown>}
      {typeof eligibility === "string" && <Markdown>{eligibility}</Markdown>}
      {entries(piece["members"]).length > 0 && <p className={styles["muted"]}>
        {entries(piece["members"]).map(member => {
          const quantity = typeof member["quantity"] === "number" && member["quantity"] > 1 ? `${member["quantity"]} × ` : "";
          return quantity + String(member["name"] ?? "Build component");
        }).join(" · ")}
      </p>}
    </li>;
  })}</ul>;
}

function ReviewMessages({ summary }: { summary: Record<string, unknown> }) {
  const messages = [summary["blockers"], summary["warnings"], summary["tableQuestions"]].flatMap(value => Array.isArray(value) ? value : [])
    .concat(entries(summary["validationErrors"]).map(issue => issue["message"]))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  return messages.length > 0 && <Section title="Check before approving">
    <ul className={styles["list"]}>{messages.map((message, index) => <li key={index}><Markdown>{message}</Markdown></li>)}</ul>
  </Section>;
}

export function CharacterDraft({ summary }: { summary: Record<string, unknown> }) {
  const character = record(summary["normalized"]);
  const access = record(character["startingAccess"]);
  const placements = entries(character["placements"]);
  const owned = placements.filter(piece => !piece["isMirrored"]);
  const extras = owned.filter(piece => !startingRules.some(([, category]) => category === piece["category"]));
  const drawbacks = placements.filter(piece => piece["isMirrored"]);
  const capabilities = entries(character["capabilities"]);
  const backstory = Object.entries(record(character["backstory"])).filter((entry): entry is [string, string] =>
    typeof entry[1] === "string" && entry[1].trim().length > 0);
  return <>
    <ReviewMessages summary={summary} />
    <Section title="Attributes"><Attributes value={character["attributes"]} /></Section>
    <Section title="Starting rules">
      <div className={styles["ruleGroups"]}>
        {startingRules.map(([key, category, label, baseline]) => {
          const selected = owned.filter(piece => piece["category"] === category);
          return <div className={styles["rule"]} key={key}>
            <h3>{label}</h3>
            {access[key] === "freeBaseline"
              ? <div className={styles["pieceHeading"]}><strong>{baseline}</strong><span>Free</span></div>
              : selected.length ? <PieceList pieces={selected} /> : <p className={styles["muted"]}>Still to choose</p>}
          </div>;
        })}
      </div>
    </Section>
    {capabilities.length > 0 && <Section title="Capabilities"><PieceList pieces={capabilities} /></Section>}
    {extras.length > 0 && <Section title="Additional primitives"><PieceList pieces={extras} /></Section>}
    {drawbacks.length > 0 && <Section title="Mirrored drawbacks"><PieceList pieces={drawbacks} /></Section>}
    {backstory.length > 0 && <Section title="Backstory">
      <div className={styles["story"]}>{backstory.map(([field, value]) => (
        <div key={field}><h3>{words(field)}</h3><Markdown>{value}</Markdown></div>
      ))}</div>
    </Section>}
  </>;
}

export function CompanionDraft({ summary }: { summary: Record<string, unknown> }) {
  const pieces = entries(summary["components"]);
  return <>
    <ReviewMessages summary={summary} />
    {typeof summary["description"] === "string" && summary["description"] && <Section title="About this companion"><Markdown>{summary["description"]}</Markdown></Section>}
    <Section title="Attributes"><Attributes value={summary["attributes"]} proficiency={summary["proficientAttribute"]} /></Section>
    {pieces.length > 0 && <Section title="Build components"><PieceList pieces={pieces} /></Section>}
  </>;
}

const compareFields = [
  ["level", "Level"], ["currentVitality", "Current Vitality"], ["maxVitality", "Maximum Vitality"],
  ["proficiencyBonus", "Proficiency bonus"], ["progressionPool", "Progression budget"], ["progressionSpent", "Build Units spent"],
  ["progressionRemaining", "Build Units available"], ["pool", "Build Units budget"], ["spent", "Build Units spent"],
  ["remaining", "Build Units available"], ["volatilityCeiling", "Volatility ceiling"], ["debtUsed", "Drawback debt used"],
  ["itemSpent", "Item Build Units spent"], ["dmBonusBu", "GM bonus Build Units"], ["title", "Consequence"],
  ["description", "Description"], ["durationTier", "Duration"], ["status", "Status"],
] as const;

function Compare({ before, after, title }: { before: unknown; after: unknown; title: string }) {
  const from = record(before);
  const to = record(after);
  const rows = compareFields.filter(([key]) => from[key] != null || to[key] != null);
  return rows.length > 0 && <Section title={title}>
    <div className={styles["tableWrap"]}>
      <table className={styles["comparison"]}>
        <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
        <tbody>{rows.map(([key, label]) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            <td><ReviewValue value={from[key] ?? "—"} field={key} /></td>
            <td><ReviewValue value={to[key] ?? "—"} field={key} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </Section>;
}

const foundationFields: Record<string, string> = {
  attrPhysical: "Physical", attrMental: "Mental", attrMagical: "Magical", attrProficient: "Proficient attribute",
};

function ChangeValue({ value, field }: { value: unknown; field: string }) {
  const slot = record(value);
  return typeof slot["name"] === "string" && typeof slot["placement"] === "string"
    ? <PieceList pieces={[slot]} />
    : <ReviewValue value={value} field={field} />;
}

export function ChangesDraft({ summary }: { summary: Record<string, unknown> }) {
  const piece = record(summary["piece"]);
  const fields = record(piece["fields"]);
  const changes = entries(summary["changes"]).flatMap(change => Array.isArray(change["fields"]) ? entries(change["fields"]) : [change]);
  const budget = record(summary["budgetDelta"] ?? summary["budget"]);
  const note = summary["markdownAddition"] ?? summary["addition"];
  const rationale = summary["markdownRationale"];
  const after = record(summary["after"]);
  const source = record(summary["source"]);
  const addition = { ...piece, buCost: piece["buCost"] ?? fields["buCost"], authored: {
    narrativeRule: piece["description"] ?? piece["narrativeRule"] ?? fields["description"] ?? fields["verboseDescription"] ?? fields["narrativeDescription"],
    mechanicalOutputText: piece["mechanicalOutputText"],
  } };
  return <>
    <ReviewMessages summary={summary} />
    {typeof note === "string" && <Section title="Add to Player Notes"><Markdown>{note}</Markdown></Section>}
    {Object.keys(piece).length > 0 && <Section title={`New ${String(piece["kind"] ?? "build component")}`}>
      <PieceList pieces={[addition]} />
    </Section>}
    {changes.length > 0 && <Section title="Proposed changes">
      <div className={styles["story"]}>{changes.map((change, index) => {
        const field = typeof change["field"] === "string" ? change["field"] : "";
        return <div key={index}>
          <h3>{foundationFields[field] ?? (words(field || change["label"] || change["action"] || change["kind"]) || "Sheet change")}</h3>
          <dl className={styles["changeValues"]}>
            <div><dt>Before</dt><dd><ChangeValue value={change["before"] ?? change["from"]} field={field} /></dd></div>
            <div><dt>After</dt><dd><ChangeValue value={change["after"] ?? change["to"] ?? change["value"]} field={field} /></dd></div>
          </dl>
          {entries(change["members"]).length > 0 && <PieceList pieces={entries(change["members"])} />}
          {typeof change["privateCopyAccess"] === "string" && <Markdown>{change["privateCopyAccess"]}</Markdown>}
        </div>;
      })}</div>
    </Section>}
    {typeof source["name"] === "string" && <Section title="Play action"><p>{source["name"]}</p></Section>}
    {entries(after["occurrences"]).length > 0 && <Section title="Consequences">
      <PieceList pieces={entries(after["occurrences"]).map(occurrence => ({ ...occurrence, name: occurrence["title"] ?? occurrence["name"], drawback: { description: occurrence["description"] } }))} />
    </Section>}
    <Compare title="Sheet changes" before={summary["before"]} after={summary["after"]} />
    {typeof budget["before"] === "number" && typeof budget["after"] === "number"
      ? <Compare title="Build budget" before={{ remaining: budget["before"] }} after={{ remaining: budget["after"] }} />
      : <Compare title="Build budget" before={budget["before"]} after={budget["after"]} />}
    {typeof rationale === "string" && rationale.trim() && <Section title="Reason for the change"><Markdown>{rationale}</Markdown></Section>}
    {typeof summary["decision"] === "string" && <Section title="Decision">
      <p>{words(summary["decision"])} proposal</p>
      {typeof summary["decisionNote"] === "string" && <Markdown>{summary["decisionNote"]}</Markdown>}
    </Section>}
  </>;
}

export function Budget({ spent, pool, remaining, credit, debt, items }: {
  spent: unknown; pool: unknown; remaining: unknown; credit: unknown; debt: unknown; items?: unknown;
}) {
  if (typeof spent !== "number" || typeof pool !== "number") return null;
  return <div className={styles["budget"]}>
    <h2>Build budget</h2>
    <p className={styles["budgetTotal"]}><strong>{spent}</strong><span> / {pool} BU</span></p>
    {pool > 0 && <meter className={styles["meter"]} min={0} max={pool} value={Math.min(spent, pool)} aria-label="Build Units spent from the base budget" />}
    <dl className={styles["budgetLabels"]}>
      {typeof remaining === "number" && <div><dt>Available</dt><dd>{remaining} BU</dd></div>}
      {typeof credit === "number" && credit > 0 && <div><dt>Drawback credit</dt><dd>{credit} BU</dd></div>}
      {typeof debt === "number" && debt > 0 && <div><dt>Drawback debt used</dt><dd>{debt} BU</dd></div>}
      {typeof items === "number" && items > 0 && <div><dt>Item spending</dt><dd>{items} BU</dd></div>}
    </dl>
  </div>;
}
