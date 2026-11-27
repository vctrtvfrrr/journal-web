import { useState } from "react";
import { Checkbox } from "../../components/ui/checkbox";
import { DemoRow, ModulePage } from "../demo-badge";

const habits = [
  { id: "run", title: "Run", goal: "4 times a week", done: 3, target: 4 },
  { id: "read", title: "Read 20 min", goal: "every day", done: 5, target: 7 },
  { id: "water", title: "Drink water", goal: "8 glasses", done: 4, target: 8 },
];

function Progress({ done, target }: { done: number; target: number }) {
  return (
    <span className="text-muted-foreground" aria-label={`${done} of ${target}`}>
      <span aria-hidden>
        {"▮".repeat(done)}
        {"▯".repeat(target - done)}
      </span>
    </span>
  );
}

function Habits({ showGoal }: { showGoal: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({ run: true });
  return (
    <ul>
      {habits.map((habit) => (
        <DemoRow key={habit.id}>
          <Checkbox
            aria-label={habit.title}
            checked={checked[habit.id] ?? false}
            onCheckedChange={(value) => setChecked({ ...checked, [habit.id]: value === true })}
          />
          <span className="truncate">{habit.title}</span>
          {showGoal && <span className="text-muted-foreground">{habit.goal}</span>}
          <span className="ml-auto">
            <Progress done={habit.done} target={habit.target} />
          </span>
        </DemoRow>
      ))}
    </ul>
  );
}

export function Widget() {
  return <Habits showGoal={false} />;
}

export function Page() {
  return (
    <ModulePage title="Rhythms">
      <Habits showGoal />
    </ModulePage>
  );
}
