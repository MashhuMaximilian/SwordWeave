import { SignIn } from "@clerk/nextjs";

/**
 * /sign-in — embedded Clerk SignIn with full OAuth/email/magic-link UI.
 *
 * Why this page works at all (Mashu 2026-09-06): the `[[...sign-in]]`
 * catch-all is the Clerk-recommended mount point that, combined with
 * `signInUrl="/sign-in"` + `signUpUrl="/sign-up"` on the components,
 * renders the FULL sign-in UI inline — including social buttons
 * (Google / GitHub / etc. — only the providers enabled in the Clerk
 * dashboard appear) plus email + password + magic-link + SSO.
 *
 * If the user reports "I have nowhere to choose Google", the cause is
 * either:
 *   (a) Google OAuth is not enabled in the Clerk dashboard:
 *       https://dashboard.clerk.com → User & Authentication →
 *       Social Connections → enable Google. Out of code; needs a
 *       dashboard toggle.
 *   (b) Clerk's clerk-js bundle hasn't finished hydrating when the
 *       user looked — the social buttons are part of the client-side
 *       mount. The first render shows the loading spinner; the form
 *       appears ~200–800 ms later.
 *
 * The `withSignUp` prop on <SignIn /> adds a "Don't have an account?"
 * tab inside the same component so the user can switch to sign-up
 * without a navigation.
 *
 * `appearance.layout` is the documented place to put layout overrides
 * (social button placement, etc.) — verified against @clerk/shared v4.
 */
export default function SignInPage() {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-4 py-10">
      <div className="grid w-full gap-6 rounded-md border border-border bg-card p-5 md:grid-cols-[1fr_420px] md:p-6">
        <section className="flex flex-col justify-between rounded-md border border-border bg-background p-5">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">
              SwordWeave Account
            </p>
            <h1 className="font-display mt-4 text-5xl font-semibold uppercase leading-none">
              Sign In
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Save private primitives, compose effects, and prepare account-owned
              characters, monsters, items, and heritage.
            </p>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            Sandbox browsing stays open. Saving and private ledgers require an
            account.
          </p>
        </section>

        <div className="flex justify-center">
          <SignIn
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/atelier"
            withSignUp
            appearance={{
              elements: {
                cardBox: "shadow-none",
                rootBox: "w-full",
                card: "bg-card text-foreground border border-border shadow-none",
                formButtonPrimary:
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                socialButtonsBlockButton:
                  "bg-background border-border hover:bg-secondary/40 text-foreground",
                socialButtonsBlockButtonText: "font-medium",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground",
                formFieldInput:
                  "bg-background border-border text-foreground focus:border-primary",
                formFieldLabel: "text-foreground",
                footerActionLink: "text-primary hover:text-primary/80",
              },
            } as never}
          />
        </div>
      </div>
    </div>
  );
}
