package ops

import (
	"context"
	"fmt"
	"regexp"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

// allowedServices lists systemd units kura-helper may manage.
// Extend this list deliberately — never use wildcard matching.
var allowedServices = map[string]bool{
	"smbd":            true,
	"nmbd":            true,
	"nfs-kernel-server": true,
	"vsftpd":          true,
	"sssd":            true,
	"tailscaled":      true,
	"docker":          true,
	"kura-daemon":     true,
	"axis-engine":     true,
}

var reServiceName = regexp.MustCompile(`^[a-zA-Z0-9_\-@.]+$`)

// ServiceRestart restarts a whitelisted systemd unit.
// Required params: unit
func ServiceRestart(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "restart", unit)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ServiceStatus returns the status of a whitelisted systemd unit.
// Required params: unit
func ServiceStatus(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 10*time.Second, "systemctl", "is-active", unit)
	_ = err // is-active exits 3 for inactive, still useful
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// allowedModules lists kernel modules kura-helper may load.
var allowedModules = map[string]bool{
	"it87":       true,
	"i2c-dev":    true,
	"nbd":        true,
	"kvm":        true,
	"kvm-intel":  true,
	"kvm-amd":    true,
	"vfio-pci":   true,
	"vfio-iommu-type1": true,
}

// Modprobe loads a whitelisted kernel module.
// Required params: module, args (optional)
func Modprobe(params map[string]string) ipc.Reply {
	module := params["module"]
	if !allowedModules[module] {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("module not allowed: %q", module)}
	}
	args := []string{module}
	if extra := params["args"]; extra != "" {
		// No shell expansion — split on spaces
		for _, a := range regexp.MustCompile(`\s+`).Split(extra, -1) {
			if a != "" {
				args = append(args, a)
			}
		}
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "modprobe", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

func validateService(unit string) error {
	if !reServiceName.MatchString(unit) {
		return fmt.Errorf("invalid service name: %q", unit)
	}
	if !allowedServices[unit] {
		return fmt.Errorf("service not in allowlist: %q", unit)
	}
	return nil
}
