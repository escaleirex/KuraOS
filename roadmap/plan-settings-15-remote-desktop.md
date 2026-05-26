# Phase 15: Remote Desktop

**Status**: Not started
**Complexity**: Medium
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock config
- No remote desktop management API exists

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const remoteDesktopKey = "settings:remote-desktop"

type remoteDesktopSettings struct {
    RDPEnabled    bool   `json:"rdpEnabled"`
    VNCEnabled    bool   `json:"vncEnabled"`
    DE            string `json:"de"`            // "xfce" | "openbox" | "kde" | "gnome"
    Resolution    string `json:"resolution"`    // "1920x1080" etc.
    AutoInstall   bool   `json:"autoInstall"`
}

// GET /api/settings/remote-desktop
func (h *settingsHandler) getRemoteDesktop(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/remote-desktop
func (h *settingsHandler) saveRemoteDesktop(w http.ResponseWriter, r *http.Request)

// GET /api/settings/remote-desktop/status
// Returns: { rdpRunning, vncRunning, deInstalled, deRunning }
func (h *settingsHandler) getRemoteDesktopStatus(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/remotedesktop.go` — new file)

```go
type SetupRDP struct {
    Enabled    bool
    Resolution string
}

type SetupVNC struct {
    Enabled    bool
    Resolution string
}

type InstallDesktop struct {
    DE string  // "xfce" | "openbox" | "kde" | "gnome"
}
```

Implementation:
- RDP: `apt install xrdp` + configure `/etc/xrdp/xrdp.ini` + `systemctl enable --now xrdp`
- VNC: `apt install tigervnc-standalone-server` + configure + `systemctl enable --now tigervncserver`
- DE install: `apt install xfce4` / `apt install kde-plasma-desktop` / `apt install gnome-core` / `apt install openbox`
- Resolution: configure in xrdp/tigervnc config

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/remote-desktop", seh.getRemoteDesktop)
r.Put("/api/settings/remote-desktop", seh.saveRemoteDesktop)
r.Get("/api/settings/remote-desktop/status", seh.getRemoteDesktopStatus)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getRemoteDesktop(),
    saveRemoteDesktop(data),
    getRemoteDesktopStatus(),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getRemoteDesktop`
2. Connect RDP toggle to `saveRemoteDesktop`
3. Connect VNC toggle to `saveRemoteDesktop`
4. Connect DE selector to `saveRemoteDesktop` (triggers install if needed)
5. Connect resolution dropdown to `saveRemoteDesktop`
6. Connect auto-install toggle to `saveRemoteDesktop`
7. Show installation progress indicator

## Files to Create/Modify
- `backend/internal/api/settings.go`
- `backend/internal/helper/ops/remotedesktop.go` (new)
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (RemoteDesktopPanel)

## Testing
- [ ] RDP enable installs and starts xrdp
- [ ] VNC enable installs and starts tigervnc
- [ ] DE installation works
- [ ] Resolution applies correctly
- [ ] Settings persist across reboots
