#!/usr/bin/env bash
# KuraOS server bootstrap — run once on the target machine (nathan)
# Usage: bash scripts/setup-server.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${GRN}▶${NC} $*"; }
warn() { echo -e "${YLW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

# ── System deps ──────────────────────────────────────────────────────────────
install_system_deps() {
  log "Updating apt and installing system dependencies..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    git curl build-essential pkg-config \
    libpam0g-dev lsof tmux \
    || die "Failed to install system dependencies"
  log "System dependencies ready."
}

# ── Docker ───────────────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed."
  else
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    log "Docker installed."
  fi

  if ! groups | grep -q docker; then
    log "Adding user to docker group..."
    sudo usermod -aG docker "$USER"
    warn "You must log out and back in for docker group to take effect."
    warn "Or run: newgrp docker"
  fi
}

# ── Go 1.22 ──────────────────────────────────────────────────────────────────
install_go() {
  if command -v go &>/dev/null; then
    local ver; ver=$(go version | awk '{print $3}')
    log "Go $ver already installed."
    return
  fi
  log "Installing Go 1.22..."
  local arch; arch=$(uname -m)
  [[ "$arch" == "x86_64" ]] && arch="amd64"
  local url="https://go.dev/dl/go1.22.5.linux-${arch}.tar.gz"
  local tmp; tmp=$(mktemp -d)
  curl -fsSL "$url" -o "$tmp/go.tar.gz"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "$tmp/go.tar.gz"
  rm -rf "$tmp"

  if ! grep -q '/usr/local/go/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$PATH:/usr/local/go/bin"' >> ~/.bashrc
  fi
  export PATH="$PATH:/usr/local/go/bin"
  log "Go installed → $(go version)"
}

# ── Node.js 20 ───────────────────────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null && [[ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -ge 20 ]]; then
    log "Node.js $(node -v) already installed."
    return
  fi
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y -qq nodejs
  log "Node.js installed → $(node -v)"
}

# ── uv (Python) ──────────────────────────────────────────────────────────────
install_uv() {
  if command -v uv &>/dev/null; then
    log "uv $(uv --version) already installed."
    return
  fi
  log "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  if ! grep -q '.local/bin' ~/.bashrc 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  fi
  export PATH="$HOME/.local/bin:$PATH"
  log "uv installed → $(uv --version)"
}

# ── Python 3.12 check ────────────────────────────────────────────────────────
check_python() {
  local py_ver
  py_ver=$(python3 --version 2>/dev/null | awk '{print $2}' | cut -d. -f1,2)
  if [[ "$py_ver" != "3.12" ]]; then
    warn "Python 3.12 required but found: ${py_ver:-none}"
    warn "Debian 13 (trixie) should have Python 3.12 by default."
    die "Please install Python 3.12: sudo apt install python3.12 python3.12-venv"
  fi
  log "Python $py_ver OK."
}

# ── Go deps & build ──────────────────────────────────────────────────────────
build_go() {
  log "Downloading Go modules and building binaries..."
  export PATH="$PATH:/usr/local/go/bin"
  CGO_ENABLED=1 go mod tidy
  make build
  log "Go binaries ready → dist/"
}

# ── Frontend deps ────────────────────────────────────────────────────────────
install_frontend_deps() {
  log "Installing frontend dependencies..."
  cd "$ROOT/frontend"
  npm install --silent
  cd "$ROOT"
  log "Frontend dependencies ready."
}

# ── Python deps ──────────────────────────────────────────────────────────────
install_python_deps() {
  log "Installing Python dependencies (uv sync)..."
  export PATH="$HOME/.local/bin:$PATH"
  uv sync --extra ml 2>/dev/null || uv sync
  log "Python dependencies ready."
}

# ── Docker services ──────────────────────────────────────────────────────────
start_docker_services() {
  log "Starting Docker services (postgres, nats, ollama)..."
  if ! docker info &>/dev/null 2>&1; then
    die "Docker is not running or user not in docker group. Try: newgrp docker"
  fi
  docker compose -f "$ROOT/docker-compose.dev.yml" up -d
  log "Docker services running."
}

# ── Dev environment setup ────────────────────────────────────────────────────
setup_dev_env() {
  mkdir -p "$ROOT/.dev"
  if [[ ! -f "$ROOT/.dev/jwt.secret" ]]; then
    head -c 64 /dev/urandom | base64 > "$ROOT/.dev/jwt.secret"
    log "Generated JWT secret."
  fi

  cat > "$ROOT/.dev/axis.env" <<EOF
INFERENCE_MODE=auto
OLLAMA_BASE_URL=http://localhost:11434
POSTGRES_DSN=postgresql://kura:kura_dev@localhost:5432/kura
KURA_DAEMON_URL=http://192.168.1.205:9080
EOF
  log "Dev environment files created."
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
  echo -e "${NC}  Server Bootstrap\n"

  install_system_deps
  install_docker
  install_go
  install_node
  install_uv
  check_python
  build_go
  install_frontend_deps
  install_python_deps
  setup_dev_env
  start_docker_services

  echo ""
  log "✅ Server bootstrap complete!"
  echo ""
  echo "  Next steps:"
  echo "    1. If Docker group was just added, run: newgrp docker"
  echo "    2. Start dev environment: bash scripts/dev-server.sh"
  echo ""
  echo "  Access from your XPS:"
  echo "    Frontend: http://192.168.1.205:5173"
  echo "    API:      http://192.168.1.205:9080"
  echo "    Axis:     http://192.168.1.205:9765"
  echo ""
}

main "$@"
