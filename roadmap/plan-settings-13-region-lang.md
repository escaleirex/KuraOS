# Phase 13: Region & Language

**Status**: Not started
**Complexity**: Easy
**Scope**: Backend + helper ops + frontend

## Current State
- Panel uses local state with mock config
- No locale management API exists

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const localeKey = "settings:locale"

type localeSettings struct {
    Language    string `json:"language"`     // "en-US" | "pt-PT" | "pt-BR" etc.
    DateFormat  string `json:"dateFormat"`   // "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"
    TimeFormat  string `json:"timeFormat"`   // "24h" | "12h"
    Currency    string `json:"currency"`     // "USD" | "EUR" | "GBP" | "BRL"
    NumberFormat string `json:"numberFormat"` // "en" | "pt"
}

// GET /api/settings/locale
func (h *settingsHandler) getLocale(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/locale
func (h *settingsHandler) saveLocale(w http.ResponseWriter, r *http.Request)
```

### Helper Ops (`backend/internal/helper/ops/system.go` — extend)

```go
type SetLocale struct {
    Language string  // "en_US.UTF-8" | "pt_PT.UTF-8" etc.
}
```

Implementation:
- `localectl set-locale LANG=<language>`
- `localectl set-keymap <keymap>`
- Ensure locale is generated: `sed -i '/<locale>/s/^# //g' /etc/locale.gen && locale-gen`

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/locale", seh.getLocale)
r.Put("/api/settings/locale", seh.saveLocale)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getLocale(),
    saveLocale(data),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getLocale`
2. Connect language dropdown to `saveLocale`
3. Connect date format dropdown to `saveLocale`
4. Connect time format buttons to `saveLocale`
5. Connect currency dropdown to `saveLocale`
6. Connect number format dropdown to `saveLocale`

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/helper/ops/system.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (RegionPanel)

## Testing
- [ ] Settings persist across refresh
- [ ] Language change applies via localectl
- [ ] All format settings save correctly
