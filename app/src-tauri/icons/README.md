# Icons

The Tauri bundler expects the following files to exist here before `cargo tauri build`:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Generate them from a single source PNG (preferably 1024×1024) with:

```bash
cargo tauri icon path/to/logo.png
```

They are **.gitignored** so every contributor can drop their own working set without
polluting the repo. For `npm run tauri dev` a warning will be shown if icons are
missing but the app should still launch.
