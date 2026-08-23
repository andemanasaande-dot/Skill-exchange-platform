# Technical Design Document

## Phase 1: Foundation

SkillSwap is a modular monolith with a React/Vite frontend and a Node/Express backend. PostgreSQL is accessed through Prisma. The frontend uses React Router, TanStack Query, Zustand, Zod, Axios, Socket.IO Client, and Lucide React. The backend uses TypeScript, Zod, JWT, bcrypt, and Socket.IO.

## Repository structure

- `client/`: React, Vite, TypeScript, Tailwind CSS frontend.
- `server/`: Express TypeScript backend.
- `prisma/`: shared schema assets where applicable.
- `docs/`: operational and design documentation.
- `.github/`: CI/CD workflows.

## Backend structure

`server/src/` contains `config`, `middleware`, `utils`, `infrastructure`, and domain modules for auth, users, skills, requests, conversations, messages, notifications, moderation, and admin, with `app.ts` for HTTP composition and `server.ts` for process startup.

## Foundation startup

- Frontend development: `npm run dev:client`.
- Backend development: `npm run dev:server`.
- Backend production: `npm run build --workspace server` followed by `npm run start --workspace server`.
- Health endpoint: `GET /api/v1/health`.
- Readiness endpoint: `GET /api/v1/ready`.
- Prisma schema validation: `npx prisma validate --schema server/prisma/schema.prisma`.
- Migration deployment: `npx prisma migrate deploy --schema server/prisma/schema.prisma`.

Business modules are implemented in later phases; the foundation preserves their module boundaries and startup contracts.
