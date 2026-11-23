import type { ErrorComponentProps } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { describeError } from "../lib/problem";

export function ErrorPage({ error }: ErrorComponentProps) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>error</AlertTitle>
        <AlertDescription>{describeError(error)}</AlertDescription>
      </Alert>
    </main>
  );
}
