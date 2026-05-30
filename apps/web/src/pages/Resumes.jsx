import React, { useState } from "react";
import { FileText, Star } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { toast } from "../components/ui/toast.jsx";

export function Resumes() {
  const { resumes, saveResume } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    try {
      await saveResume({ title: data.title, rawText: data.rawText });
      form.reset();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar title="Resume" subtitle="Parsed skills power your job match scores" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} className="text-primary" /> Paste resume text
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Primary SWE/cloud resume"
                defaultValue="Primary SWE/cloud resume"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rawText">Resume text</Label>
              <Textarea
                id="rawText"
                name="rawText"
                rows={10}
                placeholder="Paste resume text with skills, projects, education, and experience."
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Parsing…" : "Parse resume"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved resumes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {resumes.length ? (
            resumes.map((resume) => (
              <div key={resume._id} className="rounded-[calc(var(--radius)-2px)] border border-border p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{resume.title}</h3>
                  {resume.isPrimary ? (
                    <Badge variant="success" className="gap-1">
                      <Star size={12} /> Primary
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(resume.parsed?.skills || []).slice(0, 16).map((skill) => (
                    <Badge key={skill} variant="muted">
                      {skill}
                    </Badge>
                  ))}
                  {!(resume.parsed?.skills || []).length ? (
                    <span className="text-sm text-muted-foreground">No skills extracted.</span>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No resumes yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
