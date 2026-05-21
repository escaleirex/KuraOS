package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

type Disk struct {
	Path       string `json:"path"`
	Model      string `json:"model"`
	Serial     string `json:"serial"`
	SizeBytes  uint64 `json:"size_bytes"`
	FSType     string `json:"fs_type,omitempty"`
	MountPoint string `json:"mount_point,omitempty"`
	Transport  string `json:"transport"` // sata, nvme, usb
	RPM        int    `json:"rpm,omitempty"`
}

type SMARTStatus struct {
	Healthy     bool           `json:"healthy"`
	Temperature int            `json:"temperature_c,omitempty"`
	PowerOnH    int            `json:"power_on_hours,omitempty"`
	Reallocated int            `json:"reallocated_sectors"`
	Attrs       []SMARTAttr    `json:"attributes,omitempty"`
	Raw         map[string]any `json:"raw,omitempty"`
}

type SMARTAttr struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Value int    `json:"value"`
	Worst int    `json:"worst"`
	Raw   string `json:"raw"`
}

// ListDisks returns all block devices via lsblk.
func ListDisks(ctx context.Context) ([]Disk, error) {
	res, err := kexec.Run(ctx, 10*time.Second, "lsblk",
		"--json", "--output", "PATH,MODEL,SERIAL,SIZE,FSTYPE,MOUNTPOINT,TRAN,ROTA",
		"--bytes", "--exclude", "1,2,253",
	)
	if err != nil {
		return nil, fmt.Errorf("lsblk: %w", err)
	}

	var raw struct {
		BlockDevices []struct {
			Path     string `json:"path"`
			Model    string `json:"model"`
			Serial   string `json:"serial"`
			Size     uint64 `json:"size"`
			FSType   string `json:"fstype"`
			MountPt  string `json:"mountpoint"`
			Tran     string `json:"tran"`
			Rota     bool   `json:"rota"`
			Children []struct {
				Path     string `json:"path"`
				Model    string `json:"model"`
				Serial   string `json:"serial"`
				Size     uint64 `json:"size"`
				FSType   string `json:"fstype"`
				MountPt  string `json:"mountpoint"`
				Tran     string `json:"tran"`
				Rota     bool   `json:"rota"`
				Children []struct {
					Path     string `json:"path"`
					Model    string `json:"model"`
					Serial   string `json:"serial"`
					Size     uint64 `json:"size"`
					FSType   string `json:"fstype"`
					MountPt  string `json:"mountpoint"`
					Tran     string `json:"tran"`
					Rota     bool   `json:"rota"`
				} `json:"children"`
			} `json:"children"`
		} `json:"blockdevices"`
	}
	if err := json.Unmarshal([]byte(res.Stdout), &raw); err != nil {
		return nil, fmt.Errorf("parse lsblk: %w", err)
	}

	disks := make([]Disk, 0, len(raw.BlockDevices)*4)
	for _, d := range raw.BlockDevices {
		if isVirtualDevice(d.Path) {
			continue
		}
		transport := d.Tran
		if transport == "" {
			transport = detectTransport(d.Path)
		}
		// Parent disk (only if it has a mount point itself)
		if d.MountPt != "" {
			disks = append(disks, Disk{
				Path:       d.Path,
				Model:      strings.TrimSpace(d.Model),
				Serial:     strings.TrimSpace(d.Serial),
				SizeBytes:  d.Size,
				FSType:     d.FSType,
				MountPoint: d.MountPt,
				Transport:  transport,
			})
		}
		// Partitions (level 1)
		for _, c := range d.Children {
			if isVirtualDevice(c.Path) {
				continue
			}
			cTransport := c.Tran
			if cTransport == "" {
				cTransport = transport
			}
			if c.MountPt != "" || c.FSType != "" {
				disks = append(disks, Disk{
					Path:       c.Path,
					Model:      strings.TrimSpace(firstNonEmpty(c.Model, d.Model)),
					Serial:     strings.TrimSpace(firstNonEmpty(c.Serial, d.Serial)),
					SizeBytes:  c.Size,
					FSType:     c.FSType,
					MountPoint: c.MountPt,
					Transport:  cTransport,
				})
			}
			// Sub-partitions / LVM (level 2)
			for _, sc := range c.Children {
				if isVirtualDevice(sc.Path) {
					continue
				}
				scTransport := sc.Tran
				if scTransport == "" {
					scTransport = cTransport
				}
				if sc.MountPt != "" || sc.FSType != "" {
					disks = append(disks, Disk{
						Path:       sc.Path,
						Model:      strings.TrimSpace(firstNonEmpty(sc.Model, c.Model, d.Model)),
						Serial:     strings.TrimSpace(firstNonEmpty(sc.Serial, c.Serial, d.Serial)),
						SizeBytes:  sc.Size,
						FSType:     sc.FSType,
						MountPoint: sc.MountPt,
						Transport:  scTransport,
					})
				}
			}
		}
	}
	return disks, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func isVirtualDevice(path string) bool {
	base := filepath.Base(path)
	prefixes := []string{"loop", "ram", "zram", "dm-", "md"}
	for _, p := range prefixes {
		if strings.HasPrefix(base, p) {
			return true
		}
	}
	return false
}

// SMARTCheck runs smartctl on a device and parses health + key attributes.
func SMARTCheck(ctx context.Context, device string) (*SMARTStatus, error) {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return nil, err
	}

	res, err := kexec.Run(ctx, 30*time.Second, "smartctl", "--json=c", "--all", device)
	// smartctl exits non-zero on warnings — still parse output
	_ = err

	var raw map[string]any
	if jsonErr := json.Unmarshal([]byte(res.Stdout), &raw); jsonErr != nil {
		return nil, fmt.Errorf("parse smartctl: %w", jsonErr)
	}

	status := &SMARTStatus{Raw: raw}

	if st, ok := raw["smart_status"].(map[string]any); ok {
		status.Healthy, _ = st["passed"].(bool)
	}

	if temp, ok := raw["temperature"].(map[string]any); ok {
		if c, ok := temp["current"].(float64); ok {
			status.Temperature = int(c)
		}
	}

	if pow, ok := raw["power_on_time"].(map[string]any); ok {
		if h, ok := pow["hours"].(float64); ok {
			status.PowerOnH = int(h)
		}
	}

	if attrs, ok := raw["ata_smart_attributes"].(map[string]any); ok {
		if table, ok := attrs["table"].([]any); ok {
			for _, entry := range table {
				m, _ := entry.(map[string]any)
				id := int(m["id"].(float64))
				name, _ := m["name"].(string)
				val, _ := m["value"].(float64)
				worst, _ := m["worst"].(float64)
				rawV, _ := m["raw"].(map[string]any)
				rawStr := fmt.Sprintf("%v", rawV["value"])

				status.Attrs = append(status.Attrs, SMARTAttr{
					ID: id, Name: name,
					Value: int(val), Worst: int(worst), Raw: rawStr,
				})
				if id == 5 { // Reallocated Sector Count
					status.Reallocated = int(val)
				}
			}
		}
	}

	return status, nil
}

func detectTransport(path string) string {
	base := filepath.Base(path)
	switch {
	case strings.HasPrefix(base, "nvme"):
		return "nvme"
	case strings.HasPrefix(base, "sd") || strings.HasPrefix(base, "hd"):
		// check if USB via /sys/block/sdX/device/../../subsystem
		syspath := fmt.Sprintf("/sys/block/%s", base)
		link, err := os.Readlink(syspath)
		if err == nil && strings.Contains(link, "usb") {
			return "usb"
		}
		return "sata"
	default:
		return "unknown"
	}
}
