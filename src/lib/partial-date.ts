const pad = (value: number) => String(value).padStart(2, "0");

export function currentMinute(now = new Date()) {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const EARLIEST_MINUTE = "0000-01-01T00:00";
const LATEST_MINUTE = "0000-12-31T23:59";

// Day 31 for every month is enough here: these bounds are only compared, never parsed as dates.
export function periodStart(date: string) {
  return date + EARLIEST_MINUTE.slice(date.length);
}

export function periodEnd(date: string) {
  return date + LATEST_MINUTE.slice(date.length);
}
