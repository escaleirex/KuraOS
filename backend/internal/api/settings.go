package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/pkg/config"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

const (
	dockKey          = "dock:pinned"
	navOrderKey      = "nav:order"
	notificationsKey = "settings:notifications"
	axisKey          = "settings:axis"
	appearanceKey    = "settings:appearance"
	remoteDesktopKey = "settings:remote-desktop"
	localeKey        = "settings:locale"
	powerKey         = "settings:power"
	searchKey        = "settings:search"
	accountsKey      = "settings:accounts"
	datetimeKey      = "settings:datetime"
)

var uiToSystemLocale = map[string]string{
	"en-US": "en_US.UTF-8",
	"pt-PT": "pt_PT.UTF-8",
	"pt-BR": "pt_BR.UTF-8",
}

var validDateFormats = map[string]bool{"MM/DD/YYYY": true, "DD/MM/YYYY": true, "YYYY-MM-DD": true}
var validTimeFormats = map[string]bool{"24h": true, "12h": true}
var validCurrencies = map[string]bool{"USD": true, "EUR": true, "GBP": true, "BRL": true}
var validNumberFormats = map[string]bool{"en": true, "pt": true}
var allowedProviders = map[string]bool{"google": true, "s3": true, "dropbox": true, "backblaze": true}

type settingsHandler struct {
	store *config.Store
}

type dockSettings struct {
	Pinned []string `json:"pinned"`
}

type navOrderSettings struct {
	Order []string `json:"order"`
}

type notificationSettings struct {
	DiskFull     bool `json:"diskFull"`
	RAIDDegraded bool `json:"raidDegraded"`
	BackupFail   bool `json:"backupFail"`
	UpdateAvail  bool `json:"updateAvail"`
	LoginFail    bool `json:"loginFail"`
	TempCrit     bool `json:"tempCrit"`
	DockerDown   bool `json:"dockerDown"`
}

type axisSettings struct {
	Mode           string            `json:"mode"`
	OllamaURL      string            `json:"ollamaUrl"`
	LocalModel     string            `json:"localModel"`
	Preferred      string            `json:"preferred"`
	APIKeys        map[string]string `json:"apiKeys"`
	CustomURL      string            `json:"customUrl,omitempty"`
	ProviderModels map[string]string `json:"providerModels,omitempty"`
}

type appearanceSettings struct {
	Theme   string `json:"theme"`
	Accent  string `json:"accent"`
	Scale   string `json:"scale"`
	Density string `json:"density"`
}

type datetimeSettings struct {
	NTPEnabled bool   `json:"ntpEnabled"`
	NTPServer  string `json:"ntpServer"`
	Timezone   string `json:"timezone"`
}

type localeSettings struct {
	Language     string `json:"language"`
	DateFormat   string `json:"dateFormat"`
	TimeFormat   string `json:"timeFormat"`
	Currency     string `json:"currency"`
	NumberFormat string `json:"numberFormat"`
}

type powerSettings struct {
	Profile  string `json:"profile"`
	Spindown string `json:"spindown"`
	WoL      bool   `json:"wol"`
}

type remoteDesktopSettings struct {
	RDPEnabled    bool   `json:"rdpEnabled"`
	VNCEnabled    bool   `json:"vncEnabled"`
	DE            string `json:"de"`
	Resolution    string `json:"resolution"`
	AutoInstall   bool   `json:"autoInstall"`
}

func maskKey(k string) string {
	if len(k) < 8 {
		return "••••"
	}
	return k[:4] + "••••"
}

