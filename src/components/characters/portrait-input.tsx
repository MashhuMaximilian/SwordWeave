"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Link2, Loader2, Minus, Move, Plus, RotateCcw, Upload, X } from "lucide-react";
import { portraitFrameStyle, type PortraitFrame } from "@/lib/character/portrait-frame";
export type { PortraitFrame } from "@/lib/character/portrait-frame";

interface PortraitInputProps {
  value: string;
  onChange: (value: string) => void;
  frame?: PortraitFrame;
  onFrameChange?: (value: PortraitFrame) => void;
  characterName?: string;
  className?: string;
  label?: string;
  /** Fields placed alongside the portrait, before its URL/upload controls. */
  identityFields?: ReactNode;
  layout?: "stacked" | "identity";
}

export function PortraitInput({
  value,
  onChange,
  label = "Character portrait",
  frame = { x: 50, y: 50, zoom: 1 },
  onFrameChange,
  characterName,
  className = "",
  identityFields,
  layout = "stacked",
}: PortraitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const panRef = useRef<{ pointerId: number; clientX: number; clientY: number; frame: PortraitFrame } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileDragging, setFileDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/icons/upload", { method: "POST", body: data });
      const payload = (await response.json().catch(() => ({}))) as {
        pathname?: string;
        error?: string;
      };
      if (!response.ok || !payload.pathname) {
        throw new Error(payload.error ?? "The portrait could not be uploaded.");
      }
      onChange(`/api/icons/blob/${payload.pathname}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The portrait could not be uploaded.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className={`sw-portrait-input${layout === "identity" ? " sw-portrait-input--identity" : ""} ${className}`}>
      <div className="sw-portrait-input__art">
      <div
        ref={previewRef}
        className={`sw-portrait-input__preview${fileDragging ? " is-dragging" : ""}${panning ? " is-panning" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setFileDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setFileDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setFileDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        onPointerDown={(event) => {
          if (!value || !onFrameChange || (event.target as HTMLElement).closest("button")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          panRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, frame };
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          const rect = previewRef.current?.getBoundingClientRect();
          if (!pan || !rect || pan.pointerId !== event.pointerId || !onFrameChange) return;
          const image = imageRef.current;
          const aspect = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
          const frameAspect = rect.width / rect.height;
          const fittedWidth = aspect > frameAspect ? rect.height * aspect : rect.width;
          const fittedHeight = aspect > frameAspect ? rect.height : rect.width / aspect;
          // object-position moves the fitted image; transform-origin moves the
          // zoomed image. Together they make the full cropped area draggable.
          const horizontalTravel = fittedWidth - rect.width + (pan.frame.zoom - 1) * rect.width;
          const verticalTravel = fittedHeight - rect.height + (pan.frame.zoom - 1) * rect.height;
          const move = (start: number, delta: number, travel: number) =>
            Math.abs(travel) < 1 ? start : Math.max(0, Math.min(100, start - delta * 100 / travel));
          onFrameChange({
            ...pan.frame,
            x: move(pan.frame.x, event.clientX - pan.clientX, horizontalTravel),
            y: move(pan.frame.y, event.clientY - pan.clientY, verticalTravel),
          });
        }}
        onPointerUp={() => { panRef.current = null; setPanning(false); }}
        onPointerCancel={() => { panRef.current = null; setPanning(false); }}
        onLostPointerCapture={() => { panRef.current = null; setPanning(false); }}
      >
        {value ? (
          // Portraits may be authenticated local blob-proxy URLs or arbitrary
          // user links, so Next Image cannot safely predeclare their host.
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imageRef} src={value} alt={characterName ? `${characterName} portrait` : label} draggable={false} style={portraitFrameStyle(frame)} />
        ) : (
          <div className="sw-portrait-input__empty">
            <ImagePlus aria-hidden />
            <strong>{label}</strong>
            <span>Drop an image here or choose a file</span>
          </div>
        )}
        {value ? (
          <button type="button" className="sw-portrait-input__clear" onClick={() => onChange("")} aria-label="Remove portrait">
            <X aria-hidden />
          </button>
        ) : null}
        {value && onFrameChange ? <span className="sw-portrait-input__move"><Move aria-hidden /> Drag to position</span> : null}
      </div>

      {value && onFrameChange ? <div className="sw-portrait-input__framing"><span>Frame portrait</span><button type="button" onClick={() => onFrameChange({ ...frame, zoom: Math.max(0.5, Math.round((frame.zoom - 0.1) * 10) / 10) })} aria-label="Zoom out"><Minus aria-hidden /></button><input type="range" min="0.5" max="3" step="0.05" value={frame.zoom} style={{ "--portrait-progress": `${((frame.zoom - 0.5) / 2.5) * 100}%` } as React.CSSProperties} onChange={(event) => onFrameChange({ ...frame, zoom: Number(event.target.value) })} aria-label="Portrait zoom" /><button type="button" onClick={() => onFrameChange({ ...frame, zoom: Math.min(3, Math.round((frame.zoom + 0.1) * 10) / 10) })} aria-label="Zoom in"><Plus aria-hidden /></button><output>{Math.round(frame.zoom * 100)}%</output><button type="button" onClick={() => onFrameChange({ x: 50, y: 50, zoom: 1 })} aria-label="Reset portrait framing"><RotateCcw aria-hidden /></button></div> : null}

      </div>
      <div className="sw-portrait-input__details">
      {identityFields}
      <div className="sw-portrait-input__controls">
        <button type="button" className="sw-metal-button sw-metal-button--secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <label className="sw-portrait-input__url">
          <span><Link2 aria-hidden /> Or use an image link</span>
          <input type="url" value={value.startsWith("/") ? "" : value} onChange={(event) => onChange(event.target.value)} placeholder="https://…" />
        </label>
      </div>
      {error ? <p className="sw-forge-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
