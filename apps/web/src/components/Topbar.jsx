import React from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../lib/auth-context.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { Button } from "./ui/button.jsx";

export function Topbar({ title, subtitle }) {
  const { user } = useAuth();
  const { refresh, loading } = useWorkspace();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="mb-1 text-sm text-muted-foreground">{subtitle || user?.email}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <Button variant="secondary" onClick={refresh} disabled={loading}>
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
      </Button>
    </header>
  );
}
