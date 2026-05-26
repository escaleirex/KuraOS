import re
import os
import glob

# Map remaining rgba values (shorter notation like 0.1 instead of 0.10)
REPLACEMENTS = {
    "rgba(255,255,255,0.9)": "var(--kura-alpha-90)",
    "rgba(255,255,255,0.5)": "var(--kura-alpha-50)",
    "rgba(255,255,255,0.4)": "var(--kura-alpha-40)",
    "rgba(255,255,255,0.3)": "var(--kura-alpha-30)",
    "rgba(255,255,255,0.2)": "var(--kura-alpha-20)",
    "rgba(255,255,255,0.1)": "var(--kura-alpha-10)",
    "rgba(255,255,255,0.13)": "var(--kura-alpha-13)",
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

print(f"Modified {total} files (second pass).")
