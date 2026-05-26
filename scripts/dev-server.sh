#!/usr/bin/env bash
# KuraOS dev environment for server — runs all services on nathan
# Usage: bash scripts/dev-server.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; MAG='\033[0;35m'; CYN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GRN}▶${NC} $*"; }
warn() { echo -e "${YLW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

# ── Prefixed log tailing ─────────────────────────────────────────────────────
prefix_log() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    echo -e "${color}[${label}]${NC} ${line}"
  done
}

# ── Port check ───────────────────────────────────────────────────────────────
free_port() {
  local port="$1"
  local pid; pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    warn "Port $port in use by PID $pid — killing..."
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# ── Check binaries ───────────────────────────────────────────────────────────
check_binaries() {
  if [[ ! -x "$ROOT/dist/kura-daemon" ]] || [[ ! -x "$ROOT/dist/kura-helper" ]]; then
    warn "Go binaries not found. Building now..."
    export PATH="$PATH:/usr/local/go/bin"
    make build
  fi
}

# ── Check Docker ─────────────────────────────────────────────────────────────
check_docker() {
  if ! docker info &>/dev/null 2>&1; then
    warn "Docker not available — postgres/nats/ollama may be down."
    return
  fi
  if ! docker compose -f "$ROOT/docker-compose.dev.yml" ps | grep -q "Up"; then
    log "Starting Docker services..."
    docker compose -f "$ROOT/docker-compose.dev.yml" up -d
  else
    log "Docker services already running."
  fi
}

# ── Dev env setup ────────────────────────────────────────────────────────────
setup_dev_env() {
  mkdir -p "$ROOT/.dev"
  if [[ ! -f "$ROOT/.dev/jwt.secret" ]]; then
    head -c 64 /dev/urandom | base64 > "$ROOT/.dev/jwt.secret"
    log "Generated JWT secret."
  fi
  if [[ ! -f "$ROOT/.dev/axis.env" ]]; then
    cat > "$ROOT/.dev/axis.env" <<EOF
INFERENCE_MODE=auto
OLLAMA_BASE_URL=http://localhost:11434
POSTGRES_DSN=postgresql://kura:kura_dev@localhost:5432/kura
KURA_DAEMON_URL=http://192.168.1.205:9080
EOF
    log "Created axis.env"
  fi
}

# ── Trap: cleanup ────────────────────────────────────────────────────────────
PIDS=()
HELPER_PID=""
cleanup() {
  echo ""
  log "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [[ -n "$HELPER_PID" ]]; then
    sudo kill "$HELPER_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  log "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Start helper ─────────────────────────────────────────────────────────────
start_helper() {
  log "Starting kura-helper (requires sudo)..."
  sudo mkdir -p /run/kura
  sudo "$ROOT/dist/kura-helper" 2>&1 | prefix_log "helper" "$YLW" &
  HELPER_PID=$!
  sleep 1
  if sudo test -S /run/kura/helper.sock 2>/dev/null; then
    log "kura-helper socket ready."
  else
    warn "kura-helper socket not found — continuing anyway."
  fi
}

# ── Start daemon ─────────────────────────────────────────────────────────────
start_daemon() {
  free_port 9080
  export PATH="$PATH:/usr/local/go/bin"
  export KURA_ADDR=":9080"
  export KURA_CONFIG="$ROOT/.dev/config.db"
  export KURA_JWT_SECRET="$(cat "$ROOT/.dev/jwt.secret")"
  export KURA_DEV_MODE="1"

  local air_bin
  air_bin="$(go env GOPATH)/bin/air"
  if [[ -x "$air_bin" ]]; then
    "$air_bin" -c "$ROOT/.air.toml" 2>&1 | prefix_log "daemon" "$BLU" &
  else
    warn "air not found — using go run (no hot reload)"
    CGO_ENABLED=1 go run ./backend/cmd/kura-daemon 2>&1 | prefix_log "daemon" "$BLU" &
  fi
  PIDS+=($!)
}

# ── Start Axis ───────────────────────────────────────────────────────────────
start_axis() {
  free_port 9765
  export PATH="$HOME/.local/bin:$PATH"
  # shellcheck disable=SC1091
  source "$ROOT/.dev/axis.env" 2>/dev/null || true

  uv run uvicorn axis.core.main:app \
    --reload \
    --reload-dir "$ROOT/axis" \
    --host 0.0.0.0 \
    --port 9765 \
    --log-level info 2>&1 | prefix_log "axis  " "$MAG" &
  PIDS+=($!)
}

# ── Start frontend ───────────────────────────────────────────────────────────
start_frontend() {
  free_port 5173
  cd "$ROOT/frontend"
  # Use --host 0.0.0.0 to allow external access from XPS
  npx vite --host 0.0.0.0 --port 5173 2>&1 | prefix_log "ui    " "$CYN" &
  PIDS+=($!)
  cd "$ROOT"
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo -e "${GRN}"
  echo "  ██╗  ██╗██╗   ██╗██████╗  █████╗  ██████╗ ███████╗"
  echo "  ██║ ██╔╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗██╔════╝"
  echo "  █████╔╝ ██║   ██║██████╔╝███████║██║   ██║███████╗"
  echo "  ██╔═██╗ ██║   ██║██╔══██╗██╔══██║██║   ██║╚════██║"
  echo "  ██║  ██╗╚██████╔╝██║  ██║██║  ██║╚██████╔╝███████║"
  echo "  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
  echo -e "${NC}  Server Dev Environment\n"

  check_binaries
  check_docker
  setup_dev_env

  echo ""
  log "Starting services..."
  echo -e "  ${YLW}[helper]${NC}  /run/kura/helper.sock"
  echo -e "  ${BLU}[daemon]${NC}  http://192.168.1.205:9080"
  echo -e "  ${MAG}[axis  ]${NC}  http://192.168.1.205:9765"
  echo -e "  ${CYN}[ui    ]${NC}  http://192.168.1.205:5173"
  echo ""

  start_helper
  start_daemon
  sleep 2
  start_axis
  start_frontend

  echo ""
  log "All services running. Press Ctrl+C to stop."
  echo ""
  log "Access from XPS: http://192.168.1.205:5173"
  echo ""

  # Wait for any child to exit
  wait -n "${PIDS[@]}" 2>/dev/null || true
  die "A service exited unexpectedly. Check logs above."
}

main "$@"
