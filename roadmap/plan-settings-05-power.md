# Phase 5: Power Settings

**Status**: Not started
**Complexity**: Medium
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock profiles
- No backend endpoints exist

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const powerKey = "settings:power"

type powerSettings struct {
    Profile   string `json:"profile"`    // "performance" | "balanced" | "saver"
    Spindown  string `json:"spindown"`   // "0" | "10" | "30" | "60" | "180" (minutes)
    WoL       bool   `json:"wol"`
}

// GET /api/settings/power
func (h *settingsHandler) getPower(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/power
func (h *settingsHandler) savePower(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/system.go` — extend)

```go
// New ops:
type SetCPUGovernor struct { Governor string }  // "performance" | "schedutil" | "powersave"
type SetDiskSpindown struct { Device string, Minutes int }
type SetWoL struct { Iface string, Enabled bool }
```

Implementation:
- CPU: `echo <governor> > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`
- Spindown: `hdparm -S <value> /dev/sdX` (value mapping: 10min=120, 30min=240, 1h=241, 3h=243, never=0)
- WoL: `ethtool -s <iface> wol <g|d>`

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/power", seh.getPower)
r.Put("/api/settings/power", seh.savePower)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getPower(),
    savePower(data),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getPower`
2. Connect profile selector to `savePower` (triggers CPU governor change)
3. Connect spindown dropdown to `savePower` (triggers hdparm)
4. Connect WoL toggle to `savePower` (triggers ethtool)
5. Show current governor as badge on active profile

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/helper/ops/system.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (PowerPanel)

## Testing
- [ ] Profile change applies CPU governor
- [ ] Spindown applies to all disks
- [ ] WoL enables/disables on active interface
- [ ] Settings persist across reboots (helper ops re-applied on boot via systemd service)
