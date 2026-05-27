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

  const api = useMemo(() => makeApi(accessToken, setAccessToken), [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    refreshData();
  }, [accessToken]);

  async function refreshData() {
    const [jobData, appData, resumeData] = await Promise.all([
      api.get("/jobs"),
      api.get("/applications"),
      api.get("/resumes")
    ]);
    setJobs(jobData.jobs || []);
    setApplications(appData.applications || []);
    setResumes(resumeData.resumes || []);
  }

  async function handleAuth(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint = data.mode === "register" ? "/auth/register" : "/auth/login";
    const body =
      data.mode === "register"
        ? { name: data.name, email: data.email, password: data.password }
        : { email: data.email, password: data.password };
    const result = await api.post(endpoint, body);
    setAccessToken(result.accessToken);
    setUser(result.user);
    setMessage(`Welcome, ${result.user.name}`);
  }

  async function saveResume(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api.post("/resumes", { title: data.title, rawText: data.rawText, isPrimary: true });
    event.currentTarget.reset();
    setMessage("Resume parsed and saved.");
    await refreshData();
  }

  async function importJob(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await api.post("/jobs/import-url", { url: data.url });
    event.currentTarget.reset();
    setMessage(`Import started: ${result.ingestionRun.status}. Worker/webhook will finish the ingestion.`);
    await refreshData();
  }

  async function searchJobs(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api.post("/jobs/search", { query: data.query, location: data.location });
    setMessage("Demo search imported a matching cloud/SWE internship.");
    await refreshData();
  }

  async function scoreJob(jobId) {
    const result = await api.post(`/jobs/${jobId}/score`, {});
    setJobs((current) => current.map((job) => (job._id === jobId ? result.job : job)));
  }

  async function tailorJob(jobId) {
    const result = await api.post(`/jobs/${jobId}/tailor`, {});
    setDraft(result.draft);
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
    return <AuthScreen onSubmit={handleAuth} message={message} />;
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
              <input name="query" placeholder="Cloud SWE" defaultValue="Cloud SWE" />
              <input name="location" placeholder="Canada / Remote" defaultValue="Canada / Remote" />
              <button>Run demo search</button>
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
          <div className="job-list">
            {jobs.map((job) => {
              const app = applications.find((item) => item.jobId?._id === job._id || item.jobId === job._id);
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
                    <button onClick={() => scoreJob(job._id)}>Score</button>
                    <button onClick={() => tailorJob(job._id)}>Tailor</button>
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
          <Panel title="ATS Tailoring Draft" icon={<FileText size={20} />}>
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

function AuthScreen({ onSubmit, message }) {
  const [mode, setMode] = useState("register");
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
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
        </div>
        <form onSubmit={onSubmit} className="stack">
          <input type="hidden" name="mode" value={mode} />
          {mode === "register" && <input name="name" placeholder="Your name" defaultValue="Cloud Student" />}
          <input name="email" type="email" placeholder="Email" defaultValue="student@example.com" />
          <input name="password" type="password" placeholder="Password" defaultValue="verysecurepassword" />
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
      throw new Error(error.error || "Request failed");
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

createRoot(document.getElementById("root")).render(<App />);
