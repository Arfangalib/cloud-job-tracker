import React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";

function BulletList({ items }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}

export function TailoringDraft({ job, draft }) {
  if (!draft) return null;

  // Tolerate older drafts that only had `bulletSuggestions`.
  const experience = (draft.experienceBullets?.length ? draft.experienceBullets : draft.bulletSuggestions) || [];
  const projects = draft.projectBullets || [];
  const skills = draft.skills || [];
  const education = draft.education || [];
  const onlyAddIfTrue = draft.guardrails?.onlyAddIfTrue || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          ATS tailoring draft{job ? ` — ${job.title}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Suggested headline</h4>
          <p className="mt-1 font-medium">{draft.resumeHeadline}</p>
        </div>

        {draft.professionalSummary ? (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Professional summary</h4>
            <p className="mt-1 text-sm">{draft.professionalSummary}</p>
          </div>
        ) : null}

        {skills.length ? (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Technical skills</h4>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {experience.length ? (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Experience bullets</h4>
            <BulletList items={experience} />
          </div>
        ) : null}

        {projects.length ? (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Project bullets</h4>
            <BulletList items={projects} />
          </div>
        ) : null}

        {education.length ? (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">Education</h4>
            <BulletList items={education} />
          </div>
        ) : null}

        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Cover letter draft</h4>
          <pre className="mt-1 whitespace-pre-wrap rounded-[var(--radius)] bg-sidebar p-4 text-sm text-[#ecf5ef]">
            {draft.coverLetterDraft}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Only add if true:</span>
          {onlyAddIfTrue.length ? (
            onlyAddIfTrue.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No major gaps detected</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
