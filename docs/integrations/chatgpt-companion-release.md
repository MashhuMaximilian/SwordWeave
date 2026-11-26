# SwordWeave Companion public release

The initial listing package covers Play Guide and catalogue lookup, build previews, permitted saved-sheet reads, and links to companions and sheet PDFs. Its test cases exercise that same tool surface. Character changes still go through the SwordWeave website. The [integration guide](./chatgpt-character-companion.md) records the separate write rehearsal and host approval gate.

## Production account linking

The production OAuth application **SwordWeave Companion** is registered in the existing Clerk instance that signs players into SwordWeave. The production issuer is `https://clerk.swordweave.quest` and the public client ID is `Ms5yQFPacha0hMGA`. The separate development OAuth application serves the fictional write rehearsal.

1. Clerk is configured for the exact resource `https://www.swordweave.quest/api/mcp` with audience binding enabled. Verify a real production grant issues a JWT with that audience when the release endpoint is running.
2. The application's consent screen and public S256 PKCE flow are enabled. The application has the advertised `swordweave:read` scope and Clerk's mandatory `offline_access`. It has no email, profile, metadata, or SwordWeave write scopes. Dynamic client registration and client metadata documents are off.
3. Clerk has saved the stable callback `https://chatgpt.com/connector_platform_oauth_redirect`. The production issuer advertises issuer identification and S256. Confirm OpenAI's MCP setup displays the same callback before connecting.

[Clerk MCP resource setup](https://clerk.com/docs/guides/ai/mcp/build-mcp-server) · [OpenAI OAuth requirements](https://developers.openai.com/plugins/build/auth#redirect-url)

## Website configuration

After the release build and database migrations are verified, configure the read-only production surface in the website runtime:

```dotenv
MCP_RESOURCE_URL=https://www.swordweave.quest/api/mcp
MCP_CLERK_ISSUER=https://clerk.swordweave.quest
MCP_READ_ENABLED=true
MCP_CHARACTER_EDIT_READ_ENABLED=true
MCP_CHARACTER_PLAY_READ_ENABLED=true
MCP_CHARACTER_COMPANIONS_READ_ENABLED=true
MCP_WRITE_ENABLED=false
MCP_FIXTURE_ENABLED=false
MCP_STAGING_REVIEW_ENABLED=false
```

Set `MCP_CURSOR_HMAC_SECRET` in the server environment to a generated secret of at least 32 bytes. Leave the remaining write and staged version-proposal flags off. Run the discovery check against `/.well-known/oauth-protected-resource/api/mcp`. Check that Clerk's consent screen requests the intended permissions and that the MCP server rejects a wrong issuer, audience, or missing read scope.

When the Plugins portal provides the domain challenge, set `OPENAI_APPS_CHALLENGE_TOKEN` to the exact value in the server runtime. Verify `https://www.swordweave.quest/.well-known/openai-apps-challenge` returns only the token as `text/plain`, without signing in. The route returns 404 when the setting is absent.

## Review and publication

1. Confirm the OpenAI publisher identity, category and project settings. MCP review requires a global-data-residency project and a verified individual or business publisher. Verify the [guide](https://www.swordweave.quest/chatgpt), [support](https://www.swordweave.quest/contact), [privacy](https://www.swordweave.quest/privacy) and owner-approved terms URLs all work without sign-in. No SwordWeave terms URL was found in the public site, sitemap or source. [Terms notes for owner review](./swordweave-companion-terms-draft.md)
2. Provision a dedicated reviewer account with the sample character **Gale Reed**, an available monster companion and a second unshared fictional character for the permission check. Make reviewer sign-in work without codes, MFA or private-network access using an approved route for this account. Give the instructions and credentials only through the portal's secure form. Rehearse the five positive and three negative cases in the package, including opening the PDF and checking companion and private-sheet boundaries. Verify disconnect and reconnect with a fictional account. Clerk's access JWTs can remain valid for up to a day after revoking the refresh credential, as recorded in the integration guide.
3. Build the package from the repository root. Use the actual production client ID, verified publisher, portal category and public terms URL. The recording option can be omitted for a draft upload. A reviewer-accessible walkthrough is required for submission.

   ```sh
   python3 docs/integrations/swordweave-companion-plugin/build.py \
     --client-id "$SW_PLUGIN_CLIENT_ID" \
     --publisher "$SW_PLUGIN_PUBLISHER" \
     --category "$SW_PLUGIN_CATEGORY" \
     --terms-url "$SW_PLUGIN_TERMS_URL" \
     --recording-url "$SW_PLUGIN_RECORDING_URL" \
     --output /tmp/swordweave-companion.zip
   ```

4. Upload the ZIP to [OpenAI Plugins](https://platform.openai.com/plugins), verify domain ownership, connect with the review account and scan tools. Confirm the portal imports the provided client and read scope. The MCP manifest uses OpenAI's documented OAuth extension, which the generic Agent Plugins MCP schema does not include. Verify the scan contains the intended read tools and that the embedded character preview renders. Add the review materials and have the publisher complete the policy attestations and submit the draft. [Package authentication fields](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication) · [Submission instructions](https://developers.openai.com/plugins/deploy/submission)
5. After approval, publish, verify the directory listing using a separate eligible ChatGPT account, and set `PUBLISHED_CHATGPT_LISTING_URL` in `src/lib/chatgpt-listing.ts` to the verified listing URL and deploy the site. Keep the guide available if the listing is unavailable.
