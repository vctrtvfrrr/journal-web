import { useEffect, useId, useState } from "react";
import { zListNotesQuery, zPartialDateBound } from "../api/generated/zod.gen";
import { periodEnd, periodStart } from "../lib/partial-date";
import { describeError } from "../lib/problem";
import { isFiltering, useTimelineFilters } from "../lib/timeline-filters";
import { ErrorText, Field } from "./field";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SEARCH_DELAY_MS = 300;
const DATE_HINT = "YYYY, YYYY-MM, …";
const SEARCH_MAX_LENGTH = zListNotesQuery.shape.q.unwrap().maxLength ?? undefined;
const BOUND_LABELS = { from: "From", to: "To" };

type Range = { from: string; to: string };

function isDateBound(value: string) {
  return value === "" || zPartialDateBound.safeParse(value).success;
}

function isInverted({ from, to }: Range) {
  return from !== "" && to !== "" && periodStart(from) > periodEnd(to);
}

function isApplicable(range: Range) {
  return isDateBound(range.from) && isDateBound(range.to) && !isInverted(range);
}

function rangeError(range: Range) {
  if (!isDateBound(range.from) || !isDateBound(range.to)) return undefined;
  return isInverted(range) ? "The range ends before it starts." : undefined;
}

export function TimelineFilterBar({ searchError }: { searchError?: unknown }) {
  const id = useId();
  const [filters, applyFilters] = useTimelineFilters();
  const [text, setText] = useState(filters.q ?? "");
  const [range, setRange] = useState({ from: filters.from ?? "", to: filters.to ?? "" });

  useEffect(() => {
    setText((current) =>
      (current.trim() || undefined) === filters.q ? current : (filters.q ?? ""),
    );
  }, [filters.q]);

  useEffect(() => {
    setRange((current) =>
      (current.from || undefined) === filters.from && (current.to || undefined) === filters.to
        ? current
        : { from: filters.from ?? "", to: filters.to ?? "" },
    );
  }, [filters.from, filters.to]);

  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === filters.q) return;
    const timer = setTimeout(() => applyFilters({ q }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const changeRange = (bound: keyof Range, value: string) => {
    const next = { ...range, [bound]: value.trim() };
    setRange(next);
    if (isApplicable(next))
      applyFilters({ from: next.from || undefined, to: next.to || undefined });
  };
  const invertedRange = rangeError(range);
  const clear = () => {
    setText("");
    setRange({ from: "", to: "" });
    applyFilters({ q: undefined, from: undefined, to: undefined });
  };

  return (
    <div role="search" className="grid gap-2 py-2">
      <Field label="Search" htmlFor={`${id}-q`}>
        <Input
          id={`${id}-q`}
          type="search"
          aria-label="Search notes"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-[1ch]">
        {(["from", "to"] as const).map((bound) => (
          <Field
            key={bound}
            label={BOUND_LABELS[bound]}
            htmlFor={`${id}-${bound}`}
            hint={DATE_HINT}
            error={isDateBound(range[bound]) ? undefined : "Use a Partial Date such as 2025-03."}
          >
            <Input
              id={`${id}-${bound}`}
              aria-invalid={!isDateBound(range[bound]) || !!invertedRange}
              autoComplete="off"
              value={range[bound]}
              onChange={(event) => changeRange(bound, event.target.value)}
            />
          </Field>
        ))}
      </div>
      {invertedRange && <ErrorText>{invertedRange}</ErrorText>}
      {searchError !== undefined && <ErrorText>{describeError(searchError)}</ErrorText>}
      {(text || range.from || range.to || isFiltering(filters)) && (
        <Button
          type="button"
          variant="bracket"
          size="sm"
          className="justify-self-start"
          onClick={clear}
        >
          clear filters
        </Button>
      )}
    </div>
  );
}
