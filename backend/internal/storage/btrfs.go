package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

type BtrfsVolume struct {
	Path      string `json:"path"`
	Label     string `json:"label,omitempty"`
	UUID      string `json:"uuid"`
	TotalBytes uint64 `json:"total_bytes"`
	UsedBytes  uint64 `json:"used_bytes"`
}

type BtrfsSubvolume struct {
	ID     int    `json:"id"`
	Path   string `json:"path"`
	Parent int    `json:"parent_id"`
}

type BtrfsSnapshot struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	CreatedAt string `json:"created_at"`
	ReadOnly  bool   `json:"read_only"`
}

// FormatBtrfs creates a new Btrfs filesystem on a device.
func FormatBtrfs(ctx context.Context, device, label string) error {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return err
	}
	args := []string{"-f"}
	if label != "" {
		args = append(args, "-L", label)
	}
	args = append(args, device)
	_, err := kexec.Run(ctx, 120*time.Second, "mkfs.btrfs", args...)
	return err
}

// CreateSubvolume creates a Btrfs subvolume at the given path.
func CreateSubvolume(ctx context.Context, mountPoint, name string) error {
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return err
	}
	path := filepath.Join(mountPoint, name)
	_, err := kexec.Run(ctx, 30*time.Second, "btrfs", "subvolume", "create", path)
	return err
}

// CreateSnapshot creates a snapshot of a subvolume.
// If readOnly is true, the snapshot cannot be modified (safe for backups).
func CreateSnapshot(ctx context.Context, srcPath, dstPath string, readOnly bool) error {
	if err := kexec.MustBeMountPath(srcPath); err != nil {
		return err
	}
	if err := kexec.MustBeMountPath(dstPath); err != nil {
		return err
	}
	args := []string{"subvolume", "snapshot"}
	if readOnly {
		args = append(args, "-r")
	}
	args = append(args, srcPath, dstPath)
	_, err := kexec.Run(ctx, 60*time.Second, "btrfs", args...)
	return err
}

// DeleteSnapshot deletes a Btrfs snapshot.
func DeleteSnapshot(ctx context.Context, path string) error {
	if err := kexec.MustBeMountPath(path); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 30*time.Second, "btrfs", "subvolume", "delete", path)
	return err
}

// StartScrub initiates a Btrfs scrub on a mounted filesystem (bitrot detection).
func StartScrub(ctx context.Context, mountPoint string) error {
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 10*time.Second, "btrfs", "scrub", "start", "-B", mountPoint)
	return err
}

// ScrubStatus returns the current scrub status.
func ScrubStatus(ctx context.Context, mountPoint string) (string, error) {
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return "", err
	}
	res, err := kexec.Run(ctx, 10*time.Second, "btrfs", "scrub", "status", mountPoint)
	if err != nil {
		return "", err
	}
	return res.Stdout, nil
}

// ListSubvolumes returns subvolumes on a mounted Btrfs filesystem.
func ListSubvolumes(ctx context.Context, mountPoint string) ([]BtrfsSubvolume, error) {
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return nil, err
	}
	res, err := kexec.Run(ctx, 15*time.Second, "btrfs", "subvolume", "list", mountPoint)
	if err != nil {
		return nil, err
	}
	return parseSubvolumes(res.Stdout), nil
}

// BtrfsUsage returns filesystem usage stats.
func BtrfsUsage(ctx context.Context, mountPoint string) (string, error) {
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return "", err
	}
	res, err := kexec.Run(ctx, 15*time.Second, "btrfs", "filesystem", "usage", "-b", mountPoint)
	if err != nil {
		return "", err
	}
	return res.Stdout, nil
}

// EnsureSnapshotDir creates the .snapshots directory inside a subvolume if absent.
func EnsureSnapshotDir(mountPoint, subvol string) error {
	dir := filepath.Join(mountPoint, subvol, ".snapshots")
	return os.MkdirAll(dir, 0755)
}

func parseSubvolumes(output string) []BtrfsSubvolume {
	var result []BtrfsSubvolume
	for _, line := range strings.Split(output, "\n") {
		// "ID 256 gen 8 top level 5 path @"
		var id, gen, topLevel int
		var path string
		if n, _ := fmt.Sscanf(line, "ID %d gen %d top level %d path %s", &id, &gen, &topLevel, &path); n == 4 {
			result = append(result, BtrfsSubvolume{ID: id, Path: path, Parent: topLevel})
		}
	}
	return result
}
