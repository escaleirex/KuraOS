#!/usr/bin/env bash
# KuraOS dev environment — installs deps + starts all services
# Usage: bash scripts/dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; MAG='\033[0;35m'; CYN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GRN}▶${NC} $*"; }
warn() { echo -e "${YLW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

# ── Prefixed log tailing (coloured by service) ────────────────────────────────
prefix_log() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    echo -e "${color}[${label}]${NC} ${line}"
  done
}

# ── Dep: Go ──────────────────────────────────────────────────────────────────
install_go() {
  if command -v go &>/dev/null; then
    log "Go $(go version | awk '{print $3}') already installed."
    return
  fi
  log "Installing Go 1.22..."
  local arch; arch=$(uname -m)
  [[ "$arch" == "x86_64" ]] && arch="amd64"
  [[ "$arch" == "aarch64" ]] && arch="arm64"
  local url="https://go.dev/dl/go1.22.5.linux-${arch}.tar.gz"
  local tmp; tmp=$(mktemp -d)
  curl -fsSL "$url" -o "$tmp/go.tar.gz"
  sudo tar -C /usr/local -xzf "$tmp/go.tar.gz"
  rm -rf "$tmp"
  export PATH="$PATH:/usr/local/go/bin"
  # Add to profile if not already there
  if ! grep -q '/usr/local/go/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$PATH:/usr/local/go/bin"' >> ~/.bashrc
  fi
  log "Go installed → $(go version)"
}

# ── Dep: uv (Python package manager) ─────────────────────────────────────────
install_uv() {
  if command -v uv &>/dev/null; then
    log "uv $(uv --version) already installed."
    return
  fi
  log "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  # Add to profile if not already there
  if ! grep -q '.local/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  fi
  log "uv installed → $(uv --version)"
}

# ── Dep: Docker ───────────────────────────────────────────────────────────────
install_lsof() {
  command -v lsof &>/dev/null && return
  warn "lsof not found — installing..."
  sudo apt-get install -y -qq lsof 2>/dev/null || true
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed."
    return
  fi
  warn "Docker not found. Install manually or run:"
  warn "  curl -fsSL https://get.docker.com | bash"
  warn "Skipping Docker services (postgres, nats, ollama)."
  SKIP_DOCKER=1
}

# ── Install Go deps ───────────────────────────────────────────────────────────
go_deps() {
  log "Downloading Go modules..."
  export PATH="$PATH:/usr/local/go/bin"
  CGO_ENABLED=1 go mod tidy
  log "Go modules ready."
}

# ── Build Go binaries ─────────────────────────────────────────────────────────
build_go() {
  log "Building kura-daemon and kura-helper..."
  export PATH="$PATH:/usr/local/go/bin"
  CGO_ENABLED=1 go build -o "$ROOT/dist/kura-daemon" ./backend/cmd/kura-daemon
  CGO_ENABLED=1 go build -o "$ROOT/dist/kura-helper" ./backend/cmd/kura-helper
  log "Binaries ready → dist/"
}

# ── Install Python deps ───────────────────────────────────────────────────────
python_deps() {
  log "Installing Python deps (uv sync)..."
  export PATH="$HOME/.local/bin:$PATH"
  # pyproject.toml is at repo root; venv created at .venv/
  uv sync --extra ml 2>/dev/null || uv sync
  log "Python deps ready."
}

# ── Install frontend deps ─────────────────────────────────────────────────────
frontend_deps() {
  log "Installing frontend deps (npm install)..."
  cd "$ROOT/frontend"
  npm install --silent
  cd "$ROOT"
  log "Frontend deps ready."
}

# ── Start: Docker services ────────────────────────────────────────────────────
start_docker() {
  [[ "${SKIP_DOCKER:-0}" == "1" ]] && return
  log "Starting Docker services (postgres, nats, ollama)..."

  # Add current user to docker group if not already member (takes effect next login)
  if ! groups | grep -q docker; then
    warn "User not in docker group. Adding... (re-login needed for permanent fix)"
    sudo usermod -aG docker "$USER" 2>/dev/null || true
  fi

  # Determine docker command (prefer direct, fall back to sudo)
  local dc_cmd
  if docker info &>/dev/null 2>&1; then
    dc_cmd="docker compose"
  else
    dc_cmd="sudo docker compose"
    warn "Using sudo for Docker (re-login or run 'sudo usermod -aG docker \$USER && su - \$USER' to fix)"
  fi

  if ! $dc_cmd -f "$ROOT/docker-compose.dev.yml" up -d 2>&1; then
    warn "Docker services failed to start — continuing without DB/Ollama."
    warn "Fix: run 'newgrp docker' in a new shell or re-login."
    SKIP_DOCKER=1
    return
  fi
  log "Docker services running."
}

