package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

type servicesHandler struct{}

// serviceDef maps a friendly service ID to its systemd unit name.
var serviceDef = map[string]string{
	"samba":   "smbd",
	"nmb":     "nmbd",
	"nfs":     "nfs-kernel-server",
	"ftp":     "vsftpd",
	"ssh":     "sshd",
	"tailscale": "tailscaled",
	"docker":  "docker",
	"kura":    "kura-daemon",
	"axis":    "axis-engine",
	"nginx":   "nginx",
}

// allowedServices mirrors the helper ops whitelist for client-side validation.
var allowedServices = map[string]bool{
	"smbd": true, "nmbd": true, "nfs-kernel-server": true,
	"vsftpd": true, "sshd": true, "tailscaled": true,
	"docker": true, "kura-daemon": true, "axis-engine": true, "nginx": true,
}

type serviceInfo struct {
	ID       string `json:"id"`
	Unit     string `json:"unit"`
	Label    string `json:"label"`
	Sub      string `json:"sub"`
	Active   bool   `json:"active"`
	Enabled  bool   `json:"enabled"`
}

// GET /api/services
func (h *servicesHandler) listServices(w http.ResponseWriter, r *http.Request) {
	services := []serviceInfo{
		{ID: "samba", Unit: "smbd", Label: "Samba / SMB", Sub: "Windows file server"},
		{ID: "nmb", Unit: "nmbd", Label: "NetBIOS Name Service", Sub: "Network browsing"},
		{ID: "nfs", Unit: "nfs-kernel-server", Label: "NFS Server", Sub: "NFS exports for Linux/macOS"},
		{ID: "ftp", Unit: "vsftpd", Label: "FTP Server", Sub: "File Transfer Protocol"},
		{ID: "ssh", Unit: "sshd", Label: "SSH Server", Sub: "Secure Shell access"},
		{ID: "tailscale", Unit: "tailscaled", Label: "Tailscale", Sub: "Zero-config mesh VPN"},
		{ID: "docker", Unit: "docker", Label: "Docker Engine", Sub: "OCI container engine"},
		{ID: "kura", Unit: "kura-daemon", Label: "Kura Daemon", Sub: "KuraOS core service"},
		{ID: "axis", Unit: "axis-engine", Label: "Axis AI", Sub: "Local inference engine"},
		{ID: "nginx", Unit: "nginx", Label: "Nginx", Sub: "Reverse proxy and web server"},
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	helperAvailable := false
	for i := range services {
		unit := services[i].Unit

		// Check is-active
		reply, err := ipc.Call(ctx, ipc.Op{
			Action: "system.service_status",
			Params: map[string]string{"unit": unit},
		})
		if err == nil && reply.OK {
			if !helperAvailable {
				helperAvailable = true
			}
			services[i].Active = strings.TrimSpace(reply.Output) == "active"
		}

		// Check is-enabled
		reply2, err2 := ipc.Call(ctx, ipc.Op{
			Action: "system.service_enabled",
			Params: map[string]string{"unit": unit},
		})
		if err2 == nil && reply2.OK {
			services[i].Enabled = strings.TrimSpace(reply2.Output) == "enabled"
		}
	}

	jsonOK(w, map[string]any{"services": services, "helper_available": helperAvailable})
}

// POST /api/services/{id}/{action}
func (h *servicesHandler) serviceAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	action := chi.URLParam(r, "action") // start, stop, restart, enable, disable

	unit, ok := serviceDef[id]
	if !ok {
		jsonError(w, "unknown service: "+id, http.StatusNotFound)
		return
	}
	if !allowedServices[unit] {
		jsonError(w, "service not manageable: "+unit, http.StatusForbidden)
		return
	}

	var helperAction string
	switch action {
	case "start":
		helperAction = "system.service_start"
	case "stop":
		helperAction = "system.service_stop"
	case "restart":
		helperAction = "system.service_restart"
	case "enable":
		helperAction = "system.service_enable"
	case "disable":
		helperAction = "system.service_disable"
	default:
		jsonError(w, "unknown action: "+action, http.StatusBadRequest)
		return
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: helperAction,
		Params: map[string]string{"unit": unit},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": action, "service": id, "unit": unit})
}
