package ops

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

var rePort = regexp.MustCompile(`^\d{1,5}(/tcp|/udp)?$`)

// UFWAllow adds an allow rule to UFW.
// Required params: port (e.g. "443", "22/tcp")
func UFWAllow(params map[string]string) ipc.Reply {
	port := params["port"]
	if !rePort.MatchString(port) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid port: %q", port)}
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "ufw", "allow", port)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// UFWDeny adds a deny rule to UFW.
// Required params: port
func UFWDeny(params map[string]string) ipc.Reply {
	port := params["port"]
	if !rePort.MatchString(port) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid port: %q", port)}
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "ufw", "deny", port)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// TailscaleUp brings up Tailscale.
// Optional params: auth_key, advertise_routes (CIDR)
func TailscaleUp(params map[string]string) ipc.Reply {
	args := []string{"up"}
	if key := params["auth_key"]; key != "" {
		args = append(args, "--authkey="+key)
	}
	if routes := params["advertise_routes"]; routes != "" {
		// Validate each CIDR
		for _, cidr := range splitCIDRs(routes) {
			if _, _, err := net.ParseCIDR(cidr); err != nil {
				return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid CIDR: %q", cidr)}
			}
		}
		args = append(args, "--advertise-routes="+routes)
	}
	res, err := kexec.Run(context.Background(), 60*time.Second, "tailscale", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// TailscaleDown disconnects Tailscale.
func TailscaleDown(params map[string]string) ipc.Reply {
	res, err := kexec.Run(context.Background(), 30*time.Second, "tailscale", "down")
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// WifiSetEnabled enables or disables the Wi-Fi radio.
// Required params: enabled ("true"|"false")
func WifiSetEnabled(params map[string]string) ipc.Reply {
	on := params["enabled"] == "true"
	state := "off"
	if on {
		state = "on"
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "nmcli", "radio", "wifi", state)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// WifiScan returns available Wi-Fi networks.
func WifiScan(params map[string]string) ipc.Reply {
	// Trigger a rescan first, ignore errors (may fail if already scanning)
	kexec.Run(context.Background(), 10*time.Second, "nmcli", "device", "wifi", "rescan") //nolint:errcheck
	res, err := kexec.Run(context.Background(), 20*time.Second,
		"nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,IN-USE", "device", "wifi", "list")
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// WifiConnect connects to a Wi-Fi network.
// Required params: ssid
// Optional params: password (never logged)
func WifiConnect(params map[string]string) ipc.Reply {
	ssid := params["ssid"]
	if ssid == "" {
		return ipc.Reply{OK: false, Error: "ssid required"}
	}
	args := []string{"device", "wifi", "connect", ssid}
	if pw := params["password"]; pw != "" {
		args = append(args, "password", pw)
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "nmcli", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// EthGetConfig returns the IPv4 config for an interface.
// Required params: iface
func EthGetConfig(params map[string]string) ipc.Reply {
	iface := params["iface"]
	if !reIface.MatchString(iface) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid iface: %q", iface)}
	}
	res, err := kexec.Run(context.Background(), 10*time.Second,
		"nmcli", "-t", "-f", "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns", "con", "show", iface)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// EthSetConfig applies IPv4 config to an interface.
// Required params: iface, mode ("dhcp"|"static")
// Required when static: ip (CIDR), gateway, dns1
// Optional when static: dns2
func EthSetConfig(params map[string]string) ipc.Reply {
	iface := params["iface"]
	if !reIface.MatchString(iface) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid iface: %q", iface)}
	}
	mode := params["mode"]
	switch mode {
	case "dhcp":
		if _, err := kexec.Run(context.Background(), 15*time.Second,
			"nmcli", "con", "modify", iface, "ipv4.method", "auto",
			"ipv4.addresses", "", "ipv4.gateway", "", "ipv4.dns", ""); err != nil {
			return errReply(err)
		}
	case "static":
		ip := params["ip"]
		if ip == "" {
			return ipc.Reply{OK: false, Error: "ip required for static mode"}
		}
		if _, _, err := net.ParseCIDR(ip); err != nil {
			// Try treating it as a plain IP and add /24
			if net.ParseIP(ip) == nil {
				return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid ip: %q", ip)}
			}
			ip = ip + "/24"
		}
		gw := params["gateway"]
		if net.ParseIP(gw) == nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid gateway: %q", gw)}
		}
		dns1 := params["dns1"]
		if net.ParseIP(dns1) == nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid dns1: %q", dns1)}
		}
		dns := dns1
		if dns2 := params["dns2"]; dns2 != "" {
			if net.ParseIP(dns2) == nil {
				return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid dns2: %q", dns2)}
			}
			dns += "," + dns2
		}
		if _, err := kexec.Run(context.Background(), 15*time.Second,
			"nmcli", "con", "modify", iface,
			"ipv4.method", "manual",
			"ipv4.addresses", ip,
			"ipv4.gateway", gw,
			"ipv4.dns", dns); err != nil {
			return errReply(err)
		}
	default:
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid mode: %q", mode)}
	}
	res, err := kexec.Run(context.Background(), 20*time.Second, "nmcli", "con", "up", iface)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

var reIface = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]{1,15}$`)

func splitCIDRs(s string) []string {
	var result []string
	for _, part := range regexp.MustCompile(`[,\s]+`).Split(s, -1) {
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
