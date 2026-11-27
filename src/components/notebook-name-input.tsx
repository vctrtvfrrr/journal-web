import { useRef, useState } from "react";
import { apiTrim } from "../lib/api-trim";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function NotebookNameInput({
  label,
  defaultValue,
  placeholder,
  onSave,
  onDone,
}: {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  onSave: (name: string) => Promise<string | undefined>;
  onDone: () => void;
}) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const finish = () => {
    busy.current = true;
    onDone();
  };

  const save = async (value: string) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    const rejection = await onSave(apiTrim(value));
    setSaving(false);
    if (!rejection) return finish();
    busy.current = false;
    setError(rejection);
  };

  return (
    <Tooltip open={!!error}>
      <TooltipTrigger asChild>
        <Input
          aria-label={label}
          aria-invalid={!!error}
          defaultValue={defaultValue}
          placeholder={placeholder}
          readOnly={saving}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          className="h-7 w-[22ch] shrink-0"
          onChange={() => setError(undefined)}
          onBlur={(event) => void save(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              finish();
            }
          }}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">{error}</TooltipContent>
    </Tooltip>
  );
}
