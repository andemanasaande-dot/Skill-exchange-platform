# SkillSwap

SkillSwap is a peer-to-peer skill exchange platform built as a modular monolith.

## Repository structure

- `client/` — React + Vite + TypeScript front-end
- `server/` — Express + TypeScript back-end
- `prisma/` — Prisma schema and database migration assets
- `docs/` — design and engineering documentation
- `.github/` — CI and automation configuration

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start PostgreSQL with Docker:
   ```bash
   docker compose up -d postgres
   ```
3. Start the API:
   ```bash
   npm run dev:server
   ```
4. Start the client:
   ```bash
   npm run dev:client
   ```

## Health check

The API exposes:

```http
GET /api/v1/health
```

## Containerized development

Build and start the complete frontend, backend, and PostgreSQL stack:

```bash
docker compose build
docker compose up
```

The frontend is available at `http://localhost:5173`, the API at `http://localhost:5000`, and the API health check at `http://localhost:5000/api/v1/health`. The backend waits for PostgreSQL, bootstraps the development schema, and applies tracked Prisma migrations before starting.

The Compose file uses PostgreSQL trust authentication for local development only. Configure real database credentials and JWT secrets through environment variables before using the images outside development.

## Environment separation

Use the templates `.env.development.example`, `.env.staging.example`, and `.env.production.example` as references. Populated environment files and secrets must stay outside version control.

- Development uses `docker-compose.yml` and may bootstrap a local schema. Destructive schema changes still require Prisma confirmation.
- Staging uses `docker-compose.staging.yml` and `NODE_ENV=staging`. It requires staging-only database, JWT, email, storage, frontend, and cookie settings and runs `prisma migrate deploy` only.
- Production uses `docker-compose.production.yml` and `NODE_ENV=production`. It also runs migrations only and must use production secret-manager values.

The staging workflow uses a GitHub `staging` Environment with `STAGING_*` secrets. Production deployment credentials are separate and are never reused by staging.

## Production build

```bash
npm run build
```
