import React from "react";
import { Card } from "./ui/card.jsx";

export function MetricCard({ label, value, suffix = "", icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon ? <Icon size={18} className="text-primary" /> : null}
      </div>
      <strong className="mt-2 block text-2xl font-semibold">
        {value}
        {suffix}
      </strong>
    </Card>
  );
}
