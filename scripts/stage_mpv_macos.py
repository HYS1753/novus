#!/usr/bin/env python3
"""Stage a self-contained macOS libmpv dylib set for the Novus app bundle."""

import ctypes
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile


REPO = Path(__file__).resolve().parent.parent
DESTINATION = REPO / "src-tauri/bin/mpv"
SYSTEM_PREFIXES = ("/System/Library/", "/usr/lib/")


def run(*arguments: str) -> str:
    return subprocess.check_output(arguments, text=True, stderr=subprocess.STDOUT)


def dependencies(library: Path) -> list[str]:
    output = run("otool", "-L", "-arch", platform.machine(), str(library))
    # The first entry is the dylib's own install name, not a dependency.
    return [
        match.group(1)
        for line in output.splitlines()[2:]
        if (match := re.match(r"\s*(.+?)\s+\(compatibility version", line))
    ]


def resolve_dependency(name: str, parent: Path, source_directory: Path) -> Path:
    if name.startswith("@loader_path/"):
        candidate = parent.parent / name.removeprefix("@loader_path/")
        if candidate.is_file():
            return candidate
    if name.startswith("/"):
        candidate = Path(name)
        if candidate.is_file():
            return candidate
    basename = Path(name).name
    for directory in (
        parent.parent,
        source_directory,
        Path("/opt/homebrew/lib"),
        Path("/usr/local/lib"),
    ):
        candidate = directory / basename
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Dependency {name} required by {parent} was not found")


def stage(source: Path) -> None:
    source_directory = source if source.is_dir() else source.parent
    if source.is_dir():
        source = next(
            (source / name for name in ("libmpv.2.dylib", "libmpv.dylib") if (source / name).is_file()),
            None,
        )
        if source is None:
            raise FileNotFoundError("Source directory does not contain libmpv")
    if not source.is_file():
        raise FileNotFoundError(source)

    with tempfile.TemporaryDirectory(prefix="novus-mpv-") as temporary:
        staging = Path(temporary)
        pending = [(source, source.name)]
        visited: dict[str, Path] = {}
        references: dict[str, list[str]] = {}

        while pending:
            original, name = pending.pop()
            if name in visited:
                if visited[name].resolve() != original.resolve():
                    raise RuntimeError(f"Conflicting dependency filename: {name}")
                continue
            visited[name] = original
            target = staging / name
            shutil.copy2(original, target, follow_symlinks=True)
            target.chmod(target.stat().st_mode | 0o200)
            references[name] = dependencies(original)
            for dependency in references[name]:
                if dependency.startswith(SYSTEM_PREFIXES):
                    continue
                resolved = resolve_dependency(dependency, original, source_directory)
                pending.append((resolved, Path(dependency).name))

        for name, dependency_names in references.items():
            target = staging / name
            for dependency in dependency_names:
                if dependency.startswith(SYSTEM_PREFIXES):
                    continue
                run(
                    "install_name_tool",
                    "-change",
                    dependency,
                    f"@loader_path/{Path(dependency).name}",
                    str(target),
                )
            run("install_name_tool", "-id", f"@rpath/{name}", str(target))
            run("codesign", "--force", "--sign", "-", str(target))

        mpv = staging / source.name
        ctypes.CDLL(str(mpv))
        DESTINATION.mkdir(parents=True, exist_ok=True)
        for library in staging.iterdir():
            shutil.copy2(library, DESTINATION / library.name)
        print(f"Staged {len(visited)} validated dylibs in {DESTINATION}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: scripts/stage-mpv-macos.sh /path/to/libmpv.dylib-or-directory", file=sys.stderr)
        sys.exit(2)
    try:
        stage(Path(sys.argv[1]).expanduser())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"macOS libmpv staging failed: {error}", file=sys.stderr)
        sys.exit(1)
