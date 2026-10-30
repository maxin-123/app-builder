import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useCompanyData, useMe, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { exportCsv, money, num, signedMoney } from "@/lib/format";
import { IssuesPanel, Loading, PageHeader, Panel, ShiftBadge, Variance } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Totals } from "@/lib/profitVelocityEngine";

export const Route = createFileRoute("/_authenticated/statements")({
  head: () => ({ meta: [{ title: "Statements — AndaFlows" }, { name: "description", content: "Throughput accounting statement with variance." }] }),
  component: Statements,
});

function lines(t: Totals) {
  return [
    { label: "Revenue", v: t.revenue, strong: false },
    { label: "Materials & throughput costs", v: -(t.revenue - t.throughput), strong: false },
    { label: "Throughput", v: t.throughput, strong: true },
    { label: "Other variable costs", v: -(t.throughput - t.contributionMargin), strong: false },
    { label: "Contribution margin", v: t.contributionMargin, strong: true },
    { label: "Operating expense", v: -t.operatingExpense, strong: false },
    { label: "Profit", v: t.profit, strong: true },
  ];
}

function Statements() {
  const { data } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  const name = data?.scenarios.find((s) => s.id === scenarioId)?.name ?? "Scenario";
  if (!data) return <Loading />;
  if (a.issues.length) return <><PageHeader title="Statements" /><IssuesPanel issues={a.issues} /></>;
  if (!a.run || !a.compare) return <PageHeader title="Statements" description="Select a scenario." />;

  const cur_ = lines(a.run.evaluation.totals);
  const base = lines(a.compare.evaluation.totals);
  const rows = cur_.map((l, i) => ({ ...l, b: base[i].v, d: l.v - base[i].v }));
  const baseProducts = new Map(a.compare.evaluation.products.map((p) => [p.productId, p]));

  return (
    <>
      <PageHeader
        title="Statements"
        description={`${name} compared with ${a.compareLabel}.`}
        actions={
          <>
            <ShiftBadge shift={a.shift} />
            <Button size="sm" variant="outline" onClick={() => exportCsv("statement.csv", rows.map((r) => ({ line: r.label, [name]: r.v.toFixed(2), [a.compareLabel]: r.b.toFixed(2), variance: r.d.toFixed(2) })))}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          </>
        }
      />
      <Panel title="Throughput statement">
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Line</TableHead>
                <TableHead className="text-right">{name}</TableHead>
                <TableHead className="text-right">{a.compareLabel}</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label} className={cn(r.strong && "bg-muted/50 font-semibold")}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="tabular text-right">{money(r.v, cur)}</TableCell>
                  <TableCell className="tabular text-right">{money(r.b, cur)}</TableCell>
                  <TableCell className="text-right"><Variance value={r.d} text={signedMoney(r.d, cur)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title="By product" className="mt-6">
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Product</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Throughput</TableHead>
                <TableHead className="text-right">Contribution</TableHead>
                <TableHead className="text-right">Contribution variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.run.evaluation.products.map((p) => {
                const b = baseProducts.get(p.productId);
                const d = p.totalContributionMargin - (b?.totalContributionMargin ?? 0);
                return (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tabular text-right">{num(p.volume)}</TableCell>
                    <TableCell className="tabular text-right">{money(p.totalThroughput, cur)}</TableCell>
                    <TableCell className="tabular text-right">{money(p.totalContributionMargin, cur)}</TableCell>
                    <TableCell className="text-right"><Variance value={d} text={signedMoney(d, cur)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
