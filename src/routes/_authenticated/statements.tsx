import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { runScenario, useCompanyData, useMe, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { exportCsv, exportXlsx, money, signedMoney } from "@/lib/format";
import { KPI } from "@/lib/kpiDefinitions";
import { Empty, InfeasibleBanner, IssuesPanel, Loading, PageHeader, Panel, ShiftBadge, Th, Variance } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Evaluation, ProductResult } from "@/lib/profitVelocityEngine";

export const Route = createFileRoute("/_authenticated/statements")({
  head: () => ({ meta: [{ title: "Statements — AndaFlows" }, { name: "description", content: "P&L and cash flow for a scenario with variance and product drill-down." }, { property: "og:title", content: "Statements — AndaFlows" }, { property: "og:description", content: "P&L and cash flow for a scenario with variance and product drill-down." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Statements,
});

type Line = { key: string; label: string; formula?: string; v: (e: Evaluation) => number; strong?: boolean; cost?: boolean; drill?: (p: ProductResult) => number };

// Every line is an engine total (or a difference of two engine totals).
const PNL: Line[] = [
  { key: "rev", label: "Revenue", formula: KPI.revenue.formula, v: (e) => e.totals.revenue },
  { key: "mat", label: "Material & other throughput costs", v: (e) => -(e.totals.revenue - e.totals.throughput), cost: true },
  { key: "t", label: "Throughput", formula: KPI.throughput.formula, v: (e) => e.totals.throughput, strong: true, drill: (p) => p.totalThroughput },
  { key: "ovc", label: "Other variable costs", v: (e) => -(e.totals.throughput - e.totals.contributionMargin), cost: true, drill: (p) => -(p.totalThroughput - p.totalContributionMargin) },
  { key: "cm", label: "Contribution margin", formula: KPI.contribution.formula, v: (e) => e.totals.contributionMargin, strong: true, drill: (p) => p.totalContributionMargin },
  { key: "opex", label: "Operating expense", v: (e) => -e.totals.operatingExpense, cost: true },
  { key: "p", label: "Profit", formula: KPI.profit.formula, v: (e) => e.totals.profit, strong: true },
];
const CASH: Line[] = [
  { key: "cin", label: "Cash received from sales", v: (e) => e.totals.revenue },
  { key: "cmat", label: "Paid for materials & throughput costs", v: (e) => -(e.totals.revenue - e.totals.throughput), cost: true },
  { key: "covc", label: "Paid for other variable costs", v: (e) => -(e.totals.throughput - e.totals.contributionMargin), cost: true },
  { key: "copex", label: "Paid operating expense", v: (e) => -e.totals.operatingExpense, cost: true },
  { key: "net", label: "Net operating cash flow", v: (e) => e.totals.profit, strong: true },
];

function Statements() {
  const { data, isLoading } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  const cur = me?.company.currency ?? "USD";
  const [against, setAgainst] = useState<string>("base");
  const scenario = data?.scenarios.find((s) => s.id === scenarioId);

  const cmp = useMemo(() => {
    if (!data || against === "base") return a.compare ? { ev: a.compare.evaluation, label: a.compareLabel } : null;
    try {
      return { ev: runScenario(data, against).evaluation, label: data.scenarios.find((s) => s.id === against)?.name ?? "" };
    } catch {
      return null;
    }
  }, [data, against, a]);

  if (isLoading || !data) return <Loading />;
  if (!scenario) return <><PageHeader title="Statements" /><Empty title="No scenario selected" /></>;
  if (a.issues.length) return <><PageHeader title="Statements" /><IssuesPanel issues={a.issues} /></>;
  if (!a.run) return <Loading />;
  const ev = a.run.evaluation;

  const rowsFor = (lines: Line[]) =>
    lines.map((l) => {
      const v = l.v(ev);
      const b = cmp ? l.v(cmp.ev) : null;
      return { line: l.label, [scenario.name]: round(v), [cmp?.label ?? "Comparison"]: b == null ? null : round(b), variance: b == null ? null : round(v - b), "variance %": b ? round(((v - b) / Math.abs(b)) * 100) : null };
    });

  return (
    <>
      <PageHeader
        title="Statements"
        description={`${scenario.name}${cmp ? ` compared with ${cmp.label}` : ""}.`}
        actions={
          <>
            <ShiftBadge shift={a.shift} />
            <Button size="sm" variant="outline" onClick={() => exportCsv(`${scenario.name}-pnl.csv`, rowsFor(PNL))}><Download className="mr-1 h-4 w-4" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => exportXlsx(`${scenario.name}-statements.xlsx`, { "P&L": rowsFor(PNL), "Cash flow": rowsFor(CASH), Products: ev.products.map((p) => ({ product: p.name, volume: p.volume, throughput: round(p.totalThroughput), contribution: round(p.totalContributionMargin) })) })}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </>
        }
      />
      <InfeasibleBanner feasible={ev.feasible} />
      <div className="mb-6 flex flex-col gap-1.5 sm:w-72">
        <Label className="text-xs text-muted-foreground">Variance against</Label>
        <Select value={against} onValueChange={setAgainst}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="base">Base ({a.compareLabel})</SelectItem>
            {data.scenarios.filter((s) => s.id !== scenario.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.version_label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <StatementTable title="Profit & loss" lines={PNL} ev={ev} cmp={cmp} name={scenario.name} cur={cur} />
      <StatementTable title="Cash flow" lines={CASH} ev={ev} cmp={cmp} name={scenario.name} cur={cur} className="mt-6" note="Assumes sales are collected and costs paid within the period." />
    </>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;

function StatementTable({ title, lines, ev, cmp, name, cur, className, note }: { title: string; lines: Line[]; ev: Evaluation; cmp: { ev: Evaluation; label: string } | null; name: string; cur: string; className?: string; note?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const baseProducts = new Map(cmp?.ev.products.map((p) => [p.productId, p]));
  return (
    <Panel title={title} className={className}>
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Line</TableHead>
              <TableHead className="text-right">{name}</TableHead>
              {cmp && <TableHead className="text-right">{cmp.label}</TableHead>}
              {cmp && <TableHead className="text-right">Variance</TableHead>}
              {cmp && <TableHead className="text-right">Var. %</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => {
              const v = l.v(ev);
              const b = cmp ? l.v(cmp.ev) : null;
              const isOpen = open === l.key;
              return (
                <Fragment key={l.key}>
                  <TableRow className={cn(l.strong && "bg-muted/50 font-semibold")}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {l.drill ? (
                          <Button size="icon" variant="ghost" className="h-6 w-6" aria-expanded={isOpen} aria-label={`Break down ${l.label} by product`} onClick={() => setOpen(isOpen ? null : l.key)}>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <span className="w-6" />
                        )}
                        <Th label={l.label} formula={l.formula} />
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">{money(v, cur)}</TableCell>
                    {cmp && <TableCell className="tabular text-right">{money(b, cur)}</TableCell>}
                    {cmp && b != null && <TableCell className="text-right"><Variance value={v - b} text={signedMoney(v - b, cur)} /></TableCell>}
                    {cmp && b != null && <TableCell className="text-right"><Variance value={v - b} text={b ? `${v - b > 0 ? "+" : ""}${(((v - b) / Math.abs(b)) * 100).toFixed(1)}%` : "—"} /></TableCell>}
                  </TableRow>
                  {isOpen &&
                    l.drill &&
                    ev.products.map((p) => {
                      const pv = l.drill!(p);
                      const bp = baseProducts.get(p.productId);
                      const pb = bp ? l.drill!(bp) : null;
                      return (
                        <TableRow key={p.productId} className="text-sm">
                          <TableCell className="pl-12 text-muted-foreground">{p.name}</TableCell>
                          <TableCell className="tabular text-right">{money(pv, cur)}</TableCell>
                          {cmp && <TableCell className="tabular text-right">{money(pb, cur)}</TableCell>}
                          {cmp && <TableCell className="text-right">{pb != null && <Variance value={pv - pb} text={signedMoney(pv - pb, cur)} />}</TableCell>}
                          {cmp && <TableCell className="text-right">{pb ? <Variance value={pv - pb} text={`${pv - pb > 0 ? "+" : ""}${(((pv - pb) / Math.abs(pb)) * 100).toFixed(1)}%`} /> : "—"}</TableCell>}
                        </TableRow>
                      );
                    })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
    </Panel>
  );
}

