"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Circle, ChevronDown } from "lucide-react";
import { tracks, type ActorMarker } from "@/lib/encounters/run-state";

/** Keep typing smooth while retaining the run's existing durable sync queue. */
export function RunText({
  value,
  onCommit,
  multiline = false,
  ...props
}: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  "aria-label": string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value);
  const focus = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    if (!focus.current) queueMicrotask(() => setText(value));
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function update(next: string) {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commit.current(next);
    }, 450);
  }
  const attributes = {
    ...props,
    value: text,
    onFocus: () => {
      focus.current = true;
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update(e.target.value),
    onBlur: () => {
      focus.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        commit.current(text);
      }
    },
  };
  return multiline ? (
    <textarea {...attributes} rows={5} />
  ) : (
    <input {...attributes} />
  );
}

export function MarkerControls({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: ActorMarker;
  onChange: (value: Partial<ActorMarker>) => void;
  disabled: boolean;
}) {
  return (
    <div className="sw-live-declaration">
      <label className="sw-live-intent">
        <span>Intent</span>
        <RunText
          aria-label={`Intent for ${name}`}
          value={value.intent}
          placeholder="What will they do?"
          maxLength={2000}
          disabled={disabled}
          onCommit={(intent) => onChange({ intent })}
        />
      </label>
      <div className="sw-live-marker-line">
        <div
          className="sw-live-track-choices"
          role="group"
          aria-label={`Action track for ${name}`}
        >
          {tracks.map((track) => (
            <button
              type="button"
              className="sw-metal-button"
              key={track}
              aria-label={`${track} track for ${name}`}
              aria-pressed={value.track === track}
              disabled={disabled}
              onClick={() => onChange({ track })}
            >
              {track === "Unassigned" ? "—" : track}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sw-metal-button sw-live-resolve"
          aria-pressed={value.resolved}
          disabled={disabled}
          onClick={() => onChange({ resolved: !value.resolved })}
          aria-label={`${value.resolved ? "Unresolve" : "Resolve"} ${name}`}
        >
          {value.resolved ? <Check size={15} /> : <Circle size={15} />}
          <span>{value.resolved ? "Done" : "Resolve"}</span>
        </button>
      </div>
      <details className="sw-live-actor-notes">
        <summary>
          <ChevronDown size={13} />
          Target & reminder{value.target || value.reminder ? " · added" : ""}
        </summary>
        <label>
          Target
          <RunText
            aria-label={`Target for ${name}`}
            value={value.target ?? ""}
            maxLength={200}
            disabled={disabled}
            placeholder="Creature, character or location"
            onCommit={(target) => onChange({ target })}
          />
        </label>
        <label>
          Reminder
          <RunText
            aria-label={`Reminder for ${name}`}
            value={value.reminder ?? ""}
            maxLength={1000}
            disabled={disabled}
            placeholder="Position, trigger, recovery condition…"
            onCommit={(reminder) => onChange({ reminder })}
          />
        </label>
      </details>
    </div>
  );
}
