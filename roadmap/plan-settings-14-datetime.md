# Phase 14: Date & Time

**Status**: Not started
**Complexity**: Easy
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock config
- No datetime management API exists

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const datetimeKey = "settings:datetime"

type datetimeSettings struct {
    NTPEnabled bool   `json:"ntpEnabled"`
    NTPServer  string `json:"ntpServer"`  // "pool.ntp.org"
    Timezone   string `json:"timezone"`   // "America/New_York" | "Europe/Lisbon" etc.
}

// GET /api/settings/datetime
func (h *settingsHandler) getDatetime(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/datetime
func (h *settingsHandler) saveDatetime(w http.ResponseWriter, r *http.Request)

// GET /api/settings/datetime/timezones
// Returns list of valid timezone strings
func (h *settingsHandler) listTimezones(w http.ResponseWriter, r *http.Request)

// GET /api/settings/datetime/now
// Returns current server time: { time: "2026-05-21T14:30:00Z", timezone: "America/New_York" }
func (h *settingsHandler) getCurrentTime(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/system.go` — extend)

```go
type SetTimezone struct {
    Timezone string
}

type SetNTP struct {
    Enabled bool
    Server  string
}

type SetTimeManual struct {
    Date string  // "2026-05-21"
    Time string  // "14:30"
}
```

Implementation:
- Timezone: `timedatectl set-timezone <timezone>`
- NTP: `timedatectl set-ntp true/false` + edit `/etc/systemd/timesyncd.conf` for server
- Manual: `timedatectl set-time "2026-05-21 14:30:00"` (requires NTP off first)

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/datetime", seh.getDatetime)
r.Put("/api/settings/datetime", seh.saveDatetime)
r.Get("/api/settings/datetime/timezones", seh.listTimezones)
r.Get("/api/settings/datetime/now", seh.getCurrentTime)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getDatetime(),
    saveDatetime(data),
    listTimezones(),
    getCurrentTime(),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getDatetime`
2. Connect timezone dropdown to `saveDatetime` + populate from `listTimezones`
3. Connect NTP toggle to `saveDatetime`
4. Connect NTP server input to `saveDatetime`
5. Connect manual date/time inputs to `saveDatetime` (only when NTP off)
6. Show current server time from `getCurrentTime`

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/helper/ops/system.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (DateTimePanel)

## Testing
- [ ] Timezone change applies via timedatectl
- [ ] NTP toggle enables/disables sync
- [ ] NTP server change persists
- [ ] Manual time set works (when NTP off)
- [ ] Timezone list is complete and searchable
