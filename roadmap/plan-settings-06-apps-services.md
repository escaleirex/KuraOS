# Phase 6: Apps & Services

**Status**: Partial — app store exists, no generic service manager
**Complexity**: Medium
**Scope**: Backend + helper ops + frontend

## Current State
- App store has install/uninstall/start/stop/restart/update for Docker apps
- Panel shows hardcoded services (Samba, NFS, Docker, Tailscale, Nginx, Jellyfin, Nextcloud)
- No generic systemd service management API

## What to Build

### Backend (`backend/internal/api/services.go` — new file)

```go
type servicesHandler struct {
    helper *helper.Client
}

// Whitelisted services (defined in code, not configurable)
var managedServices = []string{
    "smbd", "nmbd", "nfs-kernel-server", "vsftpd",
    "sshd", "tailscaled", "docker", "kura-daemon",
    "axis-engine", "nginx", "jellyfin", "nextcloud",
}

// GET /api/services
// Returns: [{ id, label, sub, running, startup, restartOnError, critical, version }]
func (h *servicesHandler) listServices(w http.ResponseWriter, r *http.Request)

// POST /api/services/{id}/start
// POST /api/services/{id}/stop
// POST /api/services/{id}/restart
// POST /api/services/{id}/enable   (startup on boot)
// POST /api/services/{id}/disable
func (h *servicesHandler) serviceAction(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/system.go` — extend)

```go
// Existing: ServiceRestart, ServiceStatus
// Add:
type ServiceStart struct { Unit string }
type ServiceStop struct { Unit string }
type ServiceEnable struct { Unit string }
type ServiceDisable struct { Unit string }
```

Implementation:
- `systemctl start/stop/restart/enable/disable <unit>`
- Validate unit against whitelist

### Routes (`backend/internal/api/routes.go`)

```go
sh := &servicesHandler{helper: helperClient}
r.Get("/api/services", sh.listServices)
r.Post("/api/services/{id}/start", sh.serviceAction)
r.Post("/api/services/{id}/stop", sh.serviceAction)
r.Post("/api/services/{id}/restart", sh.serviceAction)
r.Post("/api/services/{id}/enable", sh.serviceAction)
r.Post("/api/services/{id}/disable", sh.serviceAction)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
servicesApi: {
    list(),
    start(id),
    stop(id),
    restart(id),
    enable(id),
    disable(id),
}
```

### Frontend Panel

1. Replace mock `services` with `useQuery` + `servicesApi.list()`
2. Connect start/stop buttons to `servicesApi.start/stop`
3. Connect startup toggle to `servicesApi.enable/disable`
4. Connect restart-on-error toggle (store in config, implement via systemd watchdog or custom script)
5. Remove uninstall button for non-Docker services (keep for app store items)
6. Show real version info where available

## Files to Create/Modify
- `backend/internal/api/services.go` (new)
- `backend/internal/helper/ops/system.go` (extend)
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (AppsPanel)

## Testing
- [ ] Service list shows real running/stopped status
- [ ] Start/stop buttons work
- [ ] Startup toggle enables/disables at boot
- [ ] Critical services can't be removed
- [ ] Version info displays correctly
