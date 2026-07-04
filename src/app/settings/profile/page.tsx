import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { loadCurrentProfile } from "@/app/settings/profile/actions";
import { ProfileEditor } from "@/components/profile/profile-editor";

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const profile = await loadCurrentProfile();
  if (!profile) {
    // No SwordWeave profile yet — Clerk hasn't sent user.created webhook
    // (or webhook is misconfigured). Show a friendly error.
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="rounded-2xl border border-sword-border bg-sword-surface p-6">
          <h1 className="text-2xl font-semibold text-sword-fg">
            Profile not yet created
          </h1>
          <p className="mt-2 text-sword-muted">
            We&apos;re still setting up your SwordWeave profile. If you just
            signed up, give it a moment and refresh. If this persists, the
            Clerk webhook may be misconfigured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-sword-fg">
          Profile settings
        </h1>
        <p className="mt-1 text-sm text-sword-muted">
          Update how you appear on your public profile page.
        </p>
      </header>

      <ProfileEditor
        profile={{
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          socialLinks: profile.socialLinks,
        }}
      />
    </div>
  );
}