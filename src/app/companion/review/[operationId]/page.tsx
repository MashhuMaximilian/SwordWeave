import { ArrowDown, ArrowRight, Check, Clock3, Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/ui/markdown";
import { resolveCompanionBrowserActor } from "@/lib/mcp/browser-approval";
import { getBrowserReviewMcpConfig } from "@/lib/mcp/config";
import { getOperationReview, OperationUnavailableError, type OperationKind } from "@/lib/mcp/operations";
import { withMcpRequestConfig } from "@/lib/mcp/request-config";
import { Budget, ChangesDraft, CharacterDraft, CompanionDraft, ExactDetails, record, Section, words } from "./review-content";
import styles from "./review.module.css";

export const dynamic = "force-dynamic";
// Keep the Origin on same-origin form submissions while withholding the review URL from other sites.
export const metadata = { robots: "noindex, nofollow", referrer: "same-origin" } as const;

const actions = {
  character_create: { title: "Create character", effect: "create this private character in your SwordWeave account." },
  progression_pdf: { title: "Export progression plan", effect: "Make this progression plan available to download as a PDF." },
  progression_note: { title: "Save progression notes", effect: "add this progression plan to the character’s Player Notes." },
  character_edit: { title: "Edit character", effect: "apply the reviewed changes to the character sheet." },
  character_piece: { title: "Create build component", effect: "create this private component and add it to the character." },
  companion_create: { title: "Create and add companion", effect: "create a private Bestiary monster and add it to the character as a companion." },
  character_advancement: { title: "Advance character", effect: "update the character’s level and progression budget." },
  character_proposal_submit: { title: "Submit character proposal", effect: "send these changes to the character’s owner for review." },
  character_proposal_decide: { title: "Decide on character proposal", effect: "apply your decision to this character proposal." },
  character_version_proposal_submit: { title: "Submit component version proposal", effect: "send this component version to the character’s owner for review." },
  character_version_proposal_decide: { title: "Decide on component version", effect: "apply your decision to this component version proposal." },
  session_note: { title: "Save session note", effect: "append this note to the character’s Player Notes." },
  session_play_action: { title: "Update play sheet", effect: "apply the reviewed in-session change to the character sheet." },
} satisfies Record<OperationKind, { title: string; effect: string }>;

const statuses = {
  pending_approval: "Awaiting approval",
  approved: "Approved",
  completed: "Saved",
  blocked: "Unavailable",
  superseded: "Replaced",
};

const expiryFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function CompanionReviewPage({ params }: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await params;
  const config = getBrowserReviewMcpConfig();
  if (!config) notFound();
  const actor = await resolveCompanionBrowserActor(config);
  if (!actor) notFound();
  const { status, confirmation } = await withMcpRequestConfig(config, () => getOperationReview(actor, operationId)).catch(error => {
    if (error instanceof OperationUnavailableError) notFound();
    throw error;
  });
  const action = actions[status.kind];
  const summary = record(confirmation?.summary);
  const character = record(summary["normalized"]);
  const budget = record(summary["budget"]);
  const isCharacter = status.kind === "character_create";
  const isCompanion = status.kind === "companion_create";
  const name = confirmation?.document?.title ?? (isCharacter ? character["name"] : isCompanion ? summary["name"] : summary["characterName"]);
  const title = typeof name === "string" && name ? name : action.title;
  const size = words(isCharacter ? character["size"] : isCompanion ? summary["size"] : null);
  const facts = [
    typeof budget["level"] === "number" ? `Level ${budget["level"]}` : null,
    size ? `${size} size` : null,
    isCompanion && typeof summary["character"] === "string" ? `Companion for ${summary["character"]}` : null,
    isCompanion && typeof summary["startingVitality"] === "number" ? `${summary["startingVitality"]} starting Vitality` : null,
  ].filter(Boolean);
  const privateDraft = !!confirmation && (isCharacter || isCompanion);
  const expiry = expiryFormat.format(new Date(status.expiresAt));

  return <main className={styles["page"]}>
    <header className={styles["header"]}>
      <div className={styles["headerTop"]}>
        <p>SwordWeave · ChatGPT Companion</p>
        <span className={styles["status"]} data-state={status.state}>
          {status.state === "approved" || status.state === "completed"
            ? <Check size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
          {statuses[status.state]}
        </span>
      </div>
      <h1>{title}</h1>
      {(title !== action.title || facts.length > 0 || privateDraft) && <ul className={styles["meta"]}>
        {title !== action.title && <li>{action.title}</li>}
        {facts.map(fact => <li key={fact}>{fact}</li>)}
        {privateDraft && <li><LockKeyhole size={14} aria-hidden="true" />Private</li>}
      </ul>}
      {confirmation && <a className={styles["jump"]} href="#approval">Go to approval <ArrowDown size={15} aria-hidden="true" /></a>}
    </header>

    {confirmation ? <div className={styles["layout"]}>
      <div className={styles["content"]}>
        {confirmation.document ? <Section title="Progression plan">
          <ol className={styles["ordered"]}>{confirmation.document.ideas.map((idea, index) => <li key={index}><Markdown>{idea}</Markdown></li>)}</ol>
        </Section> : <>
          {isCharacter ? <CharacterDraft summary={summary} />
            : isCompanion ? <CompanionDraft summary={summary} />
            : <ChangesDraft summary={summary} />}
          <ExactDetails summary={confirmation.summary} payload={confirmation.payload} />
        </>}
      </div>
      <aside className={styles["rail"]}>
        <div id="approval" className={styles["approval"]}>
          <ShieldCheck size={24} aria-hidden="true" className={styles["shield"]} />
          <h2>Approve this draft</h2>
          {status.kind === "progression_pdf" ? <p>{action.effect}</p> :
            <p>After approving, return to ChatGPT to {action.effect}</p>}
          <form action={`/api/companion/operations/${status.operationId}/approve`} method="post">
            <input type="hidden" name="operationId" value={status.operationId} />
            <input type="hidden" name="nonce" value={confirmation.nonce} />
            <input type="hidden" name="digest" value={confirmation.digest} />
            <button type="submit" className={styles["primary"]}>Approve draft <ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <small>Review expires <time dateTime={status.expiresAt}>{expiry} UTC</time></small>
        </div>
        {isCharacter && <Budget spent={budget["positiveSpent"]} pool={budget["startingBu"]} remaining={budget["remaining"]} credit={budget["mirrorCredit"]} debt={budget["debtUsed"]} />}
        {isCompanion && <Budget spent={summary["spentBu"]} pool={summary["baseBudget"]} remaining={typeof summary["availableBu"] === "number" && typeof summary["spentBu"] === "number" ? Math.max(0, summary["availableBu"] - summary["spentBu"]) : null}
          credit={summary["weaknessCreditBu"]} debt={summary["debtUsedBu"]} items={summary["itemBu"]} />}
      </aside>
    </div> : <div className={styles["result"]}>
      <h2>{status.downloadUrl ? "Your progression PDF is ready" : statuses[status.state]}</h2>
      {!status.downloadUrl && {
        pending_approval: <p>Return to ChatGPT to prepare a review you can approve.</p>,
        approved: <p>Return to the ChatGPT conversation to finish applying this change.</p>,
        completed: <p>SwordWeave applied the approved change.</p>,
        blocked: <p>Return to ChatGPT to prepare a new review.</p>,
        superseded: <p>A newer review replaced this one. Use the latest review link in your ChatGPT conversation.</p>,
      }[status.state]}
      {(status.downloadUrl || status.sheetUrl || status.sheetPdfUrl) && <div className={styles["resultLinks"]}>
        {status.downloadUrl && <a className={styles["primary"]} href={status.downloadUrl}>Download progression PDF <Download size={18} aria-hidden="true" /></a>}
        {status.sheetUrl && <a className={styles["primary"]} href={status.sheetUrl}>Open character sheet <ArrowRight size={18} aria-hidden="true" /></a>}
        {status.sheetPdfUrl && <a className={styles["secondary"]} href={status.sheetPdfUrl}>Download character PDF <Download size={18} aria-hidden="true" /></a>}
      </div>}
    </div>}
  </main>;
}
