# wickedhostbotai

Self-hosted TypeScript RAG platform scaffold for a Discord support bot, admin dashboard, and indexing worker.

## Workspace Layout

- `apps/web`: Next.js App Router admin shell
- `apps/api`: Fastify JSON API
- `apps/bot`: discord.js thin client
- `apps/worker`: background indexing worker
- `packages/shared`: shared env schemas and DTOs
- `packages/db`: Drizzle schema and migrations
- `packages/core`: orchestration services
- `packages/vector`: vector store contracts and Qdrant adapter
- `packages/ai`: OpenAI answer and embedding providers

## Quick Start

1. Copy `.env.example` to `.env` and set `ADMIN_TOKEN` before exposing the dashboard.
2. Install dependencies with `pnpm install`.
3. Run migrations with `pnpm db:migrate`.
4. Start the services you need with `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:bot`, and `pnpm dev:worker`.
5. Or bring up the full stack with `docker compose up --build`.
