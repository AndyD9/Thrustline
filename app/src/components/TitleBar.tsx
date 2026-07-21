import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

const appWindow = getCurrentWindow();

export function TitleBar() {
  return (
    <header
      data-tauri-drag-region
      className="flex h-8 shrink-0 select-none items-center border-b border-white/[0.06] bg-[#202020] text-slate-400"
      onDoubleClick={() => void appWindow.toggleMaximize()}
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2 px-2">
        <img src="/favicon.png" alt="" className="h-4 w-4 object-contain" draggable={false} />
        <span data-tauri-drag-region className="truncate text-[11px] font-medium">
          Thrustline
        </span>
      </div>

      <div className="flex h-full" onDoubleClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="flex h-full w-12 items-center justify-center transition-colors hover:bg-white/[0.08] hover:text-slate-100"
          onClick={() => void appWindow.minimize()}
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="flex h-full w-12 items-center justify-center transition-colors hover:bg-white/[0.08] hover:text-slate-100"
          onClick={() => void appWindow.toggleMaximize()}
          aria-label="Maximize or restore"
        >
          <Square className="h-3 w-3" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="flex h-full w-12 items-center justify-center transition-colors hover:bg-red-600 hover:text-white"
          onClick={() => void appWindow.close()}
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
