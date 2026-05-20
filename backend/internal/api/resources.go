package api

import (
	"bufio"
	"context"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	kexec "github.com/kura-os/kura/backend/pkg/exec"
)

// ── Structs ────────────────────────────────────────────────────────────────

type SystemResources struct {
	Timestamp int64       `json:"timestamp"`
	CPU       CPUInfo     `json:"cpu"`
	Memory    MemoryInfo  `json:"memory"`
	GPUs      []GPUInfo   `json:"gpus"`
	Disks     []DiskInfo  `json:"disks"`
	Network   []NetIface  `json:"network"`
	Sensors   []HwmonChip `json:"sensors"`
}

type CPUInfo struct {
	Name     string    `json:"name"`
	Cores    int       `json:"cores"`
	Threads  int       `json:"threads"`
	UsagePct float64   `json:"usage_pct"`
	PerCore  []float64 `json:"per_core"`
	FreqMHz  []float64 `json:"freq_mhz"`
	TempC    float64   `json:"temp_c,omitempty"`
	PowerW   float64   `json:"power_w,omitempty"`
}

type MemoryInfo struct {
	TotalBytes  int64 `json:"total_bytes"`
	UsedBytes   int64 `json:"used_bytes"`
	AvailBytes  int64 `json:"avail_bytes"`
	CachedBytes int64 `json:"cached_bytes"`
	BufferBytes int64 `json:"buffer_bytes"`
	SwapTotal   int64 `json:"swap_total"`
	SwapUsed    int64 `json:"swap_used"`
}

type GPUInfo struct {
	Name       string  `json:"name"`
	Driver     string  `json:"driver"` // nvidia | amd | intel
	UsagePct   float64 `json:"usage_pct"`
	VRAMUsed   int64   `json:"vram_used"`
	VRAMTotal  int64   `json:"vram_total"`
	TempC      float64 `json:"temp_c,omitempty"`
	PowerW     float64 `json:"power_w,omitempty"`
	EncoderPct float64 `json:"encoder_pct,omitempty"`
	DecoderPct float64 `json:"decoder_pct,omitempty"`
}

type DiskInfo struct {
	Name        string  `json:"name"`
	MountPoint  string  `json:"mount_point,omitempty"`
	ReadBps     float64 `json:"read_bps"`
	WriteBps    float64 `json:"write_bps"`
	TotalBytes  int64   `json:"total_bytes,omitempty"`
	UsedBytes   int64   `json:"used_bytes,omitempty"`
	FreeBytes   int64   `json:"free_bytes,omitempty"`
	TempC       float64 `json:"temp_c,omitempty"`
}

type NetIface struct {
	Name  string  `json:"name"`
	RxBps float64 `json:"rx_bps"`
	TxBps float64 `json:"tx_bps"`
}

type HwmonChip struct {
	Name    string        `json:"name"`
	Path    string        `json:"path"`
	Sensors []SensorReading `json:"sensors"`
}

type SensorReading struct {
	Label  string  `json:"label"`
	Kind   string  `json:"kind"` // temp | fan | power | voltage | current
	Value  float64 `json:"value"`
	Unit   string  `json:"unit"`
	Crit   float64 `json:"crit,omitempty"`
}

// ── Delta tracking ─────────────────────────────────────────────────────────

type coreSample struct {
	total, idle float64
	at          time.Time
}

type ioSample struct {
	read, write uint64
	at          time.Time
}

var (
	prevCoresMu sync.Mutex
	prevCores   []coreSample

	prevDisksMu sync.Mutex
	prevDisks   = make(map[string]ioSample)

	prevNetMu sync.Mutex
	prevNet   = make(map[string]ioSample)
)

// ── CPU ────────────────────────────────────────────────────────────────────

func readCPUName() string {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return "Unknown CPU"
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "model name") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return "Unknown CPU"
}