func (h *settingsHandler) getDock(w http.ResponseWriter, r *http.Request) {
	var d dockSettings
	if err := h.store.Get(dockKey, &d); err != nil {
		d = dockSettings{Pinned: []string{"settings", "appstore", "axis"}}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getPower(w http.ResponseWriter, r *http.Request) {
	var d powerSettings
	if err := h.store.Get(powerKey, &d); err != nil {
		d = powerSettings{Profile: "balanced", Spindown: "30", WoL: true}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) savePower(w http.ResponseWriter, r *http.Request) {
	var d powerSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	validProfiles := map[string]bool{"performance": true, "balanced": true, "saver": true}
	validSpindown := map[string]bool{"0": true, "10": true, "30": true, "60": true, "180": true}
	if !validProfiles[d.Profile] {
		jsonError(w, "invalid profile", http.StatusBadRequest)
		return
	}
	if !validSpindown[d.Spindown] {
		jsonError(w, "invalid spindown value", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(powerKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	governorMap := map[string]string{"performance": "performance", "balanced": "schedutil", "saver": "powersave"}
	gov := governorMap[d.Profile]
	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.set_cpu_governor",
		Params: map[string]string{"governor": gov},
	}); err != nil || !reply.OK {
		slog.Warn("set_cpu_governor helper call failed", "governor", gov, "err", fmt.Sprintf("%v / %v", err, reply))
	}
	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.set_disk_spindown",
		Params: map[string]string{"minutes": d.Spindown},
	}); err != nil || !reply.OK {
		slog.Warn("set_disk_spindown helper call failed", "minutes", d.Spindown, "err", fmt.Sprintf("%v / %v", err, reply))
	}
	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.set_wol",
		Params: map[string]string{"enabled": fmt.Sprintf("%t", d.WoL)},
	}); err != nil || !reply.OK {
		slog.Warn("set_wol helper call failed", "enabled", d.WoL, "err", fmt.Sprintf("%v / %v", err, reply))
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getDatetime(w http.ResponseWriter, r *http.Request) {
	var d datetimeSettings
	if err := h.store.Get(datetimeKey, &d); err != nil {
		d = datetimeSettings{NTPEnabled: true, NTPServer: "pool.ntp.org", Timezone: "UTC"}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveDatetime(w http.ResponseWriter, r *http.Request) {
	var d datetimeSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(datetimeKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.set_timezone",
		Params: map[string]string{"timezone": d.Timezone},
	}); err != nil || !reply.OK {
		slog.Warn("set_timezone helper call failed", "timezone", d.Timezone, "err", fmt.Sprintf("%v / %v", err, reply))
	}
	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.set_ntp",
		Params: map[string]string{"enabled": fmt.Sprintf("%t", d.NTPEnabled), "server": d.NTPServer},
	}); err != nil || !reply.OK {
		slog.Warn("set_ntp helper call failed", "enabled", d.NTPEnabled, "err", fmt.Sprintf("%v / %v", err, reply))
	}
	jsonOK(w, d)
}

func (h *settingsHandler) listTimezones(w http.ResponseWriter, r *http.Request) {
	reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "system.list_timezones",
		Params: map[string]string{},
	})
	if err != nil || !reply.OK {
		jsonOK(w, map[string]any{"timezones": []any{}})
		return
	}
	lines := strings.Split(strings.TrimSpace(reply.Output), "\n")
	var tzList []string
	for _, l := range lines {
		if t := strings.TrimSpace(l); t != "" {
			tzList = append(tzList, t)
		}
	}
	jsonOK(w, map[string]any{"timezones": tzList})
}

