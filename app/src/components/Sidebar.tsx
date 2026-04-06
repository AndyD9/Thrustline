import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSim } from "@/contexts/SimContext";
import {
  LayoutDashboard,
  Plane,
  ClipboardList,
  Warehouse,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Map,
  TrendingUp,
  Trophy,
  BookOpen,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  pulse?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { to: "/flights",      label: "Flights",      icon: Plane },
  { to: "/dispatch",     label: "Dispatch",     icon: ClipboardList },
  { to: "/fleet",        label: "Fleet",        icon: Warehouse },
  { to: "/crew",         label: "Crew",         icon: Users },
  { to: "/company",      label: "Company",      icon: Building2 },
  { to: "/routes",       label: "Routes",       icon: TrendingUp },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/efb",          label: "EFB",          icon: BookOpen },
  { to: "/finances",     label: "Finances",     icon: DollarSign },
  { to: "/settings",     label: "Settings",     icon: Settings },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { lastTakeoff, lastLanding, simActive } = useSim();
  const location = useLocation();

  // Show "Live Flight" link when a flight is in progress
  const flightInProgress = simActive && lastTakeoff && !lastLanding;
  const navItems: NavItem[] = flightInProgress
    ? [{ to: "/live-flight", label: "Live Flight", icon: Map, pulse: true }, ...NAV]
    : NAV;

  return (
    <aside className="m-3 flex w-60 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-4 py-5">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 glow-brand-sm">
          <Plane className="h-5 w-5 text-brand-300" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-white">Thrustline</div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Virtual Airline
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-brand-500/10 text-brand-300 glow-brand-sm"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_8px_oklch(0.66_0.18_195)]" />
              )}
              <Icon
                className={`h-[18px] w-[18px] transition-colors ${
                  isActive ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
                } ${item.pulse ? "animate-pulse text-brand-300" : ""}`}
              />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-300">
            {user?.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs text-slate-300">{user?.email}</div>
          </div>
          <button
            onClick={() => void signOut()}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
