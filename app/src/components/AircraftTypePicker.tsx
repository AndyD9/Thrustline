import { useEffect, useRef, useState } from "react";
import { aircraftTypes, aircraftTypeByIcao, type AircraftType } from "@/data/aircraftTypes";

interface AircraftTypePickerProps {
  value: string;
  onChange: (icaoType: string, type: AircraftType | undefined) => void;
  label?: string;
  required?: boolean;
}

const MAX_RESULTS = 8;

function search(query: string): AircraftType[] {
  if (!query) return aircraftTypes.slice(0, MAX_RESULTS);
  const q = query.toLowerCase();
  return aircraftTypes
    .filter(
      (t) =>
        t.icaoType.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.manufacturer.toLowerCase().includes(q),
    )
    .slice(0, MAX_RESULTS);
}

export default function AircraftTypePicker({
  value,
  onChange,
  label,
  required,
}: AircraftTypePickerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AircraftType[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const resolved = aircraftTypeByIcao[value];

  function handleInputChange(raw: string) {
    const v = raw.toUpperCase();
    setQuery(v);
    const r = search(v);
    setResults(r);
    setOpen(r.length > 0);
    setHighlightIdx(0);
    if (v !== value) onChange(v, aircraftTypeByIcao[v]);
  }

  function select(t: AircraftType) {
    setQuery(t.icaoType);
    onChange(t.icaoType, t);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[highlightIdx]) {
      e.preventDefault();
      select(results[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-slate-400">
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="B738"
        required={required}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          const r = search(query);
          setResults(r);
          setOpen(r.length > 0);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm font-mono text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50"
      />

      {/* Resolved type info below input */}
      {resolved && !open && (
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          {resolved.manufacturer} {resolved.name} — {resolved.rangeNm} nm, {resolved.maxPaxEco}Y
          {resolved.maxPaxBiz > 0 ? ` + ${resolved.maxPaxBiz}J` : ""}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a0f18] shadow-xl shadow-black/40 backdrop-blur-xl">
          {results.map((t, i) => (
            <button
              key={t.icaoType}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(t)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                i === highlightIdx ? "bg-brand-500/10 text-white" : "text-slate-300 hover:bg-white/[0.04]"
              }`}
            >
              <span className="w-10 shrink-0 font-mono font-bold text-brand-400">{t.icaoType}</span>
              <span className="truncate">
                {t.manufacturer} {t.name}
              </span>
              <span className="ml-auto shrink-0 text-xs text-slate-600">
                {t.rangeNm} nm / {t.maxPaxEco}Y
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
