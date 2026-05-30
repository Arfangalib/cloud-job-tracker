import React, { useRef, useState } from "react";
import { FileText, Star, Upload } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { toast } from "../components/ui/toast.jsx";

export function Resumes() {
  const { resumes, saveResume, uploadResume } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);

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

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a PDF, DOCX, or TXT file first.");
      return;
    }
    setSubmitting(true);
    try {
      await uploadResume({ file, title: data.title });
      form.reset();
      setFileName("");
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
            <FileText size={18} className="text-primary" /> Add a resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
              <TabsTrigger value="upload">Upload file</TabsTrigger>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <form onSubmit={handleUpload} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="upload-title">Title</Label>
                  <Input
                    id="upload-title"
                    name="title"
                    placeholder="Primary SWE/cloud resume"
                    defaultValue="Primary SWE/cloud resume"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Resume file</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} /> Choose file
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {fileName || "PDF, DOCX, or TXT · max 5 MB"}
                    </span>
                  </div>
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Uploading…" : "Upload & parse"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="paste">
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
            </TabsContent>
          </Tabs>
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
