import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCompanyData } from "@/lib/data";
import { toModel, scenarioInputs } from "@/lib/modelAdapter";
import { applyScenario, evaluate } from "@/lib/profitVelocityEngine";
import { Loading, PageHeader, Panel } from "@/components/common";

export const Route = createFileRoute("/_authenticated/dev/engine")({
  head: () => ({
    meta: [
      { title: "Engine test — AndaFlows" },
      { name: "description", content: "Raw evaluate() output for the seed data, next to the expected results." },
      { property: "og:title", content: "Engine test — AndaFlows" },
      { property: "og:description", content: "Raw evaluate() output for the seed data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevEngine,
});

/** Expected results for the seed data (unadjusted base model). */
const EXPECTED: { label: string; value: number; pick: (e: ReturnType<typeof evaluate>) => number | null | undefined; tol: number }[] = [
  { label: "CNC Machining utilization (%)", value: 108.5, tol: 0.05, pick: (e) => { const g = e.groups.find((x) => x.name === "CNC Machining"); return g ? g.utilization * 100 : null; } },
  { label: "Velocity A ($/constraint hr)", value: 600, tol: 0.5, pick: (e) => e.products.find((p) => p.name.endsWith("A"))?.velocity },
  { label: "Velocity B ($/constraint hr)", value: 300, tol: 0.5, pick: (e) => e.products.find((p) => p.name.endsWith("B"))?.velocity },
  { label: "Velocity C ($/constraint hr)", value: 1000, tol: 0.5, pick: (e) => e.products.find((p) => p.name.endsWith("C"))?.velocity },
  { label: "Revenue", value: 310000, tol: 0.5, pick: (e) => e.totals.revenue },
  { label: "Throughput", value: 171000, tol: 0.5, pick: (e) => e.totals.throughput },
  { label: "Profit", value: 60000, tol: 0.5, pick: (e) => e.totals.profit },
  { label: "Portfolio velocity", value: 579.7, tol: 0.1, pick: (e) => e.totals.portfolioVelocity },
];

function DevEngine() {
  const { data, isLoading, error } = useCompanyData();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  if (error || !data) return <p className="p-6 text-destructive">{String(error?.message ?? "No data")}</p>;
  const id = scenarioId ?? data.scenarios[0]?.id ?? null;

  let base: ReturnType<typeof evaluate> | null = null;
  let adjusted: ReturnType<typeof evaluate> | null = null;
  let model: unknown = null;
  let err: string | null = null;
  try {
    const m = toModel(data, id);
    const inp = scenarioInputs(data, id);
    model = m;
    base = evaluate(m, { constraintGroupId: inp.pinnedGroupId });
    adjusted = evaluate(applyScenario(m, inp.adjustments), { constraintGroupId: inp.pinnedGroupId });
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Engine test" description="evaluate() on the rows loaded for a scenario, compared with the spec's expected results." />
      <label className="flex items-center gap-2 text-sm">
        Scenario
        <select className="rounded-md border bg-background px-2 py-1" value={id ?? ""} onChange={(e) => setScenarioId(e.target.value)}>
          {data.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.version_label})</option>)}
        </select>
      </label>
      {err && <p className="text-destructive">{err}</p>}
      {base && (
        <Panel title="Expected vs engine (base model, no adjustments)">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Figure</th><th>Expected</th><th>Engine</th><th>Match</th></tr></thead>
            <tbody>
              {EXPECTED.map((x) => {
                const v = x.pick(base!);
                const ok = v != null && Math.abs(v - x.value) <= x.tol;
                return (
                  <tr key={x.label} className="border-t">
                    <td className="py-1">{x.label}</td>
                    <td>{x.value.toLocaleString()}</td>
                    <td>{v == null ? "—" : Number(v.toFixed(2)).toLocaleString()}</td>
                    <td className={ok ? "text-positive" : "text-negative"}>{ok ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
      <Panel title="evaluate() — base model"><pre className="overflow-auto text-xs">{JSON.stringify(base, null, 2)}</pre></Panel>
      <Panel title="evaluate() — with scenario adjustments"><pre className="overflow-auto text-xs">{JSON.stringify(adjusted, null, 2)}</pre></Panel>
      <Panel title="Model built by modelAdapter"><pre className="overflow-auto text-xs">{JSON.stringify(model, null, 2)}</pre></Panel>
    </div>
  );
}
