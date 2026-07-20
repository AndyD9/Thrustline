use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const DISCORD_APPLICATION_ID: &str = "1528802892881068082";

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

#[derive(Clone, PartialEq)]
struct DiscordActivity {
    details: String,
    state: String,
}

/// Keeps Discord Rich Presence alive for the lifetime of the desktop app.
/// The worker retries periodically so starting Discord after Thrustline also works.
struct DiscordPresence {
    stop: Arc<AtomicBool>,
    activity: Arc<Mutex<DiscordActivity>>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl DiscordPresence {
    fn start() -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let activity = Arc::new(Mutex::new(DiscordActivity {
            details: "Managing a virtual airline".into(),
            state: "In Thrustline".into(),
        }));
        let worker_stop = Arc::clone(&stop);
        let worker_activity = Arc::clone(&activity);
        let worker = std::thread::spawn(move || {
            while !worker_stop.load(Ordering::Relaxed) {
                let mut client = DiscordIpcClient::new(DISCORD_APPLICATION_ID);

                match client.connect() {
                    Ok(()) => {
                        let mut published: Option<DiscordActivity> = None;
                        println!("[discord] rich presence connected");

                        while !worker_stop.load(Ordering::Relaxed) {
                            let desired = match worker_activity.lock() {
                                Ok(activity) => activity.clone(),
                                Err(_) => break,
                            };

                            if published.as_ref() != Some(&desired) {
                                let presence = activity::Activity::new()
                                    .details(&desired.details)
                                    .state(&desired.state);
                                if let Err(error) = client.set_activity(presence) {
                                    eprintln!("[discord] failed to update activity: {error}");
                                    break;
                                }
                                published = Some(desired);
                            }

                            std::thread::sleep(Duration::from_secs(1));
                        }

                        let _ = client.clear_activity();
                        let _ = client.close();
                        if worker_stop.load(Ordering::Relaxed) {
                            break;
                        }
                    }
                    Err(error) => {
                        eprintln!("[discord] client unavailable, retrying: {error}");
                    }
                }

                for _ in 0..5 {
                    if worker_stop.load(Ordering::Relaxed) {
                        return;
                    }
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
        });

        Self {
            stop,
            activity,
            worker: Mutex::new(Some(worker)),
        }
    }

    fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
    }
}

#[tauri::command]
fn update_discord_presence(
    presence: tauri::State<'_, DiscordPresence>,
    details: String,
    state: String,
) {
    if let Ok(mut activity) = presence.activity.lock() {
        *activity = DiscordActivity { details, state };
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![update_discord_presence])
        .setup(|app| {
            spawn_sim_bridge(&app.handle());
            app.manage(DiscordPresence::start());
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
                if let Some(presence) = window.try_state::<DiscordPresence>() {
                    presence.stop();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
