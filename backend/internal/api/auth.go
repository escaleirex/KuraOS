package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/kura-os/kura/backend/internal/auth"
	"github.com/kura-os/kura/backend/pkg/config"
)

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

	ok, totpRequired, err := auth.VerifyPassword(req.Username, req.Password)
	if err != nil || !ok {
		jsonError(w, "invalid credentials", http.StatusBadRequest)
		return
	}

	if totpRequired {
		// Return partial token that requires TOTP step
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

	ok, err := auth.VerifyTOTP(req.Username, req.Code)
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

// jwtMiddleware validates the Bearer token and injects claims into context.
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
		_ = claims
		// TODO: inject claims into context
		next.ServeHTTP(w, r)
	})
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
