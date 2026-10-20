# Website contact and privacy controls

Implementation and configuration recorded 2026-10-19.

## Contact

- `/contact` publishes `contact@swordweave.quest`, with a copy action and an on-page form. No mail application is launched.
- Contact is linked from the public navbar (including its mobile menu), homepage footer, About page and shared site footer.
- The form posts to the first-party Next.js `/api/contact` route on Vercel. Delivery uses open-source Nodemailer over mandatory TLS to SMTP2GO’s EU SMTP server, with the dedicated Proton inbox as its fixed recipient.
- The visitor's address is Reply-To. From, subject and recipient are controlled by the server. No auto-reply or subscription is sent to the visitor.
- Server-side validation, body-size limits, same-origin checks and a honeypot reject invalid requests. Message contents and SMTP transaction details are not logged by this implementation.
- The in-memory limiter is a per-process backstop (five attempts per 15 minutes), not a distributed serverless quota. Vercel’s published edge rule limits `POST /api/contact` to five requests per 60 seconds per IP (fixed window). This is the project’s one included Hobby rate-limit rule; no paid upgrade was made.
- Errors retain the visitor's text; uncertain delivery is never automatically retried. Success means the configured SMTP relay accepted the message, not guaranteed final inbox delivery.

The UI and API fail closed if delivery is disabled or configuration is missing. SMTP configuration and `CONTACT_FORM_ENABLED=true` are saved in Vercel’s production environment. The existing Porkbun forwards to Proton continue working separately.

### Delivery configuration

SMTP2GO Free was selected by the founder. The sender domain is verified; open and click tracking are off. Use `mail-eu.smtp2go.com:587`, mandatory STARTTLS, the existing project SMTP user, and `CONTACT_RECIPIENT=swordweave@protonmail.com`. Credentials belong only in private local configuration and Vercel’s server-side environment. No Web3Forms account was created; its draft integration and hCaptcha dependency were removed.

Set `CONTACT_FORM_ENABLED=true` only with valid SMTP configuration. Verify a browser submission reaches Proton before declaring delivery working. Success means SMTP acceptance; inbox arrival must be checked separately.

The Porkbun MX records and forwards are unchanged. No Cloudflare DNS migration is needed. [Vercel supports SMTP except port 25](https://vercel.com/kb/guide/serverless-functions-and-smtp); SMTP2GO supplies outgoing delivery.

## Privacy controls

- `vanilla-cookieconsent` v3.1.0 (MIT) is installed and bundled locally, including CSS. No consent-management SaaS account or CDN request is needed.
- Essential storage remains available for Clerk sign-in and functional preferences. Optional Vercel Web Analytics and Speed Insights mount only after analytics consent.
- Accept analytics and Essential only have equal-weight buttons. Preferences can be reopened from every shared footer and from `/privacy`.
- Withdrawal unmounts analytics components and gates every future analytics event through the current consent state. This also covers SDK listeners that remain after React unmounts. It does not erase earlier events.
- Analytics URL query strings and fragments are removed before sending. No GA4 or advertising tags were added.
- The first-party `sw_consent` preference cookie lasts 180 days. The local `/privacy` page describes the current storage, providers, contact data and privacy contact route.
- The page is a factual description of this implementation, not a certification of legal compliance or a complete legal-policy review. Update it when activating/changing mail delivery or adding other data processors.

## Discord

The unchanged official Discord symbol is stored at `public/icons/brands/discord.svg`; provenance is recorded alongside it. Homepage, About, Contact and FAB links use the shared icon. The FAB Discord link has silver metallic icon/text at rest and gold hover/focus feedback. Existing support-button styling and the two-column support/Discord layout are preserved.

## Verification

- 26 focused tests pass: contact client and server validation, rejected or uncertain delivery, fixed SMTP envelope/TLS, consent opt-in and withdrawal.
- Focused ESLint and the application-only TypeScript check pass. The latter excludes unrelated scratch source copies under `tmp/`; the repository-wide include also collects those copies.
- Next.js production compilation passes for all application routes (`next build --experimental-build-mode compile`). This is a compilation check, not a deployed or finalized release build.
- Desktop and 390px phone layouts checked in the local browser. Phone content width is 390px with no horizontal overflow; form precedes the community section.
- Browser check: analytics scripts absent with analytics off; Speed Insights debug script appears after acceptance; the saved Essential only choice survives reload and analytics scripts are absent again. Preferences can be reopened and the analytics toggle reflects both choices.
- A real submission through the local browser form showed success and arrived in the dedicated Proton Inbox. The received headers confirmed fixed From `contact@swordweave.quest`, visitor Reply-To, SPF pass, DKIM pass and TLS delivery. Proton reported no trackers.
- The same browser delivery test passed on production after the GitHub-triggered deployment; the founder independently confirmed the form works. SMTP passwords were transferred through a private ignored file into server configuration; temporary credential copies were deleted.
- Screenshots are saved under `output/marketing/`: `contact-page-desktop.jpg`, `contact-page-mobile.jpg`, `privacy-preferences-desktop.jpg`, `privacy-preferences-mobile.jpg`, `discord-official-mobile.jpg`, and `homepage-official-discord.jpg`.
