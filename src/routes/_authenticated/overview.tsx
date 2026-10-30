import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompanyData, useMe, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { money, num, pct, signedMoney } from "@/lib/format";
import { ConstraintSummary, IssuesPanel, Kpi, Loading, PageHeader, Panel, ShiftBadge, Warnings } from "@/components/common";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({ meta: [{ title: "Overview — AndaFlows" }, { name: "description", content: "Profit, throughput and your bottleneck at a glance." }] }),
  component: Overview,
});

function Overview() {
  const { data } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  if (!data) return <Loading />;
  if (a.issues.length) return <><PageHeader title="Overview" /><IssuesPanel issues={a.issues} /></>;
  if (!a.run) return <><PageHeader title="Overview" /><p className="text-sm text-muted-foreground">Create a scenario to get started.</p></>;

  const ev = a.run.evaluation;
  const base = a.compare?.evaluation;
  const d = (x: number, y: number | undefined) => (y == null ? null : { value: x - y, text: `${signedMoney(x - y, cur)} vs ${a.compareLabel}` });
  const chart = ev.groups.map((g) => ({ name: g.name, utilization: Number.isFinite(g.utilization) ? g.utilization * 100 : 200, id: g.groupId }));
  const ranked = [...ev.products].filter((p) => p.rank != null).sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0));

  return (
    <>
      <PageHeader title="Overview" description="How the selected scenario performs on your bottleneck." actions={<ShiftBadge shift={a.shift} />} />
      <Warnings items={ev.warnings} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={money(ev.totals.revenue, cur)} delta={d(ev.totals.revenue, base?.totals.revenue)} />
        <Kpi label="Throughput" value={money(ev.totals.throughput, cur)} delta={d(ev.totals.throughput, base?.totals.throughput)} />
        <Kpi label="Profit" value={money(ev.totals.profit, cur)} delta={d(ev.totals.profit, base?.totals.profit)} />
        <Kpi
          label="Portfolio velocity"
          value={ev.totals.portfolioVelocity == null ? "—" : `${money(ev.totals.portfolioVelocity, cur)}/h`}
          hint="Throughput per constraint hour"
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Constraint">
          <ConstraintSummary constraint={ev.constraint} />
        </Panel>
        <Panel title="Machine group load" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: -16 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis unit="%" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
                <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
                  {chart.map((c) => (
                    <Cell key={c.id} fill={c.id === ev.constraint?.groupId ? "var(--chart-1)" : "var(--chart-3)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel
        title="Product ranking by Profit Velocity"
        className="mt-6"
        action={<Link to="/products" className="text-sm text-primary hover:underline">Details</Link>}
      >
        <div className="space-y-3">
          {ranked.map((p) => (
            <div key={p.productId} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[24px_160px_1fr_120px]">
              <span className="tabular text-muted-foreground">{p.rank}</span>
              <span className="truncate font-medium">{p.name}</span>
              <div className="hidden h-2 rounded-full bg-secondary sm:block">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${p.score ?? 0}%` }} />
              </div>
              <span className="tabular text-right">{money(p.velocity, cur)}/h</span>
            </div>
          ))}
          {ranked.length === 0 && <p className="text-sm text-muted-foreground">No products use the constraint.</p>}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Constraint hours used: {num(ev.totals.constraintHours, 1)} h · {ev.feasible ? "Plan fits capacity" : "Plan exceeds capacity"} ·{" "}
          {ev.constraint ? `Load ${pct(ev.constraint.utilization)}` : ""}
        </p>
      </Panel>
    </>
  );
}
