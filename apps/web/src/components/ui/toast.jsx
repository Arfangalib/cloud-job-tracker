import React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-card)",
          color: "var(--color-foreground)",
          border: "1px solid var(--color-border)"
        }
      }}
    />
  );
}

export { toast };