func readCPUCoreCount() (physical, logical int) {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return 1, 1
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	logicalSet := make(map[string]bool)
	physCores := 0
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "processor") {
			logical++
			logicalSet[line] = true
		}
		if strings.HasPrefix(line, "cpu cores") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				n, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
				if n > physCores {
					physCores = n
				}
			}
		}
	}
	if physCores == 0 {
		physCores = logical
	}
	return physCores, logical
}

func readPerCoreCPU() (overall float64, perCore []float64) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, nil
	}
	defer f.Close()

	type rawCore struct {
		name        string
		total, idle float64
	}
	var cores []rawCore

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		vals := make([]float64, len(fields)-1)
		for i, s := range fields[1:] {
			vals[i], _ = strconv.ParseFloat(s, 64)
		}
		idle := vals[3] + vals[4]
		total := 0.0
		for _, v := range vals {
			total += v
		}
		cores = append(cores, rawCore{name: fields[0], total: total, idle: idle})
	}

	now := time.Now()
	prevCoresMu.Lock()
	defer prevCoresMu.Unlock()

	if len(prevCores) != len(cores) {
		prevCores = make([]coreSample, len(cores))
		for i, c := range cores {
			prevCores[i] = coreSample{total: c.total, idle: c.idle, at: now}
		}
		return 0, nil
	}

	result := make([]float64, 0, len(cores)-1)
	for i, c := range cores {
		prev := prevCores[i]
		prevCores[i] = coreSample{total: c.total, idle: c.idle, at: now}
		if prev.at.IsZero() || c.total == prev.total {
			if i > 0 {
				result = append(result, 0)
			}
			continue
		}
		dTotal := c.total - prev.total
		dIdle := c.idle - prev.idle
		pct := math.Max(0, (1-dIdle/dTotal)*100)
		if i == 0 {
			overall = pct
		} else {
			result = append(result, pct)
		}
	}
	return overall, result
}

func readCPUFreqMHz(threads int) []float64 {
	freqs := make([]float64, threads)
	for i := 0; i < threads; i++ {
		data, err := os.ReadFile(fmt.Sprintf(
			"/sys/devices/system/cpu/cpu%d/cpufreq/scaling_cur_freq", i))
		if err != nil {
			continue
		}
		khz, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
		if err == nil {
			freqs[i] = khz / 1000
		}
	}
	return freqs
}

// ── Memory ─────────────────────────────────────────────────────────────────

func readFullMemInfo() MemoryInfo {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return MemoryInfo{}
	}
	defer f.Close()

	m := make(map[string]int64)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		kb, _ := strconv.ParseInt(fields[1], 10, 64)
		m[strings.TrimSuffix(fields[0], ":")] = kb * 1024
	}

	used := m["MemTotal"] - m["MemAvailable"]
	return MemoryInfo{
		TotalBytes:  m["MemTotal"],
		UsedBytes:   used,
		AvailBytes:  m["MemAvailable"],
		CachedBytes: m["Cached"] + m["SReclaimable"],
		BufferBytes: m["Buffers"],
		SwapTotal:   m["SwapTotal"],
		SwapUsed:    m["SwapTotal"] - m["SwapFree"],
	}
}

// ── Hwmon sensors ──────────────────────────────────────────────────────────

