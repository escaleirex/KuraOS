package exec

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

var (
	reDevBlock  = regexp.MustCompile(`^/dev/(sd[a-z]{1,2}|hd[a-z]|nvme\d+n\d+|md\d+|loop\d+|vd[a-z])$`)
	reVGName    = regexp.MustCompile(`^[a-zA-Z0-9_\-]{1,128}$`)
	reLVName    = regexp.MustCompile(`^[a-zA-Z0-9_\-]{1,128}$`)
	reMountPath = regexp.MustCompile(`^/[a-zA-Z0-9_\-./]{0,255}$`)
	reFSType    = regexp.MustCompile(`^(btrfs|ext4|xfs|vfat)$`)
)

type Result struct {
	Stdout string
	Stderr string
}

// Run executes a binary with explicit args — never via shell.
// Timeout defaults to 30s if zero.
func Run(ctx context.Context, timeout time.Duration, binary string, args ...string) (*Result, error) {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binary, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return &Result{stdout.String(), stderr.String()},
			fmt.Errorf("%s: %w — stderr: %s", binary, err, strings.TrimSpace(stderr.String()))
	}
	return &Result{stdout.String(), stderr.String()}, nil
}

// RunWithStdin executes a binary with explicit args, writing data to stdin.
func RunWithStdin(ctx context.Context, timeout time.Duration, stdin string, binary string, args ...string) (*Result, error) {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Stdin = strings.NewReader(stdin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return &Result{stdout.String(), stderr.String()},
			fmt.Errorf("%s: %w — stderr: %s", binary, err, strings.TrimSpace(stderr.String()))
	}
	return &Result{stdout.String(), stderr.String()}, nil
}

// MustBeBlockDevice validates a device path against the allowlist pattern.
func MustBeBlockDevice(path string) error {
	if !reDevBlock.MatchString(path) {
		return fmt.Errorf("invalid device path: %q", path)
	}
	return nil
}

// MustBeVGName validates a volume group name.
func MustBeVGName(name string) error {
	if !reVGName.MatchString(name) {
		return fmt.Errorf("invalid VG name: %q", name)
	}
	return nil
}

// MustBeLVName validates a logical volume name.
func MustBeLVName(name string) error {
	if !reLVName.MatchString(name) {
		return fmt.Errorf("invalid LV name: %q", name)
	}
	return nil
}

// MustBeMountPath validates a mount point path.
func MustBeMountPath(path string) error {
	if !reMountPath.MatchString(path) {
		return fmt.Errorf("invalid mount path: %q", path)
	}
	return nil
}

// MustBeFSType validates a filesystem type.
func MustBeFSType(fs string) error {
	if !reFSType.MatchString(fs) {
		return fmt.Errorf("unsupported filesystem: %q", fs)
	}
	return nil
}
