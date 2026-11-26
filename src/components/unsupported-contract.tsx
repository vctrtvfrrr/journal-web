import { CONTRACT_VERSION } from "../api/contract";
import { JournalShell } from "./journal-shell";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter } from "./ui/card";

export function UnsupportedContract({ minimumVersion }: { minimumVersion: string }) {
  return (
    <JournalShell status={<span className="text-muted-foreground">Outdated</span>}>
      <Card
        className="mx-auto mt-2 w-full max-w-sm"
        label={
          <span role="heading" aria-level={1}>
            Update required
          </span>
        }
      >
        <CardContent className="grid gap-2">
          <p>This version of the app is out of date.</p>
          <p className="text-xs text-muted-foreground">
            App contract {CONTRACT_VERSION} · API requires ≥ {minimumVersion}
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button" onClick={() => location.reload()}>
            reload
          </Button>
        </CardFooter>
      </Card>
    </JournalShell>
  );
}
