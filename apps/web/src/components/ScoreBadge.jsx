import React from "react";
import { cn } from "../lib/utils.js";

/** Compact fit-score pill, colored by strength. */
export function ScoreBadge({ score = 0, className }) {
  const value = Math.round(score || 0);
  const tone =
    value >= 70
      ? "bg-[var(--color-success-bg)] text-success border-[var(--color-success-border)]"
      : value >= 40
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums",
        tone,
        className
      )}
    >
      {value}% fit
    </span>
  );
}
