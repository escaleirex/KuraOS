# Phase 1: Appearance Settings

**Status**: Not started
**Complexity**: Easy
**Scope**: Frontend-only + config store persistence

## Current State
- Panel uses local `useState` for `theme`, `accent`, `scale`, `density`
- Settings are lost on refresh

## What to Build

### Backend (`backend/internal/api/settings.go`)

Add to existing `settingsHandler`:

```go
// Config store key
const appearanceKey = "settings:appearance"

type appearanceSettings struct {
    Theme    string `json:"theme"`    // "dark" | "light" | "auto"
    Accent   string `json:"accent"`   // hex color
    Scale    string `json:"scale"`    // "75" | "90" | "100" | "110" | "125"
    Density  string `json:"density"`  // "comfortable" | "compact"
}

// GET /api/settings/appearance
func (h *settingsHandler) getAppearance(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/appearance
func (h *settingsHandler) saveAppearance(w http.ResponseWriter, r *http.Request)
```

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/appearance", seh.getAppearance)
r.Put("/api/settings/appearance", seh.saveAppearance)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getAppearance()    // GET /settings/appearance
    saveAppearance(d)  // PUT /settings/appearance
}
```

### Frontend Panel

1. Replace `useState` with `useQuery({ queryKey: ['settings', 'appearance'], queryFn: settingsApi.getAppearance })`
2. Replace direct state setters with `useMutation` for `saveAppearance`
3. Add loading skeleton while fetching
4. Debounce save (500ms) for slider/color changes

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (AppearancePanel)

## Testing
- [ ] GET returns defaults on first call
- [ ] PUT persists and GET returns saved values
- [ ] Theme selector updates UI
- [ ] Scale slider persists correctly
- [ ] Accent color picker persists correctly
