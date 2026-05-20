package api

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// cpuSample holds raw /proc/stat values for delta calculation.
type cpuSample struct {
	total float64
	idle  float64
	at    time.Time
}

var (
	prevCPU   cpuSample
	prevCPUMu sync.Mutex
)

// readCPUPercent reads /proc/stat and returns CPU usage % since last call.
func readCPUPercent() (float64, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			break
		}
		vals := make([]float64, len(fields)-1)
		for i, s := range fields[1:] {
			vals[i], _ = strconv.ParseFloat(s, 64)
		}
		// user nice system idle iowait irq softirq steal guest guest_nice
		idle  := vals[3] + vals[4] // idle + iowait
		total := 0.0
		for _, v := range vals {
			total += v
		}

		prevCPUMu.Lock()
		prev := prevCPU
		prevCPU = cpuSample{total: total, idle: idle, at: time.Now()}
		prevCPUMu.Unlock()

		if prev.at.IsZero() || total == prev.total {
			return 0, nil
		}
		dTotal := total - prev.total
		dIdle  := idle  - prev.idle
		pct := (1 - dIdle/dTotal) * 100
		if pct < 0 {
			pct = 0
		}
		return pct, nil
	}
	return 0, fmt.Errorf("cpu line not found in /proc/stat")
}

// readMemInfo reads /proc/meminfo and returns total/available bytes.
func readMemInfo() (total, available int64, err error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		kb, _ := strconv.ParseInt(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:":
			total = kb * 1024
		case "MemAvailable:":
			available = kb * 1024
		}
		if total > 0 && available > 0 {
			break
		}
	}
	if total == 0 {
		return 0, 0, fmt.Errorf("MemTotal not found")
	}
	return total, available, nil
}

// readCPUTemp reads the first available hwmon/thermal_zone temperature.
func readCPUTemp() float64 {
	// Try thermal_zone0 first
	for i := 0; i < 8; i++ {
		data, err := os.ReadFile(fmt.Sprintf("/sys/class/thermal/thermal_zone%d/temp", i))
		if err != nil {
			continue
		}
		milli, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
		if err != nil || milli <= 0 {
			continue
		}
		return milli / 1000
	}
	return 0
}

func systemMetrics(w http.ResponseWriter, r *http.Request) {
	cpuPct, _ := readCPUPercent()
	memTotal, memAvail, _ := readMemInfo()
	memUsed := memTotal - memAvail
	temp := readCPUTemp()

	resp := map[string]any{
		"timestamp": time.Now().Unix(),
		"cpu_pct":   cpuPct,
		"mem_total": memTotal,
		"mem_used":  memUsed,
	}
	if temp > 0 {
		resp["cpu_temp"] = temp
	}
	jsonOK(w, resp)
}
