import React, { useState } from "react";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { toast } from "./ui/toast.jsx";

const OPTIONS = [
  { kind: "resume", format: "pdf", label: "Resume PDF" },
  { kind: "resume", format: "docx", label: "Resume DOCX" },
  { kind: "coverLetter", format: "pdf", label: "Cover letter PDF" },
  { kind: "coverLetter", format: "docx", label: "Cover letter DOCX" }
];

export function DocumentGenerator({ job }) {
  const { generateDocument, downloadDocument } = useWorkspace();
  const [busy, setBusy] = useState("");

  async function handleGenerate({ kind, format }) {
    const id = `${kind}-${format}`;
    setBusy(id);
    try {
      const document = await generateDocument({ jobId: job._id, kind, format });
      await downloadDocument(document);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown size={18} className="text-primary" /> Generate ATS documents
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Builds a tailored, single-column, ATS-friendly resume and cover letter from your
          primary resume and this job. Files also appear under Documents.
        </p>
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((option) => {
            const id = `${option.kind}-${option.format}`;
            return (
              <Button
                key={id}
                variant="secondary"
                disabled={busy === id}
                onClick={() => handleGenerate(option)}
              >
                <FileDown size={16} /> {busy === id ? "Generating…" : option.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
