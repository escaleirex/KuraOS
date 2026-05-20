package ops

import (
	"context"
	"fmt"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
	"github.com/kura-os/kura/backend/pkg/ipc"
)

// Mount mounts a device at a path.
// Required params: device, mount_point, fs_type (optional, default "btrfs")
func Mount(params map[string]string) ipc.Reply {
	device := params["device"]
	mountPoint := params["mount_point"]
	fsType := params["fs_type"]
	if fsType == "" {
		fsType = "auto"
	}

	if err := kexec.MustBeBlockDevice(device); err != nil {
		return errReply(err)
	}
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return errReply(err)
	}

	args := []string{"-t", fsType, device, mountPoint}
	res, err := kexec.Run(context.Background(), 30*time.Second, "mount", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// Umount unmounts a mount point.
func Umount(params map[string]string) ipc.Reply {
	mountPoint := params["mount_point"]
	if err := kexec.MustBeMountPath(mountPoint); err != nil {
		return errReply(err)
	}
	res, err := kexec.Run(context.Background(), 30*time.Second, "umount", mountPoint)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// ChownShare sets ownership of a share directory.
// Required params: path, user, group
func ChownShare(params map[string]string) ipc.Reply {
	path := params["path"]
	user := params["user"]
	group := params["group"]
	if err := kexec.MustBeMountPath(path); err != nil {
		return errReply(err)
	}
	ownership := fmt.Sprintf("%s:%s", user, group)
	res, err := kexec.Run(context.Background(), 30*time.Second, "chown", "-R", ownership, path)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// FormatBtrfs formats a device with Btrfs.
// Required params: device, label (optional)
func FormatBtrfs(params map[string]string) ipc.Reply {
	device := params["device"]
	label := params["label"]
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return errReply(err)
	}
	args := []string{"-f"}
	if label != "" {
		args = append(args, "-L", label)
	}
	args = append(args, device)
	res, err := kexec.Run(context.Background(), 120*time.Second, "mkfs.btrfs", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

// FormatExt4 formats a device with ext4.
// Required params: device, label (optional)
func FormatExt4(params map[string]string) ipc.Reply {
	device := params["device"]
	label := params["label"]
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return errReply(err)
	}
	args := []string{"-F"}
	if label != "" {
		args = append(args, "-L", label)
	}
	args = append(args, device)
	res, err := kexec.Run(context.Background(), 120*time.Second, "mkfs.ext4", args...)
	if err != nil {
		return errReply(err)
	}
	return ipc.Reply{OK: true, Output: res.Stdout}
}

func errReply(err error) ipc.Reply {
	return ipc.Reply{OK: false, Error: err.Error()}
}
