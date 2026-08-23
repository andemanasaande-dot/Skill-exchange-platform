# SkillSwap staging deployment checklist

## Secrets and environment

- [ ] Create a separate GitHub `staging` environment.
- [ ] Configure `STAGING_PUBLIC_API_URL`, `STAGING_DEPLOY_HOST`, `STAGING_DEPLOY_USER`, `STAGING_DEPLOY_PATH`, and `STAGING_DEPLOY_SSH_KEY`.
- [ ] Configure separate `STAGING_REGISTRY_USER` and `STAGING_REGISTRY_TOKEN` credentials.
- [ ] Set `DATABASE_URL` to the staging database only. Confirm the hostname/database are not production.
- [ ] Generate unique staging `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; never reuse production values.
- [ ] Set `FRONTEND_URL` and `COOKIE_DOMAIN` to staging domains.
- [ ] Set staging `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider credentials. Do not send staging mail through production credentials or lists.
- [ ] Configure staging image storage bucket and credentials separately from production.
- [ ] Set `NODE_ENV=staging` and `LOG_LEVEL=info`.

## Database and migrations

- [ ] Back up the staging database according to the team policy.
- [ ] Review migration SQL before deployment.
- [ ] Run `npx prisma validate --schema server/prisma/schema.prisma`.
- [ ] Run `npx prisma migrate deploy --schema server/prisma/schema.prisma` against staging.
- [ ] Confirm the staging deployment uses `docker-compose.staging.yml`, which does not run `db push` or `--accept-data-loss`.
- [ ] Confirm migration status and application startup logs.

## Application verification

- [ ] Confirm `GET https://<staging-api>/api/v1/health` returns `200`.
- [ ] Confirm `GET https://<staging-api>/api/v1/ready` returns `200` and the database is reachable.
- [ ] Confirm the frontend loads from the staging URL and uses the staging API URL.
- [ ] Confirm allowed staging origin works through CORS and an unrelated origin is rejected.
- [ ] Confirm login sets an `HttpOnly`, `Secure`, `SameSite=Strict` refresh cookie for the staging domain.
- [ ] Confirm refresh and logout rotate/clear the staging cookie.
- [ ] Confirm Socket.IO connects to the staging API and authorized conversation events work.
- [ ] Confirm unauthorized Socket.IO joins are rejected.
- [ ] Register a staging-only test account, verify email through the staging provider, and remove or anonymize test data afterward.
- [ ] Upload a non-sensitive test image and confirm it is stored in the staging bucket, not production storage.
- [ ] Confirm structured logs contain request/correlation IDs and do not contain passwords, tokens, cookies, or personal data.
- [ ] Confirm health checks show frontend, backend, and database as healthy.

## Rollback

- [ ] Record the deployed image tag and migration version.
- [ ] Define the application image rollback tag before deployment.
- [ ] Do not roll back migrations automatically; follow the reviewed database rollback procedure.
- [ ] Revoke staging credentials if deployment or verification exposes them.
