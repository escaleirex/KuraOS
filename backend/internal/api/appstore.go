package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/internal/appstore"
)

type appstoreHandler struct {
	mgr *appstore.Manager
}

func (h *appstoreHandler) listCatalog(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	templates := appstore.Catalog(category, search)
	if templates == nil {
		templates = []appstore.AppTemplate{}
	}
	jsonOK(w, templates)
}

func (h *appstoreHandler) getApp(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, ok := appstore.GetTemplate(id)
	if !ok {
		jsonError(w, "app not found", http.StatusNotFound)
		return
	}
	jsonOK(w, tmpl)
}

func (h *appstoreHandler) install(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, ok := appstore.GetTemplate(id)
	if !ok {
		jsonError(w, "app not found", http.StatusNotFound)
		return
	}

	var req appstore.InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	installed, err := h.mgr.Install(r.Context(), tmpl, req)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, installed)
}

func (h *appstoreHandler) listInstalled(w http.ResponseWriter, r *http.Request) {
	apps := h.mgr.ListInstalled(r.Context())
	if apps == nil {
		apps = []appstore.InstalledApp{}
	}
	jsonOK(w, apps)
}

func (h *appstoreHandler) getInstalled(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	app, ok := h.mgr.GetInstalled(r.Context(), id)
	if !ok {
		jsonError(w, "app not installed", http.StatusNotFound)
		return
	}
	jsonOK(w, app)
}

func (h *appstoreHandler) uninstall(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.Uninstall(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "uninstalled"})
}

func (h *appstoreHandler) start(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.Start(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "started"})
}

func (h *appstoreHandler) stop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.Stop(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "stopped"})
}

func (h *appstoreHandler) restart(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.Restart(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "restarted"})
}

func (h *appstoreHandler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.Update(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "updated"})
}

func (h *appstoreHandler) logs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tail := 100
	if t := r.URL.Query().Get("tail"); t != "" {
		if n, err := strconv.Atoi(t); err == nil && n > 0 {
			tail = n
		}
	}
	logs, err := h.mgr.Logs(r.Context(), id, tail)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"logs": logs})
}

// searchDockerHub proxies Docker Hub search API.
// GET /api/apps/search?q=jellyfin&limit=25
func (h *appstoreHandler) searchDockerHub(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonError(w, "missing query parameter q", http.StatusBadRequest)
		return
	}
	limit := 25
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	results, err := appstore.SearchDockerHub(r.Context(), q, limit)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, results)
}

// listCommunity fetches Portainer community templates.
// GET /api/apps/community?category=&search=
func (h *appstoreHandler) listCommunity(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")

	apps, err := appstore.FetchCommunityApps(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	// filter
	var result []appstore.AppTemplate
	for _, a := range apps {
		if category != "" && a.Category != category {
			continue
		}
		if search != "" {
			if !containsFoldStr(a.Name, search) && !containsFoldStr(a.Description, search) {
				continue
			}
		}
		result = append(result, a)
	}
	if result == nil {
		result = []appstore.AppTemplate{}
	}
	jsonOK(w, result)
}

// featured returns curated Docker Hub apps with full details, cached 1h.
// GET /api/apps/featured
func (h *appstoreHandler) featured(w http.ResponseWriter, r *http.Request) {
	apps, err := appstore.FetchFeatured(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, apps)
}

// hubDetails returns full details for a single Docker Hub image.
// GET /api/apps/hub/details?image=jellyfin/jellyfin
func (h *appstoreHandler) hubDetails(w http.ResponseWriter, r *http.Request) {
	image := r.URL.Query().Get("image")
	if image == "" {
		jsonError(w, "missing image param", http.StatusBadRequest)
		return
	}
	d, err := appstore.FetchHubDetails(r.Context(), image)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, d)
}

func containsFoldStr(s, sub string) bool {
	return len(sub) == 0 || len(s) >= len(sub) && func() bool {
		sl, subl := len(s), len(sub)
		for i := 0; i <= sl-subl; i++ {
			match := true
			for j := 0; j < subl; j++ {
				ca, cb := s[i+j], sub[j]
				if ca >= 'A' && ca <= 'Z' {
					ca += 32
				}
				if cb >= 'A' && cb <= 'Z' {
					cb += 32
				}
				if ca != cb {
					match = false
					break
				}
			}
			if match {
				return true
			}
		}
		return false
	}()
}
