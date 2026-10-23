"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Expand, LoaderCircle, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { onCharacterLogAdded, onVitalityChanged } from "@/lib/character/character-events";
import "./character-pdf-actions.css";

export const CHARACTER_PDF_STYLES = [
  "aegis", "vesper", "orrery", "moire", "serein", "prism",
  "cipher", "helix", "cinder", "nocturne", "tidal", "solstice",
] as const;

export interface CharacterPdfOptions {
  style: typeof CHARACTER_PDF_STYLES[number];
  density: "auto" | "normal" | "compact";
  orientation: "portrait" | "landscape";
  workbench: boolean;
  color: boolean;
}

export const DEFAULT_CHARACTER_PDF_OPTIONS: CharacterPdfOptions = {
  style: "aegis", density: "auto", orientation: "portrait", workbench: false, color: false,
};
const PREFERENCE_KEY = "swordweave.character-pdf.options.v1";

type PdfStyle = CharacterPdfOptions["style"];
type PreviewVariant = { orientation: CharacterPdfOptions["orientation"]; density: "normal" | "compact"; color?: boolean };

export function characterPdfStylePreview(style: PdfStyle, variant: PreviewVariant): string {
  return `/character-sheet-styles/${style}-${variant.orientation}-${variant.density}${variant.color ? "-color" : ""}.webp`;
}

export function nextCharacterPdfStyle(style: PdfStyle, key: string): PdfStyle | null {
  const index = CHARACTER_PDF_STYLES.indexOf(style);
  if (key === "Home") return CHARACTER_PDF_STYLES[0];
  if (key === "End") return CHARACTER_PDF_STYLES[CHARACTER_PDF_STYLES.length - 1]!;
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  return step ? CHARACTER_PDF_STYLES[(index + step + CHARACTER_PDF_STYLES.length) % CHARACTER_PDF_STYLES.length]! : null;
}

function styleName(style: PdfStyle): string { return style.charAt(0).toUpperCase() + style.slice(1); }

function PreviewVariants({ value, onChange }: { value: CharacterPdfOptions; onChange: (variant: Partial<CharacterPdfOptions>) => void }) {
  return <div className="sw-character-pdf-preview-variants" aria-label="PDF layout">
    <div role="group" aria-label="PDF orientation">
      {(["portrait", "landscape"] as const).map((orientation) => <button type="button" key={orientation} aria-pressed={value.orientation === orientation} onClick={() => onChange({ ...value, orientation })}>{orientation === "portrait" ? "Portrait" : "Landscape"}</button>)}
    </div>
    <div role="group" aria-label="PDF density">
      {(["auto", "normal", "compact"] as const).map((density) => <button type="button" key={density} aria-pressed={value.density === density} onClick={() => onChange({ density })}>{density === "auto" ? "Automatic" : density === "normal" ? "Normal" : "Dense"}</button>)}
    </div>
    <label className="sw-character-pdf-color"><input type="checkbox" checked={value.color} onChange={(event) => onChange({ color: event.target.checked })} /><span>Color PDF<small>Metallic gold, teal and silver</small></span></label>
  </div>;
}