func readHwmonSensors() []HwmonChip {
	entries, err := filepath.Glob("/sys/class/hwmon/hwmon*")
	if err != nil || len(entries) == 0 {
		return nil
	}

	var chips []HwmonChip
	for _, hwmonPath := range entries {
		nameBytes, err := os.ReadFile(filepath.Join(hwmonPath, "name"))
		if err != nil {
			continue
		}
		chipName := strings.TrimSpace(string(nameBytes))

		var readings []SensorReading

		// Temperatures
		for i := 1; i <= 32; i++ {
			inp, err := os.ReadFile(fmt.Sprintf("%s/temp%d_input", hwmonPath, i))
			if err != nil {
				break
			}
			milli, err := strconv.ParseFloat(strings.TrimSpace(string(inp)), 64)
			if err != nil || milli <= 0 {
				continue
			}
			tempC := milli / 1000

			label := fmt.Sprintf("temp%d", i)
			if lb, err := os.ReadFile(fmt.Sprintf("%s/temp%d_label", hwmonPath, i)); err == nil {
				label = strings.TrimSpace(string(lb))
			}

			r := SensorReading{Label: label, Kind: "temp", Value: tempC, Unit: "°C"}
			if crit, err := os.ReadFile(fmt.Sprintf("%s/temp%d_crit", hwmonPath, i)); err == nil {
				mc, _ := strconv.ParseFloat(strings.TrimSpace(string(crit)), 64)
				r.Crit = mc / 1000
			}
			readings = append(readings, r)
		}

		// Fans
		for i := 1; i <= 16; i++ {
			inp, err := os.ReadFile(fmt.Sprintf("%s/fan%d_input", hwmonPath, i))
			if err != nil {
				break
			}
			rpm, err := strconv.ParseFloat(strings.TrimSpace(string(inp)), 64)
			if err != nil {
				continue
			}
			label := fmt.Sprintf("fan%d", i)
			if lb, err := os.ReadFile(fmt.Sprintf("%s/fan%d_label", hwmonPath, i)); err == nil {
				label = strings.TrimSpace(string(lb))
			}
			readings = append(readings, SensorReading{Label: label, Kind: "fan", Value: rpm, Unit: "RPM"})
		}

		// Power (microwatts)
		for i := 1; i <= 8; i++ {
			inp, err := os.ReadFile(fmt.Sprintf("%s/power%d_input", hwmonPath, i))
			if err != nil {
				break
			}
			uw, err := strconv.ParseFloat(strings.TrimSpace(string(inp)), 64)
			if err != nil {
				continue
			}
			label := fmt.Sprintf("power%d", i)
			if lb, err := os.ReadFile(fmt.Sprintf("%s/power%d_label", hwmonPath, i)); err == nil {
				label = strings.TrimSpace(string(lb))
			}
			readings = append(readings, SensorReading{Label: label, Kind: "power", Value: uw / 1_000_000, Unit: "W"})
		}

		// Voltages (millivolts)
		for i := 0; i <= 16; i++ {
			inp, err := os.ReadFile(fmt.Sprintf("%s/in%d_input", hwmonPath, i))
			if err != nil {
				break
			}
			mv, err := strconv.ParseFloat(strings.TrimSpace(string(inp)), 64)
			if err != nil {
				continue
			}
			label := fmt.Sprintf("in%d", i)
			if lb, err := os.ReadFile(fmt.Sprintf("%s/in%d_label", hwmonPath, i)); err == nil {
				label = strings.TrimSpace(string(lb))
			}
			readings = append(readings, SensorReading{Label: label, Kind: "voltage", Value: mv / 1000, Unit: "V"})
		}

		if len(readings) > 0 {
			chips = append(chips, HwmonChip{Name: chipName, Path: hwmonPath, Sensors: readings})
		}
	}
	return chips
}

// cpuTempFromHwmon finds CPU temp from sensors already read.
func cpuTempFromHwmon(chips []HwmonChip) float64 {
	for _, chip := range chips {
		if strings.Contains(chip.Name, "coretemp") ||
			strings.Contains(chip.Name, "k10temp") ||
			strings.Contains(chip.Name, "zenpower") ||
			strings.Contains(chip.Name, "cpu_thermal") {
			for _, s := range chip.Sensors {
				if s.Kind == "temp" && (strings.Contains(strings.ToLower(s.Label), "package") ||
					strings.Contains(strings.ToLower(s.Label), "tctl") ||
					strings.Contains(strings.ToLower(s.Label), "core 0") ||
					s.Label == "temp1") {
					return s.Value
				}
			}
		}
	}
	// fallback: thermal_zone
	return readCPUTemp()
}

