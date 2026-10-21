# Discovery release verification · 21 October 2026

This dated receipt supersedes the pre-deployment status in today's review notes.
Video work is deferred; the active scope is discovery, reporting and performance.

## Delivered

Application commit `2007ef3bc4c15512809b491e5216901f4931b491` was pushed to
`origin/main`. Vercel deployment `dpl_AW5w72WjRzEvQK1Bxm4iL9Zf9FMG` is **Ready**
and aliases `https://www.swordweave.quest` and the apex domain. Its cloud build
completed compilation, TypeScript and static generation, including the final
Rules reference wording and manifest-derived press update date. The preceding
local production build passed too. Final scoped lint, 44 application tests and
8 read-only asset-worker tests passed.

- Public root CSS retains the exact 45 source-import order in one entry. The
  live homepage now references four stylesheets, down from the baseline's 13.
  This consolidates requests; it does not remove the unused editor CSS.
- Three alpha-identical mask PNGs replace full-color mask downloads. The
  respective distinct-resource savings are 139,507, 255,078 and 14,688 bytes.
  Actual initial-load savings depend on which resources a page requests.
- Signup links now say “Sign up”. The walkthrough links directly to preparation
  and original-character creation. The existing hero and design remain intact.
- The supplied GM Guide's unchanged reading/full PDFs are published, with
  explicit edition labels/events and earlier dark edition retained. Books,
  press, Rules reference copy and llms status distinguish current GM/PHB PDFs
  from the pending SRD revision and the existing online readers.
- The creator kit was rebuilt with current status. Its two original companions
  and their previews remain included; the books are linked rather than embedded.

## Canonical public delivery

At **10:36:56 UTC**, independent public HTTP diagnostics returned 200 for home,
Books, Press, walkthrough, Rules, llms index, robots, sitemap and the original-
character/Rules/GM-reader Markdown exports. This was a network/content check,
not a browser screenshot or proof that a particular vendor retrieved the page.

HTML destinations have their expected canonical and `index, follow`. Markdown
has `text/markdown`, no attachment disposition, HTML canonical/describedby Link
headers and `noindex, follow`. The sitemap contains 17 curated HTML destinations.
Robots permits public crawling and excludes `/api/`; the llms index identifies
the current GM release. Press shows 21 October and the SRD's pending revision.

All three deployed mask PNGs and the complete live kit ZIP match local bytes
and SHA-256. The ZIP is 3,255,509 bytes with SHA-256
`3e0fe5b17124958c4b1489525ca809db3239f1723c8b31470afd2d8650a27481`.
Both stable GM PDF links return 307 to their exact organic-release objects;
those objects were previously fully stream/hash/MIME/length checked.
See [GM publication receipt](../publications/gm-organic-publication-2026-10-21.md).
Machine proof: `output/marketing/release-live-2026-10-21.json`.

## Search and measurement

Search Console confirms the original-character guide **is indexed**. The
accepted sitemap reports 17 discovered pages; aggregate reports are still
processing and field Core Web Vitals have insufficient data. The current
US/UK keyword plan remains the working page-priority map, not a ranking claim.

GA4 now has the saved **SwordWeave · Acquisition & actions** report and the
**AI Assistants · identified traffic** comparison. Exact IDs, scope, QA baseline
and the manual weekly reporting procedure are in the
[measurement review](measurement-review-2026-10-21.md). In the reconnected
follow-up, Realtime confirmed `media_kit_download` with event count 1 after
consented ZIP-link activation. Custom parameter values were not read back before
the next browser disconnection. This is QA, not independent creator interest.

The Vercel firewall explicitly allows AI bots, with attack mode and Bot
Protection off. No security setting was changed. The external ChatGPT reader
still supplies only an unexplained access failure; this has not been traced to
a matching server request and is not established to be a site firewall block.
See the [discovery review](discovery-follow-through-2026-10-21.md).

## Performance limits and next work

The pre-release baseline was mobile **61 / LCP 8.8 s**, desktop **62 / LCP
1.4 s**. After the founder reopened the browser, a fresh PageSpeed run at
**13:48 Bucharest** completed: mobile **63 / LCP 7.8 s**, desktop **97 / LCP
1.1 s**, both **100 accessibility / 100 best practices / 100 Lighthouse SEO**.
[Report](https://pagespeed.web.dev/analysis/https-www-swordweave-quest/zdo2aw7uqc?form_factor=mobile).
This supersedes the earlier browser/API failure. It is one comparable lab pair,
not a repeated median, causal experiment or field-vitals improvement. Mobile
loading still needs substantial work. See the performance review for all metrics.

Bounded pre-release homepage/reader/books phone and desktop checks passed as
recorded in the [performance review](performance-review-2026-10-21.md). The
current live press page reloaded with its correct GM status/date, consent and
analytics script. Full authenticated-tool smoke and remaining post-release
visual checks are still open: the browser disconnected again while inspecting
the kit event's parameters. The local server is stopped. The temporary viewport
was reset at the beginning of the reconnect; after the later disconnect, check
and reset any new override on the next connected session.

Next: finish the remaining visual checks when the connection is stable; split
tool CSS using explicit route/overlay ownership and compare both devices again.
Use processed Search Console/GA4 evidence for later content decisions. No new
homepage rewrite, broad community-record indexing, automated outreach or video
production is a prerequisite for this release.

## SRD follow-through

The founder subsequently supplied the completed 78-page Reference edition on
21 October and explicitly requested its publication. The unchanged 14,522,400-
byte PDF is verified at the versioned Cloudflare release, SHA-256
`f356c7bd603812781954a6fabe5cedff792f3f6ca97c446c81cc54425bca39a1`.
The new source maps the default SRD link to this file, retains the earlier dark
edition, and removes pending-SRD wording from current public status surfaces.
See [SRD publication receipt](../publications/srd-reference-publication-2026-10-21.md).
This supersedes the SRD's pending status in the first release above; it does
not claim a new cross-book editorial reconciliation or rewrite online readers.
The rebuilt 20-entry kit is 3,255,537 bytes, SHA-256
`ce3a499709122c411f22fc099a6f6afae644496c898978fee624cd7a09ee34fb`;
both companions, their previews and all image hashes remain unchanged. Its
publication validation passed 9 worker, 14 publication/analytics and 28
Rules/discovery/Markdown tests plus scoped lint. The SRD application follow-up
is verified separately from the earlier `2007ef3b` release; its final canonical
receipt belongs in `output/marketing/srd-live-2026-10-21.json` after deployment.
