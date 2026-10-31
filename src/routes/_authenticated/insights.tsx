import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompanyData, useMe, useScenarioAnalysis, analyzeScenario } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { profitBridge } from "@/lib/profitVelocityEngine";
import { money } from "@/lib/format";
import { KPI } from "@/lib/kpiDefinitions";
import { BridgeChart } from "@/components/BridgeChart";
import { Empty, IssuesPanel, Loading, PageHeader, Panel } from "@/components/common";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — AndaFlows" }, { name: "description", content: "Profit bridge, variance, trend and contribution by product." }, { property: "og:title", content: "Insights — AndaFlows" }, { property: "og:description", content: "Profit bridge, variance, trend and contribution by product." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Insights,
});

const PERIODS = ["all", "Actual", "Budget", "Forecast", "Simulation"] as const;

function Insights() {
  const { data, isLoading } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId, setScenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  const [product, setProduct] = useState("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("all");

  const bridge = useMemo(() => {
    if (!a.run) return null;
    try {
      return profitBridge(a.run.baseModel, a.run.adjustments);
    } catch {
      return null;
    }
  }, [a.run]);

  const trend = useMemo(() => {
    if (!data) return [];
    return data.scenarios
      .filter((s) => period === "all" || s.version_label === period)
      .map((s) => {
        const r = analyzeScenario(data, s.id).run?.evaluation;
        const p = product === "all" ? null : r?.products.find((x) => x.productId === product);
        return {
          name: s.name,
          profit: p ? null : r?.totals.profit ?? null,
          throughput: p ? p.totalThroughput : r?.totals.throughput ?? null,
          contribution: p ? p.totalContributionMargin : r?.totals.contributionMargin ?? null,
        };
      });
  }, [data, period, product]);

  if (isLoading || !data) return <Loading />;
  const filters = (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Filter label="Scenario">
        <Select value={scenarioId ?? undefined} onValueChange={setScenarioId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{data.scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </Filter>
      <Filter label="Product">
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Filter>
      <Filter label="Period (version)">
        <Select value={period} onValueChange={(v) => setPeriod(v as (typeof PERIODS)[number])}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p} value={p}>{p === "all" ? "All versions" : p}</SelectItem>)}</SelectContent>
        </Select>
      </Filter>
    </div>
  );
  if (a.issues.length) return <><PageHeader title="Insights" />{filters}<IssuesPanel issues={a.issues} /></>;
  if (!a.run) return <><PageHeader title="Insights" />{filters}<Empty title="Select a scenario" /></>;

  const ev = a.run.evaluation;
  const base = new Map(a.compare?.evaluation.products.map((p) => [p.productId, p]));
  const prods = ev.products.filter((p) => product === "all" || p.productId === product);
  const cmData = prods.map((p) => ({ name: p.name, cm: p.totalContributionMargin }));
  const varData = prods.map((p) => ({ name: p.name, variance: p.totalContributionMargin - (base.get(p.productId)?.totalContributionMargin ?? 0) }));

  return (
    <>
      <PageHeader title="Insights" description="Where profit comes from and how it moves." />
      {filters}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Profit bridge: before → after adjustments">
          {bridge ? <BridgeChart bridge={bridge} currency={cur} baseLabel="Base" endLabel="Scenario" /> : <Empty title="Bridge not available" />}
        </Panel>
        <Panel title={`Contribution variance vs ${a.compareLabel}`}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={varData} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => money(v, cur)} />
                <Tooltip formatter={(v) => [money(Number(v), cur), "Variance"]} />
                <Bar dataKey="variance" radius={[3, 3, 3, 3]}>
                  {varData.map((d) => <Cell key={d.name} fill={d.variance >= 0 ? "var(--positive)" : "var(--negative)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Trend across scenarios">
          {trend.length === 0 ? <Empty title="No scenarios in this period" /> : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ left: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => money(v, cur)} />
                  <Tooltip formatter={(v) => money(Number(v), cur)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="throughput" name="Throughput" stroke="var(--chart-2)" strokeWidth={2} />
                  <Line dataKey="contribution" name="Contribution" stroke="var(--chart-1)" strokeWidth={2} />
                  {product === "all" && <Line dataKey="profit" name="Profit" stroke="var(--chart-4)" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Contribution margin by product">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={cmData} margin={{ left: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => money(v, cur)} />
                <Tooltip formatter={(v) => [money(Number(v), cur), "Contribution"]} />
                <Bar dataKey="cm" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="KPI definitions" className="mt-6">
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.values(KPI).map((k) => (
            <div key={k.label}>
              <dt className="text-sm font-medium">{k.label}</dt>
              <dd className="mt-1 rounded bg-muted px-2 py-1 font-mono text-xs">{k.formula}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">The constraint is a machine group, never a single machine. Pure TOC users: leave other variable cost at 0 and put all labour in operating expense.</p>
      </Panel>
    </>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
