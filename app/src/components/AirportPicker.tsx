import { useEffect, useRef, useState } from "react";
import { airports, airportByIcao, type Airport } from "@/data/airports";
import { MapPin } from "lucide-react";

interface AirportPickerProps {
  value: string;
  onChange: (icao: string) => void;
  placeholder?: string;
  required?: boolean;
  label?: string;
  /** Show icon prefix (MapPin) */
  icon?: boolean;
}

const MAX_RESULTS = 8;

function search(query: string): Airport[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const exact: Airport[] = [];
  const startsWith: Airport[] = [];
  const contains: Airport[] = [];

  for (const a of airports) {
    if (exact.length + startsWith.length + contains.length >= MAX_RESULTS * 3) break;
    const icaoL = a.icao.toLowerCase();
    const iataL = a.iata.toLowerCase();
    if (icaoL === q || iataL === q) {
      exact.push(a);
    } else if (icaoL.startsWith(q) || iataL.startsWith(q)) {
      startsWith.push(a);
    } else if (
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q)
    ) {
      contains.push(a);
    }
  }
  return [...exact, ...startsWith, ...contains].slice(0, MAX_RESULTS);
}

export default function AirportPicker({
  value,
  onChange,
  placeholder = "LFPG",
  required,
  label,
  icon,
}: AirportPickerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const resolved = airportByIcao[value];

  function handleInputChange(raw: string) {
    const v = raw.toUpperCase();
    setQuery(v);
    const r = search(v);
    setResults(r);
    setOpen(r.length > 0);
    setHighlightIdx(0);
    // If user cleared or typed partial, clear the parent value
    if (v !== value) onChange(v);
  }

  function select(airport: Airport) {
    setQuery(airport.icao);
    onChange(airport.icao);
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

  // Close on click outside
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
      <div className="relative">
        {icon && (
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          required={required}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query) {
              const r = search(query);
              setResults(r);
              setOpen(r.length > 0);
            }
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-xl border border-white/[0.08] bg-white/[0.03] ${icon ? "pl-10" : "px-3"} ${!icon ? "" : "pr-3"} py-2.5 text-sm font-mono text-slate-100 outline-none transition-all placeholder:text-slate-600 focus:border-brand-400/50`}
        />
      </div>

      {/* Resolved airport name below input */}
      {resolved && !open && (
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          {resolved.name}{resolved.city ? `, ${resolved.city}` : ""}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a0f18] shadow-xl shadow-black/40 backdrop-blur-xl">
          {results.map((a, i) => (
            <button
              key={a.icao}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(a)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                i === highlightIdx ? "bg-brand-500/10 text-white" : "text-slate-300 hover:bg-white/[0.04]"
              }`}
            >
              <span className="w-12 shrink-0 font-mono font-bold text-brand-400">{a.icao}</span>
              <span className="truncate">
                {a.name}
                {a.city && <span className="text-slate-500">, {a.city}</span>}
              </span>
              {a.iata && (
                <span className="ml-auto shrink-0 font-mono text-xs text-slate-600">{a.iata}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
