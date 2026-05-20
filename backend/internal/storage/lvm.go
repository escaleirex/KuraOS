package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

type VolumeGroup struct {
	Name      string `json:"name"`
	SizeBytes uint64 `json:"size_bytes"`
	FreeBytes uint64 `json:"free_bytes"`
	PVs       []string `json:"pvs"`
}

type LogicalVolume struct {
	Name      string `json:"name"`
	VGName    string `json:"vg_name"`
	SizeBytes uint64 `json:"size_bytes"`
	Path      string `json:"path"`
	Active    bool   `json:"active"`
	Cached    bool   `json:"cached"`
}

// CreatePV initialises a physical volume.
func CreatePV(ctx context.Context, device string) error {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 60*time.Second, "pvcreate", "-ff", "-y", device)
	return err
}

// CreateVG creates a volume group from one or more PVs.
func CreateVG(ctx context.Context, vgName string, devices []string) error {
	if err := kexec.MustBeVGName(vgName); err != nil {
		return err
	}
	for _, d := range devices {
		if err := kexec.MustBeBlockDevice(d); err != nil {
			return err
		}
	}
	args := append([]string{vgName}, devices...)
	_, err := kexec.Run(ctx, 60*time.Second, "vgcreate", args...)
	return err
}

// CreateLV creates a logical volume.
// size is a lvcreate-compatible string: "100G", "50%FREE", etc.
func CreateLV(ctx context.Context, vgName, lvName, size string) error {
	if err := kexec.MustBeVGName(vgName); err != nil {
		return err
	}
	if err := kexec.MustBeLVName(lvName); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 120*time.Second, "lvcreate",
		"-n", lvName, "-L", size, vgName,
	)
	return err
}

// RemoveLV removes a logical volume.
func RemoveLV(ctx context.Context, vgName, lvName string) error {
	if err := kexec.MustBeVGName(vgName); err != nil {
		return err
	}
	if err := kexec.MustBeLVName(lvName); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 60*time.Second, "lvremove", "-f",
		fmt.Sprintf("%s/%s", vgName, lvName),
	)
	return err
}

// EnableSSDCache converts an existing LV to use an NVMe-backed LVM cache pool.
// cacheDevice must be an NVMe or fast SSD device.
// cachePoolSize is a lvcreate-compatible size string for the cache pool.
func EnableSSDCache(ctx context.Context, vgName, dataLV, cacheDevice, cachePoolSize string) error {
	if err := kexec.MustBeVGName(vgName); err != nil {
		return err
	}
	if err := kexec.MustBeLVName(dataLV); err != nil {
		return err
	}
	if err := kexec.MustBeBlockDevice(cacheDevice); err != nil {
		return err
	}

	// Add the fast device as a PV to the VG
	if _, err := kexec.Run(ctx, 60*time.Second, "pvcreate", "-ff", "-y", cacheDevice); err != nil {
		return fmt.Errorf("pvcreate cache device: %w", err)
	}
	if _, err := kexec.Run(ctx, 30*time.Second, "vgextend", vgName, cacheDevice); err != nil {
		return fmt.Errorf("vgextend: %w", err)
	}

	// Create the cache pool on the fast PV
	cachePoolName := dataLV + "_cache_pool"
	if _, err := kexec.Run(ctx, 120*time.Second, "lvcreate",
		"--type", "cache-pool",
		"-n", cachePoolName,
		"-L", cachePoolSize,
		"--cachepolicy", "smq",
		vgName, cacheDevice,
	); err != nil {
		return fmt.Errorf("create cache pool: %w", err)
	}

	// Convert data LV to use the cache pool
	if _, err := kexec.Run(ctx, 120*time.Second, "lvconvert",
		"--type", "cache",
		"--cachepool", fmt.Sprintf("%s/%s", vgName, cachePoolName),
		fmt.Sprintf("%s/%s", vgName, dataLV),
	); err != nil {
		return fmt.Errorf("lvconvert cache: %w", err)
	}
	return nil
}

// ListVGs returns all volume groups via vgs --reportformat json.
func ListVGs(ctx context.Context) ([]VolumeGroup, error) {
	res, err := kexec.Run(ctx, 15*time.Second, "vgs",
		"--reportformat", "json",
		"--units", "b",
		"--nosuffix",
		"-o", "vg_name,vg_size,vg_free",
	)
	if err != nil {
		return nil, err
	}
	return parseVGS(res.Stdout)
}

// ListLVs returns all logical volumes for a VG.
func ListLVs(ctx context.Context, vgName string) ([]LogicalVolume, error) {
	if err := kexec.MustBeVGName(vgName); err != nil {
		return nil, err
	}
	res, err := kexec.Run(ctx, 15*time.Second, "lvs",
		"--reportformat", "json",
		"--units", "b",
		"--nosuffix",
		"-o", "lv_name,vg_name,lv_size,lv_path,lv_active,lv_layout",
		vgName,
	)
	if err != nil {
		return nil, err
	}
	return parseLVS(res.Stdout)
}

func parseVGS(output string) ([]VolumeGroup, error) {
	var raw struct {
		Report []struct {
			VG []struct {
				Name string `json:"vg_name"`
				Size string `json:"vg_size"`
				Free string `json:"vg_free"`
			} `json:"vg"`
		} `json:"report"`
	}
	if err := json.Unmarshal([]byte(output), &raw); err != nil {
		return nil, err
	}
	var vgs []VolumeGroup
	for _, r := range raw.Report {
		for _, v := range r.VG {
			vg := VolumeGroup{Name: v.Name}
			fmt.Sscanf(v.Size, "%d", &vg.SizeBytes)
			fmt.Sscanf(v.Free, "%d", &vg.FreeBytes)
			vgs = append(vgs, vg)
		}
	}
	return vgs, nil
}

func parseLVS(output string) ([]LogicalVolume, error) {
	var raw struct {
		Report []struct {
			LV []struct {
				Name   string `json:"lv_name"`
				VGName string `json:"vg_name"`
				Size   string `json:"lv_size"`
				Path   string `json:"lv_path"`
				Active string `json:"lv_active"`
				Layout string `json:"lv_layout"`
			} `json:"lv"`
		} `json:"report"`
	}
	if err := json.Unmarshal([]byte(output), &raw); err != nil {
		return nil, err
	}
	var lvs []LogicalVolume
	for _, r := range raw.Report {
		for _, l := range r.LV {
			lv := LogicalVolume{
				Name:   l.Name,
				VGName: l.VGName,
				Path:   l.Path,
				Active: l.Active == "active",
				Cached: strings.Contains(l.Layout, "cache"),
			}
			fmt.Sscanf(l.Size, "%d", &lv.SizeBytes)
			lvs = append(lvs, lv)
		}
	}
	return lvs, nil
}
