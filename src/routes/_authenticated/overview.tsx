import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GitCompare, Plus, Sparkles } from "lucide-react";
import { useCompanyData, useMe, usePermissions, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { money, num, pct, signedMoney } from "@/lib/format";
import { KPI } from "@/lib/kpiDefinitions";
import { Empty, InfeasibleBanner, IssuesPanel, Kpi, Loading, PageHeader, Panel, ShiftBadge, Th } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ProductResult } from "@/lib/profitVelocityEngine";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({ meta: [{ title: "Overview — AndaFlows" }, { name: "description", content: "Profit, throughput and your bottleneck at a glance." }] }),
  component: Overview,
});

function Overview() {
  const { data, isLoading } = useCompanyData();
  const { data: me } = useMe();
  const { canEdit } = usePermissions();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  if (isLoading || !data) return <Loading />;

  const actions = (
    <>
      <ShiftBadge shift={a.shift} />
      {canEdit && (
        <Button size="sm" asChild><Link to="/scenarios" search={{ action: "new" }}><Plus className="mr-1 h-4 w-4" /> New scenario</Link></Button>
      )}
      <Button size="sm" variant="outline" asChild><Link to="/scenarios" search={{ tab: "compare" }}><GitCompare className="mr-1 h-4 w-4" /> Compare</Link></Button>
      {canEdit && (
        <Button size="sm" variant="outline" asChild><Link to="/scenarios" search={{ action: "optimize" }}><Sparkles className="mr-1 h-4 w-4" /> Optimize mix</Link></Button>
      )}
    </>
  );

  if (data.scenarios.length === 0)
    return <><PageHeader title="Overview" actions={actions} /><Empty title="No scenarios yet" description="Create a scenario to see profit and your bottleneck." /></>;
  if (a.issues.length) return <><PageHeader title="Overview" actions={actions} /><IssuesPanel issues={a.issues} /></>;
  if (!a.run) return <Loading />;

  const ev = a.run.evaluation;
  const base = a.compare?.evaluation;
  const d = (x: number | null, y: number | null | undefined, fmt: (v: number) => string) =>
    x == null || y == null ? null : { value: x - y, text: `${fmt(x - y)} vs ${a.compareLabel}` };
  const ranked = ev.products.filter((p) => p.rank != null).sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0));
  const top = ranked.slice(0, 3);
  const bottom = ranked.length > 3 ? ranked.slice(-3).reverse() : [];
  const cg = ev.groups.find((g) => g.groupId === ev.constraint?.groupId);
  const chart = ranked.map((p) => ({ name: p.name, velocity: p.velocity ?? 0, id: p.productId }));

  return (
    <>
      <PageHeader title="Overview" description="How the selected scenario performs on your bottleneck." actions={actions} />
      <InfeasibleBanner feasible={ev.feasible} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" formula={KPI.revenue.formula} value={money(ev.totals.revenue, cur)} delta={d(ev.totals.revenue, base?.totals.revenue, (v) => signedMoney(v, cur))} />
        <Kpi label="Throughput" formula={KPI.throughput.formula} value={money(ev.totals.throughput, cur)} delta={d(ev.totals.throughput, base?.totals.throughput, (v) => signedMoney(v, cur))} />
        <Kpi label="Profit" formula={KPI.profit.formula} value={money(ev.totals.profit, cur)} delta={d(ev.totals.profit, base?.totals.profit, (v) => signedMoney(v, cur))} />
        <Kpi
          label="Portfolio velocity"
          formula={KPI.portfolioVelocity.formula}
          value={ev.totals.portfolioVelocity == null ? "—" : `${money(ev.totals.portfolioVelocity, cur, 1)}/h`}
          delta={d(ev.totals.portfolioVelocity, base?.totals.portfolioVelocity, (v) => `${v > 0 ? "+" : ""}${money(v, cur, 1)}/h`)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Constraint">
          {ev.constraint && cg ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{ev.constraint.name}</span>
                <Badge variant={ev.constraint.binding ? "default" : "secondary"}>{ev.constraint.binding ? "Binding" : "Non-binding"}</Badge>
                {ev.constraint.pinned && <Badge variant="outline">Pinned</Badge>}
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground"><Th label="Utilization" formula={KPI.utilization.formula} /></span>
                  <span className="tabular font-medium">{pct(ev.constraint.utilization, 1)}</span>
                </div>
                <Progress value={Math.min(100, ev.constraint.utilization * 100)} className="h-2" />
                <p className="tabular mt-2 text-xs text-muted-foreground">
                  {num(cg.loadHours, 1)} h load / {num(cg.capacityHours, 1)} h capacity
                  {cg.overloadHours > 0 && ` · ${num(cg.overloadHours, 1)} h over`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No product is routed through a machine group yet.</p>
          )}
          {ev.warnings.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-xs">
              {ev.warnings.map((w) => <li key={w} className="text-muted-foreground">{w}</li>)}
            </ul>
          )}
        </Panel>
        <Panel title="Velocity by product" className="lg:col-span-2">
          {chart.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ left: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} tickFormatter={(v) => money(v, cur)} />
                  <Tooltip formatter={(v) => [`${money(Number(v), cur)}/h`, "Velocity"]} />
                  <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
                    {chart.map((c, i) => <Cell key={c.id} fill={i === 0 ? "var(--chart-1)" : "var(--chart-2)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No product uses the constraint" />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <RankList title="Top 3 by velocity" items={top} cur={cur} />
        <RankList title="Bottom 3 by velocity" items={bottom} cur={cur} empty="Need more than 3 ranked products." />
      </div>
    </>
  );
}

function RankList({ title, items, cur, empty = "No ranked products." }: { title: string; items: ProductResult[]; cur: string; empty?: string }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.productId} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 text-sm">
              <span className="tabular text-muted-foreground">#{p.rank}</span>
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${p.score ?? 0}%` }} /></div>
              </div>
              <span className="tabular text-right">{money(p.velocity, cur)}/h</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
