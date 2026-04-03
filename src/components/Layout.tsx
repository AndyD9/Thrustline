import { NavLink, Outlet } from 'react-router-dom'
import { SimStatus } from './SimStatus'
import { LiveFlightBar } from './LiveFlightBar'
import { SyncIndicator } from './SyncIndicator'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Overview',  icon: '▦' },
  { to: '/flights',   label: 'Flights',   icon: '✈' },
  { to: '/finances',  label: 'Finances',  icon: '◈' },
  { to: '/fleet',     label: 'Fleet',     icon: '⬡' },
  { to: '/crew',      label: 'Crew',      icon: '👤' },
  { to: '/routes',    label: 'Routes',    icon: '◎' },
  { to: '/dispatch',  label: 'Dispatch',  icon: '⎆' },
  { to: '/settings',  label: 'Settings',  icon: '⚙' },
]

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">

      {/* Sidebar */}
      <aside className="flex flex-col w-52 shrink-0 border-r border-gray-800 bg-gray-900">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-emerald-400">Thrust</span>line
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* SimStatus + Sync at bottom */}
        <div className="px-5 py-4 border-t border-gray-800 space-y-2">
          <SimStatus />
          <SyncIndicator />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Live flight bar — sticky top */}
        <div className="px-6 pt-4">
          <LiveFlightBar />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
