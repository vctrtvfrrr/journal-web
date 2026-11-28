import type { ReactNode } from "react";
import { describeError } from "../lib/problem";
import { ErrorText } from "./field";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

type ConfirmStatus = { isPending: boolean; error: unknown; reset: () => void };

export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  status,
  onConfirm,
  confirmDisabled = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  status: ConfirmStatus;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  const change = (next: boolean) => {
    if (status.isPending) return;
    if (!next) status.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent label={title} showCloseButton={false}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="wrap-anywhere">{description}</DialogDescription>
        {children}
        {status.error != null && <ErrorText>{describeError(status.error)}</ErrorText>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={status.isPending}
            onClick={() => change(false)}
          >
            cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={status.isPending || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
