# KuraOS — Gemini CLI Context

## What is KuraOS?
A Debian-based NAS/home-server OS competing with Synology DSM and UGOS Pro.
Installed as a Debian overlay (`bash installer/install.sh`), future: standalone ISO.
Unique feature: **Axis AI** — an intelligent assistant running fully local (Ollama/Qwen3)
or via cloud APIs (Groq, OpenAI, Anthropic, OpenRouter).

## Repository layout
```
backend/        Go services (kura-daemon + kura-helper)
axis/           Python AI engine (FastAPI)
frontend/       React + shadcn/ui dashboard
installer/      Debian install script + systemd units
configs/        Config templates (Samba, NFS, SSSD)
```

## Process architecture
```
kura-daemon  (:8080)  — main API, serves frontend, orchestrates all modules
kura-helper  (root)   — privileged binary, whitelisted ops only, Unix socket
axis-engine  (:8765)  — AI inference, MCP tools, RAG (Phase 2)
```

## Go conventions
- Module: `github.com/kura-os/kura`
- No shell execution: `kexec.Run(ctx, timeout, binary, args...)` from `backend/pkg/exec/`
- Device validation: `kexec.MustBeBlockDevice(path)` before any disk operation
- Build: `CGO_ENABLED=1 go build ./backend/cmd/kura-daemon`

## Python / Axis conventions
- Python 3.12, uv package manager
- Config via `/etc/kura/axis.env` (pydantic-settings)
- Inference: `axis/inference/` — ollama_client.py, cloud_client.py
- MCP tools: `axis/mcp/tools.py` — only calls kura-daemon REST, never helper directly

## Frontend conventions
- React 19 + TypeScript + Vite + shadcn/ui + Tailwind v4
- `npx shadcn@latest add <component>` to add UI components
- shadcn MCP server configured in `.mcp.json` for AI-assisted component generation
- API: `frontend/src/api/client.ts` (axios + JWT auto-inject)
- Server state: TanStack Query (react-query)

## Critical constraints
1. **Samba**: always `store dos attributes = no` to preserve POSIX permissions
2. **Security**: privileged ops are whitelisted in `backend/internal/helper/ops/`
3. **No shell interpolation**: all commands use explicit arg arrays
4. **Axis → daemon → helper** (never Axis → helper directly)

## Development quick start
```bash
docker compose -f docker-compose.dev.yml up -d  # start postgres, nats, ollama
make dev                                          # start kura-daemon
cd frontend && npm run dev                        # start frontend dev server
cd axis && uv run uvicorn axis.core.main:app --reload --port 8765
```
