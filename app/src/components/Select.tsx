import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

/**
 * Custom Select dropdown matching the Thrustline glass design system.
 * Replaces native <select> for consistent dark UI.
 */
export function Select({ value, onChange, options, placeholder = "Select...", className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm outline-none transition-all ${
          open
            ? "border-brand-400/50 bg-white/[0.04]"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
        }`}
      >
        <span className={selected ? "text-slate-100" : "text-slate-500"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0a1018]/98 py-1 shadow-xl shadow-black/40 backdrop-blur-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No options</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-brand-500/10 text-brand-300"
                      : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-400" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