function CharacterPdfStyleGallery({ options, onChange }: { options: CharacterPdfOptions; onChange: (change: Partial<CharacterPdfOptions>) => void }) {
  const [hoverStyle, setHoverStyle] = useState<PdfStyle>(options.style);
  const [previewStyle, setPreviewStyle] = useState<PdfStyle | null>(null);
  const variant: PreviewVariant = { orientation: options.orientation, density: options.density === "normal" ? "normal" : "compact", color: options.color };
  const [zoomed, setZoomed] = useState(false);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const tiles = useRef<Partial<Record<PdfStyle, HTMLButtonElement | null>>>({});
  const galleryLabelId = useId();
  const previewTitleId = useId();
  const previewHintId = useId();

  useEffect(() => {
    if (previewStyle) previewDialog.current?.showModal();
  }, [previewStyle]);

  function openPreview(style: PdfStyle, button?: HTMLButtonElement) {
    returnFocus.current = button ?? tiles.current[style] ?? null;
    setHoverStyle(style);
    setZoomed(false);
    setPreviewStyle(style);
  }

  function closePreview() {
    previewDialog.current?.close();
    setPreviewStyle(null);
    returnFocus.current?.focus();
  }

  return <section className="sw-character-pdf-designs" aria-labelledby={galleryLabelId}>
    <div className="sw-character-pdf-designs-heading"><h3 id={galleryLabelId}>Design</h3><p>Hover to preview. Click to choose.</p></div>
    <div className="sw-character-pdf-gallery">
      <div className="sw-character-pdf-style-grid" role="radiogroup" aria-labelledby={galleryLabelId} onPointerLeave={() => setHoverStyle(options.style)}>
        {CHARACTER_PDF_STYLES.map((style) => <button
          type="button" role="radio" aria-checked={options.style === style} title={`Choose ${styleName(style)}`}
          tabIndex={options.style === style ? 0 : -1} key={style}
          ref={(element) => { tiles.current[style] = element; }}
          className="sw-character-pdf-style" data-selected={options.style === style || undefined}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setHoverStyle(style); }}
          onFocus={() => setHoverStyle(style)}
          onClick={(event) => {
            onChange({ style });
            setHoverStyle(style);
            if (window.matchMedia("(hover: none), (pointer: coarse)").matches) openPreview(style, event.currentTarget);
          }}
          onKeyDown={(event) => {
            const next = nextCharacterPdfStyle(style, event.key);
            if (!next) return;
            event.preventDefault();
            onChange({ style: next });
            tiles.current[next]?.focus();
          }}
        >
          {/* These pre-rendered examples are already sized and compressed for the gallery. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={characterPdfStylePreview(style, variant)} alt="" loading="lazy" width={variant.orientation === "portrait" ? 420 : 594} height={variant.orientation === "portrait" ? 594 : 420} />
          <span>{styleName(style)}{options.style === style && <Check aria-hidden="true" />}</span>
        </button>)}
      </div>
      <aside className="sw-character-pdf-hover-preview" aria-label="Design example">
        <div className="sw-character-pdf-hover-title"><strong>{styleName(hoverStyle)}</strong><button type="button" onClick={() => openPreview(hoverStyle)} aria-label={`Enlarge ${styleName(hoverStyle)} example`}><Expand aria-hidden="true" /></button></div>
        <PreviewVariants value={options} onChange={onChange} />
        <button className="sw-character-pdf-preview-page" type="button" onClick={() => openPreview(hoverStyle)} aria-label={`Enlarge ${styleName(hoverStyle)} example`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={characterPdfStylePreview(hoverStyle, variant)} alt={`${styleName(hoverStyle)} ${variant.orientation}, ${variant.density === "compact" ? "dense" : "normal"} character sheet example`} width={variant.orientation === "portrait" ? 420 : 594} height={variant.orientation === "portrait" ? 594 : 420} />
        </button>
      </aside>
    </div>
    <div className="sw-character-pdf-mobile-layout"><PreviewVariants value={options} onChange={onChange} /></div>
    <p className="sw-character-pdf-example-hint">Examples show Orren. {options.density === "auto" ? "Automatic fits the layout to your character; this example shows Dense. " : ""}Extra rules continue onto supporting pages.</p>
    {previewStyle && <dialog ref={previewDialog} className="sw-character-pdf-preview-dialog" aria-labelledby={previewTitleId} aria-describedby={previewHintId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); closePreview(); }} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
      <div className="sw-character-pdf-preview-panel">
        <header><h2 id={previewTitleId}>{styleName(previewStyle)}</h2><button type="button" className="sw-character-pdf-close" onClick={closePreview} aria-label="Close design preview"><X aria-hidden="true" /></button></header>
        <p id={previewHintId}>Orren example. These layout choices apply to your character’s PDF.{options.density === "auto" ? " Automatic fits your character; the example shows Dense." : ""}</p>
        <div className="sw-character-pdf-preview-toolbar"><PreviewVariants value={options} onChange={(next) => { onChange(next); setZoomed(false); }} /><button type="button" className="sw-character-pdf-zoom" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>{zoomed ? <ZoomOut aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}{zoomed ? "Fit page" : "Enlarge"}</button></div>
        <div className={`sw-character-pdf-preview-canvas${zoomed ? " is-zoomed" : ""}`} data-orientation={variant.orientation}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={characterPdfStylePreview(previewStyle, variant)} alt={`${styleName(previewStyle)} ${variant.orientation}, ${variant.density === "compact" ? "dense" : "normal"} character sheet example`} width={variant.orientation === "portrait" ? 840 : 1188} height={variant.orientation === "portrait" ? 1188 : 840} />
        </div>
        <footer><button type="button" className="is-primary" onClick={closePreview}>Back to designs</button></footer>
      </div>
    </dialog>}
  </section>;
}

/** Stored preferences are untrusted; old or malformed fields fall back individually. */
export function parseCharacterPdfOptions(value: unknown): CharacterPdfOptions {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    style: CHARACTER_PDF_STYLES.includes(candidate["style"] as CharacterPdfOptions["style"])
      ? candidate["style"] as CharacterPdfOptions["style"] : DEFAULT_CHARACTER_PDF_OPTIONS.style,
    density: candidate["density"] === "normal" || candidate["density"] === "compact" || candidate["density"] === "auto"
      ? candidate["density"] : DEFAULT_CHARACTER_PDF_OPTIONS.density,
    orientation: candidate["orientation"] === "landscape" || candidate["orientation"] === "portrait"
      ? candidate["orientation"] : DEFAULT_CHARACTER_PDF_OPTIONS.orientation,
    workbench: typeof candidate["workbench"] === "boolean" ? candidate["workbench"] : DEFAULT_CHARACTER_PDF_OPTIONS.workbench,
    color: typeof candidate["color"] === "boolean" ? candidate["color"] : DEFAULT_CHARACTER_PDF_OPTIONS.color,
  };
}

function storedOptions(): CharacterPdfOptions {
  try { return parseCharacterPdfOptions(JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? "null")); }
  catch { return { ...DEFAULT_CHARACTER_PDF_OPTIONS }; }
}

