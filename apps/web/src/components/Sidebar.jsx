import React from "react";
import { NavLink } from "react-router-dom";
import { Briefcase, Cloud, FileText, FileDown, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth-context.jsx";
import { cn } from "../lib/utils.js";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/resumes", label: "Resume", icon: FileText },
  { to: "/documents", label: "Documents", icon: FileDown },
  { to: "/settings", label: "Security", icon: ShieldCheck }
];

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-6 text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3">
        <Cloud size={28} />
        <div>
          <strong className="block text-base leading-tight">Cloud Job Tracker</strong>
          <span className="block text-sm text-sidebar-muted">SWE + cloud internships</span>
        </div>
      </div>

      <nav className="grid gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white",
                isActive && "bg-white/10 text-white"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="mt-auto flex items-center gap-3 rounded-[calc(var(--radius)-2px)] bg-white/10 px-3 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-white/20 hover:text-white"
      >
        <LogOut size={18} /> Sign out
      </button>
    </aside>
  );
}
