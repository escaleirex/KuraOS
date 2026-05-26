package api

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

const (
	sshKey              = "settings:ssh"
	sshAuthorizedKeysPath = "/root/.ssh/authorized_keys"
)

type sshSettings struct {
	Enabled      bool   `json:"enabled"`
	Port         string `json:"port"`
	PasswordAuth bool   `json:"passwordAuth"`
	RootLogin    bool   `json:"rootLogin"`
}

type sshAuthorizedKey struct {
	ID          int    `json:"id"`
	Comment     string `json:"comment"`
	Fingerprint string `json:"fingerprint"`
	Added       string `json:"added"`
}

func (h *settingsHandler) getSSH(w http.ResponseWriter, r *http.Request) {
	var d sshSettings
	if err := h.store.Get(sshKey, &d); err != nil {
		d = sshSettings{Enabled: false, Port: "22", PasswordAuth: false, RootLogin: false}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveSSH(w http.ResponseWriter, r *http.Request) {
	var d sshSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if d.Port == "" {
		d.Port = "22"
	}
	p, err := strconv.Atoi(d.Port)
	if err != nil || p < 1 || p > 65535 {
		jsonError(w, fmt.Sprintf("invalid port: %q", d.Port), http.StatusBadRequest)
		return
	}
	if err := h.store.Set(sshKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()
	reply, err := ipc.Call(ctx, ipc.Op{
		Action: "ssh.apply_config",
		Params: map[string]string{
			"enabled":       strconv.FormatBool(d.Enabled),
			"port":          d.Port,
			"password_auth": strconv.FormatBool(d.PasswordAuth),
			"root_login":    strconv.FormatBool(d.RootLogin),
		},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) listSSHKeys(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(sshAuthorizedKeysPath)
	if err != nil {
		if os.IsNotExist(err) {
			jsonOK(w, map[string]any{"keys": []sshAuthorizedKey{}})
			return
		}
		jsonError(w, "read authorized_keys: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var keys []sshAuthorizedKey
	scanner := bufio.NewScanner(bytes.NewReader(data))
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		comment := ""
		if len(fields) >= 3 {
			comment = strings.Join(fields[2:], " ")
		}
		fp := sshFingerprint(fields[1])
		keys = append(keys, sshAuthorizedKey{
			ID:          lineNum,
			Comment:     comment,
			Fingerprint: fp,
			Added:       "",
		})
	}
	if keys == nil {
		keys = []sshAuthorizedKey{}
	}
	jsonOK(w, map[string]any{"keys": keys})
}

func (h *settingsHandler) addSSHKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	key := strings.TrimSpace(body.Key)
	if key == "" {
		jsonError(w, "key is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	reply, err := ipc.Call(ctx, ipc.Op{
		Action: "ssh.add_key",
		Params: map[string]string{"key": key, "user": "root"},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

func (h *settingsHandler) removeSSHKey(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	if _, err := strconv.Atoi(idStr); err != nil {
		jsonError(w, "invalid key id", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	reply, err := ipc.Call(ctx, ipc.Op{
		Action: "ssh.remove_key",
		Params: map[string]string{"line": idStr, "user": "root"},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

// sshFingerprint computes SHA256:<base64> from the raw base64 key material.
func sshFingerprint(keyB64 string) string {
	raw, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		return "SHA256:?"
	}
	sum := sha256.Sum256(raw)
	encoded := base64.RawStdEncoding.EncodeToString(sum[:])
	return "SHA256:" + encoded
}
