package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"

	"github.com/kura-os/kura/backend/pkg/config"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

const updatesSettingsKey = "settings:updates"

type updatesHandler struct {
	store *config.Store
}

type updateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Available      bool   `json:"available"`
	Changelog      string `json:"changelog"`
	PackageCount   int    `json:"packageCount"`
}

type updateProgress struct {
	Running  bool   `json:"running"`
	Progress int    `json:"progress"`
	Stage    string `json:"stage"`
	Message  string `json:"message"`
}

func (h *updatesHandler) checkUpdates(w http.ResponseWriter, r *http.Request) {
	reply, err := ipc.Call(r.Context(), ipc.Op{Action: "updates.check"})
	if err != nil {
		jsonOK(w, updateInfo{
			CurrentVersion: "1.0.3",
			LatestVersion:  "1.0.3",
			Available:      false,
			Changelog:      "Update service unavailable — try again later",
			PackageCount:   0,
		})
		return
	}
	if !reply.OK {
		jsonOK(w, updateInfo{
			CurrentVersion: "1.0.3",
			LatestVersion:  "1.0.3",
			Available:      false,
			Changelog:      reply.Error,
			PackageCount:   0,
		})
		return
	}

	var result struct {
		PackageCount int `json:"packageCount"`
	}
	if err := json.Unmarshal([]byte(reply.Output), &result); err != nil {
		jsonError(w, "parse helper response: "+err.Error(), http.StatusInternalServerError)
		return
	}

	info := updateInfo{
		CurrentVersion: "1.0.3",
		LatestVersion:  "1.0.3",
		Available:      result.PackageCount > 0,
		Changelog:      "",
		PackageCount:   result.PackageCount,
	}
	if result.PackageCount > 0 {
		info.LatestVersion = "1.0.4"
		info.Changelog = "Security patches and system updates available"
	}
	jsonOK(w, info)
}

func (h *updatesHandler) installUpdates(w http.ResponseWriter, r *http.Request) {
	reply, err := ipc.Call(r.Context(), ipc.Op{Action: "updates.install"})
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

func (h *updatesHandler) getUpdateStatus(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile("/var/lib/kura/update-status.json")
	if err != nil {
		jsonOK(w, updateProgress{Running: false, Progress: 0, Stage: "idle", Message: ""})
		return
	}
	var status updateProgress
	if err := json.Unmarshal(data, &status); err != nil {
		jsonOK(w, updateProgress{Running: false, Progress: 0, Stage: "idle", Message: ""})
		return
	}
	jsonOK(w, status)
}

type updatesSettings struct {
	AutoCheck bool `json:"autoCheck"`
}

func (h *updatesHandler) getUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var s updatesSettings
	if err := h.store.Get(updatesSettingsKey, &s); err != nil {
		s = updatesSettings{AutoCheck: true}
	}
	jsonOK(w, s)
}

func (h *updatesHandler) saveUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var s updatesSettings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(updatesSettingsKey, s); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, s)
}

var _ = context.Background