export function characterPdfFilename(disposition: string | null, characterName?: string): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i);
  let filename = plain?.[1] ?? plain?.[2]?.trim();
  if (encoded) {
    try { filename = decodeURIComponent(encoded); } catch { /* Prefer the ordinary filename when malformed. */ }
  }
  filename = (filename ?? `swordweave-${characterName ?? "character"}.pdf`)
    .replace(/[\u0000-\u001f\u007f/\\]/g, "-").trim();
  return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename || "swordweave-character"}.pdf`;
}

export async function requestCharacterPdf(characterId: string, options: CharacterPdfOptions, signal: AbortSignal, characterName?: string) {
  const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/pdf" },
    body: JSON.stringify(options), signal,
  });
  if (!response.ok) {
    let message = response.status === 403 || response.status === 404
      ? "This character is no longer available to export. Refresh the page and try again."
      : "The PDF could not be created. Please try again.";
    try {
      const details = await response.json() as { error?: unknown };
      if (typeof details.error === "string") message = details.error;
    } catch { /* Keep the readable fallback for non-JSON failures. */ }
    throw new Error(message);
  }
  if (!response.headers.get("Content-Type")?.includes("application/pdf")) {
    throw new Error("The server did not return a PDF. Refresh the page and try again.");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("The PDF was empty. Please try again.");
  const warningCount = Number(response.headers.get("X-SwordWeave-PDF-Artwork-Warnings") ?? "0");
  const artworkWarnings = Number.isSafeInteger(warningCount) && warningCount > 0 ? warningCount : 0;
  return { blob, filename: characterPdfFilename(response.headers.get("Content-Disposition"), characterName), artworkWarnings };
}

export function observeCharacterPdfChanges(characterId: string, invalidate: (reason: "change" | "return") => void) {
  const changed = () => invalidate("change");
  const returned = () => invalidate("return");
  const storageChanged = (event: StorageEvent) => { if (!event.key || event.key.includes(characterId)) changed(); };
  const workspaceChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ characterId?: string }>).detail;
    if (!detail?.characterId || detail.characterId === characterId) changed();
  };
  const unsubscribeLog = onCharacterLogAdded(characterId, changed);
  const unsubscribeVitality = onVitalityChanged(characterId, changed);
  const events = ["sw:workspace-changed", "sw:library-changed", "sw:toggle-changed"];
  for (const event of events) window.addEventListener(event, workspaceChanged);
  window.addEventListener("focus", returned);
  window.addEventListener("storage", storageChanged);
  return () => {
    unsubscribeLog(); unsubscribeVitality();
    for (const event of events) window.removeEventListener(event, workspaceChanged);
    window.removeEventListener("focus", returned);
    window.removeEventListener("storage", storageChanged);
  };
}

type PdfArtifact = { url: string; filename: string; signature: string; printWindows: Window[]; artworkWarnings: number };

/** Keep URLs alive while a PDF viewer is open, even when this sheet is unmounted. */
function releaseArtifact(artifact: PdfArtifact) {
  const releaseWhenUnused = () => {
    if (artifact.printWindows.some((viewer) => !viewer.closed)) {
      window.setTimeout(releaseWhenUnused, 30_000);
    } else {
      window.setTimeout(() => URL.revokeObjectURL(artifact.url), 60_000);
    }
  };
  releaseWhenUnused();
}

function openWaitingPrintWindow(): Window | null {
  try {
    const viewer = window.open("", "_blank");
    if (viewer) {
      viewer.opener = null;
      viewer.document.title = "Preparing character PDF — SwordWeave";
      viewer.document.body.textContent = "Preparing your character PDF… You can close this tab to cancel printing.";
    }
    return viewer;
  } catch { return null; }
}

function sendToPrintViewer(artifact: PdfArtifact, viewer: Window) {
  artifact.printWindows.push(viewer);
  viewer.addEventListener("load", () => {
    // PDF viewers differ: always retain the ordinary viewer and its own Print action.
    window.setTimeout(() => {
      if (!viewer.closed) {
        try { viewer.focus(); viewer.print(); } catch { /* The native viewer remains the fallback. */ }
      }
    }, 600);
  }, { once: true });
  viewer.location.replace(artifact.url);
}

interface CharacterPdfActionsProps {
  characterId: string;
  characterName?: string;
  compact?: boolean;
}

export function CharacterPdfActions(props: CharacterPdfActionsProps) {
  // Route transitions may reuse this component. A prepared PDF, pending request
  // and print window must belong to exactly one character's lifetime.
  return <CharacterPdfActionsForCharacter key={props.characterId} {...props} />;
}

function CharacterPdfActionsForCharacter({ characterId, characterName, compact = false }: CharacterPdfActionsProps) {
  const [intent, setIntent] = useState<"download" | "print" | null>(null);
  const [options, setOptions] = useState<CharacterPdfOptions>(DEFAULT_CHARACTER_PDF_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState<PdfArtifact | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const artifact = useRef<PdfArtifact | null>(null);
  const controller = useRef<AbortController | null>(null);
  const waitingWindow = useRef<Window | null>(null);
  const titleId = useId();
  const hintId = useId();

  function discardArtifact() {
    if (artifact.current) releaseArtifact(artifact.current);
    artifact.current = null;
    setReady(null);
  }

  function close() {
    controller.current?.abort();
    controller.current = null;
    waitingWindow.current?.close();
    waitingWindow.current = null;
    discardArtifact();
    dialog.current?.close();
    setIntent(null);
    setBusy(false);
    opener.current?.focus();
  }

  useEffect(() => {
    if (intent) dialog.current?.showModal();
  }, [intent]);

  useEffect(() => {
    if (!intent) return;
    return observeCharacterPdfChanges(characterId, (reason) => {
      // Regenerate after a confirmed change, or when returning from a different tab.
      // A new print viewer opening must not cancel its own in-flight request.
      if (reason === "return" && !artifact.current) return;
      controller.current?.abort();
      controller.current = null;
      waitingWindow.current?.close();
      waitingWindow.current = null;
      if (artifact.current) releaseArtifact(artifact.current);
      artifact.current = null;
      setReady(null);
      setBusy(false);
      setStatus("Create a fresh PDF to include the latest saved character values.");
    });
  }, [characterId, intent]);

  useEffect(() => () => {
    controller.current?.abort();
    controller.current = null;
    waitingWindow.current?.close();
    if (artifact.current) releaseArtifact(artifact.current);
  }, []);

  function begin(action: "download" | "print", button: HTMLButtonElement) {
    opener.current = button;
    setOptions(storedOptions());
    setError(null);
    setStatus("");
    setIntent(action);
  }

  function updateOptions(change: Partial<CharacterPdfOptions>) {
    const next = { ...options, ...change };
    setOptions(next);
    setError(null);
    setStatus("");
    discardArtifact();
    try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(next)); } catch { /* Export works when storage is unavailable. */ }
  }

  async function exportPdf(action: "download" | "print") {
    if (busy) return;
    // Open synchronously from the click so the browser does not treat a later fetch as a popup.
    const viewer = action === "print" ? openWaitingPrintWindow() : null;
    waitingWindow.current = viewer;
    setBusy(true);
    setError(null);
    setStatus("Preparing your character PDF…");
    const request = new AbortController();
    controller.current = request;
    try {
      const signature = JSON.stringify({ characterId, ...options });
      let output = artifact.current;
      if (!output || output.signature !== signature) {
        const { blob, filename, artworkWarnings } = await requestCharacterPdf(characterId, options, request.signal, characterName);
        if (request.signal.aborted) return;
        if (artifact.current) releaseArtifact(artifact.current);
        output = { url: URL.createObjectURL(blob), filename, signature, printWindows: [], artworkWarnings };
        artifact.current = output;
        setReady(output);
      }
      if (request.signal.aborted) return;
      if (action === "print") {
        if (viewer && !viewer.closed) {
          sendToPrintViewer(output, viewer);
          setStatus("PDF opened for printing. If no print dialog appears, use the PDF viewer’s Print button.");
        } else {
          setStatus("The print tab did not open. Your PDF is ready: open it below, then use the PDF viewer’s Print button.");
        }
      } else {
        const link = document.createElement("a");
        link.href = output.url;
        link.download = output.filename;
        document.body.append(link);
        link.click();
        link.remove();
        setStatus("Your PDF is ready. If the download did not start, use Download PDF below.");
      }
      if (waitingWindow.current === viewer) waitingWindow.current = null;
    } catch (cause) {
      viewer?.close();
      if (waitingWindow.current === viewer) waitingWindow.current = null;
      if (!request.signal.aborted) {
        setStatus("");
        setError(cause instanceof Error ? cause.message : "The PDF could not be created. Please try again.");
      }
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setBusy(false);
      }
    }
  }

  return <>
    <div className={`sw-character-pdf-actions${compact ? " is-compact" : ""}`} aria-label={`PDF actions${characterName ? ` for ${characterName}` : ""}`}>
      <button type="button" onClick={(event) => begin("download", event.currentTarget)}><Download aria-hidden="true" />Download PDF</button>
      <button type="button" onClick={(event) => begin("print", event.currentTarget)}><Printer aria-hidden="true" />Print</button>
    </div>
    {intent && createPortal(<dialog ref={dialog} className="sw-character-pdf-dialog" aria-labelledby={titleId} aria-describedby={hintId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="sw-character-pdf-panel">
        <header>
          <div><span>Character folio</span><h2 id={titleId}>{characterName ?? "Character"} · PDF</h2></div>
          <button className="sw-character-pdf-close" type="button" onClick={close} aria-label="Close PDF options"><X aria-hidden="true" /></button>
        </header>
        <p id={hintId}>Choose your sheet. Download and Print use the same PDF.</p>
        <fieldset disabled={busy}>
          <CharacterPdfStyleGallery options={options} onChange={updateOptions} />
          <label className="sw-character-pdf-check"><input type="checkbox" checked={options.workbench} onChange={(event) => updateOptions({ workbench: event.target.checked })} /><span>Add a blank workbench<small>Space for new compositions and purchases during play.</small></span></label>
        </fieldset>
        <p className="sw-character-pdf-status" role="status" aria-live="polite">{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{status}</p>
        {error && <p className="sw-character-pdf-error" role="alert">{error}</p>}
        {ready && ready.artworkWarnings > 0 && <p className="sw-character-pdf-status" role="status">Some artwork could not be included in this PDF.</p>}
        {ready && <div className="sw-character-pdf-ready"><a href={ready.url} download={ready.filename}>Download PDF</a><a href={ready.url} target="_blank" rel="noopener" onClick={(event) => {
          const viewer = window.open(ready.url, "_blank");
          if (viewer) { viewer.opener = null; ready.printWindows.push(viewer); event.preventDefault(); }
        }}>Open PDF to print</a></div>}
        <footer>
          <button type="button" disabled={busy} className={intent === "download" ? "is-primary" : ""} onClick={() => void exportPdf("download")}><Download aria-hidden="true" />Download PDF</button>
          <button type="button" disabled={busy} className={intent === "print" ? "is-primary" : ""} onClick={() => void exportPdf("print")}><Printer aria-hidden="true" />Print</button>
        </footer>
      </div>
    </dialog>, document.body)}
  </>;
}
