import type * as React from "react";
import { cn } from "../lib/utils";
import { Label } from "./ui/label";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-red-ink">✗ {children}</span>;
}
