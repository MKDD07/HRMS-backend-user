# Invisible reCAPTCHA v2

Temporarily disabled at the user's request: the site key is blank in local and Wrangler configuration. Login does not show or require a CAPTCHA. Restore `RECAPTCHA_SITE_KEY` with the registered public key to re-enable it; the server secret must also be configured.

The login page loads public configuration from `/api/v1/auth/captcha-config`, runs Google's invisible v2 challenge on sign-in, and sends its token with the credentials. The Worker verifies that token using SiteVerify before password verification or session creation. Google rejects expired or previously used tokens. The Worker also checks the returned hostname against `RECAPTCHA_ALLOWED_HOSTNAMES`.

The site key is public. The secret belongs only in the ignored `.env` for local Express and the `RECAPTCHA_SECRET_KEY` Worker secret for deployment. Do not put the secret in a `VITE_` variable, source code, or Wrangler's plaintext variables. The local server must be restarted after changing `.env`.

Production configuration is in `wrangler.company.toml`. Register the actual login hostname in Google's reCAPTCHA console. For local testing, also register `localhost` (and `127.0.0.1` if used); a production-domain registration alone will not validate a localhost challenge. Additional production subdomains must be added to both the Google registration and the server hostname allowlist.

Login fails closed if a configured site key lacks a server secret, verification fails, Google cannot be reached, or the hostname is not allowed. Existing authenticated password-change flows do not require a second CAPTCHA. Environments without a site key disable CAPTCHA, such as the isolated Worker integration tests.

This implementation uses SiteVerify, which accepts the supplied site/secret pair. Google's CreateAssessment migration additionally needs Google Cloud project/authentication configuration and enterprise frontend instrumentation; it is not enabled here.

Tests: `node --test worker/recaptcha.test.mjs`, `node worker/worker.test.mjs`, `npm run lint`, `npm run build`.
