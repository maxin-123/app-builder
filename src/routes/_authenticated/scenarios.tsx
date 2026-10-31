import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, Lock, Plus, RotateCcw, Save, Sparkles, Trash2, Unlock } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { analyzeScenario, useCompanyData, useMe, usePermissions, useRefresh, useScenarioAnalysis } from "@/lib/data";
import type { CompanyData } from "@/lib/modelAdapter";
import { useScenario } from "@/lib/scenario-context";
import { useDb, toNum } from "@/lib/mutations";
import { KPI } from "@/lib/kpiDefinitions";
import { optimizeMix, sensitivity, ModelError, type Optimization, type Scenario as EngineScenario, type SensitivityVariable } from "@/lib/profitVelocityEngine";
import { money, num, pct, signedMoney } from "@/lib/format";
import { EditCell, nonNegative, required } from "@/components/EditCell";
import { useConfirm } from "@/components/confirm";
import { Empty, InfeasibleBanner, IssuesPanel, Loading, PageHeader, Panel, ShiftBadge, Th, Variance, Warnings } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Tab = "workspace" | "compare" | "sensitivity" | "history";
type Search = { tab?: Tab; action?: "new" | "optimize" };

export const Route = createFileRoute("/_authenticated/scenarios")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: ["workspace", "compare", "sensitivity", "history"].includes(String(s.tab)) ? (s.tab as Tab) : undefined,
    action: s.action === "new" || s.action === "optimize" ? s.action : undefined,
  }),
  head: () => ({ meta: [{ title: "Scenarios — AndaFlows" }, { name: "description", content: "Model price, cost, volume and mix changes and see the profit impact live." }] }),
  component: ScenariosPage,
});

const LABELS = ["Actual", "Budget", "Forecast", "Simulation"] as const;
const AUTO = "__auto__";

function ScenariosPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/scenarios" });
  const { data, isLoading } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId, setScenarioId } = useScenario();
  const { canEdit, canLock } = usePermissions();
  const db = useDb();
  const refresh = useRefresh();
  const confirm = useConfirm();
  const cur = me?.company.currency ?? "USD";

  const [draft, setDraft] = useState<EngineScenario | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  useEffect(() => setDraft(null), [scenarioId]);
  useEffect(() => {
    if (search.action === "new") setNewOpen(true);
    if (search.action === "optimize") setOptOpen(true);
    if (search.action) navigate({ search: { tab: search.tab }, replace: true });
  }, [search.action, search.tab, navigate]);

  const a = useScenarioAnalysis(data, scenarioId, draft ?? undefined);
  if (isLoading || !data) return <Loading />;

  const scenario = data.scenarios.find((s) => s.id === scenarioId);
  const input = data.inputs.find((i) => i.scenario_id === scenarioId);
  const editable = canEdit && !!scenario && !scenario.is_locked;
  const tab = search.tab ?? "workspace";

  async function createScenario(o: { name: string; label: string; base: string | null; volumes?: Record<string, number>; adjustments?: EngineScenario }) {
    const src = data!.inputs.find((i) => i.scenario_id === o.base);
    const { data: s, error } = await supabase
      .from("scenarios")
      .insert({ name: o.name, version_label: o.label as (typeof LABELS)[number], base_scenario_id: o.base })
      .select()
      .single();
    if (error || !s) return toast.error(error?.message ?? "Could not create scenario");
    const { error: e2 } = await supabase.from("scenario_inputs").insert({
      scenario_id: s.id,
      volumes: (o.volumes ?? src?.volumes ?? {}) as Json,
      operating_expense: src?.operating_expense ?? 0,
      adjustments: (o.adjustments ?? src?.adjustments ?? {}) as Json,
      pinned_group_id: src?.pinned_group_id ?? null,
    });
    if (e2) return toast.error(e2.message);
    await refresh();
    setScenarioId(s.id);
    toast.success(`Created “${o.name}”`);
  }

  const saveInputs = (patch: Record<string, unknown>, ok?: string) => (input ? db.update("scenario_inputs", input.id, patch, ok) : Promise.resolve(false));

  async function resetToBase() {
    if (!scenario || !input) return;
    const base = data!.inputs.find((i) => i.scenario_id === scenario.base_scenario_id);
    const ok = await confirm({
      title: "Reset to base?",
      description: base ? "Volumes, operating expense and adjustments will be copied from the base scenario." : "All adjustments will be cleared.",
      action: "Reset",
    });
    if (!ok) return;
    const patch = base ? { volumes: base.volumes, operating_expense: base.operating_expense, adjustments: base.adjustments } : { adjustments: {} };
    if (await saveInputs(patch, "Reset to base")) setDraft(null);
  }

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Change prices, costs, volume and mix; results update instantly."
        actions={
          <>
            <ShiftBadge shift={a.shift} />
            {canEdit && <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> New scenario</Button>}
            {canEdit && a.run && <Button size="sm" variant="outline" onClick={() => setOptOpen(true)}><Sparkles className="mr-1 h-4 w-4" /> Optimize mix</Button>}
          </>
        }
      />
      <NewScenarioDialog open={newOpen} onOpenChange={setNewOpen} scenarios={data.scenarios} defaultBase={scenarioId} onCreate={createScenario} />
      {a.run && scenario && (
        <OptimizeDialog
          open={optOpen}
          onOpenChange={setOptOpen}
          data={data}
          run={a.run}
          cur={cur}
          onApply={(vols) =>
            createScenario({
              name: `${scenario.name} — optimized`,
              label: "Simulation",
              base: scenario.id,
              volumes: vols,
              adjustments: { price: a.run!.adjustments.price, materialCost: a.run!.adjustments.materialCost },
            })
          }
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Scenarios" className="space-y-2">
          {data.scenarios.length === 0 && <Empty title="No scenarios" description="Create your first scenario." />}
          {data.scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              aria-current={s.id === scenarioId}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                s.id === scenarioId && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.name}</span>
                {s.is_locked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.version_label}</div>
            </button>
          ))}
        </nav>

        {!scenario || !input ? (
          <Empty title="Select a scenario" description="Pick one on the left or create a new one." />
        ) : (
          <div className="min-w-0 space-y-6">
            <Panel>
              <div className="flex flex-wrap items-center gap-3">
                <EditCell type="text" label="Scenario name" value={scenario.name} disabled={!editable} validate={required} className="max-w-xs text-base font-semibold" onSave={(v) => db.update("scenarios", scenario.id, { name: v }, "Renamed")} />
                <Badge variant="secondary">{scenario.version_label}</Badge>
                {scenario.is_locked && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {canLock(scenario) && (
                    <Button size="sm" variant="outline" onClick={() => db.update("scenarios", scenario.id, { is_locked: !scenario.is_locked }, scenario.is_locked ? "Unlocked" : "Locked")}>
                      {scenario.is_locked ? <><Unlock className="mr-1 h-4 w-4" /> Unlock</> : <><Lock className="mr-1 h-4 w-4" /> Lock</>}
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => createScenario({ name: `${scenario.name} (copy)`, label: scenario.version_label, base: scenario.id })}>
                      <Copy className="mr-1 h-4 w-4" /> Duplicate
                    </Button>
                  )}
                  {editable && <Button size="sm" variant="outline" onClick={resetToBase}><RotateCcw className="mr-1 h-4 w-4" /> Reset to base</Button>}
                  {editable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete scenario"
                      onClick={async () => (await confirm({ title: `Delete “${scenario.name}”?`, description: "This can't be undone." })) && db.remove("scenarios", scenario.id, "Scenario deleted")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Labeled label="Version label">
                  <Select value={scenario.version_label} disabled={!editable} onValueChange={(v) => db.update("scenarios", scenario.id, { version_label: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Base scenario">
                  <Select value={scenario.base_scenario_id ?? "none"} disabled={!editable} onValueChange={(v) => db.update("scenarios", scenario.id, { base_scenario_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (compare to before adjustments)</SelectItem>
                      {data.scenarios.filter((s) => s.id !== scenario.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Operating expense">
                  <EditCell label="Operating expense" value={input.operating_expense} validate={nonNegative} disabled={!editable} format={(v) => money(Number(v), cur)} onSave={(v) => saveInputs({ operating_expense: toNum(v) ?? 0 })} />
                </Labeled>
                <Labeled label="Constraint group">
                  <Select value={input.pinned_group_id ?? AUTO} disabled={!editable} onValueChange={(v) => saveInputs({ pinned_group_id: v === AUTO ? null : v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Auto-detect (most utilized)</SelectItem>
                      {data.groups.map((g) => <SelectItem key={g.id} value={g.id}>Pin: {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Labeled>
              </div>
            </Panel>

            <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
                <TabsTrigger value="workspace">Workspace</TabsTrigger>
                <TabsTrigger value="compare">Compare</TabsTrigger>
                <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="workspace" className="mt-4">
                {a.issues.length > 0 && <div className="mb-6"><IssuesPanel issues={a.issues} /></div>}
                {a.run && (
                  <>
                    <InfeasibleBanner feasible={a.run.evaluation.feasible} />
                    <Warnings items={a.run.evaluation.warnings.filter((w) => !w.startsWith("Plan exceeds"))} />
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
                      <div className="min-w-0 space-y-6">
                        <ResultStrip a={a} cur={cur} />
                        <ProductTable data={data} a={a} cur={cur} editable={editable} onVolume={(pid, v) => saveInputs({ volumes: { ...a.run!.baseModel.volumes, [pid]: v } })} />
                      </div>
                      <SimulationPanel
                        data={data}
                        value={draft ?? a.run.adjustments}
                        dirty={draft !== null}
                        editable={editable}
                        onChange={setDraft}
                        onDiscard={() => setDraft(null)}
                        onSave={async () => {
                          if (await saveInputs({ adjustments: (draft ?? {}) as unknown as Json }, "Adjustments saved")) setDraft(null);
                        }}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="compare" className="mt-4"><CompareTab data={data} current={scenario.id} cur={cur} /></TabsContent>
              <TabsContent value="sensitivity" className="mt-4">{a.run ? <SensitivityTab data={data} a={a} cur={cur} /> : <IssuesPanel issues={a.issues} />}</TabsContent>
              <TabsContent value="history" className="mt-4"><HistoryTab scenario={scenario} input={input} /></TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </>
  );
}

type Analysis = ReturnType<typeof analyzeScenario>;

function ResultStrip({ a, cur }: { a: Analysis; cur: string }) {
  const ev = a.run!.evaluation;
  const c = a.compare?.evaluation;
  const items = [
    { label: "Revenue", f: KPI.revenue.formula, v: ev.totals.revenue, b: c?.totals.revenue },
    { label: "Throughput", f: KPI.throughput.formula, v: ev.totals.throughput, b: c?.totals.throughput },
    { label: "Profit", f: KPI.profit.formula, v: ev.totals.profit, b: c?.totals.profit },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border bg-card p-3 shadow-card">
          <div className="text-xs text-muted-foreground"><Th label={i.label} formula={i.f} /></div>
          <div className="tabular mt-1 text-lg font-semibold">{money(i.v, cur)}</div>
          {i.b != null && <Variance value={i.v - i.b} text={signedMoney(i.v - i.b, cur)} className="text-xs" />}
        </div>
      ))}
      <div className="rounded-lg border bg-card p-3 shadow-card">
        <div className="text-xs text-muted-foreground"><Th label="Constraint" /></div>
        <div className="mt-1 truncate text-lg font-semibold">{ev.constraint?.name ?? "—"}</div>
        <div className="tabular text-xs text-muted-foreground">{ev.constraint ? `${pct(ev.constraint.utilization, 1)} · ${ev.constraint.binding ? "binding" : "non-binding"}` : ""}</div>
      </div>
      <p className="col-span-full text-xs text-muted-foreground">Variance vs {a.compareLabel}</p>
    </div>
  );
}

function ProductTable({ data, a, cur, editable, onVolume }: { data: CompanyData; a: Analysis; cur: string; editable: boolean; onVolume: (pid: string, v: number) => void }) {
  const run = a.run!;
  const prices = new Map(run.model.products.map((p) => [p.id, p.price]));
  return (
    <Panel title="Products">
      {data.products.length === 0 ? (
        <Empty title="No products yet" description="Add products under Products & Constraint." />
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[110px]">Product</TableHead>
                <TableHead><Th label="Base vol." formula="Planned units before volume and mix adjustments" /></TableHead>
                <TableHead className="text-right"><Th label="Volume" formula="After volume and mix adjustments" /></TableHead>
                <TableHead className="text-right"><Th label="Price" formula="After price adjustment" /></TableHead>
                <TableHead className="text-right"><Th label="T" formula={KPI.throughput.formula.split(", where ")[1]} /></TableHead>
                <TableHead className="text-right"><Th label="CM" formula={KPI.contribution.formula} /></TableHead>
                <TableHead className="text-right"><Th label="Constr. min" formula="Minutes per unit on the constraint group" /></TableHead>
                <TableHead className="text-right"><Th label="Velocity" formula={KPI.velocity.formula} /></TableHead>
                <TableHead className="text-right"><Th label="Score" formula={KPI.score.formula} /></TableHead>
                <TableHead className="text-right">Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.evaluation.products.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <EditCell label={`Base volume for ${r.name}`} value={run.baseModel.volumes[r.productId] ?? 0} validate={nonNegative} disabled={!editable} format={(v) => num(Number(v))} onSave={(v) => onVolume(r.productId, toNum(v) ?? 0)} />
                  </TableCell>
                  <TableCell className="tabular text-right">{num(r.volume)}</TableCell>
                  <TableCell className="tabular text-right">{money(prices.get(r.productId), cur, 2)}</TableCell>
                  <TableCell className="tabular text-right">{money(r.throughputPerUnit, cur, 2)}</TableCell>
                  <TableCell className="tabular text-right">{money(r.contributionMarginPerUnit, cur, 2)}</TableCell>
                  <TableCell className="tabular text-right">{num(r.constraintMinutesPerUnit, 1)}</TableCell>
                  <TableCell className="tabular text-right font-medium">{r.velocity == null ? "—" : `${money(r.velocity, cur)}/h`}</TableCell>
                  <TableCell className="tabular text-right">{num(r.score)}</TableCell>
                  <TableCell className="tabular text-right">{r.rank ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

function SimulationPanel({
  data,
  value,
  dirty,
  editable,
  onChange,
  onSave,
  onDiscard,
}: {
  data: CompanyData;
  value: EngineScenario;
  dirty: boolean;
  editable: boolean;
  onChange: (s: EngineScenario) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [target, setTarget] = useState<string>("all");
  const get = (k: "price" | "materialCost" | "volume") => (target === "all" ? value[k]?.all : value[k]?.byProduct?.[target]) ?? 0;
  const set = (k: "price" | "materialCost" | "volume", f: number) => {
    const adj = { ...(value[k] ?? {}) };
    if (target === "all") adj.all = f || undefined;
    else {
      const bp = { ...(adj.byProduct ?? {}) };
      if (f) bp[target] = f;
      else delete bp[target];
      adj.byProduct = Object.keys(bp).length ? bp : undefined;
    }
    onChange({ ...value, [k]: adj.all == null && !adj.byProduct ? undefined : adj });
  };
  const mix = target === "all" ? 0 : value.mixShift?.find((m) => m.productId === target)?.deltaPoints ?? 0;
  const setMix = (pts: number) => {
    const rest = (value.mixShift ?? []).filter((m) => m.productId !== target);
    onChange({ ...value, mixShift: pts ? [...rest, { productId: target, deltaPoints: pts }] : rest.length ? rest : undefined });
  };

  const sliders: Array<[string, number, (n: number) => void, number, string]> = [
    ["Selling price", get("price"), (n) => set("price", n), 0.5, "%"],
    ["Material cost", get("materialCost"), (n) => set("materialCost", n), 0.5, "%"],
    ["Volume", get("volume"), (n) => set("volume", n), 0.5, "%"],
  ];

  return (
    <Panel title="Simulation" className="h-fit xl:sticky xl:top-20">
      <div className="space-y-5">
        <Labeled label="Apply to">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Labeled>
        {sliders.map(([label, v, fn, max]) => (
          <SliderRow key={label} label={`${label} ±%`} value={v} max={max} step={0.01} disabled={!editable} onChange={fn} display={`${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} />
        ))}
        <SliderRow
          label="Mix shift ±points"
          value={mix}
          max={0.3}
          step={0.01}
          disabled={!editable || target === "all"}
          onChange={setMix}
          display={`${mix > 0 ? "+" : ""}${(mix * 100).toFixed(0)} pts`}
          hint={target === "all" ? "Choose a product above to shift mix toward or away from it." : "Other products scale so total volume stays the same."}
        />
        {editable ? (
          <div className="flex gap-2 border-t pt-4">
            <Button className="flex-1" disabled={!dirty} onClick={onSave}><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" disabled={!dirty} onClick={onDiscard}>Discard</Button>
          </div>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">Read-only: this scenario is locked or your role can't edit.</p>
        )}
        {dirty && <p className="text-xs text-muted-foreground">Unsaved changes — results above are a live preview.</p>}
      </div>
    </Panel>
  );
}

function SliderRow({ label, value, max, step, disabled, onChange, display, hint }: { label: string; value: number; max: number; step: number; disabled?: boolean; onChange: (n: number) => void; display: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={cn("tabular font-medium", value > 0 && "text-foreground", disabled && "text-muted-foreground")}>{display}</span>
      </div>
      <Slider aria-label={label} min={-max} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([n]) => onChange(Math.round((n ?? 0) * 100) / 100)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OptimizeDialog({ open, onOpenChange, data, run, cur, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; data: CompanyData; run: NonNullable<Analysis["run"]>; cur: string; onApply: (v: Record<string, number>) => Promise<unknown> }) {
  const result = useMemo((): Optimization | string[] => {
    try {
      return optimizeMix(run.model, { constraintGroupId: run.pinnedGroupId });
    } catch (e) {
      return e instanceof ModelError ? e.issues : [String(e)];
    }
  }, [run]);
  const [busy, setBusy] = useState(false);
  const ok = !Array.isArray(result);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Optimize mix</DialogTitle>
          <DialogDescription>Fills the constraint with the highest-velocity products first, up to each product's max demand.</DialogDescription>
        </DialogHeader>
        {!ok ? (
          <Warnings items={result as string[]} />
        ) : (
          <>
            <Warnings items={result.warnings} />
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">Suggested</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.products.map((p) => {
                  const curV = run.model.volumes[p.id] ?? 0;
                  const s = result.volumes[p.id] ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="tabular text-right">{num(curV)}</TableCell>
                      <TableCell className="text-right"><Variance value={s - curV} text={num(s)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-between rounded-md bg-muted p-3 text-sm">
              <span>Profit</span>
              <span className="tabular">
                {money(run.evaluation.totals.profit, cur)} → <strong>{money(result.evaluation.totals.profit, cur)}</strong>{" "}
                <Variance value={result.evaluation.totals.profit - run.evaluation.totals.profit} text={`(${signedMoney(result.evaluation.totals.profit - run.evaluation.totals.profit, cur)})`} />
              </span>
            </div>
            {!result.evaluation.feasible && <p className="text-xs text-negative">The suggested plan still exceeds capacity on another group.</p>}
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {ok && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onApply((result as Optimization).volumes);
                setBusy(false);
                onOpenChange(false);
              }}
            >
              Apply to new scenario
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompareTab({ data, current, cur }: { data: CompanyData; current: string; cur: string }) {
  const base = data.scenarios.find((s) => s.id === current)?.base_scenario_id;
  const [ids, setIds] = useState<string[]>(() => [...new Set([base, current].filter(Boolean) as string[])]);
  const runs = useMemo(() => ids.map((id) => ({ id, name: data.scenarios.find((s) => s.id === id)?.name ?? "", a: analyzeScenario(data, id) })), [ids, data]);
  const toggle = (id: string) => setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : x.length >= 4 ? x : [...x, id]));
  const first = runs[0]?.a.run?.evaluation;
  const rows: Array<[string, (e: NonNullable<typeof first>) => number | null, string]> = [
    ["Revenue", (e) => e.totals.revenue, KPI.revenue.formula],
    ["Throughput", (e) => e.totals.throughput, KPI.throughput.formula],
    ["Contribution margin", (e) => e.totals.contributionMargin, KPI.contribution.formula],
    ["Operating expense", (e) => e.totals.operatingExpense, ""],
    ["Profit", (e) => e.totals.profit, KPI.profit.formula],
    ["Portfolio velocity /h", (e) => e.totals.portfolioVelocity, KPI.portfolioVelocity.formula],
  ];
  return (
    <div className="space-y-6">
      <Panel title="Choose up to 4 scenarios">
        <div className="flex flex-wrap gap-4">
          {data.scenarios.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={ids.includes(s.id)} disabled={!ids.includes(s.id) && ids.length >= 4} onCheckedChange={() => toggle(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </Panel>
      {runs.length === 0 ? (
        <Empty title="Pick scenarios to compare" />
      ) : (
        <Panel title={`Variance vs ${runs[0].name}`}>
          <div className="-mx-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[170px]">Line</TableHead>
                  {runs.map((r, i) => (
                    <TableHead key={r.id} className="min-w-[150px] text-right" colSpan={i === 0 ? 1 : 2}>{r.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(([label, fn, f]) => (
                  <TableRow key={label}>
                    <TableCell><Th label={label} formula={f || undefined} /></TableCell>
                    {runs.map((r, i) => {
                      const e = r.a.run?.evaluation;
                      const v = e ? fn(e) : null;
                      const b = first ? fn(first) : null;
                      return [
                        <TableCell key={r.id} className="tabular text-right">{v == null ? "—" : money(v, cur, label.includes("velocity") ? 1 : 0)}</TableCell>,
                        i > 0 && (
                          <TableCell key={`${r.id}-v`} className="text-right text-xs">
                            {v != null && b != null ? <Variance value={label === "Operating expense" ? b - v : v - b} text={signedMoney(v - b, cur)} /> : "—"}
                          </TableCell>
                        ),
                      ];
                    })}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Constraint</TableCell>
                  {runs.map((r, i) => {
                    const c = r.a.run?.evaluation.constraint;
                    const shifted = i > 0 && first?.constraint && c && c.groupId !== first.constraint.groupId;
                    return [
                      <TableCell key={r.id} className="text-right text-sm">{c ? `${c.name} (${pct(c.utilization)})` : "—"}</TableCell>,
                      i > 0 && <TableCell key={`${r.id}-s`} className="text-right">{shifted && <ShiftBadge shift={{ from: first!.constraint!.name, to: c!.name }} />}</TableCell>,
                    ];
                  })}
                </TableRow>
                <TableRow>
                  <TableCell>Plan fits capacity</TableCell>
                  {runs.map((r, i) => [
                    <TableCell key={r.id} className="text-right text-sm">{r.a.run ? (r.a.run.evaluation.feasible ? "Yes" : <span className="text-negative">No</span>) : "—"}</TableCell>,
                    i > 0 && <TableCell key={`${r.id}-f`} />,
                  ])}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
}

const XS = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];

function SensitivityTab({ data, a, cur }: { data: CompanyData; a: Analysis; cur: string }) {
  const [pid, setPid] = useState(data.products[0]?.id);
  const run = a.run!;
  const curves = useMemo(() => {
    if (!pid) return null;
    try {
      const vars: SensitivityVariable[] = ["price", "materialCost", "mix"];
      return vars.map((v) => ({
        v,
        points: sensitivity(run.model, pid, v, XS, { constraintGroupId: run.pinnedGroupId }).map((p) => ({ ...p, label: `${p.x > 0 ? "+" : ""}${Math.round(p.x * 100)}${v === "mix" ? "pts" : "%"}` })),
      }));
    } catch (e) {
      return e instanceof ModelError ? e.issues : [String(e)];
    }
  }, [run, pid]);
  const titles: Record<SensitivityVariable, string> = { price: "Velocity vs price", materialCost: "Velocity vs material cost", mix: "Velocity vs mix share" };
  return (
    <Panel
      title="Sensitivity for one product"
      action={
        <Select value={pid} onValueChange={setPid}>
          <SelectTrigger className="h-8 w-40" aria-label="Product"><SelectValue /></SelectTrigger>
          <SelectContent>{data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      }
    >
      {!curves ? (
        <Empty title="No products" />
      ) : typeof curves[0] === "string" ? (
        <Warnings items={curves as string[]} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {(curves as Array<{ v: SensitivityVariable; points: Array<{ label: string; productVelocity: number | null }> }>).map((c) => (
            <div key={c.v}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">{titles[c.v]}</div>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={c.points}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval={1} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => money(v, cur)} />
                    <RTooltip formatter={(v) => [`${money(Number(v), cur)}/h`, "Velocity"]} />
                    <Line type="monotone" dataKey="productVelocity" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">The constraint group is held fixed so curves don't jump between groups.</p>
    </Panel>
  );
}

function HistoryTab({ scenario, input }: { scenario: Tables<"scenarios">; input: Tables<"scenario_inputs"> }) {
  const q = useQuery({
    queryKey: ["history", scenario.id, scenario.updated_at, input.updated_at],
    queryFn: async () => {
      const [{ data: rows, error }, { data: profiles }] = await Promise.all([
        supabase.from("audit_logs").select("*").in("row_id", [scenario.id, input.id]).order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("user_id, full_name, email"),
      ]);
      if (error) throw new Error(error.message);
      const who = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name || p.email]));
      return (rows ?? []).map((r) => ({ ...r, who: r.user_id ? who.get(r.user_id) ?? "Former user" : "System" }));
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data?.length) return <Empty title="No history yet" />;
  return (
    <Panel title="Change history">
      <ol className="space-y-3">
        {q.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3 text-sm last:border-0">
            <Badge variant="secondary">{r.action}</Badge>
            <span>{r.who}</span>
            <span className="text-muted-foreground">{r.table_name === "scenario_inputs" ? "inputs" : "scenario"}</span>
            <span className="tabular ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            <ChangedFields before={r.before} after={r.after} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function ChangedFields({ before, after }: { before: Json | null; after: Json | null }) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Record<string, Json>;
  const n = after as Record<string, Json>;
  const keys = Object.keys(n).filter((k) => k !== "updated_at" && JSON.stringify(b[k]) !== JSON.stringify(n[k]));
  if (!keys.length) return null;
  return (
    <div className="w-full space-y-1 text-xs">
      {keys.map((k) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="break-all font-mono"><span className="text-negative line-through">{JSON.stringify(b[k])}</span> → <span className="text-positive">{JSON.stringify(n[k])}</span></span>
        </div>
      ))}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewScenarioDialog({
  open,
  onOpenChange,
  scenarios,
  defaultBase,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scenarios: { id: string; name: string }[];
  defaultBase: string | null;
  onCreate: (o: { name: string; label: string; base: string | null }) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState<string>("Simulation");
  const [base, setBase] = useState<string>("none");
  useEffect(() => {
    if (open) setBase(defaultBase ?? "none");
  }, [open, defaultBase]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scenario</DialogTitle>
          <DialogDescription>Start from an existing scenario to copy its volumes, costs and adjustments.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await onCreate({ name: name.trim(), label, base: base === "none" ? null : base });
            onOpenChange(false);
            setName("");
          }}
        >
          <Labeled label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Labeled>
          <Labeled label="Version label">
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Base scenario">
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Blank</SelectItem>
                {scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Labeled>
          <DialogFooter><Button type="submit" disabled={!name.trim()}>Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
