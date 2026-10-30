import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useCompanyData, useMe, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { optimizeMix, sensitivity, ModelError, type SensitivityVariable } from "@/lib/profitVelocityEngine";
import { money, num, signedMoney } from "@/lib/format";
import { IssuesPanel, Loading, PageHeader, Panel, Variance, Warnings } from "@/components/common";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — AndaFlows" }, { name: "description", content: "Sensitivity and best product mix for your bottleneck." }] }),
  component: Insights,
});

const XS = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];

function Insights() {
  const { data } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  const [productId, setProductId] = useState<string | undefined>();
  const [variable, setVariable] = useState<SensitivityVariable>("price");
  const pid = productId ?? data?.products[0]?.id;

  const sens = useMemo(() => {
    if (!a.run || !pid) return null;
    try {
      return sensitivity(a.run.model, pid, variable, XS, { constraintGroupId: a.run.pinnedGroupId }).map((p) => ({ ...p, label: `${p.x > 0 ? "+" : ""}${Math.round(p.x * 100)}${variable === "mix" ? " pts" : "%"}` }));
    } catch (e) {
      return e instanceof ModelError ? e.issues : [String(e)];
    }
  }, [a.run, pid, variable]);

  const opt = useMemo(() => {
    if (!a.run) return null;
    try {
      return optimizeMix(a.run.model, { constraintGroupId: a.run.pinnedGroupId });
    } catch (e) {
      return e instanceof ModelError ? e.issues : [String(e)];
    }
  }, [a.run]);

  if (!data) return <Loading />;
  if (a.issues.length) return <><PageHeader title="Insights" /><IssuesPanel issues={a.issues} /></>;
  if (!a.run) return <PageHeader title="Insights" description="Select a scenario." />;
  const ev = a.run.evaluation;

  return (
    <>
      <PageHeader title="Insights" description={`Based on ${ev.constraint ? `${ev.constraint.name} as the constraint` : "the selected scenario"}.`} />
      <Panel
        title="Sensitivity"
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={pid} onValueChange={setProductId}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={variable} onValueChange={(v) => setVariable(v as SensitivityVariable)}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="materialCost">Material cost</SelectItem>
                <SelectItem value="mix">Mix share</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {Array.isArray(sens) && typeof sens[0] === "string" ? (
          <Warnings items={sens as string[]} />
        ) : sens ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartBox title="Velocity per constraint hour">
              <LineChart data={sens as Exclude<typeof sens, string[]>}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => money(v, cur)} />
                <Tooltip formatter={(v: number) => `${money(v, cur)}/h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="productVelocity" name="Product" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="portfolioVelocity" name="Portfolio" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartBox>
            <ChartBox title="Profit">
              <LineChart data={sens as Exclude<typeof sens, string[]>}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => money(v, cur)} />
                <Tooltip formatter={(v: number) => money(v, cur)} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartBox>
          </div>
        ) : null}
      </Panel>

      <Panel title="Best mix for the constraint" className="mt-6">
        {opt && !Array.isArray(opt) ? (
          <>
            <Warnings items={opt.warnings} />
            <p className="mb-4 text-sm">
              Filling {ev.constraint?.name ?? "the constraint"} with the highest-velocity products first would give profit of{" "}
              <span className="tabular font-semibold">{money(opt.evaluation.totals.profit, cur)}</span>{" "}
              (<Variance value={opt.evaluation.totals.profit - ev.totals.profit} text={signedMoney(opt.evaluation.totals.profit - ev.totals.profit, cur)} />).
            </p>
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Current volume</TableHead>
                    <TableHead className="text-right">Suggested</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ev.products.map((p) => {
                    const s = opt.volumes[p.productId] ?? 0;
                    return (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="tabular text-right">{num(p.volume)}</TableCell>
                        <TableCell className="tabular text-right">{num(s)}</TableCell>
                        <TableCell className="text-right"><Variance value={s - p.volume} text={`${s - p.volume > 0 ? "+" : ""}${num(s - p.volume)}`} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Demand caps use each product's max demand. Apply this mix from Scenarios with “Optimise mix”.</p>
          </>
        ) : (
          <Warnings items={(opt as string[] | null) ?? []} />
        )}
      </Panel>
    </>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="h-64"><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </div>
  );
}