func (h *settingsHandler) getCurrentTime(w http.ResponseWriter, r *http.Request) {
	var d datetimeSettings
	_ = h.store.Get(datetimeKey, &d)
	loc, err := time.LoadLocation(d.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	jsonOK(w, map[string]any{
		"time":     now.Format(time.RFC3339),
		"timezone": d.Timezone,
		"offset":   now.Format("Z07:00"),
	})
}

// Ensure time import used (referenced by other handlers added in future phases)
var _ = time.RFC3339

type searchSettings struct {
	AISearch     bool     `json:"aiSearch"`
	AxisModel    string   `json:"axisModel"`
	ScopeContent bool     `json:"scopeContent"`
	IndexedPaths []string `json:"indexedPaths"`
	Schedule     string   `json:"schedule"`
}

type onlineAccount struct {
	ID        string `json:"id"`
	Provider  string `json:"provider"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
	Purpose   string `json:"purpose"`
}

func (h *settingsHandler) getSearch(w http.ResponseWriter, r *http.Request) {
	var d searchSettings
	if err := h.store.Get(searchKey, &d); err != nil {
		d = searchSettings{
			AISearch:     true,
			AxisModel:    "groq/llama-3.3-70b",
			ScopeContent: false,
			IndexedPaths: []string{"/srv/nas/media", "/srv/nas/public"},
			Schedule:     "daily",
		}
	}
	if d.IndexedPaths == nil {
		d.IndexedPaths = []string{}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveSearch(w http.ResponseWriter, r *http.Request) {
	var d searchSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if d.IndexedPaths == nil {
		d.IndexedPaths = []string{}
	}
	if err := h.store.Set(searchKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getAccounts(w http.ResponseWriter, r *http.Request) {
	var accounts []onlineAccount
	if err := h.store.Get(accountsKey, &accounts); err != nil {
		accounts = []onlineAccount{
			{ID: "google", Provider: "google", Name: "", Connected: false, Purpose: ""},
			{ID: "s3", Provider: "s3", Name: "", Connected: false, Purpose: ""},
			{ID: "dropbox", Provider: "dropbox", Name: "", Connected: false, Purpose: ""},
			{ID: "backblaze", Provider: "backblaze", Name: "", Connected: false, Purpose: ""},
		}
	}
	jsonOK(w, accounts)
}

func (h *settingsHandler) saveAccount(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if !allowedProviders[provider] {
		jsonError(w, "invalid provider", http.StatusBadRequest)
		return
	}
	var acct onlineAccount
	if err := json.NewDecoder(r.Body).Decode(&acct); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	acct.Provider = provider

	var accounts []onlineAccount
	_ = h.store.Get(accountsKey, &accounts)

	found := false
	for i, a := range accounts {
		if a.Provider == provider {
			accounts[i] = acct
			found = true
			break
		}
	}
	if !found {
		accounts = append(accounts, acct)
	}

	if err := h.store.Set(accountsKey, accounts); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, acct)
}

func (h *settingsHandler) connectAccount(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if !allowedProviders[provider] {
		jsonError(w, "invalid provider", http.StatusBadRequest)
		return
	}

	var accounts []onlineAccount
	_ = h.store.Get(accountsKey, &accounts)

	for i, a := range accounts {
		if a.Provider == provider {
			accounts[i].Connected = true
			if err := h.store.Set(accountsKey, accounts); err != nil {
				jsonError(w, err.Error(), http.StatusInternalServerError)
				return
			}
			jsonOK(w, accounts[i])
			return
		}
	}

	acct := onlineAccount{ID: provider, Provider: provider, Name: "", Connected: true, Purpose: ""}
	accounts = append(accounts, acct)
	if err := h.store.Set(accountsKey, accounts); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, acct)
}

func (h *settingsHandler) disconnectAccount(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	if !allowedProviders[provider] {
		jsonError(w, "invalid provider", http.StatusBadRequest)
		return
	}

	var accounts []onlineAccount
	_ = h.store.Get(accountsKey, &accounts)

	for i, a := range accounts {
		if a.Provider == provider {
			accounts[i].Connected = false
			if err := h.store.Set(accountsKey, accounts); err != nil {
				jsonError(w, err.Error(), http.StatusInternalServerError)
				return
			}
			jsonOK(w, accounts[i])
			return
		}
	}

	jsonOK(w, map[string]string{"status": "not connected"})
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

func (h *settingsHandler) getNotifications(w http.ResponseWriter, r *http.Request) {
	var d notificationSettings
	if err := h.store.Get(notificationsKey, &d); err != nil {
		d = notificationSettings{DiskFull: true, RAIDDegraded: true, BackupFail: true, UpdateAvail: true}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveNotifications(w http.ResponseWriter, r *http.Request) {
	var d notificationSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(notificationsKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getAppearance(w http.ResponseWriter, r *http.Request) {
	var d appearanceSettings
	if err := h.store.Get(appearanceKey, &d); err != nil {
		d = appearanceSettings{Theme: "dark", Accent: "#3b82f6", Scale: "100", Density: "comfortable"}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveAppearance(w http.ResponseWriter, r *http.Request) {
	var d appearanceSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(appearanceKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getAxis(w http.ResponseWriter, r *http.Request) {
	var d axisSettings
	if err := h.store.Get(axisKey, &d); err != nil {
		d = axisSettings{
			Mode:       "auto",
			OllamaURL:  "http://localhost:11434",
			LocalModel: "qwen3:8b",
			Preferred:  "groq",
			APIKeys:    map[string]string{},
		}
	}
	masked := make(map[string]string, len(d.APIKeys))
	for k, v := range d.APIKeys {
		if v != "" {
			masked[k] = maskKey(v)
		}
	}
	d.APIKeys = masked
	jsonOK(w, d)
}

func (h *settingsHandler) saveAxis(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}

	var incoming axisSettings
	if err := json.Unmarshal(body, &incoming); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var existing axisSettings
	_ = h.store.Get(axisKey, &existing)
	if existing.APIKeys == nil {
		existing.APIKeys = map[string]string{}
	}

	merged := make(map[string]string)
	for provider, val := range incoming.APIKeys {
		if val == "" {
			continue
		}
		if strings.Contains(val, "•") {
			if stored := existing.APIKeys[provider]; stored != "" {
				merged[provider] = stored
			}
		} else {
			merged[provider] = val
		}
	}
	for provider, stored := range existing.APIKeys {
		if _, ok := merged[provider]; !ok && stored != "" {
			merged[provider] = stored
		}
	}
	incoming.APIKeys = merged

	if err := h.store.Set(axisKey, incoming); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "ok"})
}

func (h *settingsHandler) listAxisModels(w http.ResponseWriter, r *http.Request) {
	var d axisSettings
	if err := h.store.Get(axisKey, &d); err != nil || d.OllamaURL == "" {
		d.OllamaURL = "http://localhost:11434"
	}

	resp, err := http.Get(d.OllamaURL + "/api/tags") //nolint:noctx
	if err != nil {
		jsonOK(w, map[string]any{"models": []any{}})
		return
	}
	defer resp.Body.Close()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		jsonOK(w, map[string]any{"models": []any{}})
		return
	}
	jsonOK(w, result)
}

func (h *settingsHandler) getLocale(w http.ResponseWriter, r *http.Request) {
	var d localeSettings
	if err := h.store.Get(localeKey, &d); err != nil {
		d = localeSettings{Language: "en-US", DateFormat: "MM/DD/YYYY", TimeFormat: "24h", Currency: "USD", NumberFormat: "en"}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveLocale(w http.ResponseWriter, r *http.Request) {
	var d localeSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if _, ok := uiToSystemLocale[d.Language]; !ok {
		jsonError(w, "invalid language", http.StatusBadRequest)
		return
	}
	if !validDateFormats[d.DateFormat] {
		jsonError(w, "invalid dateFormat", http.StatusBadRequest)
		return
	}
	if !validTimeFormats[d.TimeFormat] {
		jsonError(w, "invalid timeFormat", http.StatusBadRequest)
		return
	}
	if !validCurrencies[d.Currency] {
		jsonError(w, "invalid currency", http.StatusBadRequest)
		return
	}
	if !validNumberFormats[d.NumberFormat] {
		jsonError(w, "invalid numberFormat", http.StatusBadRequest)
		return
	}
	if err := h.store.Set(localeKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, d)
}

func (h *settingsHandler) getRemoteDesktop(w http.ResponseWriter, r *http.Request) {
	var d remoteDesktopSettings
	if err := h.store.Get(remoteDesktopKey, &d); err != nil {
		d = remoteDesktopSettings{DE: "xfce", Resolution: "1920x1080", AutoInstall: true}
	}
	jsonOK(w, d)
}

func (h *settingsHandler) saveRemoteDesktop(w http.ResponseWriter, r *http.Request) {
	var d remoteDesktopSettings
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if d.DE == "" {
		d.DE = "xfce"
	}
	if d.Resolution == "" {
		d.Resolution = "1920x1080"
	}

	var existing remoteDesktopSettings
	_ = h.store.Get(remoteDesktopKey, &existing)

	if err := h.store.Set(remoteDesktopKey, d); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "remotedesktop.setup_rdp",
		Params: map[string]string{"enabled": fmt.Sprintf("%v", d.RDPEnabled), "resolution": d.Resolution},
	}); err != nil || !reply.OK {
		slog.Warn("setup_rdp helper call failed", "err", fmt.Sprintf("%v / %v", err, reply))
	}

	if reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "remotedesktop.setup_vnc",
		Params: map[string]string{"enabled": fmt.Sprintf("%v", d.VNCEnabled), "resolution": d.Resolution},
	}); err != nil || !reply.OK {
		slog.Warn("setup_vnc helper call failed", "err", fmt.Sprintf("%v / %v", err, reply))
	}

	if d.AutoInstall && d.DE != existing.DE {
		if reply, err := ipc.Call(context.Background(), ipc.Op{
			Action: "remotedesktop.install_desktop",
			Params: map[string]string{"de": d.DE},
		}); err != nil || !reply.OK {
			slog.Warn("install_desktop helper call failed", "err", fmt.Sprintf("%v / %v", err, reply))
		}
	}

	jsonOK(w, d)
}

func (h *settingsHandler) getRemoteDesktopStatus(w http.ResponseWriter, r *http.Request) {
	var d remoteDesktopSettings
	_ = h.store.Get(remoteDesktopKey, &d)
	if d.DE == "" {
		d.DE = "xfce"
	}

	reply, err := ipc.Call(context.Background(), ipc.Op{
		Action: "remotedesktop.status",
		Params: map[string]string{"de": d.DE},
	})
	if err != nil || !reply.OK {
		jsonOK(w, map[string]any{"rdpRunning": false, "vncRunning": false, "deInstalled": false})
		return
	}

	status := map[string]bool{"rdpRunning": false, "vncRunning": false, "deInstalled": false}
	for _, part := range strings.Fields(reply.Output) {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 {
			status[kv[0]] = kv[1] == "true"
		}
	}
	jsonOK(w, status)
}
