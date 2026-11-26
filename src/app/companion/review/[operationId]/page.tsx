import { notFound } from "next/navigation";
import { Markdown } from "@/components/ui/markdown";
import { resolveCompanionBrowserActor } from "@/lib/mcp/browser-approval";
import { getOperationReview, OperationUnavailableError } from "@/lib/mcp/operations";

export const dynamic = "force-dynamic";
export const metadata = { robots: "noindex, nofollow", referrer: "no-referrer" } as const;

const statusText = {
  pending_approval: "Waiting for your approval",
  approved: "Approved. Return to the companion to continue.",
  completed: "Saved",
  blocked: "This review can no longer be saved. Prepare a new review in the companion.",
  superseded: "A newer review replaced this one.",
};

function reviewLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function ReviewValue({ value, field = "" }: { value: unknown; field?: string }) {
  if (Array.isArray(value)) return <ul className="list-disc space-y-2 pl-5">{value.map((item, i) => (
    <li key={i}><ReviewValue value={item} field={field} /></li>
  ))}</ul>;
  if (value && typeof value === "object") {
    const changeField = "field" in value && typeof value.field === "string" ? value.field : null;
    return <dl className="grid gap-2">{Object.entries(value).map(([key, item]) => (
    <div key={key} className="space-y-1">
      <dt className="font-medium first-letter:uppercase">{reviewLabel(key)}</dt>
        <dd className="break-words pl-3"><ReviewValue value={item} field={changeField && ["before", "after", "from", "to"].includes(key)
          ? changeField : /backstory/i.test(field) ? field : key} /></dd>
    </div>
    ))}</dl>;
  }
  if (value === null || value === undefined || value === "") return <span>None</span>;
  if (typeof value === "string" && /backstory|description|markdown|narrativeRule|mechanicalOutputText|note|reason|rationale|^recovery$|^text$|^addition$/i.test(field)) return <Markdown>{value}</Markdown>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

export default async function CompanionReviewPage({ params }: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await params;
  const actor = await resolveCompanionBrowserActor();
  if (!actor) notFound();
  const { status, confirmation } = await getOperationReview(actor, operationId).catch(error => {
    if (error instanceof OperationUnavailableError) notFound();
    throw error;
  });
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold">Review {reviewLabel(status.kind)}</h1>
      <p>{status.downloadUrl ? "Approved. Your progression PDF is ready." : statusText[status.state]}</p>
      <p className="text-sm">Available until <time dateTime={status.expiresAt}>{new Date(status.expiresAt).toUTCString()}</time></p>
    </header>
    {confirmation && <>
      {confirmation.document ? <section className="space-y-3">
        <h2 className="text-lg font-semibold">{confirmation.document.title}</h2>
        <ol className="list-decimal space-y-2 pl-5">{confirmation.document.ideas.map((idea, ordinal) => (
          <li key={ordinal}><Markdown>{idea}</Markdown></li>
        ))}</ol>
      </section> : <>
        <ReviewValue value={confirmation.summary} />
        {confirmation.payload !== null && <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">Reviewed save details</summary>
          <div className="mt-3"><ReviewValue value={confirmation.payload} /></div>
        </details>}
      </>}
      <form action={`/api/companion/operations/${status.operationId}/approve`} method="post">
        <input type="hidden" name="operationId" value={status.operationId} />
        <input type="hidden" name="nonce" value={confirmation.nonce} />
        <input type="hidden" name="digest" value={confirmation.digest} />
        <button type="submit" className="rounded border px-4 py-2 font-medium">Approve this review</button>
      </form>
    </>}
    {status.downloadUrl && <a className="underline" href={status.downloadUrl}>Download progression PDF</a>}
    {status.sheetUrl && <a className="underline" href={status.sheetUrl}>Open character sheet</a>}
    {status.sheetPdfUrl && <a className="underline" href={status.sheetPdfUrl}>Download character-sheet PDF</a>}
  </main>;
}
