package ops

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

var allowedDEs = map[string]string{
	"xfce":    "xfce4",
	"openbox": "openbox",
	"kde":     "kde-plasma-desktop",
	"gnome":   "gnome-core",
}

var reResolution = regexp.MustCompile(`^\d{3,5}x\d{3,5}$`)

// SetupRDP installs/configures xrdp or disables it.
// Required params: enabled ("true"/"false"), resolution (e.g. "1920x1080")
func SetupRDP(params map[string]string) ipc.Reply {
	enabled := params["enabled"] == "true"
	resolution := params["resolution"]

	if enabled {
		if resolution == "" {
			resolution = "1920x1080"
		}
		if !reResolution.MatchString(resolution) {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid resolution: %q", resolution)}
		}

		if res, err := kexec.Run(context.Background(), 5*time.Minute, "apt-get", "install", "-y", "xrdp"); err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}

		parts := strings.SplitN(resolution, "x", 2)
		geometry := fmt.Sprintf("geometry=%sx%s", parts[0], parts[1])
		// Patch or append geometry in xrdp.ini [Globals] section
		if res, err := kexec.Run(context.Background(), 10*time.Second,
			"sed", "-i",
			fmt.Sprintf(`s/^geometry=.*/%s/`, geometry),
			"/etc/xrdp/xrdp.ini",
		); err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}

		if res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "enable", "--now", "xrdp"); err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}
		return ipc.Reply{OK: true, Output: "xrdp enabled"}
	}

	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "disable", "--now", "xrdp")
	if err != nil {
		// Not installed/running is acceptable
		return ipc.Reply{OK: true, Output: res.Stdout}
	}
	return ipc.Reply{OK: true, Output: "xrdp disabled"}
}

// SetupVNC installs/configures tigervnc or disables it.
// Required params: enabled ("true"/"false"), resolution (e.g. "1920x1080")
func SetupVNC(params map[string]string) ipc.Reply {
	enabled := params["enabled"] == "true"
	resolution := params["resolution"]

	if enabled {
		if resolution == "" {
			resolution = "1920x1080"
		}
		if !reResolution.MatchString(resolution) {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid resolution: %q", resolution)}
		}

		if res, err := kexec.Run(context.Background(), 5*time.Minute, "apt-get", "install", "-y", "tigervnc-standalone-server"); err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}

		if res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "enable", "--now", "vncserver@1"); err != nil {
			return ipc.Reply{OK: false, Error: res.Stderr}
		}
		return ipc.Reply{OK: true, Output: "vnc enabled"}
	}

	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "disable", "--now", "vncserver@1")
	if err != nil {
		return ipc.Reply{OK: true, Output: res.Stdout}
	}
	return ipc.Reply{OK: true, Output: "vnc disabled"}
}

// InstallDesktop installs a desktop environment.
// Required params: de ("xfce" | "openbox" | "kde" | "gnome")
func InstallDesktop(params map[string]string) ipc.Reply {
	de := params["de"]
	pkg, ok := allowedDEs[de]
	if !ok {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("unknown desktop environment: %q", de)}
	}
	res, err := kexec.Run(context.Background(), 10*time.Minute, "apt-get", "install", "-y", pkg)
	if err != nil {
		return ipc.Reply{OK: false, Error: res.Stderr}
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// RemoteDesktopStatus checks running state of xrdp, vncserver, and installed DE.
// Required params: de ("xfce" | "openbox" | "kde" | "gnome")
func RemoteDesktopStatus(params map[string]string) ipc.Reply {
	de := params["de"]
	pkg, ok := allowedDEs[de]
	if !ok {
		pkg = "xfce4"
	}

	rdpRes, _ := kexec.Run(context.Background(), 10*time.Second, "systemctl", "is-active", "xrdp")
	vncRes, _ := kexec.Run(context.Background(), 10*time.Second, "systemctl", "is-active", "vncserver@1")

	// dpkg -l exits 1 if not installed, stdout contains "ii <pkg>" if installed
	dpkgRes, _ := kexec.Run(context.Background(), 10*time.Second, "dpkg", "-l", pkg)

	rdpRunning := strings.TrimSpace(rdpRes.Stdout) == "active"
	vncRunning := strings.TrimSpace(vncRes.Stdout) == "active"
	deInstalled := strings.Contains(dpkgRes.Stdout, "ii  "+pkg)

	output := fmt.Sprintf("rdpRunning=%v vncRunning=%v deInstalled=%v",
		rdpRunning, vncRunning, deInstalled)
	return ipc.Reply{OK: true, Output: output}
}
