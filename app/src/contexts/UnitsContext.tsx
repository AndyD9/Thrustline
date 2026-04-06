import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getFormatters, type UnitSystem, type UnitFormatters } from "@/lib/units";

const STORAGE_KEY = "thrustline-units";

function loadSystem(): UnitSystem {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "metric" || stored === "imperial") return stored;
  } catch { /* noop */ }
  return "imperial";
}

interface UnitsContextValue {
  system: UnitSystem;
  fmt: UnitFormatters;
  setSystem: (s: UnitSystem) => void;
}

const UnitsContext = createContext<UnitsContextValue>({
  system: "imperial",
  fmt: getFormatters("imperial"),
  setSystem: () => {},
});

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [system, setSystemState] = useState<UnitSystem>(loadSystem);
  const fmt = getFormatters(system);

  const setSystem = useCallback((s: UnitSystem) => {
    setSystemState(s);
    try { localStorage.setItem(STORAGE_KEY, s); } catch { /* noop */ }
  }, []);

  return (
    <UnitsContext.Provider value={{ system, fmt, setSystem }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}
