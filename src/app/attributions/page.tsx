import type { Metadata } from "next";
import Link from "next/link";
// JSON module typed as any by Next.js — cast at use site.
import iconIndex from "@/lib/icons/game-icons-index.json";

export const metadata: Metadata = {
  title: "Attributions · SwordWeave",
  description:
    "Credits and licenses for third-party content used in SwordWeave, including the game-icons.net icon set.",
};

interface AuthorRow {
  author: string;
  slug: string;
  count: number;
  homepage: string | null;
  isCc0: boolean;
}

// CC0 authors from the license.txt note:
//   - Viscious Speed
//   - Zeromancer
// Other 34 authors are CC BY 3.0.
const CC0_AUTHORS = new Set(["viscious-speed", "zeromancer"]);

export default function AttributionsPage() {
  // Build the per-author rollup. The JSON file gives us a flat
  // icons[].author list; we count + look up homepage + tag CC0 vs CC BY.
  const idx = iconIndex as {
    authors: string[];
    icons: { key: string; author: string }[];
    authorCredits: Record<string, string | null>;
  };
  const counts: Record<string, number> = {};
  for (const icon of idx.icons) {
    counts[icon.author] = (counts[icon.author] ?? 0) + 1;
  }
  const rows: AuthorRow[] = idx.authors.map((author) => ({
    author,
    slug: author,
    count: counts[author] ?? 0,
    homepage: idx.authorCredits[author] ?? null,
    isCc0: CC0_AUTHORS.has(author),
  }));
  // Sort: most icons first, then alphabetical.
  rows.sort(
    (a, b) => b.count - a.count || a.author.localeCompare(b.author),
  );

  const totalIcons = idx.icons.length;
  const cc0Icons = idx.icons.filter((i) =>
    CC0_AUTHORS.has(i.author),
  ).length;
  const ccByIcons = totalIcons - cc0Icons;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Attributions</h1>
        <p className="mt-2 text-muted-foreground">
          SwordWeave uses third-party content made available under open
          licenses. We&apos;re grateful to the artists and communities who
          make their work freely usable.
        </p>
      </header>

      {/* License overview */}
      <section className="mb-10 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Icon set</h2>
        <p className="mt-2 text-sm">
          {totalIcons.toLocaleString()} icons from{" "}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            game-icons.net
          </a>
          , contributed by {rows.length} artists.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">{ccByIcons.toLocaleString()}</strong>{" "}
            icons licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              CC BY 3.0
            </a>{" "}
            — used with attribution.
          </li>
          <li>
            <strong className="text-foreground">{cc0Icons.toLocaleString()}</strong>{" "}
            icons licensed under{" "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              CC0
            </a>{" "}
            (public domain dedication) — no attribution required, but
            credited here for completeness.
          </li>
        </ul>
        <p className="mt-4 text-sm">
          Where the icon picker shows an icon sourced from game-icons.net,
          the artist name is shown in the icon&apos;s tooltip. Hover any
          icon in a list or in the picker to see &quot;By <em>artist</em>
          &quot; before its label.
        </p>
      </section>

      {/* Per-author credits */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Contributing artists</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Artist</th>
                <th className="px-4 py-2.5 font-medium">Icons</th>
                <th className="px-4 py-2.5 font-medium">License</th>
                <th className="px-4 py-2.5 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.author} className="bg-card">
                  <td className="px-4 py-2.5 font-medium">{row.author}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.isCc0 ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        CC0
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        CC BY 3.0
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.homepage ? (
                      <a
                        href={row.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:no-underline"
                      >
                        Homepage ↗
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Homepages are listed where the artist provided one. Some
          contributors requested to be credited by handle only — no
          homepage is on file for them.
        </p>
      </section>

      {/* License text */}
      <section className="mb-10 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">License terms</h2>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            The CC BY 3.0 license requires that you include a mention of
            &quot;Icons made by {`{author}`}&quot; in any derivative work
            using these icons. SwordWeave satisfies this by displaying
            the artist name in each icon&apos;s hover tooltip.
          </p>
          <p>
            The CC0 icons are released to the public domain and may be
            used without restriction. We credit them anyway as a thank
            you to the artists.
          </p>
          <p>
            For the complete license texts, see{" "}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              CC BY 3.0
            </a>{" "}
            and{" "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              CC0 1.0
            </a>
            .
          </p>
        </div>
      </section>

      <div className="text-sm">
        <Link
          href="/"
          className="text-primary underline hover:no-underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}