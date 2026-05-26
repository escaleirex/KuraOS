# Phase 7: Search Settings

**Status**: Not started
**Complexity**: Easy
**Scope**: Backend + config store + frontend

## Current State
- Panel uses local state with mock config
- Axis API exists but search settings not persisted

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const searchKey = "settings:search"

type searchSettings struct {
    AISearch      bool     `json:"aiSearch"`
    AxisModel     string   `json:"axisModel"`     // "groq/llama-3.3-70b" | "ollama/llama3.2" etc.
    ScopeContent  bool     `json:"scopeContent"`
    IndexedPaths  []string `json:"indexedPaths"`  // ["/srv/nas/media", ...]
    Schedule      string   `json:"schedule"`      // "realtime" | "hourly" | "daily" | "weekly"
}

// GET /api/settings/search
func (h *settingsHandler) getSearch(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/search
func (h *settingsHandler) saveSearch(w http.ResponseWriter, r *http.Request)
```

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/search", seh.getSearch)
r.Put("/api/settings/search", seh.saveSearch)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getSearch(),
    saveSearch(data),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getSearch`
2. Connect AI search toggle to `saveSearch`
3. Connect model selector to `saveSearch`
4. Connect indexed paths toggles to `saveSearch`
5. Connect schedule dropdown to `saveSearch`
6. API key field: keep in frontend-only (sensitive, stored via Axis AI settings)

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (SearchPanel)

## Testing
- [ ] Settings persist across refresh
- [ ] Model selector saves correctly
- [ ] Indexed paths toggle persist
- [ ] Schedule saves correctly
