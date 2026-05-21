package api

import (
	"encoding/json"
	"net/http"

	"github.com/kura-os/kura/backend/pkg/config"
)

const (
	dockKey     = "dock:pinned"
	navOrderKey = "nav:order"
)

type settingsHandler struct {
	store *config.Store
}

type dockSettings struct {
	Pinned []string `json:"pinned"`
}

type navOrderSettings struct {
	Order []string `json:"order"`
}

func (h *settingsHandler) getDock(w http.ResponseWriter, r *http.Request) {
	var d dockSettings
	if err := h.store.Get(dockKey, &d); err != nil {
		d = dockSettings{Pinned: []string{"settings", "appstore", "axis"}}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveDock(w http.ResponseWriter, r *http.Request) {
	var d dockSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if d.Pinned == nil {
		d.Pinned = []string{}
	}
	if err := h.store.Set(dockKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getNavOrder(w http.ResponseWriter, r *http.Request) {
	var d navOrderSettings
	if err := h.store.Get(navOrderKey, &d); err != nil {
		d = navOrderSettings{Order: []string{}}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveNavOrder(w http.ResponseWriter, r *http.Request) {
	var d navOrderSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if d.Order == nil {
		d.Order = []string{}
	}
	if err := h.store.Set(navOrderKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}
