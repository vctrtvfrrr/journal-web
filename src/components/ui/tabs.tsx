import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../../lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "line" | "inverted" | "group";
  numbered?: boolean;
};

function TabsList({ className, variant = "line", numbered = false, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-numbered={numbered || undefined}
      className={cn(
        "group/tabs flex w-full items-end overflow-x-auto overflow-y-hidden [counter-reset:tab]",
        variant === "line" && "shadow-[inset_0_-1px_0_0_var(--border-strong)]",
        variant === "inverted" && "gap-[1ch]",
        variant === "group" && "items-stretch [&>*:not(:first-child)]:-ml-px",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-[1ch] whitespace-nowrap px-[1.5ch] text-muted-foreground outline-none [counter-increment:tab] hover:text-foreground focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
        "group-data-numbered/tabs:before:text-muted-foreground group-data-numbered/tabs:before:content-['['_counter(tab)_']']",
        "group-data-[variant=line]/tabs:border group-data-[variant=line]/tabs:border-transparent group-data-[variant=line]/tabs:aria-selected:border-border-strong group-data-[variant=line]/tabs:aria-selected:border-b-background group-data-[variant=line]/tabs:aria-selected:bg-background group-data-[variant=line]/tabs:aria-selected:text-accent-ink",
        "group-data-[variant=group]/tabs:flex-1 group-data-[variant=group]/tabs:justify-center group-data-[variant=group]/tabs:border group-data-[variant=group]/tabs:border-border-strong group-data-[variant=group]/tabs:aria-selected:relative group-data-[variant=group]/tabs:aria-selected:border-accent group-data-[variant=group]/tabs:aria-selected:bg-accent group-data-[variant=group]/tabs:aria-selected:text-accent-foreground",
        "group-data-[variant=inverted]/tabs:h-6 group-data-[variant=inverted]/tabs:aria-selected:bg-accent group-data-[variant=inverted]/tabs:aria-selected:text-accent-foreground group-data-[variant=inverted]/tabs:aria-selected:before:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
