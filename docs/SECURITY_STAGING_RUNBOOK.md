# Staging Security Runbook — Forteza AI Visibility

This runbook applies to the security branch `security/forteza-access-ssrf-metrics-20261126`. It is not permission to configure or deploy Cloudflare resources.

## Required staging-only configuration

Configure these values on a dedicated staging Worker only. Do not commit them to `wrangler.jsonc`, GitHub, or a public document.

| Variable / binding | Requirement |
|---|---|
| `ALLOWED_ADMIN_EMAILS` | Exact comma-separated email allowlist. Leave unset/empty until Karia confirms the login identity. Empty fails closed. |
| `ALLOWED_DOMAINS` | Exact comma-separated HTTPS hostnames approved for public-site inspection. No wildcard or implicit subdomains. Empty fails closed. |
| `AI_GATEWAY_ID` | Dedicated staging AI Gateway ID with a hard budget/usage ceiling. No shared `default` gateway. |
| `AEO_KV` | New staging-only KV namespace. Never reuse the current Worker namespace. |
| `BRAND_VISIBILITY_QUEUE` | New staging-only queue with its own consumer. Never reuse the current queue. |
| `AI` | Workers AI binding, only after the dedicated gateway and budget are verified. |

No credentials, customer records or CRM bindings are needed.

## Cloudflare Access

1. Create a Worker-level Access application for the staging Worker, not a broad account-wide policy.
2. Protect the Worker's production-style staging URL and preview URLs.
3. Add only the exact email(s) Karia confirms; do not infer that `broker@fortezarealty.com` and `broker@fortezarealtyllc.com` are interchangeable.
4. Do not add a public bypass.
5. Confirm the Access identity reaches the Worker as `ctx.access`; the application also checks `ALLOWED_ADMIN_EMAILS` server-side.
6. Test unauthenticated (401), authenticated but not allowlisted (403), and authorized (200) paths.
7. Keep the current production Worker and all existing public sites unchanged.

## Staging isolation

Create a separate Worker name, KV namespace, queue, consumer, Access application and AI Gateway. The staging Worker must not bind to the existing production KV, queue, D1, R2, email, RingCentral, CRM, Google, Meta or Forteza OS resources.

Use synthetic brand records and an approved public test hostname only. Do not submit customer or transaction information to model providers.

## Controls in this branch

- Fail-closed Cloudflare Access identity plus server-side exact-email allowlist.
- Exact HTTPS hostname allowlist for site registration and prompt-generation fetch.
- Redirect target revalidation, 5-second fetch timeout, HTML-only response and 1 MB response cap.
- Request Content-Length guard (64 KB), prompt cap (10 per site / 500 characters each), model allowlist and 50-job ceiling per test.
- Explicit provider-error status; provider failures are excluded from visibility-rate denominator.
- Brand mention matching against approved name/domain aliases.
- Deterministic KV result keys so queue retries overwrite the same model/prompt result rather than creating duplicate citations.
- No mock AI responses counted as real results.
- Explicit AI Gateway ID; no shared `default` gateway.

## Controls still required before any staging test

- Configure and verify a dedicated AI Gateway budget / alert ceiling.
- Add robust per-identity and per-IP rate limiting (KV counters are not sufficient for concurrency-safe enforcement; use Cloudflare rate limiting or a Durable Object).
- Verify effective Worker-level Access policy and preview protection.
- Verify the staging KV and queue IDs differ from the currently deployed Worker.
- Confirm the authorized login email(s) and approved domain allowlist.
- Run full CI, typecheck, build and staging smoke tests.
- Confirm no production settings or bindings changed.

## Rollback

Before any staging deployment, record the staging Worker's active version and bindings. Roll back by promoting the previous staging version only. Do not alter or delete production Worker versions, KV namespaces, queues, Access applications or AI Gateway configuration.

## Production gate

No merge to `main`, production Access change, production binding change, production deployment, DNS/WAF/bot policy change, website change or public-profile publication is authorized by this branch. Each requires Karia's separate explicit approval after reviewing the diff, test evidence and rollback plan.
