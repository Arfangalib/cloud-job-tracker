import React, { useState } from "react";
import { ExternalLink, Sparkles, Target } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select.jsx";
import { ScoreBadge } from "./ScoreBadge.jsx";
import { isHttpUrl, timeAgo } from "../lib/utils.js";
import { useWorkspace, applicationForJob } from "../lib/workspace-context.jsx";
import { toast } from "./ui/toast.jsx";

const STATUSES = ["saved", "tailoring", "applied", "interview", "rejected", "offer"];

export function JobCard({ job, onTailored }) {
  const { applications, scoreJob, tailorJob, updateStatus } = useWorkspace();
  const app = applicationForJob(applications, job._id);
  const [busy, setBusy] = useState("");
  const postedAt = job.postedAt || job.createdAt;

  async function handleScore() {
    setBusy("score");
    try {
      await scoreJob(job._id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  async function handleTailor() {
    setBusy("tailor");
    try {
      const draft = await tailorJob(job._id);
      onTailored?.(job, draft);
      toast.success("Tailored draft generated.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{job.title}</h3>
          {postedAt ? (
            <span className="text-xs text-muted-foreground">· Posted {timeAgo(postedAt)}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {job.company}
          {job.location ? ` · ${job.location}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(job.keywords || []).slice(0, 8).map((keyword) => (
            <Badge key={keyword} variant="muted">
              {keyword}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid w-full gap-2 sm:w-44">
        <ScoreBadge score={job.match?.score} className="justify-self-start sm:justify-self-end" />

        {isHttpUrl(job.sourceUrl) ? (
          <Button asChild variant="outline" size="sm">
            <a href={job.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> View posting
            </a>
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" disabled={busy === "score"} onClick={handleScore}>
            <Target size={14} /> {busy === "score" ? "…" : "Score"}
          </Button>
          <Button size="sm" disabled={busy === "tailor"} onClick={handleTailor}>
            <Sparkles size={14} /> {busy === "tailor" ? "…" : "Tailor"}
          </Button>
        </div>

        {app ? (
          <Select value={app.status} onValueChange={(status) => updateStatus(app._id, status)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </Card>
  );
}
