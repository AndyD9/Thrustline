use std::{env, fs, path::PathBuf};

fn main() {
    tauri_build::build();
    copy_sidecar_deps();
}

/// Tauri's `externalBin` copies only the sidecar **.exe** to the Cargo target
/// directory.  The .NET apphost (`sim-bridge.exe`) also needs its managed
/// assembly (`sim-bridge.dll`), runtime config, deps manifest, and all
/// framework / third-party DLLs next to it.
///
/// This function copies every non-exe file from `src-tauri/binaries/` into the
/// same target directory so the sidecar can boot at `cargo tauri dev` time.
fn copy_sidecar_deps() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let binaries_dir = manifest_dir.join("binaries");

    if !binaries_dir.exists() {
        return;
    }

    // OUT_DIR is e.g. target/debug/build/<crate-hash>/out — go up 3 levels to
    // reach the profile directory (target/debug/ or target/release/).
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("could not derive target dir from OUT_DIR");

    println!("cargo:rerun-if-changed=binaries");

    let Ok(entries) = fs::read_dir(&binaries_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        // Skip .exe files — Tauri already handles copying the sidecar executable.
        if path.extension().and_then(|e| e.to_str()) == Some("exe") {
            continue;
        }
        let dest = target_dir.join(path.file_name().unwrap());
        let _ = fs::copy(&path, &dest);
    }
}
