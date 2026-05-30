import React from "react";
import { ShieldCheck } from "lucide-react";
import { Topbar } from "../components/Topbar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Badge } from "../components/ui/badge.jsx";

const SECURITY = [
  "15-minute JWT access tokens",
  "HttpOnly refresh cookies",
  "Hashed refresh sessions",
  "Rotation + reuse revocation",
  "Strict auth rate limits",
  "Helmet + audit logging"
];

export function Settings() {
  return (
    <>
      <Topbar title="Security" subtitle="How your account is protected" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" /> Authentication security
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SECURITY.map((item) => (
            <Badge key={item} variant="muted">
              {item}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
