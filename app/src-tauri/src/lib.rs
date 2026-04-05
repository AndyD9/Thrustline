use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Spawns the C# sim-bridge sidecar at startup and forwards its stdout/stderr
/// to the Tauri process log (visible in `npm run tauri dev`).
///
/// The binary `sim-bridge` is bundled via `bundle.externalBin` in tauri.conf.json
/// and must be placed under `src-tauri/binaries/sim-bridge-<target-triple>.exe`
/// for dev builds. On macOS/Linux the Mock client is still used (no SimConnect).
fn spawn_sim_bridge(app: &tauri::AppHandle) {
    let shell = app.shell();
    match shell.sidecar("sim-bridge") {
        Ok(command) => match command.spawn() {
            Ok((mut rx, _child)) => {
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
            }
            Err(e) => eprintln!("Failed to spawn sim-bridge sidecar: {e}"),
        },
        Err(e) => eprintln!("Failed to resolve sim-bridge sidecar: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            spawn_sim_bridge(&app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
