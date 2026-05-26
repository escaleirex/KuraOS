package ops

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

// allowedLocales maps system locale strings kura-helper may apply.
var allowedLocales = map[string]bool{
	"en_US.UTF-8": true,
	"en_GB.UTF-8": true,
	"pt_PT.UTF-8": true,
	"pt_BR.UTF-8": true,
	"es_ES.UTF-8": true,
	"fr_FR.UTF-8": true,
	"de_DE.UTF-8": true,
}

// SetLocale applies a system locale via localectl and locale-gen.
// Required params: locale (e.g. "en_US.UTF-8")
func SetLocale(params map[string]string) ipc.Reply {
	locale := params["locale"]
	if !allowedLocales[locale] {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("locale not allowed: %q", locale)}
	}

	// Strip the .UTF-8 suffix to get the bare locale name (e.g. "en_US")
	bare := locale[:len(locale)-6] // removes ".UTF-8"

	if _, err := kexec.Run(context.Background(), 15*time.Second, "localectl", "set-locale", "LANG="+locale); err != nil {
		return errReply(err)
	}

	// Uncomment the locale in /etc/locale.gen (e.g. "# en_US.UTF-8 UTF-8" → "en_US.UTF-8 UTF-8")
	sedExpr := fmt.Sprintf("s/^# %s/%s/", bare, bare)
	if _, err := kexec.Run(context.Background(), 10*time.Second, "sed", "-i", sedExpr, "/etc/locale.gen"); err != nil {
		return errReply(err)
	}

	res, err := kexec.Run(context.Background(), 60*time.Second, "locale-gen")
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

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
	"sshd":            true,
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

// ServiceStart starts a whitelisted systemd unit.
// Required params: unit
func ServiceStart(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "start", unit)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ServiceStop stops a whitelisted systemd unit.
// Required params: unit
func ServiceStop(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "systemctl", "stop", unit)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ServiceEnable enables a whitelisted systemd unit at boot.
// Required params: unit
func ServiceEnable(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "systemctl", "enable", unit)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ServiceDisable disables a whitelisted systemd unit at boot.
// Required params: unit
func ServiceDisable(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "systemctl", "disable", unit)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ServiceEnabled returns whether a whitelisted systemd unit is enabled at boot.
// Required params: unit
func ServiceEnabled(params map[string]string) ipc.Reply {
	unit := params["unit"]
	if err := validateService(unit); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 10*time.Second, "systemctl", "is-enabled", unit)
	_ = err // is-enabled exits 1 for disabled, still useful
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

var allowedGovernors = map[string]bool{
	"performance": true,
	"schedutil":   true,
	"powersave":   true,
}

// SetCPUGovernor writes a cpufreq scaling governor to all CPU cores.
// Required params: governor ("performance" | "schedutil" | "powersave")
func SetCPUGovernor(params map[string]string) ipc.Reply {
	gov := params["governor"]
	if !allowedGovernors[gov] {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("governor not allowed: %q", gov)}
	}
	paths, err := filepath.Glob("/sys/devices/system/cpu/cpu*/cpufreq/scaling_governor")
	if err != nil || len(paths) == 0 {
		return ipc.Reply{OK: false, Error: "cpufreq not available on this system"}
	}
	for _, p := range paths {
		if err := os.WriteFile(p, []byte(gov), 0644); err != nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("write %s: %v", p, err)}
		}
	}
	return ipc.Reply{OK: true, Output: fmt.Sprintf("set %d cores to %s", len(paths), gov)}
}

// hdparmSpindownValue maps minutes to hdparm -S raw value.
// 0=never, 10min=120, 30min=240, 60min=241, 180min=243
func hdparmSpindownValue(minutes int) (string, error) {
	m := map[int]int{0: 0, 10: 120, 30: 240, 60: 241, 180: 243}
	v, ok := m[minutes]
	if !ok {
		return "", fmt.Errorf("unsupported spindown minutes: %d", minutes)
	}
	return strconv.Itoa(v), nil
}

