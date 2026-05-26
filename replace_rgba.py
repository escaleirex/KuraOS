import re
import os
import glob

# Map of rgba values to CSS variables
REPLACEMENTS = {
    "rgba(255,255,255,0.90)": "var(--kura-alpha-90)",
    "rgba(255,255,255,0.85)": "var(--kura-alpha-85)",
    "rgba(255,255,255,0.80)": "var(--kura-alpha-80)",
    "rgba(255,255,255,0.75)": "var(--kura-alpha-75)",
    "rgba(255,255,255,0.70)": "var(--kura-alpha-70)",
    "rgba(255,255,255,0.65)": "var(--kura-alpha-65)",
    "rgba(255,255,255,0.60)": "var(--kura-alpha-60)",
    "rgba(255,255,255,0.55)": "var(--kura-alpha-55)",
    "rgba(255,255,255,0.50)": "var(--kura-alpha-50)",
    "rgba(255,255,255,0.45)": "var(--kura-alpha-45)",
    "rgba(255,255,255,0.40)": "var(--kura-alpha-40)",
    "rgba(255,255,255,0.35)": "var(--kura-alpha-35)",
    "rgba(255,255,255,0.30)": "var(--kura-alpha-30)",
    "rgba(255,255,255,0.25)": "var(--kura-alpha-25)",
    "rgba(255,255,255,0.20)": "var(--kura-alpha-20)",
    "rgba(255,255,255,0.15)": "var(--kura-alpha-15)",
    "rgba(255,255,255,0.12)": "var(--kura-alpha-12)",
    "rgba(255,255,255,0.10)": "var(--kura-alpha-10)",
    "rgba(255,255,255,0.09)": "var(--kura-alpha-09)",
    "rgba(255,255,255,0.08)": "var(--kura-alpha-08)",
    "rgba(255,255,255,0.07)": "var(--kura-alpha-07)",
    "rgba(255,255,255,0.06)": "var(--kura-alpha-06)",
    "rgba(255,255,255,0.05)": "var(--kura-alpha-05)",
    "rgba(255,255,255,0.04)": "var(--kura-alpha-04)",
    "rgba(255,255,255,0.03)": "var(--kura-alpha-03)",
    "rgba(255,255,255,0.02)": "var(--kura-alpha-02)",
    "rgba(255,255,255,0.01)": "var(--kura-alpha-01)",
}

BASE_DIR = "frontend/src"
extensions = ("tsx", "ts", "css")

total = 0
for ext in extensions:
    for filepath in glob.glob(f"{BASE_DIR}/**/*.{ext}", recursive=True):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        original = content
        for old, new in REPLACEMENTS.items():
            content = content.replace(old, new)
        if content != original:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            total += 1

print(f"Modified {total} files.")
