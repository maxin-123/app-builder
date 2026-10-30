import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Plus, Sparkles, Trash2, Unlock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyData, useMe, usePermissions, useRefresh, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { useDb, toNum } from "@/lib/mutations";
import { optimizeMix, profitBridge, ModelError, type Scenario as EngineScenario } from "@/lib/profitVelocityEngine";
import { money, num, pct, signedMoney } from "@/lib/format";
import { EditCell } from "@/components/EditCell";
import { BridgeChart } from "@/components/BridgeChart";
import { ConstraintSummary, IssuesPanel, Loading, PageHeader, Panel, ShiftBadge, Variance, Warnings } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/scenarios")({
  head: () => ({ meta: [{ title: "Scenarios — AndaFlows" }, { name: "description", content: "Model price, cost, volume and mix changes and see the profit impact." }] }),
  component: ScenariosPage,
});

const LABELS = ["Actual", "Budget", "Forecast", "Simulation"] as const;
const AUTO = "__auto__";

function ScenariosPage() {
  const { data } = useCompanyData();
  const { data: me } = useMe();
  const { scenarioId, setScenarioId } = useScenario();
  const { canEdit, canLock } = usePermissions();
  const a = useScenarioAnalysis(data, scenarioId);
  const db = useDb();
  const refresh = useRefresh();
  const cur = me?.company.currency ?? "USD";

  const scenario = data?.scenarios.find((s) => s.id === scenarioId);
  const input = data?.inputs.find((i) => i.scenario_id === scenarioId);
  const editable = canEdit && !!scenario && !scenario.is_locked;

  const bridge = useMemo(() => {
    if (!a.run) return null;
    try {
      return profitBridge(a.run.baseModel, a.run.adjustments);
    } catch {
      return null;
    }
  }, [a.run]);

  if (!data) return <Loading />;

  async function createScenario(name: string, label: string, copyFrom: string | null) {
    const src = data!.inputs.find((i) => i.scenario_id === copyFrom);
    const { data: s, error } = await supabase
      .from("scenarios")
      .insert({ name, version_label: label as (typeof LABELS)[number], base_scenario_id: copyFrom })
      .select()
      .single();
    if (error || !s) return toast.error(error?.message ?? "Could not create scenario");
    const { error: e2 } = await supabase.from("scenario_inputs").insert({
      scenario_id: s.id,
      volumes: src?.volumes ?? {},
      operating_expense: src?.operating_expense ?? 0,
      adjustments: copyFrom ? {} : {},
      pinned_group_id: src?.pinned_group_id ?? null,
    });
    if (e2) return toast.error(e2.message);
    await refresh();
    setScenarioId(s.id);
    toast.success("Scenario created");
  }

  const saveInputs = (patch: Record<string, unknown>) => input && db.update("scenario_inputs", input.id, patch);
  const adjustments = (a.run?.adjustments ?? {}) as EngineScenario;
  const setAdj = (next: EngineScenario) => saveInputs({ adjustments: next as unknown as Json });
  const setAll = (key: "price" | "materialCost" | "volume", v: string) => {
    const n = toNum(v);
    setAdj({ ...adjustments, [key]: { ...adjustments[key], all: n == null ? undefined : n / 100 } });
  };

  function runOptimize() {
    if (!a.run || !input) return;
    try {
      const res = optimizeMix(a.run.baseModel, { constraintGroupId: a.run.pinnedGroupId });
      res.warnings.forEach((w) => toast.warning(w));
      const vols: Record<string, number> = {};
      for (const [k, v] of Object.entries(res.volumes)) vols[k] = v;
      saveInputs({ volumes: vols });
      toast.success(`Optimised mix: profit ${money(res.evaluation.totals.profit, cur)}`);
    } catch (e) {
      toast.error(e instanceof ModelError ? e.issues.join("; ") : String(e));
    }
  }

  const ev = a.run?.evaluation;
  const cmp = a.compare?.evaluation;
  const results = new Map(ev?.products.map((p) => [p.productId, p]));

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Your workspace for what-ifs. Pick a scenario on the left or in the top bar."
        actions={
          <>
            <ShiftBadge shift={a.shift} />
            {canEdit && <NewScenarioDialog scenarios={data.scenarios} defaultBase={scenarioId} onCreate={createScenario} />}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {data.scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/50",
                s.id === scenarioId && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.name}</span>
                {s.is_locked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.version_label}</div>
            </button>
          ))}
        </div>

        {scenario && input ? (
          <div className="min-w-0 space-y-6">
            <Panel>
              <div className="flex flex-wrap items-center gap-3">
                <EditCell type="text" value={scenario.name} disabled={!editable} className="max-w-xs text-base font-semibold" onSave={(v) => db.update("scenarios", scenario.id, { name: v })} />
                <Badge variant="secondary">{scenario.version_label}</Badge>
                {scenario.is_locked && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {canLock(scenario) && (
                    <Button size="sm" variant="outline" onClick={() => db.update("scenarios", scenario.id, { is_locked: !scenario.is_locked }, scenario.is_locked ? "Unlocked" : "Locked")}>
                      {scenario.is_locked ? <><Unlock className="mr-1 h-4 w-4" /> Unlock</> : <><Lock className="mr-1 h-4 w-4" /> Lock</>}
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => createScenario(`${scenario.name} (copy)`, "Simulation", scenario.id)}>
                      <Copy className="mr-1 h-4 w-4" /> Duplicate
                    </Button>
                  )}
                  {editable && (
                    <Button size="sm" variant="ghost" aria-label="Delete scenario" onClick={() => confirm(`Delete ${scenario.name}?`) && db.remove("scenarios", scenario.id, "Scenario deleted")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Labeled label="Version">
                  <Select value={scenario.version_label} disabled={!editable} onValueChange={(v) => db.update("scenarios", scenario.id, { version_label: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Compare against">
                  <Select value={scenario.base_scenario_id ?? "none"} disabled={!editable} onValueChange={(v) => db.update("scenarios", scenario.id, { base_scenario_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Before adjustments</SelectItem>
                      {data.scenarios.filter((s) => s.id !== scenario.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Labeled>
                <Labeled label="Operating expense">
                  <EditCell value={input.operating_expense} disabled={!editable} format={(v) => money(Number(v), cur)} onSave={(v) => saveInputs({ operating_expense: toNum(v) ?? 0 })} />
                </Labeled>
                <Labeled label="Constraint group">
                  <Select value={input.pinned_group_id ?? AUTO} disabled={!editable} onValueChange={(v) => saveInputs({ pinned_group_id: v === AUTO ? null : v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Auto-detect (most loaded)</SelectItem>
                      {data.groups.map((g) => <SelectItem key={g.id} value={g.id}>Pin: {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Labeled>
              </div>
            </Panel>

            {a.issues.length > 0 && <IssuesPanel issues={a.issues} />}
            {ev && <Warnings items={ev.warnings} />}

            {ev && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Panel title="Results">
                  <dl className="space-y-3 text-sm">
                    {([
                      ["Revenue", ev.totals.revenue, cmp?.totals.revenue],
                      ["Throughput", ev.totals.throughput, cmp?.totals.throughput],
                      ["Profit", ev.totals.profit, cmp?.totals.profit],
                    ] as const).map(([l, v, c]) => (
                      <div key={l} className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">{l}</dt>
                        <dd className="text-right">
                          <div className="tabular font-medium">{money(v, cur)}</div>
                          {c != null && <Variance value={v - c} text={signedMoney(v - c, cur)} className="text-xs" />}
                        </dd>
                      </div>
                    ))}
                    <div className="flex justify-between"><dt className="text-muted-foreground">Portfolio velocity</dt><dd className="tabular font-medium">{money(ev.totals.portfolioVelocity, cur)}/h</dd></div>
                  </dl>
                  <div className="mt-4 border-t pt-4"><ConstraintSummary constraint={ev.constraint} /></div>
                  <p className="mt-3 text-xs text-muted-foreground">Compared with: {a.compareLabel}</p>
                </Panel>
                <Panel title="Profit bridge" className="xl:col-span-2">
                  {bridge ? <BridgeChart bridge={bridge} currency={cur} baseLabel="Before" endLabel="After" /> : <p className="text-sm text-muted-foreground">Not available.</p>}
                </Panel>
              </div>
            )}

            <Panel title="Adjustments">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {([["price", "Price change (all products)"], ["materialCost", "Material cost change"], ["volume", "Volume change"]] as const).map(([k, l]) => (
                  <Labeled key={k} label={`${l}, %`}>
                    <EditCell
                      value={adjustments[k]?.all != null ? +(adjustments[k]!.all! * 100).toFixed(4) : ""}
                      placeholder="0"
                      disabled={!editable}
                      format={(v) => (v === "" || v == null ? "0%" : `${v}%`)}
                      onSave={(v) => setAll(k, v)}
                    />
                  </Labeled>
                ))}
              </div>
              <div className="mt-6">
                <Label className="text-xs text-muted-foreground">Mix shifts (keeps total volume, other products scale)</Label>
                <div className="mt-2 space-y-2">
                  {(adjustments.mixShift ?? []).map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-40 truncate text-sm">{data.products.find((p) => p.id === m.productId)?.name ?? "Unknown"}</span>
                      <EditCell
                        value={+(m.deltaPoints * 100).toFixed(4)}
                        disabled={!editable}
                        className="w-24"
                        format={(v) => `${Number(v) > 0 ? "+" : ""}${v} pts`}
                        onSave={(v) => setAdj({ ...adjustments, mixShift: (adjustments.mixShift ?? []).map((x, j) => (j === i ? { ...x, deltaPoints: (toNum(v) ?? 0) / 100 } : x)) })}
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                      {editable && (
                        <Button size="icon" variant="ghost" aria-label="Remove shift" onClick={() => setAdj({ ...adjustments, mixShift: (adjustments.mixShift ?? []).filter((_, j) => j !== i) })}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <Select value="" onValueChange={(pid) => setAdj({ ...adjustments, mixShift: [...(adjustments.mixShift ?? []), { productId: pid, deltaPoints: 0.05 }] })}>
                      <SelectTrigger className="h-8 w-full sm:w-64"><SelectValue placeholder="+ Shift mix toward…" /></SelectTrigger>
                      <SelectContent>{data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Panel>

            <Panel
              title="Planned volumes"
              action={editable && <Button size="sm" variant="outline" onClick={runOptimize}><Sparkles className="mr-1 h-4 w-4" /> Optimise mix</Button>}
            >
              <div className="-mx-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Product</TableHead>
                      <TableHead>Base volume</TableHead>
                      <TableHead className="text-right">After adjustments</TableHead>
                      <TableHead className="text-right">Velocity</TableHead>
                      <TableHead className="text-right">Rank</TableHead>
                      <TableHead className="text-right">Throughput</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.products.map((p) => {
                      const r = results.get(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <EditCell
                              value={a.run?.baseModel.volumes[p.id] ?? 0}
                              disabled={!editable}
                              format={(v) => num(Number(v))}
                              onSave={(v) => saveInputs({ volumes: { ...(a.run?.baseModel.volumes ?? {}), [p.id]: toNum(v) ?? 0 } })}
                            />
                          </TableCell>
                          <TableCell className="tabular text-right">{num(r?.volume)}</TableCell>
                          <TableCell className="tabular text-right">{r?.velocity == null ? "—" : `${money(r.velocity, cur)}/h`}</TableCell>
                          <TableCell className="tabular text-right">{r?.rank ?? "—"}</TableCell>
                          <TableCell className="tabular text-right">{money(r?.totalThroughput, cur)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {ev && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {ev.groups.map((g) => `${g.name} ${pct(g.utilization)}`).join(" · ")}
                </p>
              )}
            </Panel>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select or create a scenario.</p>
        )}
      </div>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewScenarioDialog({
  scenarios,
  defaultBase,
  onCreate,
}: {
  scenarios: { id: string; name: string }[];
  defaultBase: string | null;
  onCreate: (name: string, label: string, base: string | null) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [label, setLabel] = useState<string>("Simulation");
  const [base, setBase] = useState<string>(defaultBase ?? "none");
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setBase(defaultBase ?? "none"); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New scenario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New scenario</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Labeled label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 price increase" /></Labeled>
          <Labeled label="Version">
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Labeled>
          <Labeled label="Start from (copies volumes and costs, used for comparison)">
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Blank</SelectItem>
                {scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Labeled>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              await onCreate(name.trim(), label, base === "none" ? null : base);
              setOpen(false);
              setName("");
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
