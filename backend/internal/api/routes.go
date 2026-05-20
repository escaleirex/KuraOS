package api

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/kura-os/kura/backend/internal/appstore"
	"github.com/kura-os/kura/backend/pkg/config"
)

func NewRouter(store *config.Store) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:8080"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	appMgr, err := appstore.NewManager("")
	if err != nil {
		slog.Error("init appstore manager", "err", err)
	}

	sh := &storageHandler{}
	ah := &authHandler{store: store}
	fh := &filesHandler{}
	aph := &appstoreHandler{mgr: appMgr}
	seh := &settingsHandler{store: store}

	// Auth (public)
	r.Post("/api/auth/login", ah.login)
	r.Post("/api/auth/totp/verify", ah.totpVerify)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(jwtMiddleware)

		// Storage
		r.Get("/api/storage/disks", sh.listDisks)
		r.Get("/api/storage/disks/{device}/smart", sh.diskSmart)
		r.Get("/api/storage/raids", sh.listRAID)
		r.Post("/api/storage/raids", sh.createRAID)
		r.Delete("/api/storage/raids/{device}", sh.stopRAID)
		r.Get("/api/storage/vgs", sh.listVGs)
		r.Post("/api/storage/vgs", sh.createVG)
		r.Get("/api/storage/vgs/{vg}/lvs", sh.listLVs)
		r.Post("/api/storage/vgs/{vg}/lvs", sh.createLV)
		r.Post("/api/storage/vgs/{vg}/lvs/{lv}/cache", sh.enableCache)
		r.Get("/api/storage/shares", sh.listShares)
		r.Post("/api/storage/shares", sh.createShare)
		r.Put("/api/storage/shares/{name}", sh.updateShare)
		r.Delete("/api/storage/shares/{name}", sh.deleteShare)

		// Files
		r.Get("/api/files/list", fh.listDir)
		r.Get("/api/files/download", fh.downloadFile)

		// System metrics
		r.Get("/api/system/metrics", systemMetrics)
		r.Get("/api/system/resources", systemResources)

		// WebSocket — real-time events
		r.Get("/ws", wsHandler)

		// App Store — catalog + discovery
		r.Get("/api/apps", aph.listCatalog)
		r.Get("/api/apps/installed", aph.listInstalled)
		r.Get("/api/apps/featured", aph.featured)
		r.Get("/api/apps/community", aph.listCommunity)
		r.Get("/api/apps/search", aph.searchDockerHub)
		r.Get("/api/apps/hub/details", aph.hubDetails)
		r.Get("/api/apps/{id}", aph.getApp)
		r.Post("/api/apps/{id}/install", aph.install)

		// App Store — installed app management
		r.Get("/api/apps/{id}/installed", aph.getInstalled)
		r.Post("/api/apps/{id}/uninstall", aph.uninstall)
		r.Post("/api/apps/{id}/start", aph.start)
		r.Post("/api/apps/{id}/stop", aph.stop)
		r.Post("/api/apps/{id}/restart", aph.restart)
		r.Post("/api/apps/{id}/update", aph.update)
		r.Get("/api/apps/{id}/logs", aph.logs)

		// Settings
		r.Get("/api/settings/dock", seh.getDock)
		r.Put("/api/settings/dock", seh.saveDock)
	})

	// Serve SvelteKit frontend (production)
	r.Handle("/*", http.FileServer(http.Dir("./frontend/build")))

	return r
}
