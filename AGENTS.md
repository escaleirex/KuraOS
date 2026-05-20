# KuraOS — AI Agent Context (OpenCode / Codex)

## Project overview
KuraOS = Debian-based NAS OS. Competes with Synology DSM.
Differentiator: **Axis AI** (local Ollama + cloud API fallback).

## Tech stack
| Layer | Tech |
|---|---|
| Backend | Go 1.22, chi router, sqlite3, CGO_ENABLED=1 |
| Privileged helper | Go (root, Linux capabilities) |
| AI engine | Python 3.12 + FastAPI + Ollama |
| Frontend | React 19 + TypeScript + Vite + shadcn/ui (Tailwind v4) |
| DB | PostgreSQL 16 + pgvector |
| IPC | Unix socket JSON-RPC (kura-daemon ↔ kura-helper) |

## Key file locations
- Go daemon entry: `backend/cmd/kura-daemon/main.go`
- Go helper entry: `backend/cmd/kura-helper/main.go`
- API routes: `backend/internal/api/routes.go`
- Storage module: `backend/internal/storage/` (mdadm.go, lvm.go, btrfs.go, shares.go, smart.go)
- Helper ops whitelist: `backend/internal/helper/ops/`
- Axis entry: `axis/core/main.py`
- Frontend entry: `frontend/src/App.tsx`
- API client: `frontend/src/api/client.ts`

## Build commands
```bash
make build          # compile Go binaries to dist/
make dev            # run kura-daemon in dev mode
cd frontend && npm run dev   # Vite dev server :5173
cd axis && uv run uvicorn axis.core.main:app --reload --port 8765
docker compose -f docker-compose.dev.yml up -d  # postgres + nats + ollama
```

## NEVER do
1. `exec.Command("sh", "-c", ...)` — shell injection risk
2. Call kura-helper directly from Axis — always go through kura-daemon API
3. Enable Samba `store dos attributes = yes` by default — breaks POSIX perms
4. Add new privileged ops without input validation in the ops handler
5. Commit secrets or API keys

## Module name (Go)
`github.com/kura-os/kura`

## Axis inference routing
```
auto mode: hardware score ≥ 2 → Ollama local, else cloud
cloud priority: groq → openai → anthropic → openrouter
```
