# Phase 11: Security (2FA)

**Status**: Partial — TOTP verify exists but no enable/disable
**Complexity**: Medium
**Scope**: Backend + frontend

## Current State
- `POST /api/auth/totp/verify` exists for login verification
- No endpoint to enable/disable 2FA
- Panel uses local state with mock QR code

## What to Build

### Backend (`backend/internal/api/auth.go` — extend)

```go
// POST /api/auth/totp/setup
// Returns: { secret, qr_code_url }
// Generates a new TOTP secret for the authenticated user
func (h *authHandler) setupTOTP(w http.ResponseWriter, r *http.Request)

// POST /api/auth/totp/enable
// Body: { code: "123456" }
// Verifies the code against the pending secret, then enables 2FA
func (h *authHandler) enableTOTP(w http.ResponseWriter, r *http.Request)

// POST /api/auth/totp/disable
// Body: { code: "123456" }
// Verifies current code, then disables 2FA
func (h *authHandler) disableTOTP(w http.ResponseWriter, r *http.Request)

// GET /api/auth/totp/status
// Returns: { enabled: bool }
func (h *authHandler) totpStatus(w http.ResponseWriter, r *http.Request)
```

Implementation uses `github.com/pquerna/otp` (or similar TOTP library):
- Generate secret → store in config store (encrypted)
- QR code URL: `otpauth://totp/KuraOS:user?secret=XXX&issuer=KuraOS`
- Verify code against stored secret
- Enable: set `totp:enabled = true` in config store

### Routes (`backend/internal/api/routes.go`)

```go
r.Post("/api/auth/totp/setup", ah.setupTOTP)
r.Post("/api/auth/totp/enable", ah.enableTOTP)
r.Post("/api/auth/totp/disable", ah.disableTOTP)
r.Get("/api/auth/totp/status", ah.totpStatus)
```

### API Client (`frontend/src/api/client.ts`)

```typescript
authApi: {
    // ...existing
    totpStatus(),
    setupTOTP(),
    enableTOTP(code),
    disableTOTP(code),
}
```

### Frontend Panel

1. Replace local state with `useQuery` + `authApi.totpStatus()`
2. Connect "Ativar" button to `authApi.setupTOTP()` → show QR modal
3. Connect verification code input to `authApi.enableTOTP()`
4. Connect "Desativar" button to `authApi.disableTOTP()` (with confirmation)
5. Show status banner (protected / not protected)

## Files to Modify
- `backend/internal/api/auth.go`
- `backend/internal/api/routes.go`
- `frontend/src/api/client.ts`
- `frontend/src/pages/settings/SettingsPage.tsx` (SecurityPanel)

## Dependencies
- TOTP library: `go get github.com/pquerna/otp` (if not already present)

## Testing
- [ ] Setup generates valid secret and QR URL
- [ ] Enable with correct code activates 2FA
- [ ] Enable with wrong code fails
- [ ] Disable with correct code deactivates 2FA
- [ ] Login requires TOTP code when enabled
- [ ] Status endpoint reflects current state
