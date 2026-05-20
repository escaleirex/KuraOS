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

func splitCIDRs(s string) []string {
	var result []string
	for _, part := range regexp.MustCompile(`[,\s]+`).Split(s, -1) {
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
