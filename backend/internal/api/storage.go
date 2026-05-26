package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/internal/storage"
	"github.com/kura-os/kura/backend/pkg/config"
)

const sharesKey = "storage:shares"

type storageHandler struct {
	store *config.Store
}

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
	var shares []storage.Share
	_ = h.store.Get(sharesKey, &shares)
	if shares == nil {
		shares = []storage.Share{}
	}
	jsonOK(w, shares)
}

func (h *storageHandler) createShare(w http.ResponseWriter, r *http.Request) {
	var s storage.Share
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if s.Name == "" {
		jsonError(w, "share name is required", http.StatusBadRequest)
		return
	}
	if s.Path == "" {
		jsonError(w, "share path is required", http.StatusBadRequest)
		return
	}

	var shares []storage.Share
	_ = h.store.Get(sharesKey, &shares)

	for _, existing := range shares {
		if existing.Name == s.Name {
			jsonError(w, "share already exists: "+s.Name, http.StatusConflict)
			return
		}
	}

	shares = append(shares, s)
	if err := h.store.Set(sharesKey, shares); err != nil {
		jsonError(w, "failed to save shares: "+err.Error(), http.StatusInternalServerError)
		return
	}

	switch s.Protocol {
	case storage.ProtocolSMB:
		if err := storage.ApplySMBConfig(r.Context(), shares); err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
	case storage.ProtocolNFS:
		if err := storage.ApplyNFSConfig(r.Context(), shares); err != nil {
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
	name := chi.URLParam(r, "name")
	if name == "" {
		jsonError(w, "share name is required", http.StatusBadRequest)
		return
	}

	var updates struct {
		Path        *string  `json:"path"`
		Description *string  `json:"description"`
		ReadOnly    *bool    `json:"read_only"`
		ValidUsers  []string `json:"valid_users"`
		ForceGroup  *string  `json:"force_group"`
		WindowsACL  *bool    `json:"windows_acl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var shares []storage.Share
	if err := h.store.Get(sharesKey, &shares); err != nil {
		jsonError(w, "failed to load shares: "+err.Error(), http.StatusInternalServerError)
		return
	}

	found := false
	for i := range shares {
		if shares[i].Name == name {
			if updates.Path != nil {
				if *updates.Path == "" {
					jsonError(w, "path must not be empty", http.StatusBadRequest)
					return
				}
				shares[i].Path = *updates.Path
			}
			if updates.Description != nil {
				shares[i].Description = *updates.Description
			}
			if updates.ReadOnly != nil {
				shares[i].ReadOnly = *updates.ReadOnly
			}
			if updates.ValidUsers != nil {
				shares[i].ValidUsers = updates.ValidUsers
			}
			if updates.ForceGroup != nil {
				shares[i].ForceGroup = *updates.ForceGroup
			}
			if updates.WindowsACL != nil {
				shares[i].WindowsACL = *updates.WindowsACL
			}
			found = true
			break
		}
	}
	if !found {
		jsonError(w, "share not found: "+name, http.StatusNotFound)
		return
	}

	if err := h.store.Set(sharesKey, shares); err != nil {
		jsonError(w, "failed to save shares: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := storage.ApplySMBConfig(r.Context(), shares); err != nil {
		jsonError(w, "failed to apply SMB config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "updated", "name": name})
}

func (h *storageHandler) deleteShare(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		jsonError(w, "share name is required", http.StatusBadRequest)
		return
	}

	var shares []storage.Share
	if err := h.store.Get(sharesKey, &shares); err != nil {
		jsonError(w, "failed to load shares: "+err.Error(), http.StatusInternalServerError)
		return
	}

	found := false
	filtered := make([]storage.Share, 0, len(shares))
	for _, s := range shares {
		if s.Name == name {
			found = true
			continue
		}
		filtered = append(filtered, s)
	}
	if !found {
		jsonError(w, "share not found: "+name, http.StatusNotFound)
		return
	}

	if err := h.store.Set(sharesKey, filtered); err != nil {
		jsonError(w, "failed to save shares: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := storage.ApplySMBConfig(r.Context(), filtered); err != nil {
		jsonError(w, "failed to apply SMB config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
