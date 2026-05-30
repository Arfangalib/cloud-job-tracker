import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context.jsx";
import { formatImportNotice } from "./api.js";
import { toast } from "../components/ui/toast.jsx";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { api, isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  // Recency filter in hours; null means "all". Backed by the job's postedAt
  // (falling back to import time) so "last 24 hours" is honest.
  const [recencyHours, setRecencyHours] = useState(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const jobsPath = recencyHours ? `/jobs?recentHours=${recencyHours}` : "/jobs";
      const [jobData, appData, resumeData] = await Promise.all([
        api.get(jobsPath),
        api.get("/applications"),
        api.get("/resumes")
      ]);
      setJobs(jobData.jobs || []);
      setApplications(appData.applications || []);
      setResumes(resumeData.resumes || []);
    } catch (error) {
      toast.error(error.message || "Could not load your workspace.");
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated, recencyHours]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const importLinkedInSearch = useCallback(
    async ({ title, location, rows }) => {
      const result = await api.post("/jobs/import-linkedin-search", {
        title,
        location,
        rows: Number(rows || 25)
      });
      toast.message(
        formatImportNotice(result.ingestionRun, "LinkedIn import", "Apify webhook will finish the ingestion.")
      );
      await refresh();
      return result;
    },
    [api, refresh]
  );

  const importUrl = useCallback(
    async (url) => {
      const result = await api.post("/jobs/import-url", { url });
      toast.message(
        formatImportNotice(result.ingestionRun, "Import", "Worker/webhook will finish the ingestion.")
      );
      await refresh();
      return result;
    },
    [api, refresh]
  );

  const searchSavedJobs = useCallback(
    async (params) => {
      const result = await api.post("/jobs/search", params);
      return result.jobs || [];
    },
    [api]
  );

  const scoreJob = useCallback(
    async (jobId) => {
      const result = await api.post(`/jobs/${jobId}/score`, {});
      setJobs((current) => current.map((job) => (job._id === jobId ? result.job : job)));
      toast.success(`Score updated: ${result.job.match?.score || 0}% fit.`);
      return result.job;
    },
    [api]
  );

  const tailorJob = useCallback(
    async (jobId) => {
      const result = await api.post(`/jobs/${jobId}/tailor`, {});
      return result.draft;
    },
    [api]
  );

  const updateStatus = useCallback(
    async (applicationId, status) => {
      await api.patch(`/applications/${applicationId}/status`, { status });
      await refresh();
    },
    [api, refresh]
  );

  const saveResume = useCallback(
    async ({ title, rawText }) => {
      await api.post("/resumes", { title, rawText, isPrimary: true });
      toast.success("Resume parsed and saved.");
      await refresh();
    },
    [api, refresh]
  );

  const uploadResume = useCallback(
    async ({ file, title }) => {
      const form = new FormData();
      form.append("file", file);
      if (title) form.append("title", title);
      await api.upload("/resumes/upload", form);
      toast.success("Resume uploaded and parsed.");
      await refresh();
    },
    [api, refresh]
  );

  const generateDocument = useCallback(
    async ({ jobId, kind, format }) => {
      const result = await api.post("/documents/generate", { jobId, kind, format });
      toast.success(`${kind === "coverLetter" ? "Cover letter" : "Resume"} (${format.toUpperCase()}) generated.`);
      return result.document;
    },
    [api]
  );

  const downloadDocument = useCallback(
    async (doc) => {
      const blob = await api.download(`/documents/${doc._id}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = doc.fileName || "document";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    [api]
  );

  const value = useMemo(
    () => ({
      jobs,
      applications,
      resumes,
      loading,
      recencyHours,
      setRecencyHours,
      refresh,
      importLinkedInSearch,
      importUrl,
      searchSavedJobs,
      scoreJob,
      tailorJob,
      updateStatus,
      saveResume,
      uploadResume,
      generateDocument,
      downloadDocument
    }),
    [
      jobs,
      applications,
      resumes,
      loading,
      recencyHours,
      refresh,
      importLinkedInSearch,
      importUrl,
      searchSavedJobs,
      scoreJob,
      tailorJob,
      updateStatus,
      saveResume,
      uploadResume,
      generateDocument,
      downloadDocument
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

export function applicationForJob(applications, jobId) {
  return applications.find((item) => item.jobId?._id === jobId || item.jobId === jobId);
}
