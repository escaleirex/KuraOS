# KuraOS — Claude Code Context

## Project
KuraOS is a Debian-based NAS/home-server OS (Synology DSM / UGOS Pro competitor).
Built as a Debian overlay installer, future: standalone ISO.
Core differentiator: **Axis AI** — local (Ollama) or cloud (OpenAI/Groq/Anthropic/OpenRouter).

## Architecture
```
kura-daemon (Go :8080)  ← REST API + WebSocket
kura-helper (Go root)   ← privileged ops via Unix socket /run/kura/helper.sock
axis-engine (Python :8765) ← FastAPI, Ollama, RAG, MCP tools
frontend (React + shadcn/ui + Vite) ← dev :5173, prod served by daemon
```

## Module structure
```
backend/cmd/kura-daemon/   — main Go daemon entrypoint
backend/cmd/kura-helper/   — privileged helper entrypoint
backend/internal/storage/  — mdadm, LVM, Btrfs, Samba, NFS, SMART
backend/internal/api/      — HTTP handlers (chi router)
backend/internal/auth/     — JWT, TOTP, users
backend/internal/helper/   — IPC server + ops whitelist
backend/internal/network/  — Tailscale, UFW, Nginx
backend/internal/docker/   — Docker SDK, compose, HW passthrough
backend/internal/hardware/ — fan control (ITE/hwmon), sensors, LCD
backend/internal/vm/       — KVM/QEMU/libvirt (Phase 3)
backend/pkg/exec/          — safe exec (NEVER use sh -c, always exec.Command)
backend/pkg/ipc/           — Unix socket IPC client
backend/pkg/config/        — SQLite config store
axis/core/                 — FastAPI app, inference router
axis/inference/            — Ollama client, cloud client, HW detect
axis/mcp/                  — MCP tools → kura-daemon API
axis/rag/                  — pgvector RAG pipeline (Phase 2)
axis/media/                — photo/audio ML (Phase 3)
frontend/src/              — React + shadcn/ui + TanStack Query
installer/                 — Debian install script + systemd units
configs/templates/         — smb.conf.tmpl, sssd.conf.tmpl, exports.tmpl
```

## Critical rules — read before editing

### Security (never violate)
- All privileged ops go through kura-helper via Unix socket
- kura-helper ops are **whitelisted** in `backend/internal/helper/ops/`
- NEVER use `exec.Command("sh", "-c", ...)` — always explicit binary + args array
- Validate ALL device paths with `kexec.MustBeBlockDevice()` before use
- Axis MCP tools → kura-daemon API → kura-helper (never Axis → helper directly)

### Samba permissions (critical)
- Default: `store dos attributes = no` + `ea support = no`
- This prevents Windows DOSATTRIB xattrs breaking POSIX permissions
- Only enable `streams_xattr` if user explicitly requests Windows ACL compatibility
- See `backend/internal/storage/shares.go` for the template

### Go module
- Module name: `github.com/kura-os/kura`
- Build: `make build` (produces `dist/kura-daemon` and `dist/kura-helper`)
- CGO required (sqlite3): always use `CGO_ENABLED=1`

### Python / Axis
- Managed with `uv` (pyproject.toml at `axis/pyproject.toml`)
- Config via env file `/etc/kura/axis.env` or env vars
- Inference mode: `auto` (local if hardware score ≥ 2, else cloud fallback)
- Cloud priority: groq → openai → anthropic → openrouter (configurable)

### Frontend
- React 19 + TypeScript + Vite + shadcn/ui (Tailwind v4)
- State: TanStack Query for server state
- API client: `frontend/src/api/client.ts` (axios, auto-injects JWT)
- Routing: react-router-dom v7
- Dev proxy: `/api/*` → `localhost:8080`, `/ws` → ws `localhost:8080`
- Add components: `npx shadcn@latest add <component>`

## Dev environment
```bash
# Start deps (postgres + nats + ollama)
docker compose -f docker-compose.dev.yml up -d

# Backend
make dev          # runs kura-daemon (no helper — needs root for socket)

# Frontend
cd frontend && npm run dev

# Axis
cd axis && uv run uvicorn axis.core.main:app --reload --port 8765
```

## Phase 1 MVP goals (current)
- Storage: disk list, SMART, RAID 1/5, Btrfs, SMB/NFS
- Auth: JWT + TOTP
- Axis: cloud API chat (Groq/OpenAI/Anthropic)
- Frontend: Dashboard + Storage + Axis chat UI
- Installer: `bash installer/install.sh` on clean Debian 12
