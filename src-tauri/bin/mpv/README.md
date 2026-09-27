# Native video runtime staging area

Place the platform's `libmpv` binary and all non-system runtime dependencies here before bundling. Binary files are ignored by Git. For macOS development, run `scripts/stage-mpv-macos.sh /path/to/Frameworks` from the repository root. Redistribution requires review of each included library's license and a signed release build.
