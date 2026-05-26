package api

import (
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

var reUserNameAPI = regexp.MustCompile(`^[a-z_][a-z0-9_\-\.]{0,31}$`)

type usersHandler struct{}

type UserEntry struct {
	Username  string `json:"username"`
	Role      string `json:"role"`
	Samba     bool   `json:"samba"`
	LastLogin string `json:"lastLogin"`
}

// GET /api/users
func (h *usersHandler) listUsers(w http.ResponseWriter, r *http.Request) {
	reply, err := ipc.Call(r.Context(), ipc.Op{Action: "users.list"})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}

	var users []UserEntry
	if err := json.Unmarshal([]byte(reply.Output), &users); err != nil {
		jsonError(w, "invalid helper response", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []UserEntry{}
	}
	jsonOK(w, users)
}

// POST /api/users  body: { username, password, role, samba }
func (h *usersHandler) createUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Samba    bool   `json:"samba"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if !reUserNameAPI.MatchString(body.Username) {
		jsonError(w, "invalid username: must match ^[a-z_][a-z0-9_\\-\\.]{0,31}$", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 8 {
		jsonError(w, "password too short (minimum 8 characters)", http.StatusBadRequest)
		return
	}
	if body.Role != "admin" && body.Role != "user" {
		jsonError(w, "role must be admin or user", http.StatusBadRequest)
		return
	}

	samba := "false"
	if body.Samba {
		samba = "true"
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "users.create",
		Params: map[string]string{
			"username": body.Username,
			"password": body.Password,
			"role":     body.Role,
			"samba":    samba,
		},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"username": body.Username})
}

// DELETE /api/users/{username}
func (h *usersHandler) deleteUser(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if !reUserNameAPI.MatchString(username) {
		jsonError(w, "invalid username", http.StatusBadRequest)
		return
	}
	if username == "admin" {
		jsonError(w, "cannot delete the admin user", http.StatusForbidden)
		return
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "users.delete",
		Params: map[string]string{"username": username},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"username": username})
}

// PUT /api/users/{username}/password  body: { password }
func (h *usersHandler) setPassword(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if !reUserNameAPI.MatchString(username) {
		jsonError(w, "invalid username", http.StatusBadRequest)
		return
	}

	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 8 {
		jsonError(w, "password too short (minimum 8 characters)", http.StatusBadRequest)
		return
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "users.set_password",
		Params: map[string]string{
			"username": username,
			"password": body.Password,
		},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"username": username})
}

// PUT /api/users/{username}/role  body: { role }
func (h *usersHandler) setRole(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if !reUserNameAPI.MatchString(username) {
		jsonError(w, "invalid username", http.StatusBadRequest)
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Role != "admin" && body.Role != "user" {
		jsonError(w, "role must be admin or user", http.StatusBadRequest)
		return
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "users.set_role",
		Params: map[string]string{
			"username": username,
			"role":     body.Role,
		},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"username": username, "role": body.Role})
}

// PUT /api/users/{username}/samba  body: { samba, password? }
func (h *usersHandler) setSamba(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if !reUserNameAPI.MatchString(username) {
		jsonError(w, "invalid username", http.StatusBadRequest)
		return
	}

	var body struct {
		Samba    bool   `json:"samba"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	enabled := "false"
	if body.Samba {
		enabled = "true"
	}

	params := map[string]string{
		"username": username,
		"enabled":  enabled,
	}
	if body.Samba && body.Password != "" {
		params["password"] = body.Password
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "users.set_samba",
		Params: params,
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"username": username, "samba": enabled})
}
