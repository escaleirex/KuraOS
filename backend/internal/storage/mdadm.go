package storage

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

type RAIDLevel string

const (
	RAID0  RAIDLevel = "0"
	RAID1  RAIDLevel = "1"
	RAID5  RAIDLevel = "5"
	RAID6  RAIDLevel = "6"
	RAID10 RAIDLevel = "10"
	JBOD   RAIDLevel = "linear"
)

type RAIDArray struct {
	Device    string    `json:"device"`
	Level     RAIDLevel `json:"level"`
	State     string    `json:"state"`
	SizeBytes uint64    `json:"size_bytes"`
	Drives    []string  `json:"drives"`
	ActiveN   int       `json:"active_drives"`
	TotalN    int       `json:"total_drives"`
	Resync    string    `json:"resync,omitempty"` // rebuild/check progress
}

var validLevels = map[RAIDLevel]bool{
	RAID0: true, RAID1: true, RAID5: true,
	RAID6: true, RAID10: true, JBOD: true,
}

// CreateRAID creates a new mdadm array. All device paths are validated.
func CreateRAID(ctx context.Context, device string, level RAIDLevel, drives []string) error {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return err
	}
	if !validLevels[level] {
		return fmt.Errorf("invalid RAID level: %q", level)
	}
	if len(drives) == 0 {
		return fmt.Errorf("no drives specified")
	}
	for _, d := range drives {
		if err := kexec.MustBeBlockDevice(d); err != nil {
			return err
		}
	}

	args := []string{
		"--create", device,
		"--level=" + string(level),
		fmt.Sprintf("--raid-devices=%d", len(drives)),
		"--run",
	}
	args = append(args, drives...)

	_, err := kexec.Run(ctx, 5*time.Minute, "mdadm", args...)
	return err
}

// StopRAID deactivates an mdadm array.
func StopRAID(ctx context.Context, device string) error {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return err
	}
	_, err := kexec.Run(ctx, 30*time.Second, "mdadm", "--stop", device)
	return err
}

// ListRAID parses /proc/mdstat and returns all active arrays.
func ListRAID(ctx context.Context) ([]RAIDArray, error) {
	data, err := os.ReadFile("/proc/mdstat")
	if err != nil {
		return nil, fmt.Errorf("read mdstat: %w", err)
	}
	return parseMDStat(string(data)), nil
}

// RAIDStatus returns detail for one array via mdadm --detail.
func RAIDStatus(ctx context.Context, device string) (*RAIDArray, error) {
	if err := kexec.MustBeBlockDevice(device); err != nil {
		return nil, err
	}
	res, err := kexec.Run(ctx, 15*time.Second, "mdadm", "--detail", device)
	if err != nil {
		return nil, err
	}
	return parseDetail(device, res.Stdout), nil
}

var (
	reMDLine    = regexp.MustCompile(`^(md\w+)\s*:\s*(\w+)\s+raid(\w+)\s+(.+)$`)
	reResync    = regexp.MustCompile(`\[=*>?\s*\]\s*(?:resync|recovery|check|repair)\s*=\s*(\d+\.\d+)%`)
	reDetailKV  = regexp.MustCompile(`^\s+(\w[\w ]+?)\s*:\s+(.+)$`)
	reDetailDev = regexp.MustCompile(`^\s+\d+\s+\d+\s+\d+\s+\d+\s+\w+\s+(\S+)\s`)
)

func parseMDStat(content string) []RAIDArray {
	var arrays []RAIDArray
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		m := reMDLine.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		dev := "/dev/" + m[1]
		state := m[2]
		level := RAIDLevel(m[3])
		drives := strings.Fields(m[4])
		// clean partition suffix from drives (sda[0] → /dev/sda)
		cleanDrives := make([]string, 0, len(drives))
		for _, d := range drives {
			d = regexp.MustCompile(`\[\d+\]`).ReplaceAllString(d, "")
			d = regexp.MustCompile(`\(\w\)`).ReplaceAllString(d, "")
			cleanDrives = append(cleanDrives, "/dev/"+strings.TrimSpace(d))
		}

		arr := RAIDArray{
			Device: dev, Level: level, State: state,
			Drives: cleanDrives, TotalN: len(cleanDrives),
		}

		// check next line for resync progress
		if i+1 < len(lines) {
			if rm := reResync.FindStringSubmatch(lines[i+1]); rm != nil {
				arr.Resync = rm[1] + "%"
			}
		}
		arrays = append(arrays, arr)
	}
	return arrays
}

func parseDetail(device, output string) *RAIDArray {
	arr := &RAIDArray{Device: device}
	for _, line := range strings.Split(output, "\n") {
		if m := reDetailKV.FindStringSubmatch(line); m != nil {
			switch strings.TrimSpace(m[1]) {
			case "State":
				arr.State = strings.TrimSpace(m[2])
			case "Raid Level":
				arr.Level = RAIDLevel(strings.TrimPrefix(strings.TrimSpace(m[2]), "raid"))
			case "Array Size":
				// "3906886656 (3726.02 GiB 4000.65 GB)"
				fields := strings.Fields(m[2])
				if len(fields) > 0 {
					kb, _ := strconv.ParseUint(fields[0], 10, 64)
					arr.SizeBytes = kb * 1024
				}
			case "Active Devices":
				arr.ActiveN, _ = strconv.Atoi(strings.TrimSpace(m[2]))
			case "Total Devices":
				arr.TotalN, _ = strconv.Atoi(strings.TrimSpace(m[2]))
			case "Resync Status":
				arr.Resync = strings.TrimSpace(m[2])
			}
		}
		if m := reDetailDev.FindStringSubmatch(line); m != nil {
			arr.Drives = append(arr.Drives, m[1])
		}
	}
	return arr
}
