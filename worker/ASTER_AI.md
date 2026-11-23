# Aster AI

Authenticated Groq drafting in the existing company API:

- `/api/v1/ai/department-draft`: Departments edit permission; department targets and responsibilities.
- `/api/v1/ai/onboarding` and `/api/v1/ai/offboarding`: matching page permission; letter drafting, wording improvements and public web research.
- `/api/v1/ai/salary-structure`: salary structure permission; editable schema details and research.
- `/api/v1/ai/vault-draft`: Document Vault permission; detects letter type and returns a draft. Selected reference IDs are loaded from the actor's company only. Small TXT contents and attachment metadata are supported; PDF/DOCX text extraction is not implemented.

The Aster button beside announcements opens an anchored chat panel. Its component stays mounted in the app layout across page changes, so hiding it does not cancel a job. Prompts open Document Vault and generate a typewriter preview (after the model returns, not token streaming), then upload a Word draft with `draft: true`, category `AI Draft Letters`, and no verification or mandatory acknowledgement. Follow-up requests include the previous letter for revision and save a separate draft copy. Browser speech playback is opt-in.

Conversation messages and unfinished input are stored in browser localStorage under a company/user key, with a fixed 24-hour expiry from conversation creation. Closing and reopening do not extend it. Expired data is rejected on restoration and cleared while the app is running. This is browser-local continuity, not cross-device storage or a server background job: refreshing/closing the browser can interrupt an in-flight request, while completed conversations remain available until expiry. Saved vault files remain as documents after the chat expires. New conversation resets the chat immediately; it is disabled during active work.

Drafts are previews. Users apply and save with the existing forms. No AI endpoint writes records, sends letters or executes payroll. Browser search receives only the user request, excluding document context. Groq responses are validated, and provider error bodies are not exposed.

## Secret setup

Put `GROQ_API_KEY` in the ignored `.env` or `.env.groq` file, then run:

```powershell
node scripts/set-groq-secret.cjs
```

The script uses project-local Wrangler with `wrangler.company.toml`, targeting `hrms-api`, and passes the secret through stdin. It never embeds the key in command arguments. To enter a replacement key interactively instead:

```powershell
npx.cmd wrangler secret put GROQ_API_KEY --config wrangler.company.toml
```

The default model is `openai/gpt-oss-20b`. An optional `GROQ_MODEL` Worker variable can override it; the selected model must support JSON mode and browser search. The local Express gateway loads the same secret file and supplies a development limiter. Production uses the Wrangler rate-limit binding (5 requests per minute per company/user, enforced by Cloudflare's local rate-limit semantics); Groq account quotas still apply.

References: [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
