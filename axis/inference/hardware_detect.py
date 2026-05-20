"""Hardware capability detection for inference backend selection.

Score:
  0 = CPU only (Ollama CPU inference)
  1 = Intel iGPU (OpenVINO / IPEX acceleration)
  2 = NVIDIA dGPU or Intel Arc (CUDA / SYCL)
  3 = High-end dGPU with 16 GB+ VRAM
"""
import asyncio
import subprocess
import re
from pathlib import Path

_capability_score: int = 0


async def detect_and_cache() -> int:
    global _capability_score
    _capability_score = await asyncio.to_thread(_detect)
    return _capability_score


def get_capability_score() -> int:
    return _capability_score


def _detect() -> int:
    score = 0

    # Check for NVIDIA GPU via nvidia-smi
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            vram_mb = sum(int(v.strip()) for v in result.stdout.strip().splitlines() if v.strip().isdigit())
            score = 3 if vram_mb >= 16000 else 2
            return score
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Check for Intel GPU via /sys/class/drm
    drm = Path("/sys/class/drm")
    if drm.exists():
        for card in drm.iterdir():
            vendor_path = card / "device" / "vendor"
            if vendor_path.exists():
                vendor = vendor_path.read_text().strip()
                if vendor == "0x8086":  # Intel
                    score = max(score, 1)
                    # Check if Arc (dedicated) via PCI device ID range
                    device_path = card / "device" / "device"
                    if device_path.exists():
                        dev_id = int(device_path.read_text().strip(), 16)
                        if 0x5690 <= dev_id <= 0x5699:  # Arc A-series
                            score = max(score, 2)

    # Check for Intel NPU (AI Boost) via /dev/accel
    accel = Path("/dev/accel")
    if accel.exists() and any(accel.iterdir()):
        score = max(score, 2)

    return score


def get_hardware_info() -> dict:
    """Return a human-readable summary of detected hardware."""
    info: dict = {"score": _capability_score, "gpus": [], "npu": False}

    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            for line in result.stdout.strip().splitlines():
                name, vram = line.split(",", 1)
                info["gpus"].append({"type": "nvidia", "name": name.strip(), "vram_mb": vram.strip()})
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    if Path("/dev/accel").exists():
        info["npu"] = True

    return info
