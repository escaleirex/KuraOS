# Phase 4: Online Accounts

**Status**: Not started
**Complexity**: Medium
**Scope**: Backend + config store + frontend

## Current State
- Panel uses local state with mock accounts
- No backend endpoints exist

## What to Build

### Backend (`backend/internal/api/settings.go` — extend)

```go
const accountsKey = "settings:accounts"

type onlineAccount struct {
    ID        int    `json:"id"`
    Provider  string `json:"provider"`   // "google" | "s3" | "dropbox" | "backblaze"
    Name      string `json:"name"`
    Connected bool   `json:"connected"`
    Purpose   string `json:"purpose"`
    // Credentials stored encrypted or in separate secure store
    ClientID     string `json:"client_id,omitempty"`
    ClientSecret string `json:"client_secret,omitempty"`
    AccessKey    string `json:"access_key,omitempty"`
    SecretKey    string `json:"secret_key,omitempty"`
    Bucket       string `json:"bucket,omitempty"`
    Region       string `json:"region,omitempty"`
}

// GET /api/settings/accounts
func (h *settingsHandler) getAccounts(w http.ResponseWriter, r *http.Request)

// PUT /api/settings/accounts/{provider}
// Body: onlineAccount
func (h *settingsHandler) saveAccount(w http.ResponseWriter, r *http.Request)

// POST /api/settings/accounts/{provider}/connect
// Triggers OAuth flow or validates API keys
func (h *settingsHandler) connectAccount(w http.ResponseWriter, r *http.Request)

// POST /api/settings/accounts/{provider}/disconnect
func (h *settingsHandler) disconnectAccount(w http.ResponseWriter, r *http.Request)
```

### Routes (`backend/internal/api/routes.go`)

```go
r.Get("/api/settings/accounts", seh.getAccounts)
r.Put("/api/settings/accounts/{provider}", seh.saveAccount)
r.Post("/api/settings/accounts/{provider}/connect", seh.connectAccount)
r.Post("/api/settings/accounts/{provider}/disconnect", seh.disconnectAccount)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
settingsApi: {
    // ...existing
    getAccounts(),
    saveAccount(provider, data),
    connectAccount(provider, credentials),
    disconnectAccount(provider),
}
```

### Frontend Panel

1. Replace mock `accounts` with `useQuery` + `getAccounts`
2. Connect "Ligar"/"Desligar" buttons to `connectAccount`/`disconnectAccount`
3. Add credential input forms per provider type
4. Show connection status from backend

## Files to Modify
- `backend/internal/api/settings.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (OnlineAccountsPanel)

## Security Considerations
- Credentials should be encrypted at rest (use a key derived from system secret)
- Never return secret keys in GET responses (mask with `••••`)
- OAuth flows should use PKCE

## Testing
- [ ] GET returns saved accounts
- [ ] Save credentials persists
- [ ] Connect/disconnect toggles work
- [ ] Secrets are masked in GET responses
