# Phase 9: Axis AI Settings

**Status**: Partial — Axis API exists but bypasses daemon
**Complexity**: Medium
**Scope**: Backend + config store + frontend

## Current State
- Panel uses local state with mock config
- `axisApi` in frontend talks directly to `localhost:9765` (bypasses daemon)
- No inference mode config endpoint

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const axisKey = "settings:axis"

type axisSettings struct {
    Mode          string            `json:"mode"`           // "auto" | "local" | "cloud"
    OllamaURL     string            `json:"ollamaUrl"`      // "http://localhost:11434"
    LocalModel    string            `json:"localModel"`     // "qwen3:8b"
    Preferred     string            `json:"preferred"`      // "groq" | "openai" | "anthropic" | "openrouter"
    APIKeys       map[string]string `json:"apiKeys"`        // masked in GET, full in PUT
}

// GET /api/settings/axis
// Returns settings with API keys masked (sk-••••)
func (h *settingsHandler) getAxis(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/axis
// Body: axisSettings (with full API keys)
func (h *settingsHandler) saveAxis(w http.ResponseWriter, r *http.Request)

// GET /api/settings/axis/models
// Returns available local models from Ollama API
func (h *settingsHandler) listModels(w http.ResponseWriter, r *http.Request)
```

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/axis", seh.getAxis)
r.Put("/api/settings/axis", seh.saveAxis)
r.Get("/api/settings/axis/models", seh.listModels)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getAxis(),
    saveAxis(data),
    listModels(),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `getAxis`
2. Connect mode selector to `saveAxis`
3. Connect Ollama URL input to `saveAxis`
4. Connect model dropdown to `saveAxis` + populate from `listModels`
5. Connect preferred provider selector to `saveAxis`
6. Connect API key fields to `saveAxis` (masked display, full save)
7. Connect "Guardar Configuração" button

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (AxisPanel)

## Security Considerations
- API keys must be encrypted at rest
- GET must return masked keys
- Never log API keys

## Testing
- [ ] Settings persist across refresh
- [ ] Model list populates from Ollama
- [ ] API keys save and are masked on GET
- [ ] Mode change applies correctly