# ── Create dev data dir ───────────────────────────────────────────────────────
setup_dev_env() {
  mkdir -p "$ROOT/.dev"
  # JWT secret for dev
  if [[ ! -f "$ROOT/.dev/jwt.secret" ]]; then
    head -c 64 /dev/urandom | base64 > "$ROOT/.dev/jwt.secret"
  fi
  # Axis env for dev
  cat > "$ROOT/.dev/axis.env" <<EOF
INFERENCE_MODE=auto
OLLAMA_BASE_URL=http://localhost:11434
POSTGRES_DSN=postgresql://kura:kura_dev@localhost:5432/kura
KURA_DAEMON_URL=http://localhost:9080
EOF
}

# ── Trap: kill all children on exit ──────────────────────────────────────────
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
  wait 2>/dev/null
  log "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Start services ────────────────────────────────────────────────────────────
free_port() {
  local port="$1"
  local pid; pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    warn "Port $port in use by PID $pid — killing..."
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

start_helper() {
  log "Starting kura-helper (privileged — may prompt for sudo password)..."
  sudo mkdir -p /run/kura
  sudo "$ROOT/dist/kura-helper" 2>&1 | prefix_log "helper" "$YLW" &
  HELPER_PID=$!
  sleep 1
  if ! sudo test -S /run/kura/helper.sock 2>/dev/null; then
    warn "kura-helper socket not found — real account login won't work (dev accounts still OK)"
  else
    log "kura-helper socket ready."
  fi
}

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
    warn "air not found — falling back to go run (no hot reload)"
    CGO_ENABLED=1 go run ./backend/cmd/kura-daemon 2>&1 | prefix_log "daemon" "$BLU" &
  fi
  PIDS+=($!)
}

start_axis() {
  free_port 9765
  export PATH="$HOME/.local/bin:$PATH"
  # shellcheck disable=SC1091
  source "$ROOT/.dev/axis.env" 2>/dev/null || true
  # Run from repo root so 'axis' package (axis/__init__.py) is importable
  uv run uvicorn axis.core.main:app \
    --reload \
    --reload-dir "$ROOT/axis" \
    --host 127.0.0.1 \
    --port 9765 \
    --log-level info 2>&1 | prefix_log "axis  " "$MAG" &
  PIDS+=($!)
}

start_frontend() {
  free_port 5173
  cd "$ROOT/frontend"
  npm run dev -- --port 5173 2>&1 | prefix_log "ui    " "$CYN" &
  PIDS+=($!)
  cd "$ROOT"
}

# ── Main ──────────────────────────────────────────────────────────────────────
deps_only() {
  SKIP_DOCKER=0
  install_go
  install_uv
  install_docker
  go_deps
  build_go
  python_deps
  frontend_deps
  setup_dev_env
  log "All deps installed."
}

main() {
  echo -e "${GRN}"
  echo "  ██╗  ██╗██╗   ██╗██████╗  █████╗  ██████╗ ███████╗"
  echo "  ██║ ██╔╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗██╔════╝"
  echo "  █████╔╝ ██║   ██║██████╔╝███████║██║   ██║███████╗"
  echo "  ██╔═██╗ ██║   ██║██╔══██╗██╔══██║██║   ██║╚════██║"
  echo "  ██║  ██╗╚██████╔╝██║  ██║██║  ██║╚██████╔╝███████║"
  echo "  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
  echo -e "${NC}  Dev Environment\n"

  # Install deps
  SKIP_DOCKER=0
  install_go
  install_uv
  install_lsof
  install_docker
  go_deps
  build_go
  python_deps
  frontend_deps
  setup_dev_env

  # Start infra (non-fatal — axis/daemon start without DB in limited mode)
  start_docker || true

  echo ""
  log "Starting services..."
  echo -e "  ${YLW}[helper]${NC}  /run/kura/helper.sock"
  echo -e "  ${BLU}[daemon]${NC}  http://localhost:9080"
  echo -e "  ${MAG}[axis  ]${NC}  http://localhost:9765"
  echo -e "  ${CYN}[ui    ]${NC}  http://localhost:5173"
  echo ""

  start_helper
  start_daemon
  sleep 2   # daemon needs a moment before axis tries to connect
  start_axis
  start_frontend

  echo ""
  log "All services running. Press Ctrl+C to stop."
  echo ""

  # Wait for any child to exit (crash → show exit)
  wait -n "${PIDS[@]}" 2>/dev/null || true
  die "A service exited unexpectedly. Check logs above."
}

[[ "${1:-}" == "--deps-only" ]] && deps_only || main "$@"
