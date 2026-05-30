import React, { useEffect, useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { useAuth } from "../lib/auth-context.jsx";
import { useWorkspace } from "../lib/workspace-context.jsx";
import { timeAgo } from "../lib/utils.js";
import { toast } from "../components/ui/toast.jsx";

export function Documents() {
  const { api } = useAuth();
  const { downloadDocument } = useWorkspace();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get("/documents");
        if (active) setDocuments(data.documents || []);
      } catch (error) {
        toast.error(error.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <>
      <Topbar title="Documents" subtitle="Generated ATS resumes & cover letters" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} className="text-primary" /> Generated documents
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : documents.length ? (
            documents.map((doc) => (
              <div
                key={doc._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-2px)] border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.fileName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {doc.jobId?.title ? `${doc.jobId.title} · ${doc.jobId.company} · ` : ""}
                    {timeAgo(doc.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{doc.format?.toUpperCase()}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => downloadDocument(doc)}>
                    <FileDown size={14} /> Download
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No documents yet. Generate one from any job on the Jobs page.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
