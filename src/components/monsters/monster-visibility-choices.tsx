"use client";
import "./monster-visibility-choices.css";
import { Globe, Users, Lock } from "lucide-react";
import { useId } from "react";
type Visibility = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";
export function MonsterVisibilityChoices({
  value,
  onChange,
  disabled = false,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="monster-visibility-choices" disabled={disabled}>
      <legend>Who can discover this monster?</legend>
      <div>
        {(
          [
            { value: "PRIVATE", name: "Private", hint: "Only you", icon: Lock },
            {
              value: "FOLLOWERS_ONLY",
              name: "Followers only",
              hint: "You and your followers",
              icon: Users,
            },
            { value: "PUBLIC", name: "Public", hint: "Everyone", icon: Globe },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            className={`sw-metal-button${value === option.value ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <option.icon size={17} />
            <span>
              <strong>{option.name}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <small>
        This applies when you save the template. Private play copies remain
        yours.
      </small>
    </fieldset>
  );
}
