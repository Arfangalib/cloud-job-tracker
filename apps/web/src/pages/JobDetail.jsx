import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { ScoreBadge } from "../components/ScoreBadge.jsx";
import { TailoringDraft } from "../components/TailoringDraft.jsx";
import { DocumentGenerator } from "../components/DocumentGenerator.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { isHttpUrl } from "../lib/utils.js";
import { toast } from "../components/ui/toast.jsx";

export function JobDetail() {
  const { id } = useParams();
  const { jobs, scoreJob, tailorJob } = useWorkspace();
  const job = jobs.find((item) => item._id === id);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState("");

  if (!job) {
    return (
      <div className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/jobs">
            <ArrowLeft size={16} /> Back to jobs
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Job not found in your current view. It may be on another recency filter.
        </p>
      </div>
    );
  }

  async function run(action, fn) {
    setBusy(action);
    try {
      await fn();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  const match = job.match || {};

  return (
    <div className="grid gap-5">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/jobs">
          <ArrowLeft size={16} /> Back to jobs
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{job.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.company}
              {job.location ? ` · ${job.location}` : ""}
            </p>
          </div>
          <ScoreBadge score={match.score} />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy === "score"}
              onClick={() => run("score", () => scoreJob(job._id))}
            >
              <Target size={16} /> {busy === "score" ? "Scoring…" : "Re-score"}
            </Button>
            <Button
              disabled={busy === "tailor"}
              onClick={() => run("tailor", async () => setDraft(await tailorJob(job._id)))}
            >
              <Sparkles size={16} /> {busy === "tailor" ? "Tailoring…" : "Tailor resume"}
            </Button>
            {isHttpUrl(job.sourceUrl) ? (
              <Button asChild variant="outline">
                <a href={job.sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> View posting
                </a>
              </Button>
            ) : null}
          </div>

          {match.summary ? (
            <div className="rounded-[calc(var(--radius)-2px)] border border-border bg-muted/40 p-4 text-sm">
              {match.summary}
            </div>
          ) : null}

          {(match.strongMatches || []).length ? (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Strong matches</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {match.strongMatches.map((item) => (
                  <Badge key={item} variant="success">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {(match.missingKeywords || []).length ? (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Missing keywords</h4>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {match.missingKeywords.map((item) => (
                  <Badge key={item} variant="muted">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {job.description ? (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground">Description</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm">{job.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DocumentGenerator job={job} />

      {draft ? <TailoringDraft job={job} draft={draft} /> : null}
    </div>
  );
}
