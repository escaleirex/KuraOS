package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/kura-os/kura/backend/internal/auth"
	"github.com/kura-os/kura/backend/pkg/config"
)

type contextKey string

const ctxUsername contextKey = "username"

type authHandler struct {
	store *config.Store
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	ok, totpRequired, err := auth.VerifyPassword(h.store, req.Username, req.Password)
	if err != nil || !ok {
		jsonError(w, "invalid credentials", http.StatusBadRequest)
		return
	}

	if totpRequired {
		jsonOK(w, map[string]any{
			"totp_required": true,
			"username":      req.Username,
		})
		return
	}

	token, err := auth.IssueJWT(req.Username)
	if err != nil {
		jsonError(w, "token error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"token": token})
}

func (h *authHandler) totpVerify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Code     string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}

	ok, err := auth.VerifyTOTP(h.store, req.Username, req.Code)
	if err != nil || !ok {
		jsonError(w, "invalid TOTP code", http.StatusBadRequest)
		return
	}

	token, err := auth.IssueJWT(req.Username)
	if err != nil {
		jsonError(w, "token error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"token": token})
}

func (h *authHandler) totpStatus(w http.ResponseWriter, r *http.Request) {
	username, ok := usernameFromCtx(r)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	enabled, err := auth.TOTPEnabled(h.store, username)
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"enabled": enabled})
}

func (h *authHandler) setupTOTP(w http.ResponseWriter, r *http.Request) {
	username, ok := usernameFromCtx(r)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	secret, err := auth.GenerateTOTPSecret(username)
	if err != nil {
		jsonError(w, "failed to generate secret", http.StatusInternalServerError)
		return
	}
	if err := auth.StorePendingSecret(h.store, username, secret.Secret); err != nil {
		jsonError(w, "failed to store pending secret", http.StatusInternalServerError)
		return
	}
	jsonOK(w, secret)
}

func (h *authHandler) enableTOTP(w http.ResponseWriter, r *http.Request) {
	username, ok := usernameFromCtx(r)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	pending, err := auth.LoadAndClearPendingSecret(h.store, username)
	if err != nil {
		jsonError(w, "no pending TOTP setup — call /setup first", http.StatusBadRequest)
		return
	}
	if !auth.ValidateTOTPCode(pending, req.Code) {
		// Restore the pending secret so the user can retry.
		_ = auth.StorePendingSecret(h.store, username, pending)
		jsonError(w, "invalid code", http.StatusBadRequest)
		return
	}
	if err := auth.EnableTOTP(h.store, username, pending); err != nil {
		jsonError(w, "failed to enable 2FA", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"enabled": true})
}

func (h *authHandler) disableTOTP(w http.ResponseWriter, r *http.Request) {
	username, ok := usernameFromCtx(r)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	ok2, err := auth.VerifyTOTP(h.store, username, req.Code)
	if err != nil || !ok2 {
		jsonError(w, "invalid code", http.StatusBadRequest)
		return
	}
	if err := auth.DisableTOTP(h.store, username); err != nil {
		jsonError(w, "failed to disable 2FA", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"enabled": false})
}

// jwtMiddleware validates the Bearer token and injects the username into context.
func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			jsonError(w, "missing token", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ParseJWT(tokenStr)
		if err != nil {
			jsonError(w, "invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUsername, claims.Username)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func usernameFromCtx(r *http.Request) (string, bool) {
	u, ok := r.Context().Value(ctxUsername).(string)
	return u, ok && u != ""
}

// Helpers

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: upgrade to WebSocket, subscribe to NATS, stream events
	http.Error(w, "WebSocket not yet implemented", http.StatusNotImplemented)
}

// JWT claims type (used by jwtMiddleware above)
type kuraclaims struct {
	jwt.RegisteredClaims
	Username string `json:"username"`
}
