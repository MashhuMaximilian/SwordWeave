# SwordWeave compact core / 21 October 2026

Four free PDFs, selected for website publication by the creator. Play and
Create are the player packet. DMs also use Run. Create & Publish explains reuse
and distribution; it adds no gameplay rule or storefront agreement.

| Editable source | PDF pages | Purpose |
| --- | ---: | --- |
| `play.md` | 4 | Intent, resolution, timing, targeting, Cost, damage and recovery. |
| `run.md` | 4 | Preparation, rulings, creature construction, encounters and advancement. |
| `create.md` | 5 | Characters, all 29 primitive families, price anchors, equipment and accounting. |
| `create-and-publish.md` | 4 | Compatible products, rights, attribution, selling, asset scope and approved creator note. |

The first three together carry the practical rules framework without required
website/catalogue lookups. Long books provide extended explanations and examples.
The incoming-damage Vitality-upkeep repayment/reset scheme remains explicitly
pending. The creator approved this compact treatment for publication. Independent
newcomer playtesting remains pending; publication does not claim it already happened.

## Editing and reproduction

Edit the Markdown sources directly. Page/column comments retain editorial source
groups; the renderer flows them in reading order and generates actual pagination.
It keeps readable type, complete tables and headings with following content.
The first three PDFs fail the build if they exceed five readable pages.

In the original publication working checkout, use the bundled Python returned by
`load_workspace_dependencies` (these generation scripts and their font caches are
maintained there):

```sh
python3 scripts/build-swordweave-quick-core.py --release
python3 scripts/render-swordweave-quick-core.py --release
python3 scripts/verify-swordweave-quick-core.py --release
```

PDFs go to `output/pdf/swordweave-{play,run,create,create-and-publish}-v0.1-alpha.pdf`.
The manifest, source hashes, cell geometry, review renders and verification live
in `output/publications/quick-core-release/`. Publication-generation scripts and font caches live in the original publication working checkout. The versioned public PDFs are copied byte-for-byte from that checked release output; the website release manifest pins their hashes and sources. Website handoffs are in Books, Rules, Creating, character creation, Combat and Press.

## Source and coverage ledger

Paths below are relative to the repository. The approved creator rulings take
precedence over older advice. Source text is condensed and reorganized; every
long-book paragraph is not reproduced. Numerical anchors and scope boundaries
are retained independently of page count.

| Area in the compact packet | Source |
| --- | --- |
| Intent, Rule of Cool, distinction between rule/default/example | `docs/publications/manuscripts/system-reference-document.md`, Core procedure |
| Attributes, practices, positive owned Verb/Domain foundation | Same source, Character foundation; `docs/publications/expanded/srd-reference.md`, Character construction in full |
| Selected DC attribute eligibility | `src/lib/rules/play-guide.ts`, DC explanation: eligible proficient attribute |
| Checks, attacks, saves, Bias, ordinary rounding | SRD manuscript, Resolution; creator rulings, Stacking/bias |
| Location, range and projected/direct delivery | SRD manuscript, Scope and targeting; Load and delivery paths; creator rulings |
| Main Intent, Clash/Contest, reactions, movement and surprise | SRD manuscript, Combat and movement; creator rulings |
| Contextual Costs, CV, Strain, continuation and pending Vitality policy | SRD manuscript, Costs and persistence; creator rulings |
| Damage, massive damage, rescue, short/long rests | SRD manuscript, Recovery and equipment; expanded SRD, Recovery accounting |
| Body/item size, Load, slots and separate accounting | SRD manuscript, Recovery and equipment; expanded SRD, Item accounting |
| Access tiers, all 29 families, range/output and grant anchors | SRD manuscript, The primitive reference |
| Mira, her owned acquisitions, capability and ordinary hook | SRD manuscript, Worked records and table references |
| Mirror accounting and creation boundaries | Expanded SRD, Mirror accounting; manuscript progression and mirror examples |
| Creature formula, common-budget lookup and Canal Watcher | Expanded SRD, Creature construction; manuscript, Canal Watcher |
| Encounter appraisal, independent state and quantities | Expanded SRD, Encounter preparation; manuscript appraisal example |
| Cumulative levels 1-21 and post-21 spikes | SRD manuscript, Progression and Progress beyond level 21 |
| Existing MIT/CC BY scope and requested attribution wording | Repository `LICENSE` |
| Compatible commercial products, official free mechanics, future store/adventure status | `docs/publications/book-rights-policy.md`; `docs/publications/publishing-and-rights.md` |
| CC obligations and limits | `https://creativecommons.org/licenses/by/4.0/legalcode.en`, checked 21 October 2026 |
| Exact approved AI note | `scripts/phb_ai_disclosure.py`; all three approved paragraphs reproduced in Create & Publish |
| Palette, typography, semantic tables | `docs/publications/print-edition/accepted-book-standard.md`; SwordWeave book skills |

## Font notices

`font-notices/` retains SIL OFL 1.1 notices. Copyright identification is matched
to the actual embedded font metadata: Aubrey 2011, Syne 2019, Unica One 2012.
License text was checked against Google Fonts' official upstream OFL files.
Reading semibold/oblique are renamed SwordWeave derivatives of Aubrey; numeral
Syne is a lining-number derivative. Preserve OFL notices for the derivatives.
Each PDF embeds the three notice files as attachments; font binaries are not
offered as reusable packet assets. Document text and instructional graphics
carry CC BY 4.0; font licensing and branding rights remain separately scoped.
