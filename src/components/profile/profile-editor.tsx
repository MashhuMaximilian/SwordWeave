"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  updateUsername,
} from "@/app/settings/profile/actions";

interface SocialLinks {
  twitter?: string;
  mastodon?: string;
  bluesky?: string;
  discord?: string;
  website?: string;
  itch?: string;
  instagram?: string;
  youtube?: string;
  drivethrurpg?: string;
  patreon?: string;
  buymeacoffee?: string;
}

interface ProfileData {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLinks;
}

export function ProfileEditor({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [social, setSocial] = useState<SocialLinks>(profile.socialLinks ?? {});
  const [newUsername, setNewUsername] = useState("");

  const handleProfileSave = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateProfile({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        socialLinks: social,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccess("Profile updated");
        router.refresh();
      }
    });
  };

  const handleUsernameChange = () => {
    setError(null);
    setSuccess(null);
    if (!newUsername.trim()) {
      setError("Enter a new username first");
      return;
    }
    startTransition(async () => {
      const result = await updateUsername(newUsername);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccess(`Username updated to @${newUsername}`);
        setNewUsername("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-500 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-sword-border bg-sword-surface p-6">
        <h2 className="text-lg font-semibold text-sword-fg">Identity</h2>
        <div className="mt-4 space-y-3">
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
              className="w-full rounded-md border border-sword-border bg-sword-bg px-3 py-2 text-sword-fg"
              placeholder="Your name"
            />
          </Field>
          <Field
            label="Avatar URL"
            hint="Link to an image (jpg/png/webp). Or leave blank for the default initial avatar."
          >
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full rounded-md border border-sword-border bg-sword-bg px-3 py-2 text-sword-fg"
              placeholder="https://..."
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-sword-border bg-sword-surface p-6">
        <h2 className="text-lg font-semibold text-sword-fg">Bio</h2>
        <Field
          label={`About you (${bio.length}/500)`}
          hint="Markdown is supported in future updates."
        >
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full rounded-md border border-sword-border bg-sword-bg px-3 py-2 text-sword-fg"
            placeholder="Tell people about your TTRPG style, favorite settings, or anything else."
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-sword-border bg-sword-surface p-6">
        <h2 className="text-lg font-semibold text-sword-fg">Social links</h2>
        <p className="mt-1 text-sm text-sword-muted">
          Add links where people can find or contact you outside SwordWeave.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["twitter", "Twitter / X"],
              ["mastodon", "Mastodon"],
              ["bluesky", "Bluesky"],
              ["discord", "Discord"],
              ["instagram", "Instagram"],
              ["youtube", "YouTube"],
              ["drivethrurpg", "DriveThruRPG"],
              ["patreon", "Patreon"],
              ["buymeacoffee", "Buy Me a Coffee"],
              ["website", "Personal website"],
              ["itch", "itch.io"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="url"
                value={social[key] ?? ""}
                onChange={(e) =>
                  setSocial({ ...social, [key]: e.target.value || undefined })
                }
                className="w-full rounded-md border border-sword-border bg-sword-bg px-3 py-2 text-sword-fg"
                placeholder="https://..."
              />
            </Field>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleProfileSave}
          disabled={pending}
          className="rounded-md bg-sword-accent px-4 py-2 text-sm font-medium text-white hover:bg-sword-accent/90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save profile"}
        </button>
      </div>

      <section className="rounded-2xl border border-amber-500/50 bg-sword-surface p-6">
        <h2 className="text-lg font-semibold text-sword-fg">Change username</h2>
        <p className="mt-1 text-sm text-sword-muted">
          Current username: <span className="font-mono">@{profile.username}</span>
        </p>
        <p className="text-sm text-sword-muted">
          Old URLs redirect automatically. Free, anytime.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="flex-1 rounded-md border border-sword-border bg-sword-bg px-3 py-2 text-sword-fg"
            placeholder="new_username"
            minLength={3}
            maxLength={64}
          />
          <button
            type="button"
            onClick={handleUsernameChange}
            disabled={pending || !newUsername.trim()}
            className="rounded-md border border-sword-border bg-sword-bg px-4 py-2 text-sm text-sword-fg hover:bg-sword-surface disabled:opacity-50"
          >
            Change username
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-sword-fg">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-sword-muted">{hint}</span>}
    </label>
  );
}