import React, { useState } from "react";
import { Briefcase, LinkIcon, Search } from "lucide-react";
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

// Phase 1 ships day-granularity presets backed by the existing recentDays API.
// Phase 4 adds a 24h preset + custom input backed by postedAt.
const RECENCY_PRESETS = [
  { label: "All", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 }
];

export function Jobs() {
  const {
    jobs,
    recencyDays,
    setRecencyDays,
    importLinkedInSearch,
    importUrl
  } = useWorkspace();
  const [location, setLocation] = useState(QUICK_LOCATIONS[0]);
  const [tailoring, setTailoring] = useState(null);
  const [submitting, setSubmitting] = useState("");

  async function handleSearch(event) {
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

  return (
    <>
      <Topbar title="Jobs" subtitle="Search, import, score, and tailor" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase size={18} className="text-primary" /> LinkedIn search (Apify)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="grid gap-3">
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
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Search size={18} className="text-primary" /> Job matches
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {RECENCY_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="secondary"
                size="sm"
                className={cn(
                  (recencyDays ?? null) === preset.days && "bg-primary text-primary-foreground"
                )}
                onClick={() => setRecencyDays(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {jobs.length ? (
            jobs.map((job) => (
              <JobCard key={job._id} job={job} onTailored={(j, draft) => setTailoring({ job: j, draft })} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a resume and import or search your first role.
            </p>
          )}
        </CardContent>
      </Card>

      {tailoring ? <TailoringDraft job={tailoring.job} draft={tailoring.draft} /> : null}
    </>
  );
}
