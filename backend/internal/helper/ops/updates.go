package ops

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/kura-os/kura/backend/pkg/ipc"
)

const updateStatusPath = "/var/lib/kura/update-status.json"

type updateStatusFile struct {
	Running  bool   `json:"running"`
	Progress int    `json:"progress"`
	Stage    string `json:"stage"`
	Message  string `json:"message"`
}

type aptPackage struct {
	Name      string `json:"name"`
	Current   string `json:"current"`
	Available string `json:"available"`
}

type checkUpdatesResult struct {
	PackageCount int          `json:"packageCount"`
	Packages     []aptPackage `json:"packages"`
}

func writeUpdateStatus(s updateStatusFile) {
	data, _ := json.Marshal(s)
	tmp := updateStatusPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return
	}
	os.Rename(tmp, updateStatusPath)
}

func runApt(ctx context.Context, timeout time.Duration, args ...string) error {
	tctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(tctx, "apt-get", args...)
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("apt-get %s: %w — %s", args[0], err, strings.TrimSpace(string(out)))
	}
	return nil
}

// CheckUpdates returns available apt package count and list.
func CheckUpdates(_ map[string]string) ipc.Reply {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "apt", "list", "--upgradable")
	out, _ := cmd.Output()

	var pkgs []aptPackage
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" || strings.HasPrefix(line, "Listing...") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		name := strings.SplitN(parts[0], "/", 2)[0]
		available := parts[1]
		current := ""
		if idx := strings.Index(line, "upgradable from: "); idx >= 0 {
			current = strings.TrimSuffix(strings.TrimSpace(line[idx+17:]), "]")
		}
		pkgs = append(pkgs, aptPackage{Name: name, Current: current, Available: available})
	}
	if pkgs == nil {
		pkgs = []aptPackage{}
	}
	result := checkUpdatesResult{PackageCount: len(pkgs), Packages: pkgs}
	data, _ := json.Marshal(result)
	return ipc.Reply{OK: true, Output: string(data)}
}

// InstallUpdates runs apt-get update && apt-get upgrade, writing progress to the status file.
func InstallUpdates(_ map[string]string) ipc.Reply {
	writeUpdateStatus(updateStatusFile{Running: true, Progress: 5, Stage: "checking", Message: "Refreshing package lists..."})

	if err := runApt(context.Background(), 5*time.Minute, "update"); err != nil {
		writeUpdateStatus(updateStatusFile{Running: false, Progress: 0, Stage: "error", Message: err.Error()})
		return errReply(err)
	}

	writeUpdateStatus(updateStatusFile{Running: true, Progress: 30, Stage: "installing", Message: "Installing upgrades..."})

	if err := runApt(context.Background(), 20*time.Minute,
		"upgrade", "-y",
		"-o", "Dpkg::Options::=--force-confdef",
		"-o", "Dpkg::Options::=--force-confold",
	); err != nil {
		writeUpdateStatus(updateStatusFile{Running: false, Progress: 0, Stage: "error", Message: err.Error()})
		return errReply(err)
	}

	writeUpdateStatus(updateStatusFile{Running: false, Progress: 100, Stage: "done", Message: "Update complete."})
	return ipc.Reply{OK: true, Output: "update complete"}
}
