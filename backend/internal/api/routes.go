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
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:8080", "http://192.168.1.205:5173"},
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
		r.Get("/api/files/home", fh.homeDir)
		r.Get("/api/files/list", fh.listDir)
		r.Get("/api/files/download", fh.downloadFile)
		r.Post("/api/files/create", fh.createFile)

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

		// Code Server — auto-setup
		r.Post("/api/code-server/setup", aph.codeServerSetup)
		r.Get("/api/code-server/status", aph.codeServerStatus)

		// Network
		nh := &networkHandler{}
		r.Get("/api/network/interfaces", nh.getInterfaces)
		r.Put("/api/network/wifi", nh.setWifi)
		r.Post("/api/network/wifi/scan", nh.scanWifi)
		r.Post("/api/network/wifi/connect", nh.connectWifi)
		r.Get("/api/network/eth/{iface}", nh.getEthConfig)
		r.Put("/api/network/eth/{iface}", nh.setEthConfig)

		// Services
		svh := &servicesHandler{}
		r.Get("/api/services", svh.listServices)
		r.Post("/api/services/{id}/start", svh.serviceAction)
		r.Post("/api/services/{id}/stop", svh.serviceAction)
		r.Post("/api/services/{id}/restart", svh.serviceAction)
		r.Post("/api/services/{id}/enable", svh.serviceAction)
		r.Post("/api/services/{id}/disable", svh.serviceAction)

		// Users
		uh := &usersHandler{}
		r.Get("/api/users", uh.listUsers)
		r.Post("/api/users", uh.createUser)
		r.Delete("/api/users/{username}", uh.deleteUser)
		r.Put("/api/users/{username}/password", uh.setPassword)
		r.Put("/api/users/{username}/role", uh.setRole)
		r.Put("/api/users/{username}/samba", uh.setSamba)

		// Settings
		r.Get("/api/settings/dock", seh.getDock)
		r.Put("/api/settings/dock", seh.saveDock)
		r.Get("/api/settings/nav-order", seh.getNavOrder)
		r.Put("/api/settings/nav-order", seh.saveNavOrder)
		r.Get("/api/settings/search", seh.getSearch)
		r.Put("/api/settings/search", seh.saveSearch)
		r.Get("/api/settings/datetime", seh.getDatetime)
		r.Put("/api/settings/datetime", seh.saveDatetime)
		r.Get("/api/settings/datetime/timezones", seh.listTimezones)
		r.Get("/api/settings/datetime/now", seh.getCurrentTime)
		r.Get("/api/settings/notifications", seh.getNotifications)
		r.Put("/api/settings/notifications", seh.saveNotifications)
		r.Get("/api/settings/appearance", seh.getAppearance)
		r.Put("/api/settings/appearance", seh.saveAppearance)
		r.Get("/api/settings/axis", seh.getAxis)
		r.Put("/api/settings/axis", seh.saveAxis)
		r.Get("/api/settings/axis/models", seh.listAxisModels)
		r.Get("/api/settings/power", seh.getPower)
		r.Put("/api/settings/power", seh.savePower)
		r.Get("/api/settings/locale", seh.getLocale)
		r.Put("/api/settings/locale", seh.saveLocale)
		r.Get("/api/settings/ssh", seh.getSSH)
		r.Put("/api/settings/ssh", seh.saveSSH)
		r.Get("/api/settings/ssh/keys", seh.listSSHKeys)
		r.Post("/api/settings/ssh/keys", seh.addSSHKey)
		r.Delete("/api/settings/ssh/keys/{id}", seh.removeSSHKey)
		r.Get("/api/settings/remote-desktop", seh.getRemoteDesktop)
		r.Put("/api/settings/remote-desktop", seh.saveRemoteDesktop)
		r.Get("/api/settings/remote-desktop/status", seh.getRemoteDesktopStatus)
		r.Get("/api/settings/accounts", seh.getAccounts)
		r.Put("/api/settings/accounts/{provider}", seh.saveAccount)
		r.Post("/api/settings/accounts/{provider}/connect", seh.connectAccount)
		r.Post("/api/settings/accounts/{provider}/disconnect", seh.disconnectAccount)
	})

	// Serve SvelteKit frontend (production)
	r.Handle("/*", http.FileServer(http.Dir("./frontend/build")))

	return r
}
