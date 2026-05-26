package api

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

type networkHandler struct{}

// GET /api/network/interfaces
func (h *networkHandler) getInterfaces(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	wifiReply, err := ipc.Call(ctx, ipc.Op{Action: "network.wifi_scan"})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}

	type wifiNet struct {
		SSID      string `json:"ssid"`
		Signal    int    `json:"signal"`
		Secured   bool   `json:"secured"`
		Connected bool   `json:"connected"`
	}

	var networks []wifiNet
	if wifiReply.OK {
		for _, line := range strings.Split(strings.TrimSpace(wifiReply.Output), "\n") {
			if line == "" {
				continue
			}
			parts := strings.SplitN(line, ":", 4)
			if len(parts) < 4 {
				continue
			}
			ssid := parts[0]
			if ssid == "" {
				continue
			}
			signal := 0
			for _, c := range parts[1] {
				if c >= '0' && c <= '9' {
					signal = signal*10 + int(c-'0')
				}
			}
			secured := parts[2] != "" && parts[2] != "--"
			connected := strings.TrimSpace(parts[3]) == "*"
			networks = append(networks, wifiNet{SSID: ssid, Signal: signal, Secured: secured, Connected: connected})
		}
	}

	type wifiState struct {
		Enabled  bool      `json:"enabled"`
		Networks []wifiNet `json:"networks"`
	}

	// Enumerate ethernet interfaces from /sys/class/net/
	type ethIface struct {
		Name   string `json:"name"`
		Speed  string `json:"speed"`
		Status string `json:"status"`
	}
	var ethIfaces []ethIface

	entries, _ := os.ReadDir("/sys/class/net")
	for _, entry := range entries {
		name := entry.Name()
		// Skip loopback, wifi, bridges, docker, virtual interfaces
		if name == "lo" || strings.HasPrefix(name, "wlan") || strings.HasPrefix(name, "wl") ||
			strings.HasPrefix(name, "br") || strings.HasPrefix(name, "docker") ||
			strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "tun") ||
			strings.HasPrefix(name, "tap") || strings.HasPrefix(name, "dummy") ||
			strings.HasPrefix(name, "virbr") || strings.HasPrefix(name, "kube") ||
			strings.HasPrefix(name, "cni") || strings.HasPrefix(name, "flannel") {
			continue
		}
		// Include all remaining interfaces (eth*, en*, ens*, enp*, bond*, etc.)

		// Get link status from /sys/class/net/<name>/operstate
		status := "down"
		if state, err := os.ReadFile("/sys/class/net/" + name + "/operstate"); err == nil {
			s := strings.TrimSpace(string(state))
			if s == "up" || s == "unknown" {
				status = "up"
			}
		}

		// Get speed from /sys/class/net/<name>/speed (in Mbps)
		speed := "—"
		if spd, err := os.ReadFile("/sys/class/net/" + name + "/speed"); err == nil {
			mbps := strings.TrimSpace(string(spd))
			if mbps != "" && mbps != "-1" {
				// Parse and format
				speedVal := 0
				for _, c := range mbps {
					if c >= '0' && c <= '9' {
						speedVal = speedVal*10 + int(c-'0')
					}
				}
				if speedVal >= 1000 {
					speed = strings.TrimRight(strings.TrimRight(mbps, "0"), ".") + " Gbps"
					// Simpler: just show as Gbps
					if speedVal == 1000 {
						speed = "1 Gbps"
					} else if speedVal == 10000 {
						speed = "10 Gbps"
					} else if speedVal == 2500 {
						speed = "2.5 Gbps"
					} else {
						speed = mbps + " Mbps"
					}
				} else {
					speed = mbps + " Mbps"
				}
			}
		}

		ethIfaces = append(ethIfaces, ethIface{Name: name, Speed: speed, Status: status})
	}

	// Fallback: if no interfaces found via /sys, try ip command
	if len(ethIfaces) == 0 {
		cmd := exec.CommandContext(ctx, "ip", "-o", "link", "show")
		if out, err := cmd.Output(); err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if line == "" {
					continue
				}
				parts := strings.Fields(line)
				if len(parts) < 2 {
					continue
				}
				name := strings.TrimRight(parts[1], ":")
				// Apply same skip logic
				if name == "lo" || strings.HasPrefix(name, "wlan") || strings.HasPrefix(name, "wl") ||
					strings.HasPrefix(name, "br") || strings.HasPrefix(name, "docker") ||
					strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "tun") ||
					strings.HasPrefix(name, "tap") || strings.HasPrefix(name, "dummy") ||
					strings.HasPrefix(name, "virbr") || strings.HasPrefix(name, "kube") ||
					strings.HasPrefix(name, "cni") || strings.HasPrefix(name, "flannel") {
					continue
				}
				ethIfaces = append(ethIfaces, ethIface{Name: name, Speed: "—", Status: "down"})
			}
		}
	}

	if ethIfaces == nil {
		ethIfaces = []ethIface{}
	}

	jsonOK(w, map[string]any{
		"wifi": wifiState{Enabled: wifiReply.OK, Networks: networks},
		"eth":  ethIfaces,
	})
}

