import { ConnectedDevices } from "../components/connected-devices";
import { JournalShell } from "../components/journal-shell";

export function HomePage() {
  return (
    <JournalShell status={null} footerAction={<ConnectedDevices />}>
      {null}
    </JournalShell>
  );
}