func cpuPowerFromHwmon(chips []HwmonChip) float64 {
	for _, chip := range chips {
		if strings.Contains(chip.Name, "rapl") || strings.Contains(chip.Name, "zenpower") {
			for _, s := range chip.Sensors {
				if s.Kind == "power" &&
					(strings.Contains(strings.ToLower(s.Label), "package") ||
						strings.Contains(strings.ToLower(s.Label), "power1")) {
					return s.Value
				}
			}
		}
	}
	return 0
}

// ── GPU ────────────────────────────────────────────────────────────────────

func readGPUs(chips []HwmonChip) []GPUInfo {
	var gpus []GPUInfo

	// NVIDIA via nvidia-smi
	nvidia := readNvidiaGPUs()
	gpus = append(gpus, nvidia...)

	// AMD via /sys/class/drm
	amd := readAMDGPUs(chips)
	gpus = append(gpus, amd...)

	// Intel via /sys/class/drm (basic)
	intel := readIntelGPUs()
	gpus = append(gpus, intel...)

	return gpus
}

func readNvidiaGPUs() []GPUInfo {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := kexec.Run(ctx, 3*time.Second, "nvidia-smi",
		"--query-gpu=name,utilization.gpu,utilization.encoder,utilization.decoder,memory.used,memory.total,temperature.gpu,power.draw",
		"--format=csv,noheader,nounits")
	if err != nil {
		return nil
	}
	var gpus []GPUInfo
	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		fields := strings.Split(line, ",")
		if len(fields) < 8 {
			continue
		}
		parseF := func(s string) float64 {
			v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
			return v
		}
		parseI := func(s string) int64 {
			v, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
			return v * 1024 * 1024 // MiB → bytes
		}
		gpus = append(gpus, GPUInfo{
			Name:       strings.TrimSpace(fields[0]),
			Driver:     "nvidia",
			UsagePct:   parseF(fields[1]),
			EncoderPct: parseF(fields[2]),
			DecoderPct: parseF(fields[3]),
			VRAMUsed:   parseI(fields[4]),
			VRAMTotal:  parseI(fields[5]),
			TempC:      parseF(fields[6]),
			PowerW:     parseF(fields[7]),
		})
	}
	return gpus
}

func readAMDGPUs(chips []HwmonChip) []GPUInfo {
	cards, _ := filepath.Glob("/sys/class/drm/card*/device/gpu_busy_percent")
	var gpus []GPUInfo
	for _, busyPath := range cards {
		base := filepath.Dir(busyPath)
		cardDir := filepath.Dir(base)
		cardName := filepath.Base(cardDir)

		busyData, err := os.ReadFile(busyPath)
		if err != nil {
			continue
		}
		usagePct, _ := strconv.ParseFloat(strings.TrimSpace(string(busyData)), 64)

		vramUsed := readInt64File(filepath.Join(base, "mem_info_vram_used"))
		vramTotal := readInt64File(filepath.Join(base, "mem_info_vram_total"))

		// GPU name from uevent
		name := "AMD GPU"
		if ue, err := os.ReadFile(filepath.Join(base, "uevent")); err == nil {
			for _, l := range strings.Split(string(ue), "\n") {
				if strings.HasPrefix(l, "PCI_ID=") {
					name = "AMD GPU (" + strings.TrimPrefix(l, "PCI_ID=") + ")"
					break
				}
			}
		}
		// Better: read from product name
		if pn, err := os.ReadFile(filepath.Join(base, "product_name")); err == nil {
			name = strings.TrimSpace(string(pn))
		}

		// Temp from amdgpu hwmon
		tempC := 0.0
		powerW := 0.0
		for _, chip := range chips {
			if chip.Name == "amdgpu" && strings.Contains(chip.Path, cardName[:4]) {
				for _, s := range chip.Sensors {
					if s.Kind == "temp" && tempC == 0 {
						tempC = s.Value
					}
					if s.Kind == "power" && powerW == 0 {
						powerW = s.Value
					}
				}
			}
		}

		gpus = append(gpus, GPUInfo{
			Name:      name,
			Driver:    "amd",
			UsagePct:  usagePct,
			VRAMUsed:  vramUsed,
			VRAMTotal: vramTotal,
			TempC:     tempC,
			PowerW:    powerW,
		})
	}
	return gpus
}

