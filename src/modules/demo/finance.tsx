import { useId, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "../../components/ui/sonner";
import { DemoRow, ModulePage } from "../demo-badge";

const month = { label: "November 2026", income: 8000, expenses: 3420 };

const categories = [
  ["Groceries", 1240],
  ["Housing", 1000],
  ["Transport", 430],
  ["Leisure", 310],
  ["Health", 280],
  ["Other", 160],
] as const;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL" });

function QuickAdd() {
  const id = useId();
  const [amount, setAmount] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAmount("");
    toast("Demo only: nothing was saved.");
  };
  return (
    <form className="flex min-w-0 items-center gap-[1ch]" onSubmit={submit}>
      <label htmlFor={`${id}-amount`} className="sr-only">
        Amount
      </label>
      <Input
        id={`${id}-amount`}
        inputMode="decimal"
        placeholder="- R$"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="min-w-0 flex-1"
      />
      <label htmlFor={`${id}-category`} className="sr-only">
        Category
      </label>
      <select id={`${id}-category`} className="min-w-0 border border-border-strong bg-surface">
        {categories.map(([name]) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <Button type="submit" aria-label="Add expense">
        <span aria-hidden>+</span>
      </Button>
    </form>
  );
}

function Totals() {
  return (
    <p className="text-muted-foreground">
      {month.label}: −{money.format(month.expenses)} / +{money.format(month.income)}
    </p>
  );
}

export function Widget() {
  return (
    <div className="grid gap-2">
      <QuickAdd />
      <Totals />
    </div>
  );
}

export function Page() {
  const largest = categories[0][1];
  return (
    <ModulePage title="Finance">
      <QuickAdd />
      <dl className="flex flex-wrap gap-[3ch]">
        <div>
          <dt className="text-muted-foreground">Income</dt>
          <dd className="font-bold">+{money.format(month.income)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expenses</dt>
          <dd className="font-bold">−{money.format(month.expenses)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="font-bold">{money.format(month.income - month.expenses)}</dd>
        </div>
      </dl>
      <ul>
        {categories.map(([name, value]) => (
          <DemoRow key={name}>
            <span className="w-[10ch]">{name}</span>
            <span className="flex-1">
              <span
                aria-hidden
                className="inline-block h-2 bg-accent"
                style={{ width: `${(value / largest) * 100}%` }}
              />
            </span>
            <span className="w-[12ch] text-right">{money.format(value)}</span>
          </DemoRow>
        ))}
      </ul>
    </ModulePage>
  );
}
