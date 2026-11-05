fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        // Tauri 2.12 imports TaskDialogIndirect from Common Controls v6.
        // tauri-build embeds the app manifest for binaries; lib unit-test EXEs
        // also need this activation context to start on Windows.
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        // The app binary already gets manifest resource #1 from tauri-build.
        // Do not generate a second resource for binaries; lib test EXEs still
        // use the linker-generated manifest above.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
    }
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        use std::path::PathBuf;
        use std::process::Command;

        let output_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR is set"));
        let object = output_dir.join("macos_video_view.o");
        let archive = output_dir.join("libnovus_macos_video_view.a");
        let source = "native/macos_video_view.m";
        println!("cargo:rerun-if-changed={source}");

        let status = Command::new("clang")
            .args(["-c", "-fno-objc-arc", source, "-o"])
            .arg(&object)
            .status()
            .expect("clang is needed for the macOS video surface");
        assert!(status.success(), "Could not compile macOS video surface");
        let status = Command::new("ar")
            .arg("crs")
            .arg(&archive)
            .arg(&object)
            .status()
            .expect("ar is needed for the macOS video surface");
        assert!(status.success(), "Could not archive macOS video surface");

        println!("cargo:rustc-link-search=native={}", output_dir.display());
        println!("cargo:rustc-link-lib=static=novus_macos_video_view");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }
    tauri_build::build()
}
