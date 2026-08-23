# SkillSwap production deployment guide

## Target architecture

- Frontend: Vercel, built from `client/` with `npm run build`.
- Backend: Render or Railway web service, running `node server/dist/server.js`.
- Database: managed PostgreSQL, private network access where available.
- Storage: S3-compatible object storage or Cloudinary with a production-only bucket/account.
- CI/CD: GitHub Actions in `.github/workflows/ci.yml` and `.github/workflows/deployment.yml`.

Use custom domains such as `app.skillswap.example` and `api.skillswap.example`. They are different origins for CORS but the same site for the current `SameSite=Strict` refresh cookie. Do not deploy the frontend at a different registrable domain unless CSRF protection is added and the cookie policy is deliberately changed to `SameSite=None; Secure`.

## Required production environment

Configure values through Vercel Environment Variables, Render/Railway secret environment variables, or a managed secret store. Do not commit a populated `.env` file.

Backend variables are documented in `.env.production.example`:

- `NODE_ENV=production`
- `DATABASE_URL`: production managed PostgreSQL URL, including SSL options required by the provider.
- `FRONTEND_URL`: exact HTTPS frontend origin, for example `https://app.skillswap.example`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: two independently generated production secrets.
- `COOKIE_DOMAIN`: the shared parent/domain policy appropriate for the deployment.
- `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider credentials for the production sender.
- `STORAGE_PROVIDER`, bucket, region, access key, and secret key for production storage.
- `LOG_LEVEL=info`.

The application rejects development defaults in production. Never copy staging JWT, database, email, storage, or deployment credentials into production.

## GitHub Actions

1. Protect `main` with required CI status checks.
2. Require the production Environment approval for deployment.
3. Configure `PUBLIC_API_URL`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`, `REGISTRY_USER`, and `REGISTRY_TOKEN` as production Environment secrets.
4. The deployment workflow runs typecheck, lint, tests, both builds, Prisma validation, and the high-severity dependency audit before publishing images.
5. Only the successful image SHA is deployed. The deployment uses `docker-compose.production.yml` and never runs `db push`.

## Database and migrations

1. Provision the managed PostgreSQL database separately from application containers.
2. Restrict network access to the backend service and administrative access paths.
3. Run `npx prisma migrate deploy --schema server/prisma/schema.prisma` from the release process.
4. Review migration SQL in CI before approval.
5. Never use `prisma db push`, `--accept-data-loss`, or `migrate reset` in staging or production.
6. Enable automated daily backups, point-in-time recovery, and a retention policy with the database provider.
7. Perform a restore drill before the first release and periodically thereafter.

## HTTPS, CORS, and cookies

- Terminate TLS at Vercel and Render/Railway or at the managed edge proxy.
- Redirect HTTP to HTTPS and use HSTS at the edge after verifying all subresources are HTTPS.
- Set `FRONTEND_URL` to one exact production origin; the backend enables credentialed CORS only for that origin.
- Keep refresh cookies `HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to `/api/v1/auth`.
- Verify login, refresh, logout, and cookie clearing with browser developer tools without exposing cookie values in logs.
- If cross-site hosting is unavoidable, add synchronizer-token or double-submit CSRF protection before using `SameSite=None`.

## Socket.IO

- Point the client socket URL at the HTTPS API origin; Socket.IO will use `wss`.
- Keep Socket.IO CORS aligned with `FRONTEND_URL` and credentials enabled.
- Verify JWT authentication, accepted-conversation authorization, live account-status checks, and participant-only events.
- For multiple backend instances, configure a shared Socket.IO adapter and sticky/session-compatible routing, or route WebSocket traffic consistently to one instance.
- Monitor connection rejects, disconnects, room-join rejects, message errors, and delivery counts.

## Health and monitoring

- Liveness: `GET /api/v1/health` should return `200` without requiring the database.
- Readiness: `GET /api/v1/ready` should return `200` only when PostgreSQL is reachable; route load-balancer traffic only to ready instances.
- Metrics: scrape `GET /api/v1/metrics` through a private monitoring path or place it behind the platform/network access policy.
- Forward structured Pino logs to the platform log service. Preserve request and correlation IDs.
- Configure the optional error tracker and OpenTelemetry provider through the observability abstraction without making them runtime dependencies.
- Alert on readiness failures, HTTP 5xx and latency, authentication failures, database errors, socket reject spikes, and message delivery errors.
- Confirm logs contain no passwords, JWTs, refresh tokens, cookies, reset/verification tokens, message content, or unnecessary personal data.

## Storage and email

- Use a dedicated production bucket/account with least-privilege credentials, private-by-default objects, encryption, and lifecycle rules.
- Validate content type, size, extension, and generated object names at the upload boundary; serve downloads through controlled URLs.
- Use a production email provider with a verified sending domain, bounce handling, rate limits, and production sender authentication.
- Keep staging and production recipient lists, provider credentials, buckets, and domains separate.

## Rollback

1. Record the deployed image SHA, migration version, environment version, and release commit.
2. Roll back application images to the previous known-good SHA through the deployment platform.
3. Do not automatically roll back database migrations. Use a reviewed forward-fix migration or the documented provider restore procedure.
4. Keep the previous image available until health, API, authentication, Socket.IO, email, and storage smoke tests pass.
5. Revoke or rotate credentials if a release or deployment host is suspected of exposure.

## Release smoke test

After deployment, verify the frontend loads over HTTPS, the backend health and readiness endpoints return expected status, a test login sets secure cookies, an authenticated API request succeeds, Prisma migrations are applied, a Socket.IO connection and authorized message work, and a non-production test object/email uses staging-safe or production-approved resources as intended.
