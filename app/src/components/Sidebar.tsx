import { useEffect, useState } from "react";
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
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const DASHBOARD: NavItem = { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Operations",
    items: [
      { to: "/dispatch", label: "Dispatch", icon: ClipboardList },
      { to: "/flights", label: "Flights", icon: Plane },
      { to: "/schedule", label: "Schedule", icon: CalendarDays },
      { to: "/routes", label: "Routes", icon: TrendingUp },
    ],
  },
  {
    label: "Company",
    items: [
      { to: "/fleet", label: "Fleet", icon: Warehouse },
      { to: "/crew", label: "Crew", icon: Users },
      { to: "/finances", label: "Finances", icon: DollarSign },
      { to: "/company", label: "Company", icon: Building2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/efb", label: "EFB", icon: BookOpen },
      { to: "/achievements", label: "Achievements", icon: Trophy },
    ],
  },
];

const COLLAPSED_STORAGE_KEY = "thrustline.sidebar.collapsed";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { lastTakeoff, lastLanding, simActive } = useSim();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true",
  );

  const flightInProgress = Boolean(simActive && lastTakeoff && !lastLanding);

  useEffect(() => {
    onMobileClose();
  }, [location.pathname, onMobileClose]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  function renderItem(item: NavItem, live = false) {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `group relative flex min-h-10 items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
            collapsed ? "gap-3 px-3 lg:justify-center lg:gap-0 lg:px-2" : "gap-3 px-3"
          } ${
            isActive
              ? "bg-brand-500/10 text-brand-300 glow-brand-sm"
              : live
                ? "text-brand-300 hover:bg-brand-500/[0.08]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_8px_oklch(0.66_0.18_195)]" />
            )}
            <Icon
              className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                isActive || live ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
              } ${live ? "animate-pulse" : ""}`}
            />
            <span className={collapsed ? "lg:hidden" : undefined}>{item.label}</span>
            {live && <span className={`ml-auto h-1.5 w-1.5 rounded-full bg-brand-300 ${collapsed ? "lg:hidden" : ""}`} />}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-50 m-3 flex flex-col rounded-2xl border border-white/[0.06] bg-surface-0/95 px-4 py-5 shadow-2xl backdrop-blur-xl transition-[width,transform] duration-200 lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:bg-white/[0.02] lg:shadow-none ${
        mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"
      } ${collapsed ? "lg:w-20" : "w-60 lg:w-60"}`}
    >
      <button
        type="button"
        onClick={onMobileClose}
        className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"
        aria-label="Close navigation"
      >
        <X className="h-4 w-4" />
      </button>

      <div className={`mb-6 ${collapsed ? "lg:px-1" : "px-2"}`}>
        <img
          src="/thrustline-logo.png"
          alt="Thrustline"
          className={`h-10 object-contain object-left ${collapsed ? "lg:w-10 lg:object-left lg:object-cover" : "w-auto max-w-full"}`}
        />
        <div className={`mt-1 pl-[3.15rem] text-[10px] uppercase tracking-[0.15em] text-slate-500 ${collapsed ? "lg:hidden" : ""}`}>
            Virtual Airline
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto" aria-label="Application sections">
        {flightInProgress && (
          <div className="mb-3 border-b border-white/[0.06] pb-3">
            {renderItem({ to: "/live-flight", label: "Live Flight", icon: Map }, true)}
          </div>
        )}

        <div className="mb-3">{renderItem(DASHBOARD)}</div>

        {NAV_SECTIONS.map((section) => (
          <section key={section.label} className="mb-3" aria-labelledby={`nav-${section.label}`}>
            <h2
              id={`nav-${section.label}`}
              className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 ${collapsed ? "lg:hidden" : ""}`}
            >
              {section.label}
            </h2>
            <div className="flex flex-col gap-0.5">{section.items.map((item) => renderItem(item))}</div>
          </section>
        ))}
      </nav>

      <div className="mt-2 border-t border-white/[0.06] pt-3">
        {renderItem({ to: "/settings", label: "Settings", icon: Settings })}
        <div className={`mt-2 flex items-center gap-3 px-2 ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-300">
            {user?.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className={`min-w-0 flex-1 truncate text-xs text-slate-300 ${collapsed ? "lg:hidden" : ""}`}>{user?.email}</div>
          <button
            onClick={() => void signOut()}
            className={`rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 ${collapsed ? "lg:hidden" : ""}`}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {collapsed && (
          <button
            onClick={() => void signOut()}
            className="mx-auto mt-2 hidden rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 lg:block"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={toggleCollapsed}
        className="mt-3 hidden items-center justify-center gap-2 rounded-lg border-t border-white/[0.06] pt-3 text-xs text-slate-500 transition-colors hover:text-slate-300 lg:flex"
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
