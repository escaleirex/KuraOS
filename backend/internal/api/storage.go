package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/internal/storage"
)

type storageHandler struct{}

func (h *storageHandler) listDisks(w http.ResponseWriter, r *http.Request) {
	disks, err := storage.ListDisks(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, disks)
}

func (h *storageHandler) diskSmart(w http.ResponseWriter, r *http.Request) {
	dev := "/dev/" + chi.URLParam(r, "device")
	status, err := storage.SMARTCheck(r.Context(), dev)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, status)
}

func (h *storageHandler) listRAID(w http.ResponseWriter, r *http.Request) {
	arrays, err := storage.ListRAID(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, arrays)
}

func (h *storageHandler) createRAID(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Device string           `json:"device"`
		Level  storage.RAIDLevel `json:"level"`
		Drives []string         `json:"drives"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := storage.CreateRAID(r.Context(), req.Device, req.Level, req.Drives); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *storageHandler) stopRAID(w http.ResponseWriter, r *http.Request) {
	dev := "/dev/" + chi.URLParam(r, "device")
	if err := storage.StopRAID(r.Context(), dev); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *storageHandler) listVGs(w http.ResponseWriter, r *http.Request) {
	vgs, err := storage.ListVGs(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, vgs)
}

func (h *storageHandler) createVG(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name    string   `json:"name"`
		Devices []string `json:"devices"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := storage.CreateVG(r.Context(), req.Name, req.Devices); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *storageHandler) listLVs(w http.ResponseWriter, r *http.Request) {
	vg := chi.URLParam(r, "vg")
	lvs, err := storage.ListLVs(r.Context(), vg)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, lvs)
}

func (h *storageHandler) createLV(w http.ResponseWriter, r *http.Request) {
	vg := chi.URLParam(r, "vg")
	var req struct {
		Name string `json:"name"`
		Size string `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := storage.CreateLV(r.Context(), vg, req.Name, req.Size); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *storageHandler) enableCache(w http.ResponseWriter, r *http.Request) {
	vg := chi.URLParam(r, "vg")
	lv := chi.URLParam(r, "lv")
	var req struct {
		CacheDevice string `json:"cache_device"`
		CacheSize   string `json:"cache_size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := storage.EnableSSDCache(r.Context(), vg, lv, req.CacheDevice, req.CacheSize); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *storageHandler) listShares(w http.ResponseWriter, r *http.Request) {
	// TODO: load from config store
	jsonOK(w, []storage.Share{})
}

func (h *storageHandler) createShare(w http.ResponseWriter, r *http.Request) {
	var s storage.Share
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	switch s.Protocol {
	case storage.ProtocolSMB:
		if err := storage.ApplySMBConfig(r.Context(), []storage.Share{s}); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	case storage.ProtocolNFS:
		if err := storage.ApplyNFSConfig(r.Context(), []storage.Share{s}); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	default:
		jsonError(w, "unsupported protocol: "+string(s.Protocol), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *storageHandler) updateShare(w http.ResponseWriter, r *http.Request) {
	// TODO: load existing shares, update named share, reapply
	w.WriteHeader(http.StatusNotImplemented)
}

func (h *storageHandler) deleteShare(w http.ResponseWriter, r *http.Request) {
	_ = chi.URLParam(r, "name")
	_ = strings.ToLower // imported for future use
	// TODO: remove from config store and reapply
	w.WriteHeader(http.StatusNotImplemented)
}
