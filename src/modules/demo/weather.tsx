import { DemoRow, ModulePage } from "../demo-badge";

const now = { place: "São Paulo", icon: "☀", temperature: 24, summary: "Sunny, rain from 18:00" };

const hours = [
  ["12", "☀", 26],
  ["13", "☀", 26],
  ["14", "☀", 27],
  ["15", "⛅", 27],
  ["16", "⛅", 25],
  ["17", "☁", 24],
  ["18", "☂", 22],
  ["19", "☂", 21],
  ["20", "☁", 20],
  ["21", "☁", 20],
  ["22", "☁", 19],
  ["23", "☁", 19],
] as const;

function Hours({ count }: { count: number }) {
  return (
    <ol className="flex justify-between text-center text-xs text-muted-foreground">
      {hours.slice(0, count).map(([hour, icon, temperature]) => (
        <li key={hour}>
          {hour}
          <br />
          <span aria-hidden>{icon}</span> {temperature}°
        </li>
      ))}
    </ol>
  );
}

export function Widget() {
  return (
    <div className="grid gap-1">
      <p>
        <span aria-hidden>{now.icon}</span> {now.temperature}° {now.place}{" "}
        <span className="text-muted-foreground">→ ☂ 18h</span>
      </p>
      <Hours count={6} />
    </div>
  );
}

export function Page() {
  return (
    <ModulePage title="Weather">
      <p className="text-xl">
        <span aria-hidden>{now.icon}</span> {now.temperature}° · {now.place}
      </p>
      <p className="text-muted-foreground">{now.summary}</p>
      <Hours count={hours.length} />
      <ul>
        {hours.map(([hour, icon, temperature]) => (
          <DemoRow key={hour}>
            <span className="w-[5ch] text-muted-foreground">{hour}:00</span>
            <span aria-hidden>{icon}</span>
            <span>{temperature}°</span>
          </DemoRow>
        ))}
      </ul>
    </ModulePage>
  );
}
