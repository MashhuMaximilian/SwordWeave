# SwordWeave Discord: saved configuration

Configured and checked 2026-10-19 through the founder's open Discord tab.

**Server:** SwordWeave TTRPG
**Server ID:** `1561671632744095826`
**Owner account:** Mashu / `mashhul`
**Guide:** https://discord.com/channels/1561671632744095826/@home

Community mode and onboarding are enabled. The founder explicitly approved accepting Discord's Community Server Guidelines in this chat. Access remains invite-only; no Server Discovery application was made.

## Identity

The server name uses the SwordWeave capitalisation. The description identifies the free modular TTRPG, browser character workshop and v0.1 alpha, with the website link. Traits: TTRPG, Playtesting, Character Builds, Homebrew, Pet Pics. The existing server icon was retained.

## Channels

17 channels across six categories: 14 public text/forum channels, two public voice channels and one private staff channel.

| Category | Channel | Type / purpose |
| --- | --- | --- |
| START HERE | welcome | Read-only introduction and start/book/rules links in the channel topic |
| START HERE | rules | Read-only conduct rules in the channel topic; designated Community rules channel |
| START HERE | announcements | Read-only text channel for official releases and community dates |
| START HERE | resources | Read-only official website/book/creation/credit links in the channel topic |
| THE TAVERN | tavern | General chat and introductions; renamed/moved from the original general channel |
| THE TAVERN | pet-pics | Real pets and familiars, with a welcoming description |
| THE TAVERN | off-topic | Other games, books, crafts and everyday conversation |
| THE TAVERN | Campfire | Social voice lounge; renamed from the original General voice channel |
| THE WORKSHOP | character-builds | Tagged forum for concepts, actual mechanics and advice |
| THE WORKSHOP | homebrew | Tagged forum for reusable creations, attribution and testing |
| THE WORKSHOP | rules-help | Text questions with version/context guidance |
| AT THE TABLE | find-a-table | Tagged recruitment forum with timezone/format/expectation guidance |
| AT THE TABLE | session-reports | Tagged actual-play reports and lessons |
| AT THE TABLE | Table One | Voice space for a game |
| ALPHA PLAYTEST | feedback | Tagged issue/suggestion forum with reproduction guidance |
| ALPHA PLAYTEST | playtest-planning | Session scheduling and practical coordination |
| STAFF | mod-chat | Private staff coordination, Discord Community/safety updates and spam alerts |

All created text channels have descriptions, and all five forums have posting guidelines. On the founder's subsequent request, four starter messages were published on 2026-10-19: a welcome and channel map, community conduct rules, an alpha introduction, and an official resource directory. No creator outreach was sent. Discord itself posted its Community welcome notice to the designated staff channel.

## Invitation and website

**Public invitation:** https://discord.gg/3z5tqnchY

Created from welcome with **Expire After: Never**, **Max Number of Uses: No limit**, no granted role and temporary membership disabled. Discord confirmed that the invitation will never expire. It can still be revoked by a server administrator.

The website source uses `src/lib/community.ts` for the invitation URL. Links were added to the homepage hero, homepage footer, About page and global FAB. The FAB places support and Discord in two equal columns, retaining the original `sw-fab__support` styling, typography and hover treatment. These links are included in the website release alongside Contact and privacy controls. The Discord link uses the official symbol with silver at rest and gold hover/focus; the existing support-button finish is preserved.

Verification: desktop visual review and a 390px layout check confirmed two equal columns with transparent borders and links opening in new tabs. The About-page invitation was checked in the rendered page. The application source typecheck passed using a temporary configuration excluding unrelated `tmp/` copies. The repository-wide typecheck failed in the existing temporary publication-source copy; focused lint passed except for four pre-existing effect/state errors and one dependency warning in `global-controls.tsx`, also reproduced from HEAD. `git diff --check` passed.

Starter posts:
- **welcome:** first steps, books, introductions, rules questions, table finding, pet photos, optional roles and notifications; identifies the one-person alpha project.
- **rules:** respectful participation, privacy and session consent, suitable public content, credit and AI labels, anti-spam rules, feedback guidance and moderation contact.
- **announcements:** dated alpha introduction, useful feedback examples, current version and optional playtest notifications; no event date promised.
- **resources:** canonical walkthrough, rules, combat, creation, three book pages, Library, Atelier, About and attribution links; channel directory and bug-report checklist.

Posts are ordinary channel messages, not separately pinned. No blanket role or everyone ping was sent.

## Roles

Roles are ordered as listed; community roles add identity rather than administrative powers.

