import React, { useState } from "react";
import { Briefcase, LinkIcon, Search, X } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { JobCard } from "../components/JobCard.jsx";
import { TailoringDraft } from "../components/TailoringDraft.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { toast } from "../components/ui/toast.jsx";
import { cn } from "../lib/utils.js";

const QUICK_LOCATIONS = [
  "Vancouver, British Columbia, Canada",
  "Canada / Remote",
  "Toronto, Ontario, Canada"
];

// Recency presets backed by the postedAt-aware recentHours filter.
const RECENCY_PRESETS = [
  { label: "All", hours: null },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 }
];

// Mirrors the server's recentHours cap (z.coerce.number().max(8760)).
const MAX_RECENCY_HOURS = 8760;

export function Jobs() {
  const {
    jobs,
    recencyHours,
    setRecencyHours,
    importLinkedInSearch,
    importUrl,
    searchSavedJobs
  } = useWorkspace();
  const [location, setLocation] = useState(QUICK_LOCATIONS[0]);
  const [tailoring, setTailoring] = useState(null);
  const [submitting, setSubmitting] = useState("");

  // Saved-job search state (read-only query over imported jobs).
  const [searchResults, setSearchResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Custom recency input.
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("hours");

  const isCustomActive =
    recencyHours != null && !RECENCY_PRESETS.some((preset) => preset.hours === recencyHours);

  async function handleImportSearch(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setSubmitting("search");
    try {
      await importLinkedInSearch({ title: data.query, location, rows: data.rows });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting("");
    }
  }

  async function handleImportUrl(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting("url");
    try {
      await importUrl(data.url);
      form.reset();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting("");
    }
  }

  async function handleSearchSaved(event) {
    event.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setSubmitting("saved-search");
    try {
      const results = await searchSavedJobs({
        query: searchTerm.trim(),
        ...(recencyHours ? { recentHours: recencyHours } : {})
      });
      setSearchResults(results);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting("");
    }
  }

  function clearSearch() {
    setSearchTerm("");
    setSearchResults(null);
  }

  function applyCustomRecency() {
    const value = Number(customValue);
    if (!value || value < 1) {
      toast.error("Enter a positive number for the custom window.");
      return;
    }
    const requested = customUnit === "days" ? value * 24 : value;
    const hours = Math.min(requested, MAX_RECENCY_HOURS);
    if (hours !== requested) {
      toast.message("Capped to the maximum window (8760h / 365d).");
    }
    setRecencyHours(hours);
  }

  const visibleJobs = searchResults ?? jobs;

  return (
    <>
      <Topbar title="Jobs" subtitle="Import, search, score, and tailor" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase size={18} className="text-primary" /> Import LinkedIn search (Apify)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImportSearch} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="query">Role</Label>
                <Input id="query" name="query" placeholder="Cloud SWE intern" defaultValue="Cloud SWE intern" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_LOCATIONS.map((loc) => (
                    <Button
                      key={loc}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setLocation(loc)}
                    >
                      {loc.split(",")[0]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rows">Max results</Label>
                <Input id="rows" name="rows" type="number" min="1" max="1000" defaultValue="25" />
              </div>
              <Button type="submit" disabled={submitting === "search"}>
                {submitting === "search" ? "Starting import…" : "Import LinkedIn search"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon size={18} className="text-primary" /> Import a posting by URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImportUrl} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="url">Job URL</Label>
                <Input
                  id="url"
                  name="url"
                  placeholder="LinkedIn, Indeed, Eluta, Greenhouse, or Lever URL"
                />
              </div>
              <Button type="submit" variant="secondary" disabled={submitting === "url"}>
                {submitting === "url" ? "Importing…" : "Import URL"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Search size={18} className="text-primary" /> Job matches
              {searchResults ? (
                <span className="text-sm font-normal text-muted-foreground">
                  · {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-1.5">
              {RECENCY_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn(
                    (recencyHours ?? null) === preset.hours && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setRecencyHours(preset.hours)}
                >
                  {preset.label}
                </Button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="1"
                  placeholder="Custom"
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  className={cn("h-8 w-20", isCustomActive && "border-primary")}
                />
                <select
                  value={customUnit}
                  onChange={(event) => setCustomUnit(event.target.value)}
                  className="h-8 rounded-[calc(var(--radius)-2px)] border border-input bg-card px-2 text-sm"
                >
                  <option value="hours">hrs</option>
                  <option value="days">days</option>
                </select>
                <Button type="button" size="sm" variant="outline" onClick={applyCustomRecency}>
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearchSaved} className="flex items-center gap-2">
            <Input
              placeholder="Search imported jobs (title, company, skills)…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={submitting === "saved-search"}>
              <Search size={16} /> Search
            </Button>
            {searchResults ? (
              <Button type="button" variant="ghost" size="icon" onClick={clearSearch} aria-label="Clear search">
                <X size={16} />
              </Button>
            ) : null}
          </form>
        </CardHeader>

        <CardContent className="grid gap-3">
          {visibleJobs.length ? (
            visibleJobs.map((job) => (
              <JobCard key={job._id} job={job} onTailored={(j, draft) => setTailoring({ job: j, draft })} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {searchResults
                ? "No imported jobs match that search."
                : "Add a resume and import your first role above."}
            </p>
          )}
        </CardContent>
      </Card>

      {tailoring ? <TailoringDraft job={tailoring.job} draft={tailoring.draft} /> : null}
    </>
  );
}
