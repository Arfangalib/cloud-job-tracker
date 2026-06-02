import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./lib/auth-context.jsx";
import { WorkspaceProvider } from "./lib/workspace-context.jsx";
import { AppShell } from "./components/AppShell.jsx";
import { Toaster } from "./components/ui/toast.jsx";
import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Jobs } from "./pages/Jobs.jsx";
import { JobDetail } from "./pages/JobDetail.jsx";
import { Resumes } from "./pages/Resumes.jsx";
import { Documents } from "./pages/Documents.jsx";
import { Settings } from "./pages/Settings.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <WorkspaceProvider>
                  <AppShell />
                </WorkspaceProvider>
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
