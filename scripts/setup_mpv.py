#!/usr/bin/env python3
"""Cross-platform libmpv dependency manager for Novus.

Manages, versions, and automatically downloads/stages verified libmpv
binaries for Windows and macOS.
Usage:
    pnpm setup:mpv
    python3 scripts/setup_mpv.py [--force]
"""

import argparse
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request

REPO_ROOT = Path(__file__).resolve().parent.parent
MPV_DESTINATION = REPO_ROOT / "src-tauri/bin/mpv"

# Pinned, tested releases for reproducible builds
CONFIG = {
    "windows": {
        "version": "20260927-git-a1bf4b6559",
        "url": "https://github.com/zhongfly/mpv-winbuild/releases/download/2026-09-27-a1bf4b6559/mpv-dev-x86_64-20260927-git-a1bf4b6559.7z",
        "binary": "libmpv-2.dll",
    },
    "macos": {
        "version": "v0.38.0",
        "binary": "libmpv.2.dylib",
    },
}


def log(message: str) -> None:
    print(f"[setup-mpv] {message}")


def setup_windows(force: bool = False) -> bool:
    target_dll = MPV_DESTINATION / CONFIG["windows"]["binary"]
    if target_dll.is_file() and not force:
        log(f"Windows libmpv binary already exists: {target_dll.name} (use --force to re-download)")
        return True

    url = CONFIG["windows"]["url"]
    version = CONFIG["windows"]["version"]
    log(f"Downloading Windows libmpv ({version}) from: {url}")

    MPV_DESTINATION.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="novus-mpv-win-") as tmp_dir:
        archive_path = Path(tmp_dir) / "mpv-dev.7z"
        log("Downloading archive...")
        urllib.request.urlretrieve(url, archive_path)

        log("Extracting libmpv-2.dll from archive...")
        # Use bsdtar or tar (native on macOS and modern Windows 10/11)
        extract_cmd = ["tar", "-C", tmp_dir, "-xf", str(archive_path), CONFIG["windows"]["binary"]]
        result = subprocess.run(extract_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            log(f"Failed to extract with tar: {result.stderr}")
            return False

        extracted_file = Path(tmp_dir) / CONFIG["windows"]["binary"]
        if not extracted_file.is_file():
            log(f"Extracted file not found: {CONFIG['windows']['binary']}")
            return False

        shutil.copy2(extracted_file, target_dll)
        log(f"Successfully staged Windows libmpv: {target_dll} ({target_dll.stat().st_size / (1024**2):.1f} MB)")
        return True


def setup_macos(force: bool = False) -> bool:
    target_dylib = MPV_DESTINATION / CONFIG["macos"]["binary"]
    if target_dylib.is_file() and not force:
        log(f"macOS libmpv dylib set already exists: {target_dylib.name} (use --force to restage)")
        return True

    log("macOS libmpv staging:")
    # Check if stage_mpv_macos.py can locate Homebrew or local dylib
    candidates = [
        Path("/opt/homebrew/lib/libmpv.dylib"),
        Path("/usr/local/lib/libmpv.dylib"),
    ]
    found_source = next((p for p in candidates if p.is_file()), None)

    if found_source:
        log(f"Found host libmpv at {found_source}. Running staging script...")
        cmd = [sys.executable, str(REPO_ROOT / "scripts/stage_mpv_macos.py"), str(found_source)]
        res = subprocess.run(cmd)
        return res.returncode == 0
    else:
        if target_dylib.is_file():
            log("Host Homebrew libmpv not found, but pre-staged dylib exists. Keeping current setup.")
            return True
        log(
            "Notice: Host libmpv not found in Homebrew paths (/opt/homebrew/lib or /usr/local/lib).\n"
            "To build macOS native mpv runtime, install via: brew install mpv\n"
            "Then rerun: pnpm setup:mpv"
        )
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage libmpv native binaries for Novus")
    parser.add_argument("--force", action="store_true", help="Force re-download / re-stage")
    parser.add_argument("--target", choices=["windows", "macos", "all", "current"], default="current")
    args = parser.parse_args()

    current_os = platform.system().lower()
    target = args.target

    if target == "current":
        target = "windows" if current_os == "windows" else "macos"

    success = True
    if target in ("windows", "all"):
        success = setup_windows(force=args.force) and success
    if target in ("macos", "all"):
        success = setup_macos(force=args.force) and success

    if success:
        log("libmpv setup completed successfully.")
        return 0
    else:
        log("libmpv setup finished with warnings or errors.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
