import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SimStatusBadge } from "./SimStatusBadge";
import { LiveFlightBar } from "./LiveFlightBar";

export function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4">
          <div />
          <SimStatusBadge />
        </header>

        <LiveFlightBar />

        <main className="flex-1 overflow-y-auto px-6 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
