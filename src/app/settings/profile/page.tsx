import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { loadCurrentProfile } from "@/app/settings/profile/actions";
import { createProfileFromClerk } from "@/lib/profiles/lookup";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { db } from "@/db/client";
import { users } from "@/db/schema/profiles";
import { eq } from "drizzle-orm";
import { validateUsername } from "@/lib/profiles/username";

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Self-healing: if the webhook missed us, try to create the profile
  // directly from the Clerk session before showing the editor. This makes
  // /settings/profile a reliable recovery point for any Clerk user.
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: { id: true, username: true },
  });

  if (!existing) {
    const clerkUser = await currentUser();
    if (clerkUser?.username) {
      const validation = validateUsername(clerkUser.username);
      if (validation.valid && validation.normalized) {
        const result = await createProfileFromClerk({
          clerkUserId: userId,
          username: validation.normalized,
          displayName:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            null,
          avatarUrl: clerkUser.imageUrl || null,
        });
        // If create succeeded (or hit a recoverable error), fall through and
        // loadCurrentProfile will pick it up. If it failed for a non-trivial
        // reason (taken, reserved), show the error so the user can fix it.
        if (!result.ok && result.error !== "USERNAME_TAKEN") {
          return (
            <div className="mx-auto w-full max-w-3xl px-5 py-8">
              <div className="rounded-2xl border border-sword-border bg-sword-surface p-6">
                <h1 className="text-2xl font-semibold text-sword-fg">
                  Could not create your profile
                </h1>
                <p className="mt-2 text-sword-muted">
                  {result.errorMessage ?? result.error}
                </p>
              </div>
            </div>
          );
        }
      }
    }
  }

  const profile = await loadCurrentProfile();
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="rounded-2xl border border-sword-border bg-sword-surface p-6">
          <h1 className="text-2xl font-semibold text-sword-fg">
            Profile not yet created
          </h1>
          <p className="mt-2 text-sword-muted">
            Set a username in Clerk&apos;s account panel first, then refresh
            this page. Your SwordWeave profile will be created automatically.
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