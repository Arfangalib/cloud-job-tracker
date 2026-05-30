import React from "react";
import { FileDown } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

export function Documents() {
  return (
    <>
      <Topbar title="Documents" subtitle="Generated ATS resumes & cover letters" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown size={18} className="text-primary" /> Generated documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tailored, ATS-friendly resume and cover-letter downloads will appear here.
            Generate one from any job on the Jobs page.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