// SetDiskSpindown applies hdparm -S to all sd* block devices.
// Required params: minutes ("0"|"10"|"30"|"60"|"180")
func SetDiskSpindown(params map[string]string) ipc.Reply {
	minutesStr := params["minutes"]
	minutes, err := strconv.Atoi(minutesStr)
	if err != nil {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid minutes: %q", minutesStr)}
	}
	val, err := hdparmSpindownValue(minutes)
	if err != nil {
		return errReply(err)
	}
	disks, _ := filepath.Glob("/sys/block/sd*")
	if len(disks) == 0 {
		return ipc.Reply{OK: true, Output: "no sd* disks found"}
	}
	var applied []string
	for _, d := range disks {
		dev := "/dev/" + filepath.Base(d)
		if err := kexec.MustBeBlockDevice(dev); err != nil {
			continue
		}
		if _, err := kexec.Run(context.Background(), 15*time.Second, "hdparm", "-S", val, dev); err != nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("hdparm %s: %v", dev, err)}
		}
		applied = append(applied, dev)
	}
	return ipc.Reply{OK: true, Output: fmt.Sprintf("spindown %s min applied to: %s", minutesStr, strings.Join(applied, " "))}
}

// SetWoL enables or disables Wake-on-LAN on the first non-loopback ethernet interface.
// Required params: enabled ("true" | "false")
func SetWoL(params map[string]string) ipc.Reply {
	enabled := params["enabled"] == "true"
	mode := "d"
	if enabled {
		mode = "g"
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		return errReply(err)
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		// skip virtual/bridge interfaces
		if strings.HasPrefix(iface.Name, "lo") || strings.HasPrefix(iface.Name, "docker") ||
			strings.HasPrefix(iface.Name, "veth") || strings.HasPrefix(iface.Name, "br-") ||
			strings.HasPrefix(iface.Name, "virbr") {
			continue
		}
		res, err := kexec.Run(context.Background(), 10*time.Second, "ethtool", "-s", iface.Name, "wol", mode)
		if err != nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("ethtool %s: %v", iface.Name, err)}
		}
		return ipc.Reply{OK: true, Output: fmt.Sprintf("WoL %s on %s: %s", mode, iface.Name, res.Stdout)}
	}
	return ipc.Reply{OK: false, Error: "no eligible ethernet interface found"}
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

var (
	reTimezone = regexp.MustCompile(`^[A-Za-z]+(/[A-Za-z_\-]+)*$`)
	reDateOnly = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	reTimeOnly = regexp.MustCompile(`^\d{2}:\d{2}$`)
)

// SetTimezone sets the system timezone via timedatectl.
// Required params: timezone (IANA name, e.g. "Europe/Lisbon")
func SetTimezone(params map[string]string) ipc.Reply {
	tz := params["timezone"]
	if tz == "" {
		return ipc.Reply{OK: false, Error: "timezone required"}
	}
	if !reTimezone.MatchString(tz) {
		return ipc.Reply{OK: false, Error: fmt.Sprintf("invalid timezone: %q", tz)}
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "timedatectl", "set-timezone", tz)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// SetNTP enables/disables NTP sync and optionally sets the NTP server in timesyncd.conf.
// Required params: enabled ("true"/"false")
// Optional params: server (NTP server hostname)
func SetNTP(params map[string]string) ipc.Reply {
	enabled := params["enabled"] == "true"
	flag := "false"
	if enabled {
		flag = "true"
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "timedatectl", "set-ntp", flag)
	if err != nil {
		return errReply(err)
	}
	if server := params["server"]; server != "" && enabled {
		conf := fmt.Sprintf("[Time]\nNTP=%s\n", server)
		if err := os.WriteFile("/etc/systemd/timesyncd.conf", []byte(conf), 0644); err != nil {
			return ipc.Reply{OK: false, Error: fmt.Sprintf("write timesyncd.conf: %v", err)}
		}
		kexec.Run(context.Background(), 10*time.Second, "systemctl", "restart", "systemd-timesyncd") //nolint:errcheck
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// SetTimeManual sets the system clock manually (requires NTP disabled first).
// Required params: date ("2026-05-21"), time ("14:30")
func SetTimeManual(params map[string]string) ipc.Reply {
	date := params["date"]
	t := params["time"]
	if date == "" || t == "" {
		return ipc.Reply{OK: false, Error: "date and time required"}
	}
	if !reDateOnly.MatchString(date) || !reTimeOnly.MatchString(t) {
		return ipc.Reply{OK: false, Error: "invalid date or time format"}
	}
	res, err := kexec.Run(context.Background(), 15*time.Second, "timedatectl", "set-time", date+" "+t+":00")
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ListTimezones returns all timezones known to timedatectl, newline-separated.
func ListTimezones(params map[string]string) ipc.Reply {
	res, err := kexec.Run(context.Background(), 15*time.Second, "timedatectl", "list-timezones")
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}
