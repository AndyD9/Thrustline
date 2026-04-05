import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/flights",   label: "Flights",   icon: "✈️" },
  { to: "/dispatch",  label: "Dispatch",  icon: "📋" },
  { to: "/fleet",     label: "Fleet",     icon: "🛩️" },
  { to: "/crew",      label: "Crew",      icon: "👨‍✈️" },
  { to: "/finances",  label: "Finances",  icon: "💰" },
  { to: "/settings",  label: "Settings",  icon: "⚙️" },
] as const;

export function Sidebar() {
  const { user, signOut } = useAuth();

  return (
    <aside className="glass-strong m-3 flex w-56 flex-col px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
          <span className="text-lg">✈</span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide">Thrustline</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Virtual Airline
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-4 text-xs">
        <div className="truncate text-slate-400">{user?.email}</div>
        <button
          onClick={() => void signOut()}
          className="mt-2 text-slate-500 hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
