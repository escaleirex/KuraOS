 KuraOS — Architectural Plan

 Context

 KuraOS = Debian-based NAS/home-server OS competing with Synology DSM and UGOS Pro. Differentiator: hardware-agnostic + AI
 assistant (Axis) running 100% local or via cloud APIs. Delivered first as a Debian overlay installer, later as standalone ISO.
 Five core modules: Storage, Axis AI, Virtualization, Hardware Control, Network/Security.

 ---
 1. Stack Tecnológica

 ┌─────────────────┬─────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
 │      Layer      │       Choice        │                                     Reason                                      │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Backend daemon  │ Go                  │ Static binary, great Linux syscall support, Docker SDK native, fast concurrency │
 │                 │                     │  for storage ops                                                                │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Privileged      │ Go                  │ Same codebase, compiled to setuid/capability binary                             │
 │ helper          │                     │                                                                                 │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Axis AI engine  │ Python 3.12 +       │ ML ecosystem (Ollama, pgvector, OpenVINO, sentence-transformers) is             │
 │                 │ FastAPI             │ Python-native                                                                   │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Frontend        │ SvelteKit +         │ Lighter than React, smaller bundle, excellent for dashboards                    │
 │                 │ TypeScript          │                                                                                 │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ DB (metadata)   │ PostgreSQL 16       │ Also hosts pgvector for RAG                                                     │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ IPC             │ Unix socket (gRPC)  │ kura-daemon ↔ kura-helper; strict 0600 permissions                              │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Config store    │ SQLite (embedded)   │ Local config, no external dep for daemon startup                                │
 ├─────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
 │ Message bus     │ NATS (embedded)     │ Real-time events → WebSocket → frontend                                         │
 └─────────────────┴─────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

 ---
 2. Arquitectura de Processos

                         ┌─────────────────────────────┐
                         │       kura-ui (SvelteKit)    │
                         │  :3000  (served by daemon)   │
                         └──────────┬──────────────────┘
                                    │ REST + WebSocket
                         ┌──────────▼──────────────────┐
                         │    kura-daemon (Go)           │
                         │  :8080  main API              │
                         │  Módulos: storage/net/docker  │
                         │           auth/hardware       │
                         └────┬─────────────┬───────────┘
               Unix socket    │             │  HTTP :8765
          (gRPC, 0600 perms)  │             │
               ┌──────────────▼──┐    ┌─────▼──────────────┐
               │  kura-helper    │    │   axis-engine       │
               │  (Go, CAP_*)    │    │   (Python/FastAPI)  │
               │  Executa ops    │    │   Ollama + RAG      │
               │  privilegiadas  │    │   MCP tools         │
               └─────────────────┘    └─────────────────────┘
                                               │
                               ┌───────────────┼──────────────┐
                           Ollama          pgvector        Cloud APIs
                          (local)         (postgres)    (OpenAI/Groq/…)

 ---
 3. Segurança: kura-helper e Operações Root

 Problema: Axis/daemon precisam executar mdadm, iptables, btrfs, sssd, etc. como root sem criar superfície de ataque.

 Solução — Privileged Helper pattern:

 1. kura-helper compila com capabilities Linux específicas via systemd unit:
 AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN CAP_SYS_RAWIO CAP_DAC_READ_SEARCH
 2. Comunica com kura-daemon via Unix socket /run/kura/helper.sock (0600, owned root:kura)
 3. Whitelist de operações hardcoded no helper — nenhum shell interpolation. Todos os comandos usam exec.Command(binary,
 args...) sem sh -c
 4. Cada operação tem schema de validação (ex: device path deve matchar /dev/sd[a-z] ou /dev/md[0-9]+)
 5. Audit log de todas as operações privilegiadas → /var/log/kura/helper.log
 6. Axis MCP tools → kura-daemon API → helper (nunca Axis direto ao helper)

 ---
 4. Módulo 1 — Storage

 Componentes Go (backend/internal/storage/):
 - mdadm.go — criar/gerir arrays RAID (0,1,5,6,10), status, rebuild
 - lvm.go — PV/VG/LV, LVM cache (NVMe SSD caching via lvmcache)
 - btrfs.go — criar volumes, snapshots automáticos (via btrfs-progs), scrub scheduler, subvolumes
 - shares.go — gerir SMB/NFS/FTP/WebDAV

 Crítico: Samba + POSIX permissions

 smb.conf template gerado pelo daemon:
 [share]
    vfs objects = acl_xattr
    map acl inherit = yes
    store dos attributes = no      # ← evita user.DOSATTRIB contaminar xattrs
    ea support = no
    create mask = 0664
    directory mask = 0775
    force group = kura-data

 Samba metadata problem: usar store dos attributes = no + ea support = no por defeito. Só ativar streams_xattr se user
 explicitamente precisar de ACLs Windows. Documentar o tradeoff na UI.

 LVM SSD Cache:
 # NVMe como cache de array HDD
 lvcreate --type cache-pool -n ssd_cache -l 100%FREE vg_fast
 lvconvert --type cache --cachepool vg_fast/ssd_cache vg_data/lv_data
 Daemon expõe como "SSD Cache" toggle na UI.

 ---
 5. Módulo 2 — Axis AI Engine

 Pipeline de Inferência

 User Query
     │
     ▼
 ┌─────────────────────────────────────────────┐
 │              Axis Router                      │
 │  1. Detect intent (tool call vs chat)         │
 │  2. Check hardware capability score           │
 │  3. Route: Local Ollama → Cloud API fallback  │
 └─────────────┬───────────────────────────────┘
               │
     ┌─────────▼──────────┐    ┌─────────────────────┐
     │   Local Inference   │    │   Cloud Fallback     │
     │   Ollama + Qwen3    │    │   OpenRouter/Groq/   │
     │   Intel IPEX/OpenVINO│   │   OpenAI/Anthropic   │
     │   NVIDIA CUDA       │    │   (user-configured)  │
     └─────────────────────┘    └─────────────────────┘

 Aceleração Local:
 - Intel iGPU/NPU: intel-extension-for-pytorch (IPEX) + OpenVINO runtime
 - NVIDIA: CUDA via Ollama nativo
 - Fallback: CPU inference (Ollama padrão)
 - Hardware capability score calculado no boot: VRAM disponível, NPU presente → decide modelo padrão

 RAG Pipeline

 Ingest: docs → chunker → embedding model (local, ex: nomic-embed-text via Ollama)
                                       → pgvector store
 Query: user question → embed → pgvector similarity search (top-k)
                      → reranker (local, ex: cross-encoder via sentence-transformers)
                      → context + query → LLM → response

 - DB: PostgreSQL 16 + pgvector extension
 - Embedding: nomic-embed-text (Ollama) ou all-MiniLM (sentence-transformers offline)
 - Reranker: cross-encoder/ms-marco-MiniLM-L-6-v2 (offline)
 - Privacidade: 100% local quando configurado assim

 MCP Tools (axis/mcp/)

 # Cada tool chama kura-daemon REST API, que delega ao kura-helper se necessário
 tools = [
     "disk_smart_check",      # GET /api/storage/disks/{id}/smart
     "list_docker_containers", # GET /api/docker/containers
     "manage_firewall_rule",   # POST /api/network/firewall/rules
     "create_raid_array",      # POST /api/storage/raids
     "get_system_metrics",     # GET /api/system/metrics
     "manage_shares",          # POST /api/storage/shares
 ]

 Media ML Pipeline (axis/media/)

 - Reconhecimento facial: insightface (offline)
 - OCR: tesseract via pytesseract + easyocr
 - Duplicatas/blur: perceptual hash (imagehash) + Laplacian variance
 - Pesquisa semântica: CLIP (openai/clip-vit-base-patch32 offline)
 - Transcrição áudio: whisper.cpp (offline, local)

 ---
 6. Módulo 3 — Virtualização e Docker

 Docker (backend/internal/docker/):
 - Go Docker SDK (docker/docker/client)
 - Gestão de stacks via Docker Compose (exec docker compose subprocess)
 - Hardware passthrough config gerado automaticamente:
 # Gerado pelo daemon para containers media
 devices:
   - /dev/dri:/dev/dri
 group_add:
   - "render"   # GID dinâmico lido de /etc/group no host
 - Daemon lê /etc/group para GID do grupo render e injeta no compose

 KVM/QEMU (Fase 3):
 - backend/internal/vm/ — wrapper libvirt via libvirt-go
 - GPU Passthrough: VFIO config, IOMMU groups expostos na UI

 ---
 7. Módulo 4 — Hardware Control

 Fan Control (backend/internal/hardware/fancontrol.go):
 - ITE chips (IT8790E, IT8613E): acesso via port I/O (/dev/port) ou módulo it87
 - Carregar módulo: modprobe it87 force_id=0x8790
 - PWM control: escrever para /sys/class/hwmon/hwmon*/pwm*
 - Perfis de temperatura: definidos por user na UI, daemon aplica via goroutine de monitorização

 LCD (Fase 3, opcional):
 - Driver i915 já presente no Debian
 - LVGL compilado como biblioteca C, binding Go via CGO
 - Render loop: goroutine Go lê métricas → passa para LVGL → framebuffer /dev/fb0

 ---
 8. Módulo 5 — Rede e Segurança

 Tailscale:
 - Instalar via tailscale apt package
 - Daemon gere tailscale up/down + subnet routing via helper
 - Docker: --device=/dev/net/tun --cap-add=NET_ADMIN no container Tailscale se usado em Docker

 Nginx Proxy Manager:
 - Deploy como container Docker (stack gerida pelo daemon)
 - Daemon expõe UI wrapper para configurar hosts e certificados

 Firewall:
 - Backend usa UFW como abstração (simples) + iptables direto para regras avançadas
 - Helper executa: ufw allow, ufw deny, iptables -A/-D

 Auth:
 - JWT (short-lived access token + refresh token)
 - 2FA TOTP: pquerna/otp (Go library)
 - LDAP/AD: SSSD config gerado pelo daemon, sssd.conf template com mapeamento de grupos

 ---
 9. Estrutura de Diretórios (Monorepo)

 kura-os/
 ├── backend/
 │   ├── cmd/
 │   │   ├── kura-daemon/         # main.go — entrypoint daemon
 │   │   └── kura-helper/         # main.go — entrypoint helper privilegiado
 │   ├── internal/
 │   │   ├── api/                 # HTTP handlers, WebSocket, middleware
 │   │   │   ├── routes.go
 │   │   │   ├── storage.go
 │   │   │   ├── network.go
 │   │   │   ├── docker.go
 │   │   │   ├── hardware.go
 │   │   │   └── auth.go
 │   │   ├── storage/
 │   │   │   ├── mdadm.go
 │   │   │   ├── lvm.go
 │   │   │   ├── btrfs.go
 │   │   │   ├── shares.go        # SMB/NFS/FTP/WebDAV config gen
 │   │   │   └── smart.go
 │   │   ├── network/
 │   │   │   ├── tailscale.go
 │   │   │   ├── firewall.go
 │   │   │   └── nginx.go
 │   │   ├── docker/
 │   │   │   ├── manager.go       # Docker SDK
 │   │   │   ├── compose.go
 │   │   │   └── hwpassthrough.go # DRI/render group injection
 │   │   ├── hardware/
 │   │   │   ├── fancontrol.go    # ITE EC + hwmon sysfs
 │   │   │   ├── sensors.go       # CPU/GPU temp, SMART
 │   │   │   └── lcd.go           # Fase 3
 │   │   ├── auth/
 │   │   │   ├── jwt.go
 │   │   │   ├── totp.go
 │   │   │   └── sssd.go          # LDAP/AD config gen
 │   │   ├── vm/                  # Fase 3
 │   │   │   ├── libvirt.go
 │   │   │   └── vfio.go
 │   │   └── helper/
 │   │       ├── ipc.go           # Unix socket server (helper side)
 │   │       └── ops/             # Operações whitelisted
 │   │           ├── storage.go
 │   │           ├── network.go
 │   │           └── system.go
 │   └── pkg/
 │       ├── exec/                # safe exec (nunca sh -c)
 │       │   └── run.go
 │       ├── ipc/                 # gRPC client (daemon side)
 │       │   └── client.go
 │       └── config/
 │           └── config.go        # SQLite config store
 │
 ├── axis/
 │   ├── core/
 │   │   ├── main.py              # FastAPI app
 │   │   ├── router.py            # inference router (local vs cloud)
 │   │   └── config.py
 │   ├── inference/
 │   │   ├── ollama_client.py
 │   │   ├── cloud_client.py      # OpenAI/Groq/Anthropic/OpenRouter
 │   │   ├── hardware_detect.py   # NPU/GPU capability scoring
 │   │   └── accel/
 │   │       ├── ipex.py          # Intel IPEX
 │   │       └── openvino.py      # OpenVINO
 │   ├── rag/
 │   │   ├── ingest.py            # chunker + embedding
 │   │   ├── retriever.py         # pgvector search
 │   │   ├── reranker.py          # cross-encoder
 │   │   └── pipeline.py          # full RAG chain
 │   ├── mcp/
 │   │   ├── tools.py             # MCP tool definitions
 │   │   ├── executor.py          # calls kura-daemon API
 │   │   └── schemas.py
 │   └── media/
 │       ├── photos.py            # face recog, OCR, dup/blur detect
 │       ├── clip_search.py       # semantic image search
 │       └── audio.py             # whisper.cpp transcription
 │
 ├── frontend/
 │   ├── src/
 │   │   ├── routes/
 │   │   │   ├── +layout.svelte
 │   │   │   ├── dashboard/
 │   │   │   ├── storage/
 │   │   │   ├── docker/
 │   │   │   ├── network/
 │   │   │   ├── axis/            # Axis chat UI
 │   │   │   ├── hardware/
 │   │   │   └── settings/
 │   │   ├── lib/
 │   │   │   ├── components/
 │   │   │   │   ├── charts/      # disk usage, temp graphs
 │   │   │   │   ├── storage/
 │   │   │   │   └── axis/
 │   │   │   ├── stores/          # Svelte stores (reactive state)
 │   │   │   └── api/             # typed API client (fetch)
 │   │   └── app.html
 │   ├── static/
 │   ├── svelte.config.js
 │   └── package.json
 │
 ├── installer/
 │   ├── install.sh               # Debian overlay installer
 │   ├── uninstall.sh
 │   ├── systemd/
 │   │   ├── kura-daemon.service
 │   │   ├── kura-helper.service
 │   │   └── axis-engine.service
 │   ├── sudoers.d/               # fallback se não usar capabilities
 │   └── debconf/
 │
 ├── packaging/
 │   ├── deb/                     # .deb package (Fase 2)
 │   │   ├── DEBIAN/control
 │   │   └── DEBIAN/postinst
 │   └── iso/                     # live-build config (Fase 3)
 │
 ├── configs/
 │   ├── templates/
 │   │   ├── smb.conf.tmpl        # Go text/template
 │   │   ├── sssd.conf.tmpl
 │   │   ├── exports.tmpl         # NFS
 │   │   └── nginx-site.tmpl
 │
 ├── scripts/
 │   ├── dev-setup.sh             # instala dependências dev
 │   └── build.sh                 # cross-compile + bundle frontend
 │
 ├── docs/
 │   ├── architecture/
 │   ├── api/                     # OpenAPI spec
 │   └── modules/
 │
 ├── go.mod                       # module: github.com/kura-os/kura
 ├── go.sum
 ├── Makefile
 └── docker-compose.dev.yml       # stack de desenvolvimento local

 ---
 10. Roadmap em 3 Fases

 Fase 1 — MVP (0–4 meses)

 Objetivo: Sistema instalável, discos geridos, partilhas funcionais, Axis via cloud.

 ┌──────────────────────┬───────────────────────────────────────────────────────────────┐
 │         Task         │                           Detalhes                            │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ installer/install.sh │ Instala deps Debian, cria user kura, instala serviços systemd │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ kura-daemon skeleton │ API HTTP básica, serve frontend estático                      │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ kura-helper skeleton │ Unix socket, whitelist de ops inicial                         │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Storage: discos      │ Listar discos, info, SMART básico                             │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Storage: RAID        │ mdadm create/status RAID 1/5                                  │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Storage: Btrfs       │ Criar volume, snapshot manual                                 │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Storage: SMB         │ Gerar smb.conf correto (sem DOSATTRIB), restart Samba         │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Storage: NFS         │ Gerar /etc/exports, exportfs                                  │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Auth                 │ Login local, JWT, 2FA TOTP                                    │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Frontend             │ Dashboard: discos, partilhas, utilizadores                    │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Axis                 │ Chat UI + Cloud API (OpenAI, Anthropic, Groq)                 │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Axis MCP             │ disk_smart_check, get_system_metrics                          │
 ├──────────────────────┼───────────────────────────────────────────────────────────────┤
 │ Segurança            │ UFW básico, firewall rules UI                                 │
 └──────────────────────┴───────────────────────────────────────────────────────────────┘

 Critério de saída: Debian limpo + curl | bash install.sh → sistema operacional com UI acessível em :8080.

 ---
 Fase 2 — Core Features (4–8 meses)

 ┌─────────────────────┬─────────────────────────────────────────────────────┐
 │        Task         │                      Detalhes                       │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Docker management   │ Listar/start/stop containers, deploy stacks         │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ HW transcoding      │ Auto-detect DRI/render GID, injetar em compose      │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ LVM + SSD cache     │ LVM cache com NVMe, UI para toggle                  │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Tailscale           │ Install, tailscale up, subnet routing config        │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Nginx Proxy Manager │ Deploy stack, UI wrapper para hosts/SSL             │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ LDAP/AD (SSSD)      │ Gerar sssd.conf, testar bind, mapear grupos         │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Axis — Ollama local │ Integrar Ollama, escolher modelo por hardware score │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Axis — RAG          │ pgvector, embedding local, reranker, ingest UI      │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Axis MCP avançado   │ manage_firewall_rule, list_docker_containers        │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Fan control básico  │ Ler hwmon sysfs, perfis temperatura simples         │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ RAID avançado       │ RAID 0/6/10, JBOD, rebuild progress                 │
 ├─────────────────────┼─────────────────────────────────────────────────────┤
 │ Packaging .deb      │ Primeira release instalável via apt                 │
 └─────────────────────┴─────────────────────────────────────────────────────┘

 ---
 Fase 3 — Advanced + ISO (8–14 meses)

 ┌─────────────────────┬───────────────────────────────────────────────┐
 │        Task         │                   Detalhes                    │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ KVM/QEMU            │ libvirt wrapper, criar/gerir VMs, console VNC │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ GPU Passthrough     │ VFIO config, IOMMU groups, bind unbind        │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Intel IPEX/OpenVINO │ Aceleração NPU/iGPU para Axis inference       │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Fan control ITE     │ Módulo it87, port I/O para chips EC           │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ LCD panel           │ LVGL + i915 framebuffer, métricas UI          │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Media ML pipeline   │ Reconhecimento facial, OCR, CLIP, Whisper     │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Axis MCP completo   │ KVM management, full storage ops              │
 │        Task         │                   Detalhes                    │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ KVM/QEMU            │ libvirt wrapper, criar/gerir VMs, console VNC │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ GPU Passthrough     │ VFIO config, IOMMU groups, bind unbind        │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Intel IPEX/OpenVINO │ Aceleração NPU/iGPU para Axis inference       │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Fan control ITE     │ Módulo it87, port I/O para chips EC           │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ LCD panel           │ LVGL + i915 framebuffer, métricas UI          │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Media ML pipeline   │ Reconhecimento facial, OCR, CLIP, Whisper     │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Axis MCP completo   │ KVM management, full storage ops              │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ Standalone ISO      │ live-build config Debian, preseed, branding   │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ WebDAV              │ Servidor WebDAV integrado                     │
 ├─────────────────────┼───────────────────────────────────────────────┤
 │ FTP                 │ vsftpd config gen                             │
 └─────────────────────┴───────────────────────────────────────────────┘ 

 --- 
 11. Verificação por Fase

 Fase 1:
 - curl localhost:8080 → UI carrega
 - Criar RAID 1 via UI → cat /proc/mdstat confirma
 - Montar SMB share Windows → verificar sem DOSATTRIB em getfattr
 - Login com TOTP → JWT válido
 - Chat Axis → resposta via Groq API

 Fase 2:
 - Deploy Jellyfin via UI → docker ps confirma, QSV funciona em transcoding
 - tailscale status → nó visível na rede
 - Ingest PDF → query RAG → resposta sem cloud
 - lvdisplay → mostra cache LV ativo

 Fase 3:
 - VM Windows bootada via KVM
 - cat /sys/class/hwmon/hwmon*/temp1_input → fan adapta à temperatura
 - ISO instala em máquina limpa sem internet (exceto mirrors Debian)