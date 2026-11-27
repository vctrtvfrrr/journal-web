import { DemoRow, ModulePage } from "../demo-badge";

const days = [
  {
    label: "Today",
    events: [
      ["10:00", "Daily stand-up"],
      ["14:30", "Dentist"],
      ["19:00", "Dinner with Ana"],
    ],
  },
  {
    label: "Tomorrow",
    events: [
      ["09:00", "Quarter planning"],
      ["16:00", "Gym"],
    ],
  },
] as const;

function Days() {
  return (
    <div className="grid gap-2">
      {days.map((day) => (
        <div key={day.label}>
          <p className="text-muted-foreground">{day.label}</p>
          <ul>
            {day.events.map(([time, title]) => (
              <DemoRow key={time}>
                <span className="w-[5ch] text-muted-foreground">{time}</span>
                <span className="truncate">{title}</span>
              </DemoRow>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Widget() {
  return <Days />;
}

export function Page() {
  return (
    <ModulePage title="Agenda">
      <Days />
    </ModulePage>
  );
}
