use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Spawns the C# sim-bridge sidecar at startup and forwards its stdout/stderr
/// to the Tauri process log (visible in `npm run tauri dev`).
///
/// The binary `sim-bridge` is bundled via `bundle.externalBin` in tauri.conf.json
/// and must be placed under `src-tauri/binaries/sim-bridge-<target-triple>.exe`
/// for dev builds (run `scripts/build-sidecar.ps1` first).
///
/// On macOS/Linux the binary may not exist — the sidecar silently fails to spawn
/// and the front falls back to its "sim-bridge offline" banner.
fn spawn_sim_bridge(app: &tauri::AppHandle) {
    let shell = app.shell();
    let command = match shell.sidecar("sim-bridge") {
        Ok(cmd) => cmd,
        Err(e) => {
            eprintln!("[sim-bridge] sidecar binary not found (run scripts/build-sidecar.ps1): {e}");
            return;
        }
    };

    match command.spawn() {
        Ok((mut rx, child)) => {
            // Store child handle so we can kill it on app exit
            app.manage(SidecarChild(std::sync::Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[sim-bridge] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sim-bridge] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!(
                                "[sim-bridge] terminated (code={:?}, signal={:?})",
                                payload.code, payload.signal
                            );
                            break;
                        }
                        _ => {}
                    }
                }
            });
            println!("[sim-bridge] sidecar spawned successfully");
        }
        Err(e) => eprintln!("[sim-bridge] failed to spawn: {e}"),
    }
}

/// Holds the sidecar child process so we can kill it on app close.
struct SidecarChild(std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            spawn_sim_bridge(&app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill sidecar when main window is destroyed (app close)
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<SidecarChild>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                            println!("[sim-bridge] sidecar killed on window close");
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
