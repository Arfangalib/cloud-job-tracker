import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Briefcase, Cloud, FileText, LogOut, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [accessToken, setAccessToken] = useState("");
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState("register");
  const [searchLocation, setSearchLocation] = useState("Vancouver, British Columbia, Canada");
  const [jobRecentDays, setJobRecentDays] = useState("");
  const [busyJobAction, setBusyJobAction] = useState({ jobId: "", action: "" });

  const api = useMemo(() => makeApi(accessToken, setAccessToken), [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    refreshData();
  }, [accessToken, jobRecentDays]);

  useEffect(() => {
    if (!draft) return;
    document.getElementById("tailoring-draft")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft]);

  async function refreshData() {
    const jobsPath = jobRecentDays ? `/jobs?recentDays=${jobRecentDays}` : "/jobs";
    const [jobData, appData, resumeData] = await Promise.all([
      api.get(jobsPath),
      api.get("/applications"),
      api.get("/resumes")
    ]);
    setJobs(jobData.jobs || []);
    setApplications(appData.applications || []);
    setResumes(resumeData.resumes || []);
  }

  async function handleAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    const data = Object.fromEntries(new FormData(form));
    const endpoint = data.mode === "register" ? "/auth/register" : "/auth/login";
    const body =
      data.mode === "register"
        ? { name: data.name, email: data.email, password: data.password }
        : { email: data.email, password: data.password };

    try {
      const result = await api.post(endpoint, body);

      if (data.mode === "register") {
        form.reset();
        setAuthMode("login");
        setMessage("Account created. Please sign in.");
        return;
      }

      setAccessToken(result.accessToken);
      setUser(result.user);
      setMessage(`Welcome, ${result.user.name}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleAuthModeChange(nextMode) {
    setAuthMode(nextMode);
    setMessage("");
  }

  async function saveResume(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await api.post("/resumes", { title: data.title, rawText: data.rawText, isPrimary: true });
    form.reset();
    setMessage("Resume parsed and saved.");
    await refreshData();
  }

  async function importJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const result = await api.post("/jobs/import-url", { url: data.url });
    form.reset();
    setMessage(formatImportNotice(result.ingestionRun, "Import", "Worker/webhook will finish the ingestion."));
    await refreshData();
  }

  async function searchJobs(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api.post("/jobs/import-linkedin-search", {
      title: data.query,
      location: data.location,
      rows: Number(data.rows || 25)
    });
    setMessage(formatImportNotice(result.ingestionRun, "LinkedIn import", "Apify webhook will finish the ingestion."));
    await refreshData();
  }

  async function scoreJob(jobId) {
    setBusyJobAction({ jobId, action: "score" });
    setMessage("Scoring job against your primary resume...");
    try {
      const result = await api.post(`/jobs/${jobId}/score`, {});
      setJobs((current) => current.map((job) => (job._id === jobId ? result.job : job)));
      setMessage(`Score updated: ${result.job.match?.score || 0}% fit.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyJobAction({ jobId: "", action: "" });
    }
  }

  async function tailorJob(jobId) {
    setBusyJobAction({ jobId, action: "tailor" });
    setMessage("Generating tailored draft...");
    try {
      const result = await api.post(`/jobs/${jobId}/tailor`, {});
      setDraft(result.draft);
      setMessage("Tailored draft generated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyJobAction({ jobId: "", action: "" });
    }
  }

  async function updateStatus(application, status) {
    await api.patch(`/applications/${application._id}/status`, { status });
    await refreshData();
  }

  async function logout() {
    await api.post("/auth/logout", {});
    setAccessToken("");
    setUser(null);
    setJobs([]);
    setApplications([]);
    setResumes([]);
    setDraft(null);
  }

  if (!accessToken) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={handleAuthModeChange}
        onSubmit={handleAuth}
        message={message}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Cloud size={28} />
          <div>
            <strong>Cloud Job Tracker</strong>
            <span>SWE + cloud internships</span>
          </div>
        </div>
        <nav>
          <a href="#dashboard"><Briefcase size={18} /> Tracker</a>
          <a href="#resume"><FileText size={18} /> Resume</a>
          <a href="#security"><ShieldCheck size={18} /> Security</a>
        </nav>
        <button className="ghost" onClick={logout}><LogOut size={18} /> Sign out</button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>{user?.email}</p>
            <h1>Internship command center</h1>
          </div>
          <button onClick={refreshData}><RefreshCw size={18} /> Refresh</button>
        </header>

        {message && <div className="notice">{message}</div>}

        <section id="dashboard" className="metrics">
          <Metric label="Tracked jobs" value={jobs.length} />
          <Metric label="Applications" value={applications.length} />
          <Metric label="Primary resume" value={resumes[0]?.parsed?.skills?.length || 0} suffix=" skills" />
          <Metric label="Cloud signal" value="AWS + Apify" />
        </section>

        <section className="grid two">
          <Panel title="Search / Import Jobs" icon={<Briefcase size={20} />}>
            <form onSubmit={searchJobs} className="stack">
              <input name="query" placeholder="Cloud SWE intern" defaultValue="Cloud SWE intern" />
              <input
                name="location"
                placeholder="Vancouver, British Columbia, Canada"
                value={searchLocation}
                onChange={(event) => setSearchLocation(event.target.value)}
              />
              <div className="quick-locations" aria-label="Quick locations">
                {[
                  "Vancouver, British Columbia, Canada",
                  "Canada / Remote",
                  "Toronto, Ontario, Canada"
                ].map((location) => (
                  <button type="button" key={location} onClick={() => setSearchLocation(location)}>
                    {location.split(",")[0]}
                  </button>
                ))}
              </div>
              <input name="rows" type="number" min="1" max="1000" defaultValue="25" />
              <button>Import LinkedIn search with Apify</button>
            </form>
            <form onSubmit={importJob} className="stack">
              <input name="url" placeholder="Paste LinkedIn, Indeed, Eluta, Greenhouse, or Lever URL" />
              <button type="submit">Import URL with Apify-aware flow</button>
            </form>
          </Panel>

          <Panel id="resume" title="Resume Intake" icon={<FileText size={20} />}>
            <form onSubmit={saveResume} className="stack">
              <input name="title" placeholder="Primary SWE/cloud resume" defaultValue="Primary SWE/cloud resume" />
              <textarea
                name="rawText"
                rows="10"
                placeholder="Paste resume text with skills, projects, education, and experience."
              />
              <button>Parse resume</button>
            </form>
          </Panel>
        </section>

        <Panel title="Job Matches" icon={<Sparkles size={20} />}>
          <div className="panel-toolbar" aria-label="Job recency filter">
            <button
              type="button"
              className={jobRecentDays === "" ? "active" : ""}
              onClick={() => setJobRecentDays("")}
            >
              All
            </button>
            <button
              type="button"
              className={jobRecentDays === "7" ? "active" : ""}
              onClick={() => setJobRecentDays("7")}
            >
              Last 7 days
            </button>
          </div>
          <div className="job-list">
            {jobs.map((job) => {
              const app = applications.find((item) => item.jobId?._id === job._id || item.jobId === job._id);
              const isScoring = busyJobAction.jobId === job._id && busyJobAction.action === "score";
              const isTailoring = busyJobAction.jobId === job._id && busyJobAction.action === "tailor";
              return (
                <article className="job-card" key={job._id}>
                  <div>
                    <h3>{job.title}</h3>
                    <p>{job.company} · {job.location}</p>
                    <div className="chips">
                      {(job.keywords || []).slice(0, 8).map((keyword) => <span key={keyword}>{keyword}</span>)}
                    </div>
                  </div>
                  <div className="job-actions">
                    <strong>{job.match?.score || 0}% fit</strong>
                    {isHttpUrl(job.sourceUrl) ? (
                      <a
                        className="button-link"
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View posting for ${job.title}`}
                      >
                        View posting
                      </a>
                    ) : (
                      <span className="no-posting-link">No posting link</span>
                    )}
                    <button disabled={isScoring} onClick={() => scoreJob(job._id)}>
                      {isScoring ? "Scoring..." : "Score"}
                    </button>
                    <button disabled={isTailoring} onClick={() => tailorJob(job._id)}>
                      {isTailoring ? "Tailoring..." : "Tailor"}
                    </button>
                    {app && (
                      <select value={app.status} onChange={(event) => updateStatus(app, event.target.value)}>
                        {["saved", "tailoring", "applied", "interview", "rejected", "offer"].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </article>
              );
            })}
            {!jobs.length && <p className="empty">Add a resume and import/search your first role.</p>}
          </div>
        </Panel>

        {draft && (
          <Panel id="tailoring-draft" title="ATS Tailoring Draft" icon={<FileText size={20} />}>
            <div className="draft">
              <h3>{draft.resumeHeadline}</h3>
              <ul>{draft.bulletSuggestions.map((item) => <li key={item}>{item}</li>)}</ul>
              <pre>{draft.coverLetterDraft}</pre>
              <p><strong>Only add if true:</strong> {draft.guardrails.onlyAddIfTrue.join(", ") || "No major gaps detected"}</p>
            </div>
          </Panel>
        )}

        <Panel id="security" title="Authentication Security" icon={<ShieldCheck size={20} />}>
          <div className="security-grid">
            <span>15-minute JWT access tokens</span>
            <span>HttpOnly refresh cookies</span>
            <span>Hashed refresh sessions</span>
            <span>Rotation + reuse revocation</span>
            <span>Strict auth rate limits</span>
            <span>Helmet + audit logging</span>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function AuthScreen({ mode, onModeChange, onSubmit, message }) {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand large">
          <Cloud size={34} />
          <div>
            <strong>Cloud Job Tracker</strong>
            <span>Apify ingestion · AWS-ready workers · ATS tailoring</span>
          </div>
        </div>
        <div className="segmented">
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>Register</button>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Login</button>
        </div>
        <form onSubmit={onSubmit} className="stack">
          <input type="hidden" name="mode" value={mode} />
          {mode === "register" && <input name="name" placeholder="Your name" defaultValue="Cloud Student" />}
          <input name="email" type="email" placeholder="Email" defaultValue="student@example.com" />
          <input name="password" type="password" placeholder="Password" defaultValue="verysecurepassword" />
          {mode === "register" && <p className="field-hint">Password must be at least 10 characters.</p>}
          <button>{mode === "register" ? "Create account" : "Sign in"}</button>
        </form>
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function Panel({ title, icon, children, id }) {
  return (
    <section id={id} className="panel">
      <header><span>{icon}</span><h2>{title}</h2></header>
      {children}
    </section>
  );
}

function Metric({ label, value, suffix = "" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}{suffix}</strong>
    </div>
  );
}

function makeApi(accessToken, setAccessToken) {
  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 && accessToken) {
      const refresh = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" }
      });
      if (refresh.ok) {
        const refreshed = await refresh.json();
        setAccessToken(refreshed.accessToken);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(getApiErrorMessage(error));
    }
    if (response.status === 204) return {};
    return response.json();
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) })
  };
}

function getApiErrorMessage(errorData) {
  if (Array.isArray(errorData)) {
    return errorData[0]?.message || "Request failed";
  }

  if (Array.isArray(errorData?.errors)) {
    return errorData.errors[0]?.message || "Request failed";
  }

  if (Array.isArray(errorData?.error)) {
    return errorData.error[0]?.message || "Request failed";
  }

  if (typeof errorData?.error === "string" && errorData.error.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(errorData.error);
      if (parsed[0]?.message) return parsed[0].message;
    } catch (_error) {
      // Fall back to the plain error string below.
    }
  }

  return errorData?.error || errorData?.message || "Request failed";
}

function formatImportNotice(run, label, completionMessage) {
  if (run?.status === "failed") {
    return `${label} failed: ${run.error || "Apify could not start the run."}`;
  }

  if (run?.status === "pending") {
    return `${label} pending: ${run.error || "Apify is not configured yet."}`;
  }

  return `${label} started: ${run?.status || "running"}. ${completionMessage}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

createRoot(document.getElementById("root")).render(<App />);
