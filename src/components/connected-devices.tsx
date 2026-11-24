import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ListedDevice } from "../api/generated";
import {
  listDevicesOptions,
  listDevicesQueryKey,
  revokeDeviceMutation,
} from "../api/generated/@tanstack/react-query.gen";
import { describeError, isProblem } from "../lib/problem";
import { ErrorText } from "./field";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";

function isAlreadyGone(error: unknown) {
  return isProblem(error) && error.status === 404;
}

function DeviceRow({ device }: { device: ListedDevice }) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refreshDevices = () => queryClient.invalidateQueries({ queryKey: listDevicesQueryKey() });
  const revoke = useMutation({
    ...revokeDeviceMutation(),
    meta: { showsOwnError: true },
    onSuccess: () => {
      if (!device.current) return refreshDevices();
      queryClient.clear();
      return navigate({ to: "/login" });
    },
    onError: (error) => {
      if (isAlreadyGone(error)) return refreshDevices();
    },
  });

  return (
    <li className="flex flex-wrap items-baseline gap-x-[1ch] border-b border-dashed border-border px-[1ch] py-1 last:border-b-0">
      <span className="wrap-anywhere">{device.name}</span>
      {device.current && <span className="text-accent-ink">[This device]</span>}
      <time dateTime={device.last_used_at} className="ml-auto text-xs text-muted-foreground">
        last used {new Date(device.last_used_at).toLocaleString()}
      </time>
      {confirming ? (
        <span className="flex basis-full items-baseline justify-end gap-x-[1ch]">
          <span>Revoke "{device.name}"?</span>
          <Button
            type="button"
            variant="bracket"
            size="sm"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ path: { id: device.id } })}
          >
            yes
          </Button>
          <Button
            type="button"
            variant="bracket"
            size="sm"
            disabled={revoke.isPending}
            onClick={() => setConfirming(false)}
          >
            no
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          variant="bracket"
          size="sm"
          aria-label={`Revoke ${device.name}`}
          onClick={() => setConfirming(true)}
        >
          revoke
        </Button>
      )}
      {revoke.isError && !isAlreadyGone(revoke.error) && (
        <span className="basis-full text-right">
          <ErrorText>{describeError(revoke.error)}</ErrorText>
        </span>
      )}
    </li>
  );
}

export function ConnectedDevices() {
  const [open, setOpen] = useState(false);
  const devices = useQuery({ ...listDevicesOptions(), enabled: open });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" size="sm">
          Connected devices
        </Button>
      </DialogTrigger>
      <DialogContent label="Connected devices">
        <DialogTitle className="sr-only">Connected devices</DialogTitle>
        <DialogDescription>Devices with an active Journal session.</DialogDescription>
        {devices.isPending && <p role="status">Loading connected devices...</p>}
        {devices.isError && (
          <div className="flex items-center gap-[1ch]">
            <p className="text-red-ink" role="alert">
              {describeError(devices.error)}
            </p>
            <Button
              type="button"
              variant="bracket"
              size="sm"
              onClick={() => void devices.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {devices.data && (
          <ul
            aria-label="Active devices"
            className="max-h-[45dvh] overflow-y-auto border border-border-strong"
          >
            {devices.data.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
