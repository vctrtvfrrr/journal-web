import { useEffect, useId, useState } from "react";
import { zListNotesQuery, zPartialDateBound } from "../api/generated/zod.gen";
import { periodEnd, periodStart } from "../lib/partial-date";
import { useNotesSearch } from "../lib/notes-search";
import { isFiltering, NO_FILTERS, useTimelineFilters } from "../lib/timeline-filters";
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

export function TimelineFilterBar() {
  const id = useId();
  const [filters, applyFilters] = useTimelineFilters();
  const search = useNotesSearch();
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
    applyFilters(NO_FILTERS);
    search.open();
  };

  return (
    <div role="search" className="grid gap-2">
      <div className="grid grid-cols-2 gap-x-[1ch] gap-y-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Search" htmlFor={`${id}-q`} className="col-span-2 lg:col-span-1">
          <Input
            ref={search.searchFieldRef}
            id={`${id}-q`}
            type="search"
            aria-label="Search notes"
            autoComplete="off"
            maxLength={SEARCH_MAX_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        {(["from", "to"] as const).map((bound) => (
          <Field
            key={bound}
            label={BOUND_LABELS[bound]}
            htmlFor={`${id}-${bound}`}
            error={isDateBound(range[bound]) ? undefined : "Use a Partial Date such as 2025-03."}
          >
            <Input
              id={`${id}-${bound}`}
              placeholder={DATE_HINT}
              aria-invalid={!isDateBound(range[bound]) || !!invertedRange}
              autoComplete="off"
              value={range[bound]}
              onChange={(event) => changeRange(bound, event.target.value)}
            />
          </Field>
        ))}
      </div>
      {invertedRange && <ErrorText>{invertedRange}</ErrorText>}
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