func readIntelGPUs() []GPUInfo {
	// Check for Intel GPU via i915
	cards, _ := filepath.Glob("/sys/class/drm/card*/device/driver/module/drivers/pci:i915")
	if len(cards) == 0 {
		return nil
	}
	// Intel doesn't expose usage easily without intel_gpu_top; return minimal
	return []GPUInfo{{Name: "Intel Integrated Graphics", Driver: "intel"}}
}

// ── Disk I/O ───────────────────────────────────────────────────────────────

func readDiskIO() []DiskInfo {
	f, err := os.Open("/proc/diskstats")
	if err != nil {
		return nil
	}
	defer f.Close()

	now := time.Now()
	type rawDisk struct {
		name         string
		readSectors  uint64
		writeSectors uint64
	}
	var raws []rawDisk

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 14 {
			continue
		}
		name := fields[2]
		// Skip partitions (sda1, nvme0n1p1, etc.) and loop/ram devices
		if isPartition(name) {
			continue
		}
		rs, _ := strconv.ParseUint(fields[5], 10, 64)
		ws, _ := strconv.ParseUint(fields[9], 10, 64)
		raws = append(raws, rawDisk{name: name, readSectors: rs, writeSectors: ws})
	}

	mounts := readMountPoints()

	prevDisksMu.Lock()
	defer prevDisksMu.Unlock()

	var disks []DiskInfo
	for _, rd := range raws {
		prev, hasPrev := prevDisks[rd.name]
		prevDisks[rd.name] = ioSample{read: rd.readSectors, write: rd.writeSectors, at: now}

		disk := DiskInfo{Name: rd.name}
		if hasPrev && !prev.at.IsZero() {
			dt := now.Sub(prev.at).Seconds()
			if dt > 0 {
				disk.ReadBps = float64(rd.readSectors-prev.read) * 512 / dt
				disk.WriteBps = float64(rd.writeSectors-prev.write) * 512 / dt
			}
		}

		// Filesystem usage via statfs on mount point
		if mp, ok := mounts[rd.name]; ok {
			disk.MountPoint = mp
			var stat syscall.Statfs_t
			if err := syscall.Statfs(mp, &stat); err == nil {
				disk.TotalBytes = int64(stat.Blocks) * stat.Bsize
				disk.FreeBytes  = int64(stat.Bavail) * stat.Bsize
				disk.UsedBytes  = disk.TotalBytes - int64(stat.Bfree)*stat.Bsize
			}
		} else {
			// Fallback: raw block device size
			disk.TotalBytes = readInt64File(fmt.Sprintf("/sys/block/%s/size", rd.name)) * 512
		}

		// NVMe temp from hwmon
		if strings.HasPrefix(rd.name, "nvme") {
			disk.TempC = readNVMeTemp(rd.name)
		}

		disks = append(disks, disk)
	}
	return disks
}

func isPartition(name string) bool {
	// sda1, sdb2, nvme0n1p1, mmcblk0p1
	for _, c := range name {
		if c >= '0' && c <= '9' {
			// check if it's a bare number at the end (partition) vs device number
			// nvme0n1 is a device; nvme0n1p1 is a partition
			if strings.Contains(name, "nvme") || strings.Contains(name, "mmcblk") {
				return strings.Contains(name, "p")
			}
			return true
		}
	}
	return false
}

func readNVMeTemp(nvmeName string) float64 {
	base := fmt.Sprintf("/sys/class/nvme/%s", nvmeName)
	entries, _ := filepath.Glob(base + "/hwmon*/temp*_input")
	for _, path := range entries {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		milli, _ := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
		if milli > 0 {
			return milli / 1000
		}
	}
	return 0
}

// ── Network ────────────────────────────────────────────────────────────────

