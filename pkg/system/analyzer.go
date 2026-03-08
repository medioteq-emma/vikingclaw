package system

import (
	"bufio"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// HardwareSpecs contains detected hardware information.
type HardwareSpecs struct {
	OS          string  `json:"os"`
	Arch        string  `json:"arch"`
	CPUModel    string  `json:"cpu_model"`
	CPUCores    int     `json:"cpu_cores"`
	CPUThreads  int     `json:"cpu_threads"`
	RAMGB       float64 `json:"ram_gb"`
	RAMFreeGB   float64 `json:"ram_free_gb"`
	DiskFreeGB  float64 `json:"disk_free_gb"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	HasGPU      bool    `json:"has_gpu"`
	GPUModel    string  `json:"gpu_model,omitempty"`
	GPUVRAMGB   float64 `json:"gpu_vram_gb,omitempty"`
	IsWSL       bool    `json:"is_wsl"`
	Tier        string  `json:"tier"` // "low" | "mid" | "high" | "ultra"
}

// GetSpecs detects and returns hardware specs.
func GetSpecs() HardwareSpecs {
	specs := HardwareSpecs{
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
		CPUCores:   runtime.NumCPU(),
		CPUThreads: runtime.NumCPU(),
		IsWSL:      isWSL(),
	}
	specs.RAMGB = getRAMGB()
	specs.RAMFreeGB = getRAMFreeGB()
	specs.DiskFreeGB, specs.DiskTotalGB = getDiskGB()
	specs.CPUModel = getCPUModel()
	specs.HasGPU, specs.GPUModel, specs.GPUVRAMGB = getGPUInfo()
	specs.Tier = calcTier(specs)
	return specs
}

func isWSL() bool {
	data, err := os.ReadFile("/proc/version")
	if err != nil {
		return false
	}
	lower := strings.ToLower(string(data))
	return strings.Contains(lower, "microsoft") || strings.Contains(lower, "wsl")
}

func getRAMGB() float64 {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 8
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				kb, _ := strconv.ParseFloat(fields[1], 64)
				return kb / 1024 / 1024
			}
		}
	}
	return 8
}

func getRAMFreeGB() float64 {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				kb, _ := strconv.ParseFloat(fields[1], 64)
				return kb / 1024 / 1024
			}
		}
	}
	return 0
}

func getDiskGB() (free, total float64) {
	out, err := exec.Command("df", "-B1", "/mnt/c").Output()
	if err != nil {
		out, err = exec.Command("df", "-B1", "/").Output()
		if err != nil {
			return 50, 100
		}
	}
	lines := strings.Split(string(out), "\n")
	if len(lines) < 2 {
		return 50, 100
	}
	fields := strings.Fields(lines[1])
	if len(fields) >= 4 {
		tot, _ := strconv.ParseFloat(fields[1], 64)
		avail, _ := strconv.ParseFloat(fields[3], 64)
		return avail / 1e9, tot / 1e9
	}
	return 50, 100
}

func getCPUModel() string {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return "Unknown CPU"
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
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

func getGPUInfo() (has bool, model string, vramGB float64) {
	// Try nvidia-smi
	out, err := exec.Command("nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader").Output()
	if err == nil && len(out) > 0 {
		parts := strings.Split(strings.TrimSpace(string(out)), ",")
		if len(parts) >= 2 {
			name := strings.TrimSpace(parts[0])
			memStr := strings.TrimSpace(parts[1])
			memStr = strings.ReplaceAll(memStr, " MiB", "")
			mem, _ := strconv.ParseFloat(memStr, 64)
			return true, name, mem / 1024
		}
	}
	// Try lspci for AMD
	out, err = exec.Command("lspci").Output()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			lower := strings.ToLower(line)
			if strings.Contains(lower, "vga") || strings.Contains(lower, "3d") {
				if strings.Contains(lower, "radeon") || strings.Contains(lower, "amd") {
					return true, line, 0
				}
			}
		}
	}
	return false, "", 0
}

func calcTier(s HardwareSpecs) string {
	switch {
	case s.RAMGB >= 64 || s.GPUVRAMGB >= 24:
		return "ultra"
	case s.RAMGB >= 32 || s.GPUVRAMGB >= 12:
		return "high"
	case s.RAMGB >= 16 || s.GPUVRAMGB >= 8:
		return "mid"
	default:
		return "low"
	}
}
