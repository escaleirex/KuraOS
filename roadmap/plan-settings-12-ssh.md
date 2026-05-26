# Phase 12: SSH Access

**Status**: Not started
**Complexity**: Easy-Medium
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock keys
- No SSH management API exists

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const sshKey = "settings:ssh"

type sshSettings struct {
    Enabled       bool   `json:"enabled"`
    Port          string `json:"port"`
    PasswordAuth  bool   `json:"passwordAuth"`
    RootLogin     bool   `json:"rootLogin"`
}

type sshAuthorizedKey struct {
    ID          int    `json:"id"`
    Comment     string `json:"comment"`
    Fingerprint string `json:"fingerprint"`
    Added       string `json:"added"`
}

// GET /api/settings/ssh
func (h *settingsHandler) getSSH(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/ssh
func (h *settingsHandler) saveSSH(w http.ResponseWriter, r *http.Request)

// GET /api/settings/ssh/keys
// Reads /root/.ssh/authorized_keys or /home/<user>/.ssh/authorized_keys
func (h *settingsHandler) listSSHKeys(w http.ResponseWriter, r *http.Request)

// POST /api/settings/ssh/keys
// Body: { key: "ssh-ed25519 ..." }
func (h *settingsHandler) addSSHKey(w http.ResponseWriter, r *http.Request)

// DELETE /api/settings/ssh/keys/{id}
func (h *settingsHandler) removeSSHKey(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/system.go` — extend)

```go
type ApplySSHConfig struct {
    Enabled      bool
    Port         string
    PasswordAuth bool
    RootLogin    bool
}
```

Implementation:
- Writes `/etc/ssh/sshd_config.d/kura.conf` with settings
- Restarts `sshd` via `systemctl restart sshd`
- Validates port range (1-65535)

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/ssh", seh.getSSH)
r.Put("/api/settings/ssh", seh.saveSSH)
r.Get("/api/settings/ssh/keys", seh.listSSHKeys)
r.Post("/api/settings/ssh/keys", seh.addSSHKey)
r.Delete("/api/settings/ssh/keys/{id}", seh.removeSSHKey)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getSSH(),
    saveSSH(data),
    listSSHKeys(),
    addSSHKey(key),
    removeSSHKey(id),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getSSH`
2. Connect SSH toggle to `saveSSH`
3. Connect port input to `saveSSH`
4. Connect auth toggles to `saveSSH`
5. Replace mock keys with `useQuery` + `listSSHKeys`
6. Connect "Add" button to `addSSHKey`
7. Connect delete button to `removeSSHKey`

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/helper/ops/system.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (SshPanel)

## Testing
- [ ] SSH toggle enables/disables sshd
- [ ] Port change applies and persists
- [ ] Password auth toggle works
- [ ] Root login toggle works
- [ ] Key list shows real authorized keys
- [ ] Add/remove keys works
