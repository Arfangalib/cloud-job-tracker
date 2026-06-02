import React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";

export function TailoringDraft({ job, draft }) {
  if (!draft) return null;
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

        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Bullet suggestions</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {(draft.bulletSuggestions || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">Cover letter draft</h4>
          <pre className="mt-1 whitespace-pre-wrap rounded-[var(--radius)] bg-sidebar p-4 text-sm text-[#ecf5ef]">
            {draft.coverLetterDraft}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Only add if true:</span>
          {(draft.guardrails?.onlyAddIfTrue || []).length ? (
            draft.guardrails.onlyAddIfTrue.map((item) => (
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