| Role | Colour | Assignment / privileges |
| --- | --- | --- |
| Founder | Gold `#f1c40f` | Assigned to Mashu; displayed separately. The account's owner status supplies owner powers. |
| Moderator | Teal `#1abc9c` | Empty at setup; displayed separately. Audit log, kick/approve/reject, timeout, manage messages, pin messages, manage threads/posts, mute and move members. No Administrator, Manage Server, Manage Roles or Manage Webhooks grant. |
| Game Master | Purple `#9b59b6` | Optional onboarding role, no additional moderation powers |
| Player | Blue `#3498db` | Optional onboarding role, no additional moderation powers |
| Worldbuilder | Orange `#e67e22` | Optional onboarding role, no additional moderation powers |
| Alpha Playtester | Green `#2ecc71` | Opt-in participation role; not evidence that someone has already played |
| Playtest Pings | Grey `#95a5a6` | Explicit post-join opt-in; no automatic assignment |

START HERE denies ordinary members sending messages, posting thread replies, and creating public/private threads. A category override allows Moderator to post announcements/information. The founder retains owner access.

STAFF is private, with the server owner and Moderator allowed. No non-owner member was assigned Moderator.

## Forum tags

Each forum requires at least one tag when posting.

- **character-builds:** Showcase; Work in progress; Advice wanted; Ready to play.
- **homebrew:** Ability; Heritage; Item; World & adventure; Needs testing.
- **find-a-table:** Looking for players; Looking for GM; One-shot; Campaign; Online; In person.
- **session-reports:** First session; Ongoing game; Ruling example; Lessons learned.
- **feedback:** Bug; Rules; Usability; Suggestion; Confirmed; Resolved. Confirmed and Resolved are restricted to moderators; this restriction was checked in both saved tag editors.

## Onboarding and guide

Onboarding was published and the settings display `ON`.

**Seven default channels:** welcome, rules, announcements, resources, tavern, pet-pics, rules-help. The configuration reported three chattable defaults and all 14 public text/forum channels covered by defaults or questions.

**Optional, multiple-choice pre-join question:** “What brings you to SwordWeave? Pick any that fit.”

| Answer | Role | Additional channels |
| --- | --- | --- |
| Play a character | Player | character-builds, find-a-table, session-reports, Table One |
| Run a game | Game Master | find-a-table, session-reports, Table One |
| Build and homebrew | Worldbuilder | character-builds, homebrew |
| Help playtest the alpha | Alpha Playtester | feedback, playtest-planning, session-reports |
| Hang out by the campfire | None | off-topic, Campfire |

**Optional post-join question:** “Would you like a ping when a community playtest is announced?” The answer “Notify me about playtests” assigns Playtest Pings. Members can change it in Channels & Roles.

**Published welcome sign:**

> Welcome, [@username]! SwordWeave is a free modular TTRPG in v0.1 alpha. Bring a character idea, a question, or a pet photo. Say hello in tavern and help shape the game through play. Choose interests and optional playtest pings in Channels & Roles.

**Guide tasks:**
- Say hello and share a character you would love to play → tavern.
- Meet our real-life familiars in pet-pics → pet-pics.
- Find your next table or offer to run a game → find-a-table.
- Discord also supplies the Read the rules action.

The guide was saved successfully and opened from the live sidebar after publication. Resource channels were retained in the channel list; no empty channel was converted into a resource page.

## Safety settings

- Verified-email requirement: Low verification level, as required by Community setup.
- Media filtering: all members, excluding Discord's age-restricted exceptions.
- Default notifications: mentions only.
- Community updates and safety notifications: private mod-chat.
- Built-in mention-spam blocking enabled.
- Suspected-spam blocking enabled, with alerts to mod-chat. The alert destination is excluded from the spam rule by Discord's configuration flow.
- Commonly flagged words filter enabled for Insults & Slurs and Sexual Content; Severe Profanity was left unselected.
- Discord's Safety Setup reported three of five AutoMod features enabled. No third-party bot was installed.

## Verification and evidence

Checked using Discord's built-in View Server As Role → @everyone:
- Staff/mod-chat was absent from the member channel list.
- Public forums offered New Post.
- The rules channel displayed the saved topic and “You do not have permission to send messages in this channel.”

Role preview was disabled afterward, restoring the normal owner view. The user's Discord tab is left on the published Server Guide.

Evidence:
- [Published server guide](../../output/marketing/discord-server-guide.jpg)
- [Default-member permissions](../../output/marketing/discord-member-view.jpg)
- [Seven saved roles](../../output/marketing/discord-roles.jpg)
- [Published resource message](../../output/marketing/discord-resources-published.jpg)
- [Homepage and original FAB styling in two columns](../../output/marketing/discord-website-desktop.jpg)

## Ongoing maintenance

- Before recruiting a moderator, choose the person deliberately and explain their scope. An empty role is not a staffing plan.
- Keep rule explanations and reusable answers on the public website as well as Discord.
- Use Playtest Pings only for relevant scheduled playtests, respecting members' opt-in.
- As activity develops, consolidate unused channels or split a forum only when the traffic warrants it.
- Have a real new participant test the complete joining flow; the built-in role preview checks permissions but is not a separate-account join test.
- Rules screening was not separately configured as an additional acceptance gate. Conduct rules are available through the rules channel topic and the guide's rules action.
- Update the published alpha introduction when there is a meaningful release or a confirmed event. Do not invent member activity or testimonials to seed the server.
