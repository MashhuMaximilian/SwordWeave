# SwordWeave email: saved configuration

Updated 2026-10-19. Incoming forwarding is configured and delivery to both addresses is verified. Website-form delivery uses SMTP2GO; general domain-address correspondence remains a separate workflow.

## Inbox and addresses

Read project mail at [Proton Mail](https://mail.proton.me/) using the dedicated **Proton Free** account `swordweave@protonmail.com`.

| Public address | Destination inbox | Purpose |
| --- | --- | --- |
| `mashu@swordweave.quest` | `swordweave@protonmail.com` | Founder correspondence |
| `contact@swordweave.quest` | `swordweave@protonmail.com` | General contact |

These are two forwarding addresses feeding one inbox. They do not have separate passwords or separate inboxes. The founder's personal Gmail is not a forwarding destination. No paid mail plan was purchased.

Manage the forwards in [Porkbun](https://porkbun.com/account/emailhosting/swordweave.quest), under **Porkbun Email Forwarding → Current Forwards**. Both saved rows were verified in the UI.

## DNS

Creating the forwards automatically added these Porkbun records:

| Type | Host | Priority | Value | TTL |
| --- | --- | --- | --- | --- |
| MX | `@` | 10 | `fwd1.porkbun.com` | 600 |
| MX | `@` | 20 | `fwd2.porkbun.com` | 600 |
| TXT | `@` | — | `v=spf1 include:_spf.porkbun.com ~all` | 600 |

The authoritative Porkbun nameserver and Cloudflare's public resolver returned the two MX records after creation. No unrelated DNS record was edited manually. Vercel website hosting remains separate from email routing.

On 2026-10-19 the founder approved adding these SMTP2GO records. They were saved at Porkbun, resolved publicly and verified by SMTP2GO. Existing website, Clerk and incoming-mail records were preserved.

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `em1118793` | `return.smtp2go.net` | 3600 |
| CNAME | `s1118793._domainkey` | `dkim.smtp2go.net` | 14400 |
| CNAME | `link` | `track.smtp2go.net` | 3600 |

These authenticate the outgoing relay. The root Porkbun SPF record remains unchanged; SMTP2GO uses its authenticated return-path subdomain. No DMARC policy was changed.

## Delivery verification

- [x] Dedicated Proton address verified from the open inbox's account title.
- [x] Both forwarding rows saved with the intended destination.
- [x] Authoritative and public MX lookups return Porkbun's forwarding servers.
- [x] An external message addressed to `mashu@swordweave.quest` arrives in Proton's Inbox. The founder's “Test max” message was opened and its recipient checked.
- [x] An external message addressed to `contact@swordweave.quest` arrives in Proton. The founder confirmed “sent and arrived” after the separate test.

The two addresses were tested separately: the `mashu@` message was checked in the Proton UI, and the founder confirmed receipt of the `contact@` message. For future tests, avoid sending from the forwarding destination itself: Porkbun documents that this can trigger loop suppression. Check Spam if necessary. Test sender addresses and private message contents are not recorded here.

## Sending and replying

Replies composed directly in Proton Free currently use **`swordweave@protonmail.com`**. This setup does not make Proton Free send as either `@swordweave.quest` address.

SMTP2GO Free was selected for the website’s contact form (1,000 messages/month, 200/day). The founder completed account and SMTP-user creation; the sender domain is verified. SMTP2GO is a relay, not an inbox, and cannot be added as a custom outgoing SMTP server inside Proton Free’s web composer. Its website-form integration does not change Proton Free’s reply address. A separate sending interface would be needed for general correspondence from the domain addresses.

Zoho's EU setup showed paid plans/trials only for this account; it was not used for routing. Proton custom-domain hosting and Bridge/IMAP access require paid plans and were not selected.

## Evidence and sources

The website Contact page and first-party form backend use SMTP2GO. A browser form submission arrived in the dedicated Proton Inbox; its received headers passed SPF and DKIM and preserved the visitor Reply-To. See [contact and privacy implementation](contact-and-privacy.md) for the relay configuration and delivery checks. CookieConsent v3 is bundled locally; no Web3Forms account was created.

- [Saved forwarding rows](../../output/marketing/email-forwards-created.jpg)
- [Porkbun forwarding and test guidance](https://kb.porkbun.com/article/10-how-to-set-up-email-forwarding-service)
- [Proton custom domains](https://proton.me/support/custom-domain)
- [SMTP2GO Free limits](https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan)

Keep passwords, recovery codes and private message contents outside this repository.
