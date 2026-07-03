import { SignIn } from "@clerk/nextjs";

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
              characters, monsters, items, and templates.
            </p>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            Sandbox browsing stays open. Saving and private ledgers require an
            account.
          </p>
        </section>

        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                cardBox: "shadow-none",
                card: "bg-card text-foreground border border-border",
                formButtonPrimary: "bg-primary text-primary-foreground",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
