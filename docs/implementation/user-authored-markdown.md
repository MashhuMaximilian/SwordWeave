# Markdown for user-authored prose across SwordWeave

Added 2026-11-24. This is a platform requirement and applies to the [ChatGPT companion](chatgpt-companion-roadmap.md#november-24-platform-requirements). It covers authoring and reading existing and new content.

## Field rule

Use Markdown for freeform prose wherever users can write it. This includes descriptions, notes, concepts, backstories, narrative rules, longer custom behavior descriptions, recovery instructions, comments and feedback. Apply the rule across Atelier, character creation and sheet Edit mode, the player and GM notes surfaces, monsters, encounters, profiles, and other forms or drawers with prose.

Keep compact one-line fields plain text. Examples include names, labels, tags, brief custom behavior prompts and short conditions designed to read inline. Treat a formula, numeric value, URL or structured identifier according to its own input format even if a textarea renders the editor. Classify by the purpose of the field. A long description still uses Markdown when described by a short label.

## Implementation and verification

1. Inventory each surface on the implementation branch. Record the field label and intent, component, API/storage key and limit, edit/preview control, and each display surface. Search form definitions and rendering code alongside textarea usage. Include alternate dialogs, condensed cards, read-only views and saved drafts. Record which paths already work end to end, which lack a shared editor or renderer, and the reason for each compact-field exception.
2. Reuse the shared [Markdown editor](../../src/components/ui/markdown-editor.tsx) and [Markdown renderer](../../src/components/ui/markdown.tsx). Existing examples include the Atelier [effect form](../../src/components/sandbox/effect-form.tsx), [character backstory](../../src/components/character-modal/tabs/backstory-tab.tsx) and the sheet [foundation editor](../../src/components/characters/workspace/character-foundation-editor.tsx). Review the raw textarea in the [condition picker](../../src/components/sandbox/condition-picker.tsx) against the compact-field rule. The [expression builder](../../src/components/sandbox/primitive-rule-instrument.tsx) is a formula editor. Check the full edit/save/display path for the [comment composer](../../src/components/engagement/like-fork-bar.tsx) and [contact message](../../src/components/contact/contact-form.tsx), including downstream display or delivery.
3. For prose fields with gaps, keep the source Markdown string in the current field and render it in the existing audience and permission context. Use the shared supported syntax and safe link behavior in both preview and saved views. Check that exports which already carry those fields preserve readable formatting and established access. Test legacy plain text and retain existing limits and content through edits.
4. Exercise a formatted description in Atelier, a backstory and notes on a character, and one example each from monster, encounter and shared-content forms. Check edit, preview, save, reload and relevant read-only surfaces on desktop and mobile. Cover headings, emphasis, lists, deliberate paragraph breaks and safe links. Run the existing [Markdown tests](../../src/components/ui/markdown.test.ts) and add focused coverage for any round-trip regression found. Confirm names, compact fields and formulas still render their intended literal or parsed value.

For ChatGPT, carry Markdown source through draft input, review, save and authorized read-back. Render it with safe Markdown in the website review and any widget that displays the prose. Keep short labels and mechanical inputs typed as before. Include the round-trip checks when implementing each phase's affected fields. Platform-wide coverage is tracked here as a separate work item.

## Local audit and fixes on November 24

| Surface | Finding and change |
| --- | --- |
| Contact message and Library flag note | These were the two user-facing prose textareas found outside the shared editor. Both now use the shared editor and preview. The contact message keeps its 5,000-character limit and sends the original Markdown through the existing mail transport. The flag note keeps its 500-character limit and the notes dialog renders the saved Markdown. |
| Atelier and Library | Existing description editors already carry Markdown. Corrected plain-text rendering in selected effect and primitive previews, Library description views, build details, and template and item selectors. Compact controls display formatted excerpts without placing links inside buttons. |
| Character creation and sheet | Existing backstory and player-note editors already use Markdown. Corrected plain-text rendering in relevant Quickbuild details, item and heritage slot views, build suggestions, proposal rationale, and mobile composition excerpts. |
| Monsters and encounters | Existing story, consequence and encounter-note editors already use Markdown. Corrected the Bestiary story excerpt, the monster creation review, and the encounter card's note. |
| Plain-field exceptions | The other raw textareas are the inline condition phrase, the formula expression builder and a developer layout fixture. Compact names, labels, tags and condition phrases keep their existing semantics. |

The isolated Chromium fixture exercised the actual contact form and Library Effects components at 1280 and 390 pixels. It verified a required-field guard, formatted preview, exact Markdown payload, draft retention after mocked failure, retry, reset and saved Library rendering. Focused tests cover shared rendering, draft and backstory handling, contact, and related monster and encounter behavior. The browser check used fictional fixtures. Signed-in cross-surface persistence and deployed coverage require a separate environment check.
