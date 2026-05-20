#!/usr/bin/env bash
# KuraOS Debian overlay installer
# Usage: curl -fsSL https://install.kuraos.io | bash
# Or:    bash install.sh
set -euo pipefail

KURA_VERSION="${KURA_VERSION:-latest}"
KURA_USER="kura"
KURA_GROUP="kura"
INSTALL_DIR="/opt/kura"
DATA_DIR="/var/lib/kura"
LOG_DIR="/var/log/kura"
CONFIG_DIR="/etc/kura"
AXIS_DIR="$INSTALL_DIR/axis"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}[kura]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

require_root() {
    [[ $EUID -eq 0 ]] || error "Run as root: sudo bash install.sh"
}

check_debian() {
    [[ -f /etc/debian_version ]] || error "KuraOS requires Debian/Ubuntu"
    DEBIAN_VERSION=$(cat /etc/debian_version | cut -d. -f1)
    [[ "$DEBIAN_VERSION" -ge 12 ]] || error "Debian 12 (Bookworm) or newer required"
}

install_deps() {
    info "Installing system dependencies..."
    apt-get update -qq
    apt-get install -y --no-install-recommends \
        mdadm lvm2 btrfs-progs e2fsprogs \
        samba samba-common-bin \
        nfs-kernel-server \
        smartmontools \
        ufw \
        python3.12 python3.12-venv python3-pip \
        postgresql-16 postgresql-16-pgvector \
        curl wget git \
        ca-certificates gnupg \
        systemd-resolved \
        acl attr \
        2>/dev/null
}

install_docker() {
    if command -v docker &>/dev/null; then
        info "Docker already installed."
        return
    fi
    info "Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
}

create_user() {
    if id "$KURA_USER" &>/dev/null; then
        info "User '$KURA_USER' already exists."
    else
        info "Creating user '$KURA_USER'..."
        useradd -r -s /usr/sbin/nologin -d "$DATA_DIR" "$KURA_USER"
    fi
    usermod -aG docker "$KURA_USER" 2>/dev/null || true
    usermod -aG render "$KURA_USER" 2>/dev/null || true
}

create_dirs() {
    info "Creating directories..."
    mkdir -p "$DATA_DIR" "$LOG_DIR" "$CONFIG_DIR" "$INSTALL_DIR"
    chown -R "$KURA_USER:$KURA_GROUP" "$DATA_DIR" "$LOG_DIR"
    chmod 750 "$DATA_DIR"
    chmod 755 "$INSTALL_DIR" "$CONFIG_DIR"
}

generate_secrets() {
    info "Generating secrets..."
    JWT_SECRET="$DATA_DIR/jwt.secret"
    AXIS_TOKEN="$DATA_DIR/axis.token"
    if [[ ! -f "$JWT_SECRET" ]]; then
        openssl rand -hex 64 > "$JWT_SECRET"
        chmod 600 "$JWT_SECRET"
        chown "$KURA_USER:$KURA_GROUP" "$JWT_SECRET"
    fi
    if [[ ! -f "$AXIS_TOKEN" ]]; then
        openssl rand -hex 32 > "$AXIS_TOKEN"
        chmod 600 "$AXIS_TOKEN"
        chown "$KURA_USER:$KURA_GROUP" "$AXIS_TOKEN"
    fi
}

write_default_configs() {
    info "Writing default configs..."
    [[ -f "$CONFIG_DIR/daemon.env" ]] || cat > "$CONFIG_DIR/daemon.env" <<EOF
KURA_ADDR=:8080
KURA_CONFIG=$DATA_DIR/config.db
KURA_JWT_SECRET_FILE=$DATA_DIR/jwt.secret
EOF

    [[ -f "$CONFIG_DIR/axis.env" ]] || cat > "$CONFIG_DIR/axis.env" <<EOF
INFERENCE_MODE=auto
OLLAMA_BASE_URL=http://localhost:11434
POSTGRES_DSN=postgresql://kura:kura_axis@localhost:5432/kura
KURA_DAEMON_URL=http://localhost:8080
KURA_DAEMON_TOKEN_FILE=$DATA_DIR/axis.token
EOF

    chmod 640 "$CONFIG_DIR"/*.env
    chown root:"$KURA_GROUP" "$CONFIG_DIR"/*.env
}

setup_postgres() {
    info "Setting up PostgreSQL..."
    systemctl enable --now postgresql
    su postgres -c "psql -c \"CREATE USER kura WITH PASSWORD 'kura_axis';\"" 2>/dev/null || true
    su postgres -c "psql -c \"CREATE DATABASE kura OWNER kura;\"" 2>/dev/null || true
    su postgres -c "psql -d kura -c \"CREATE EXTENSION IF NOT EXISTS vector;\"" 2>/dev/null || true
}

install_axis() {
    info "Setting up Axis Python environment..."
    mkdir -p "$AXIS_DIR"
    cp -r axis/* "$AXIS_DIR/" 2>/dev/null || warn "Axis source not found — copy manually to $AXIS_DIR"
    python3.12 -m venv "$AXIS_DIR/.venv"
    "$AXIS_DIR/.venv/bin/pip" install -q --upgrade pip
    [[ -f "$AXIS_DIR/pyproject.toml" ]] && \
        "$AXIS_DIR/.venv/bin/pip" install -q -e "$AXIS_DIR[ml]" || true
    chown -R "$KURA_USER:$KURA_GROUP" "$AXIS_DIR"
}

install_binaries() {
    info "Installing kura-daemon and kura-helper..."
    if [[ -f "dist/kura-daemon" ]]; then
        install -Dm755 dist/kura-daemon /usr/local/bin/kura-daemon
        install -Dm755 dist/kura-helper /usr/local/bin/kura-helper
    else
        warn "dist/ not found — build with 'make build' first."
    fi
}

install_services() {
    info "Installing systemd services..."
    install -Dm644 installer/systemd/kura-daemon.service  /etc/systemd/system/
    install -Dm644 installer/systemd/kura-helper.service  /etc/systemd/system/
    install -Dm644 installer/systemd/axis-engine.service  /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable kura-helper kura-daemon axis-engine
}

configure_samba_base() {
    info "Configuring Samba base..."
    # Ensure include line is present
    if ! grep -q "kura-shares.conf" /etc/samba/smb.conf 2>/dev/null; then
        echo "" >> /etc/samba/smb.conf
        echo "include = /etc/samba/kura-shares.conf" >> /etc/samba/smb.conf
        touch /etc/samba/kura-shares.conf
    fi
}

finalize() {
    info "Starting services..."
    systemctl start kura-helper
    systemctl start kura-daemon
    systemctl start axis-engine

    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   KuraOS installation complete!       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Web UI:   ${GREEN}http://$LOCAL_IP:8080${NC}"
    echo -e "  Axis API: ${GREEN}http://127.0.0.1:8765/docs${NC}"
    echo ""
    echo "  Next: open the web UI, create your admin account,"
    echo "  and configure your storage."
    echo ""
}

main() {
    require_root
    check_debian
    install_deps
    install_docker
    create_user
    create_dirs
    generate_secrets
    write_default_configs
    setup_postgres
    install_axis
    install_binaries
    install_services
    configure_samba_base
    finalize
}

main "$@"
