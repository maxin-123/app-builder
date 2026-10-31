import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, HelpCircle, Info, Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ConstraintInfo } from "@/lib/profitVelocityEngine";
import { pct } from "@/lib/format";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={`How ${label} is calculated`} className="inline-flex rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <HelpCircle className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

/** Column header / label with a formula tooltip. */
export function Th({ label, formula }: { label: string; formula?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      {formula && <InfoTip label={label}>{formula}</InfoTip>}
    </span>
  );
}

export function Kpi({ label, value, delta, hint, formula }: { label: string; value: string; delta?: { value: number; text: string } | null; hint?: string; formula?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {formula && <InfoTip label={label}>{formula}</InfoTip>}
      </div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {delta && <Variance value={delta.value} text={delta.text} className="mt-1 text-xs" />}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Green/red is reserved for positive/negative variance. */
export function Variance({ value, text, className }: { value: number; text: string; className?: string }) {
  const tone = Math.abs(value) < 1e-9 ? "text-muted-foreground" : value > 0 ? "text-positive" : "text-negative";
  return <span className={cn("tabular font-medium", tone, className)}>{text}</span>;
}

export function ShiftBadge({ shift }: { shift: { from: string; to: string } | null }) {
  if (!shift) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
      Constraint shifted: {shift.from} <ArrowRight className="h-3 w-3" /> {shift.to}
    </span>
  );
}

export function ConstraintSummary({ constraint }: { constraint: ConstraintInfo | null }) {
  if (!constraint) return <p className="text-sm text-muted-foreground">No product is routed through a machine group yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{constraint.name}</span>
        {constraint.pinned && (
          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">Load {pct(constraint.utilization)} of capacity</div>
      {!constraint.binding && (
        <div className="flex gap-2 rounded-md bg-secondary p-2 text-xs text-secondary-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No machine group is at 100% load. Your real constraint is probably market demand.
        </div>
      )}
    </div>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {items.map((w) => (
        <div key={w} className="flex gap-2 rounded-md border bg-card p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

export function IssuesPanel({ issues }: { issues: string[] }) {
  return (
    <Panel title="Your data needs a fix before it can be calculated">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Go to Products &amp; Constraint to correct these.</p>
    </Panel>
  );
}

export function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Prominent banner when the engine says the plan doesn't fit capacity. */
export function InfeasibleBanner({ feasible }: { feasible: boolean }) {
  if (feasible) return null;
  return (
    <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-negative bg-negative-soft p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
      <div>
        <p className="font-semibold text-negative">This plan is not achievable as planned</p>
        <p className="mt-0.5 text-foreground">At least one machine group is loaded above its capacity, so the profit shown can't be reached.</p>
      </div>
    </div>
  );
}
