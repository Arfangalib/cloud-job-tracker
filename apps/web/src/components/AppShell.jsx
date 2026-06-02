import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";

export function AppShell() {
  return (
    <div className="grid min-h-screen md:grid-cols-[270px_1fr]">
      <Sidebar />
      <main className="grid content-start gap-5 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
