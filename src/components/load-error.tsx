import { describeError } from "../lib/problem";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex items-center gap-[1ch]">
        {describeError(error)}
        <Button type="button" variant="bracket" size="sm" onClick={onRetry}>
          retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
