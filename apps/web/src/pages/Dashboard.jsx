import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Briefcase, FileText, Send, Trophy } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { ScoreBadge } from "../components/ScoreBadge.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";

const PIPELINE = ["saved", "tailoring", "applied", "interview", "offer", "rejected"];

export function Dashboard() {
  const { jobs, applications, resumes } = useWorkspace();

  const byStatus = useMemo(() => {
    const counts = Object.fromEntries(PIPELINE.map((status) => [status, 0]));
    for (const app of applications) {
      if (counts[app.status] != null) counts[app.status] += 1;
    }
    return counts;
  }, [applications]);

  const topMatches = useMemo(
    () => [...jobs].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)).slice(0, 5),
    [jobs]
  );

  const appliedCount = byStatus.applied + byStatus.interview + byStatus.offer;

  return (
    <>
      <Topbar title="Internship command center" />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tracked jobs" value={jobs.length} icon={Briefcase} />
        <MetricCard label="Applications sent" value={appliedCount} icon={Send} />
        <MetricCard label="Interviews + offers" value={byStatus.interview + byStatus.offer} icon={Trophy} />
        <MetricCard
          label="Primary resume skills"
          value={resumes[0]?.parsed?.skills?.length || 0}
          icon={FileText}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Application pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PIPELINE.map((status) => (
            <div
              key={status}
              className="flex min-w-[120px] flex-1 flex-col rounded-[calc(var(--radius)-2px)] border border-border bg-muted/40 p-3"
            >
              <span className="text-sm capitalize text-muted-foreground">{status}</span>
              <strong className="mt-1 text-xl">{byStatus[status]}</strong>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Top matches</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/jobs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {topMatches.length ? (
            topMatches.map((job) => (
              <Link
                key={job._id}
                to={`/jobs/${job._id}`}
                className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)-2px)] border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{job.company}</p>
                </div>
                <ScoreBadge score={job.match?.score} />
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No jobs yet. <Link className="text-primary underline" to="/jobs">Import your first role.</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
