"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Minus, Move, Plus, RotateCcw, Upload, X } from "lucide-react";
import { type PortraitFrame } from "@/lib/character/portrait-frame";
export type { PortraitFrame } from "@/lib/character/portrait-frame";

interface PortraitInputProps {
  value: string;
  onChange: (value: string) => void;
  frame?: PortraitFrame;
  onFrameChange?: (value: PortraitFrame) => void;
  characterName?: string;
  className?: string;
}

export function PortraitInput({
  value,
  onChange,
  frame = { x: 50, y: 50, zoom: 1 },
  onFrameChange,
  characterName,
  className = "",
}: PortraitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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
    <div className={`sw-portrait-input ${className}`}>
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
          const x = Math.max(0, Math.min(100, pan.frame.x - ((event.clientX - pan.clientX) / rect.width) * 100 / frame.zoom));
          const y = Math.max(0, Math.min(100, pan.frame.y - ((event.clientY - pan.clientY) / rect.height) * 100 / frame.zoom));
          onFrameChange({ ...frame, x, y });
        }}
        onPointerUp={() => { panRef.current = null; setPanning(false); }}
        onPointerCancel={() => { panRef.current = null; setPanning(false); }}
      >
        {value ? (
          // Portraits may be authenticated local blob-proxy URLs or arbitrary
          // user links, so Next Image cannot safely predeclare their host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={characterName ? `${characterName} portrait` : "Character portrait"} draggable={false} style={{ objectPosition: `${frame.x}% ${frame.y}%`, transform: `scale(${frame.zoom})` }} />
        ) : (
          <div className="sw-portrait-input__empty">
            <ImagePlus aria-hidden />
            <strong>Character portrait</strong>
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

      {value && onFrameChange ? <div className="sw-portrait-input__framing"><span>Frame portrait</span><button type="button" onClick={() => onFrameChange({ ...frame, zoom: Math.max(1, Math.round((frame.zoom - 0.1) * 10) / 10) })} aria-label="Zoom out"><Minus aria-hidden /></button><input type="range" min="1" max="3" step="0.05" value={frame.zoom} onChange={(event) => onFrameChange({ ...frame, zoom: Number(event.target.value) })} aria-label="Portrait zoom" /><button type="button" onClick={() => onFrameChange({ ...frame, zoom: Math.min(3, Math.round((frame.zoom + 0.1) * 10) / 10) })} aria-label="Zoom in"><Plus aria-hidden /></button><output>{Math.round(frame.zoom * 100)}%</output><button type="button" onClick={() => onFrameChange({ x: 50, y: 50, zoom: 1 })} aria-label="Reset portrait framing"><RotateCcw aria-hidden /></button></div> : null}

      <div className="sw-portrait-input__controls">
        <button type="button" className="sw-metal-button sw-metal-button--secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <label className="sw-portrait-input__url">
          <span><Link2 aria-hidden /> Or use an image link</span>
          <input type="url" value={value.startsWith("/api/") ? "" : value} onChange={(event) => onChange(event.target.value)} placeholder="https://…" />
        </label>
      </div>
      {error ? <p className="sw-forge-error" role="alert">{error}</p> : null}
    </div>
  );
}
