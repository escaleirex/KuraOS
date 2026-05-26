# Phase 8: Notifications

**Status**: Not started
**Complexity**: Medium
**Scope**: Backend + event system + frontend

## Current State
- Panel uses local state with mock alert preferences
- WebSocket endpoint `/ws` exists but returns 501
- No event/alert system in backend

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const notificationsKey = "settings:notifications"

type notificationSettings struct {
    DiskFull     bool `json:"diskFull"`
    RAIDDegraded bool `json:"raidDegraded"`
    BackupFail   bool `json:"backupFail"`
    UpdateAvail  bool `json:"updateAvail"`
    LoginFail    bool `json:"loginFail"`
    TempCrit     bool `json:"tempCrit"`
    DockerDown   bool `json:"dockerDown"`
}

// GET /api/settings/notifications
func (h *settingsHandler) getNotifications(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/notifications
func (h *settingsHandler) saveNotifications(w http.ResponseWriter, r *http.Request)
```

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/notifications", seh.getNotifications)
r.Put("/api/settings/notifications", seh.saveNotifications)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getNotifications(),
    saveNotifications(data),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getNotifications`
2. Connect toggles to `saveNotifications`
3. (Future) Add WebSocket listener for real-time alerts

## Phase 8b: WebSocket Event System (Future)

```go
// backend/internal/api/websocket.go (new)
// Implement /ws endpoint with:
// - Connection upgrade
// - Subscribe to system events (disk, RAID, backup, etc.)
// - Push alerts to connected clients
// - Heartbeat/ping-pong
```

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (NotificationsPanel)

## Testing
- [ ] Alert preferences persist
- [ ] Toggles save correctly
- [ ] (Future) WebSocket delivers real-time alerts