func readNetIO() []NetIface {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return nil
	}
	defer f.Close()

	now := time.Now()
	type rawNet struct {
		name    string
		rxBytes uint64
		txBytes uint64
	}
	var raws []rawNet

	scanner := bufio.NewScanner(f)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		if lineNo <= 2 {
			continue // skip header
		}
		line := scanner.Text()
		colonIdx := strings.Index(line, ":")
		if colonIdx < 0 {
			continue
		}
		name := strings.TrimSpace(line[:colonIdx])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(line[colonIdx+1:])
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseUint(fields[0], 10, 64)
		tx, _ := strconv.ParseUint(fields[8], 10, 64)
		raws = append(raws, rawNet{name: name, rxBytes: rx, txBytes: tx})
	}

	prevNetMu.Lock()
	defer prevNetMu.Unlock()

	var ifaces []NetIface
	for _, rn := range raws {
		prev, hasPrev := prevNet[rn.name]
		prevNet[rn.name] = ioSample{read: rn.rxBytes, write: rn.txBytes, at: now}

		iface := NetIface{Name: rn.name}
		if hasPrev && !prev.at.IsZero() {
			dt := now.Sub(prev.at).Seconds()
			if dt > 0 {
				iface.RxBps = float64(rn.rxBytes-prev.read) / dt
				iface.TxBps = float64(rn.txBytes-prev.write) / dt
			}
		}
		ifaces = append(ifaces, iface)
	}
	return ifaces
}

// ── Helpers ────────────────────────────────────────────────────────────────

// readMountPoints returns a map from block device base name (e.g. "sda") to
// its primary mount point by reading /proc/mounts.
func readMountPoints() map[string]string {
	result := make(map[string]string)
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return result
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		dev, mount := fields[0], fields[1]
		if !strings.HasPrefix(dev, "/dev/") {
			continue
		}
		base := filepath.Base(dev)
		// Strip partition suffix to get device name: sda1→sda, nvme0n1p1→nvme0n1
		devName := base
		if strings.Contains(base, "nvme") || strings.Contains(base, "mmcblk") {
			if idx := strings.LastIndex(base, "p"); idx > 0 {
				devName = base[:idx]
			}
		} else {
			devName = strings.TrimRight(base, "0123456789")
			if devName == "" {
				devName = base
			}
		}
		// Keep first (lowest-numbered) mount per device
		if _, exists := result[devName]; !exists {
			result[devName] = mount
		}
	}
	return result
}

func readInt64File(path string) int64 {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	v, _ := strconv.ParseInt(strings.TrimSpace(string(data)), 10, 64)
	return v
}

// ── Handler ────────────────────────────────────────────────────────────────

func systemResources(w http.ResponseWriter, r *http.Request) {
	physCores, threads := readCPUCoreCount()
	cpuUsage, perCore := readPerCoreCPU()
	freqs := readCPUFreqMHz(threads)
	sensors := readHwmonSensors()
	mem := readFullMemInfo()
	disks := readDiskIO()
	nets := readNetIO()
	gpus := readGPUs(sensors)

	cpuTemp := cpuTempFromHwmon(sensors)
	cpuPower := cpuPowerFromHwmon(sensors)

	// Filter sensors: skip GPU/NVMe chips (shown in their own sections)
	var filteredSensors []HwmonChip
	for _, chip := range sensors {
		skip := chip.Name == "amdgpu" || chip.Name == "nvidia" ||
			strings.HasPrefix(chip.Name, "nvme")
		if !skip {
			filteredSensors = append(filteredSensors, chip)
		}
	}

	jsonOK(w, SystemResources{
		Timestamp: time.Now().Unix(),
		CPU: CPUInfo{
			Name:     readCPUName(),
			Cores:    physCores,
			Threads:  threads,
			UsagePct: cpuUsage,
			PerCore:  perCore,
			FreqMHz:  freqs,
			TempC:    cpuTemp,
			PowerW:   cpuPower,
		},
		Memory:  mem,
		GPUs:    gpus,
		Disks:   disks,
		Network: nets,
		Sensors: filteredSensors,
	})
}
