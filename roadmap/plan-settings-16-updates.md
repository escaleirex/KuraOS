# Phase 16: Updates

**Status**: Not started
**Complexity**: Medium
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock update data
- No update management API exists

## What to Build

### Backend (`backend/internal/api/updates.go` — new file)

```go
type updatesHandler struct {
    helper *helper.Client
    store  *config.Store
}

type updateInfo struct {
    CurrentVersion string `json:"currentVersion"`
    LatestVersion  string `json:"latestVersion"`
    Available      bool   `json:"available"`
    Changelog      string `json:"changelog"`
    PackageCount   int    `json:"packageCount"`  // apt packages with updates
}

type updateProgress struct {
    Running  bool   `json:"running"`
    Progress int    `json:"progress"`  // 0-100
    Stage    string `json:"stage"`     // "checking" | "downloading" | "installing" | "done" | "error"
    Message  string `json:"message"`
}

// GET /api/updates/check
// Checks for available updates (apt + KuraOS version)
func (h *updatesHandler) checkUpdates(w http.ResponseWriter, r *http.Request)

// POST /api/updates/install
// Starts system update (apt upgrade + KuraOS components)
func (h *updatesHandler) installUpdates(w http.ResponseWriter, r *http.Request)

// GET /api/updates/status
// Returns current update progress (for polling during install)
func (h *updatesHandler) getUpdateStatus(w http.ResponseWriter, r *http.Request)

// GET /api/updates/settings
// Returns: { autoCheck: bool }
func (h *updatesHandler) getUpdateSettings(w http.ResponseWriter, r *http.Request)

// PUT /api/updates/settings
// Body: { autoCheck: bool }
func (h *updatesHandler) saveUpdateSettings(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/updates.go` — new file)

```go
type CheckUpdates struct {}
// Returns: { packageCount, packages: [{ name, current, available }] }

type InstallUpdates struct {}
// Runs: apt update && apt upgrade -y
// Reports progress via callback or status file

type CheckKuraVersion struct {}
// Returns: { current: "1.0.3", latest: "1.0.4" }
```

Implementation:
- Check: `apt list --upgradable 2>/dev/null | wc -l`
- Install: `apt update && DEBIAN_FRONTEND=noninteractive apt upgrade -y -o Dpkg::Options::="--force-confdef"`
- Progress: write to `/var/lib/kura/update-status.json` during install
- KuraOS version check: fetch from GitHub releases API or internal update server

### Routes (`backend/internal/api/routes.go`)

```go
uh := &updatesHandler{helper: helperClient, store: store}
r.Get("/api/updates/check", uh.checkUpdates)
r.Post("/api/updates/install", uh.installUpdates)
r.Get("/api/updates/status", uh.getUpdateStatus)
r.Get("/api/updates/settings", uh.getUpdateSettings)
r.Put("/api/updates/settings", uh.saveUpdateSettings)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
updatesApi: {
    check(),
    install(),
    status(),
    getSettings(),
    saveSettings(data),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `updatesApi.check()`
2. Connect "Instalar" button to `updatesApi.install()`
3. Poll `updatesApi.status()` during installation for progress bar
4. Connect auto-check toggle to `updatesApi.saveSettings()`
5. Show current KuraOS version from check response
6. Show changelog when update available

## Files to Create/Modify
- `backend/internal/api/updates.go` (new)
- `backend/internal/helper/ops/updates.go` (new)
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (UpdatesPanel)

## Testing
- [ ] Check returns real apt update count
- [ ] Install runs apt upgrade successfully
- [ ] Progress bar updates during install
- [ ] Auto-check setting persists
- [ ] KuraOS version check works
- [ ] Error handling for failed updates
