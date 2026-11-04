export type DeploymentMode = "preview" | "production" | "restore";

export function modePolicy(mode: DeploymentMode, operationalNotices = false) {
  const live = mode === "production";
  return {
    mode,
    canUseIdentity: mode !== "restore",
    canManageAccount: live,
    canSignUp: live,
    canSendContact: live,
    canHandleWebhook: live,
    canPurge: live,
    canSendOperationalNotice: live && operationalNotices,
  };
}

export type ModePolicy = ReturnType<typeof modePolicy>;
export const signupUnavailable = "Account creation is available on the live site.";
export const accountUnavailable = "Account settings are available on the live site.";
export const signInUnavailable = "Sign-in is available on the live site.";