// PUT /api/network/wifi  body: {"enabled": bool}
func (h *networkHandler) setWifi(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	enabled := "false"
	if body.Enabled {
		enabled = "true"
	}
	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "network.wifi_set_enabled",
		Params: map[string]string{"enabled": enabled},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]bool{"enabled": body.Enabled})
}

// POST /api/network/wifi/scan
func (h *networkHandler) scanWifi(w http.ResponseWriter, r *http.Request) {
	reply, err := ipc.Call(r.Context(), ipc.Op{Action: "network.wifi_scan"})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}

	type wifiNet struct {
		SSID      string `json:"ssid"`
		Signal    int    `json:"signal"`
		Secured   bool   `json:"secured"`
		Connected bool   `json:"connected"`
	}

	var networks []wifiNet
	for _, line := range strings.Split(strings.TrimSpace(reply.Output), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 4)
		if len(parts) < 4 {
			continue
		}
		ssid := parts[0]
		if ssid == "" {
			continue
		}
		signal := 0
		for _, c := range parts[1] {
			if c >= '0' && c <= '9' {
				signal = signal*10 + int(c-'0')
			}
		}
		secured := parts[2] != "" && parts[2] != "--"
		connected := strings.TrimSpace(parts[3]) == "*"
		networks = append(networks, wifiNet{SSID: ssid, Signal: signal, Secured: secured, Connected: connected})
	}
	if networks == nil {
		networks = []wifiNet{}
	}
	jsonOK(w, networks)
}

// POST /api/network/wifi/connect  body: {"ssid": string, "password"?: string}
func (h *networkHandler) connectWifi(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SSID     string `json:"ssid"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.SSID == "" {
		jsonError(w, "ssid required", http.StatusBadRequest)
		return
	}
	params := map[string]string{"ssid": body.SSID}
	if body.Password != "" {
		params["password"] = body.Password
	}
	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "network.wifi_connect",
		Params: params,
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "connected", "ssid": body.SSID})
}

// GET /api/network/eth/{iface}
func (h *networkHandler) getEthConfig(w http.ResponseWriter, r *http.Request) {
	iface := chi.URLParam(r, "iface")
	if iface == "" {
		jsonError(w, "iface required", http.StatusBadRequest)
		return
	}
	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "network.eth_get_config",
		Params: map[string]string{"iface": iface},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}

	// Parse nmcli -t output: "key:value\n..."
	cfg := map[string]string{
		"mode":    "dhcp",
		"ip":      "",
		"gateway": "",
		"dns1":    "",
		"dns2":    "",
	}
	for _, line := range strings.Split(strings.TrimSpace(reply.Output), "\n") {
		kv := strings.SplitN(line, ":", 2)
		if len(kv) != 2 {
			continue
		}
		key, val := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])
		switch key {
		case "ipv4.method":
			if val == "manual" {
				cfg["mode"] = "static"
			}
		case "ipv4.addresses":
			cfg["ip"] = val
		case "ipv4.gateway":
			cfg["gateway"] = val
		case "ipv4.dns":
			dns := strings.SplitN(val, ",", 2)
			if len(dns) > 0 {
				cfg["dns1"] = dns[0]
			}
			if len(dns) > 1 {
				cfg["dns2"] = dns[1]
			}
		}
	}
	jsonOK(w, cfg)
}

// PUT /api/network/eth/{iface}
func (h *networkHandler) setEthConfig(w http.ResponseWriter, r *http.Request) {
	iface := chi.URLParam(r, "iface")
	if iface == "" {
		jsonError(w, "iface required", http.StatusBadRequest)
		return
	}

	var body struct {
		Mode    string `json:"mode"`
		IP      string `json:"ip"`
		Gateway string `json:"gateway"`
		DNS1    string `json:"dns1"`
		DNS2    string `json:"dns2"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Mode != "dhcp" && body.Mode != "static" {
		jsonError(w, "mode must be dhcp or static", http.StatusBadRequest)
		return
	}

	reply, err := ipc.Call(r.Context(), ipc.Op{
		Action: "network.eth_set_config",
		Params: map[string]string{
			"iface":   iface,
			"mode":    body.Mode,
			"ip":      body.IP,
			"gateway": body.Gateway,
			"dns1":    body.DNS1,
			"dns2":    body.DNS2,
		},
	})
	if err != nil {
		jsonError(w, "helper unavailable: "+err.Error(), http.StatusServiceUnavailable)
		return
	}
	if !reply.OK {
		jsonError(w, reply.Error, http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"status": "applied", "iface": iface})
}
