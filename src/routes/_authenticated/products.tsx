import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import { useCompanyData, useMe, usePermissions, useScenarioAnalysis } from "@/lib/data";
import { useScenario } from "@/lib/scenario-context";
import { useDb, toNum } from "@/lib/mutations";
import { productMaterialCost } from "@/lib/modelAdapter";
import { exportCsv, money, num, pct } from "@/lib/format";
import { EditCell, efficiencyRule, nonNegative, required } from "@/components/EditCell";
import { useConfirm } from "@/components/confirm";
import { KPI } from "@/lib/kpiDefinitions";
import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Th, Empty, InfeasibleBanner, ConstraintSummary, IssuesPanel, Loading, PageHeader, Panel, ShiftBadge, Warnings } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import type { CompanyData } from "@/lib/modelAdapter";
import type { Evaluation } from "@/lib/profitVelocityEngine";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products & Constraint — AndaFlows" }, { name: "description", content: "Products, machine groups, routings and bill of materials." }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data } = useCompanyData();
  const { scenarioId } = useScenario();
  const a = useScenarioAnalysis(data, scenarioId);
  if (!data) return <Loading />;
  const ev = a.run?.evaluation ?? null;
  return (
    <>
      <PageHeader
        title="Products & Constraint"
        description="Your bottleneck is a machine group. Velocity = throughput per hour of that group."
        actions={<ShiftBadge shift={a.shift} />}
      />
      {a.issues.length > 0 && <div className="mb-6"><IssuesPanel issues={a.issues} /></div>}
      {ev && <InfeasibleBanner feasible={ev.feasible} />}
      {ev && <Warnings items={ev.warnings} />}
      <Tabs defaultValue="products">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="groups">Machine groups</TabsTrigger>
          <TabsTrigger value="routings">Routings</TabsTrigger>
          <TabsTrigger value="materials">Materials & BOM</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductsTab data={data} ev={ev} /></TabsContent>
        <TabsContent value="groups"><GroupsTab data={data} ev={ev} /></TabsContent>
        <TabsContent value="routings"><RoutingsTab data={data} ev={ev} /></TabsContent>
        <TabsContent value="materials"><MaterialsTab data={data} /></TabsContent>
      </Tabs>
    </>
  );
}

function ProductsTab({ data, ev }: { data: CompanyData; ev: Evaluation | null }) {
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const cur = me?.company.currency ?? "USD";
  const db = useDb();
  const results = new Map(ev?.products.map((p) => [p.productId, p]));
  const rows = data.products.map((p) => ({ p, r: results.get(p.id), bom: data.bom.some((b) => b.product_id === p.id) }));

  return (
    <Panel
      title={ev?.constraint ? `Ranked on ${ev.constraint.name}` : "Products"}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv("products.csv", rows.map(({ p, r }) => ({
            product: p.name, price: p.price, material_cost: productMaterialCost(data, p.id), throughput_per_unit: r?.throughputPerUnit,
            constraint_minutes: r?.constraintMinutesPerUnit, velocity: r?.velocity, score: r?.score, rank: r?.rank,
          })))}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => db.insert("products", { name: "New product", price: 0 })}>
              <Plus className="mr-1 h-4 w-4" /> Product
            </Button>
          )}
        </div>
      }
    >
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Other T cost</TableHead>
              <TableHead>Other var. cost</TableHead>
              <TableHead>Max demand</TableHead>
              <TableHead className="text-right">T / unit</TableHead>
              <TableHead className="text-right">Constr. min</TableHead>
              <TableHead className="text-right">Velocity</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, r, bom }) => (
              <TableRow key={p.id}>
                <TableCell><EditCell type="text" value={p.name} validate={required} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { name: v })} /></TableCell>
                <TableCell><EditCell value={p.price} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { price: toNum(v) ?? 0 })} /></TableCell>
                <TableCell>
                  {bom ? (
                    <span className="tabular block px-2 text-sm" title="From bill of materials">{money(productMaterialCost(data, p.id), cur, 2)} <span className="text-xs text-muted-foreground">BOM</span></span>
                  ) : (
                    <EditCell value={p.material_cost} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { material_cost: toNum(v) ?? 0 })} />
                  )}
                </TableCell>
                <TableCell><EditCell value={p.other_throughput_cost} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { other_throughput_cost: toNum(v) ?? 0 })} /></TableCell>
                <TableCell><EditCell value={p.other_variable_cost} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { other_variable_cost: toNum(v) ?? 0 })} /></TableCell>
                <TableCell><EditCell value={p.max_demand} placeholder="—" validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("products", p.id, { max_demand: toNum(v) })} /></TableCell>
                <TableCell className="tabular text-right">{money(r?.throughputPerUnit, cur, 2)}</TableCell>
                <TableCell className="tabular text-right">{num(r?.constraintMinutesPerUnit, 1)}</TableCell>
                <TableCell className="tabular text-right font-medium">{r?.velocity == null ? "—" : `${money(r.velocity, cur)}/h`}</TableCell>
                <TableCell className="tabular text-right">{num(r?.score)}</TableCell>
                <TableCell className="tabular text-right">{r?.rank ?? "—"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <Button size="icon" variant="ghost" aria-label="Delete product" onClick={async () => (await confirm({ title: `Delete ${p.name}?`, description: "Its routings and bill of materials are deleted too." })) && db.remove("products", p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function GroupsTab({ data, ev }: { data: CompanyData; ev: Evaluation | null }) {
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const db = useDb();
  const loads = new Map(ev?.groups.map((g) => [g.groupId, g]));

  async function addGroup() {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: g, error } = await supabase.from("machine_groups").insert({ name: "New group" }).select().single();
    if (error || !g) { await db.run(Promise.resolve({ error: error ?? { message: "Could not add group" } })); return; }
    await db.insert("machines", { group_id: g.id, name: "Machine 1", hours_per_period: 160, efficiency: 0.85 }, "Group added");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Current constraint"><ConstraintSummary constraint={ev?.constraint ?? null} /></Panel>
        <Panel title="How groups work" className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            A group is a set of machines that can stand in for each other. Its capacity is the sum of each machine's hours × efficiency.
            Products are routed to groups, never to single machines. A machine that can't be substituted is a group of one.
          </p>
        </Panel>
      </div>
      <Panel title="Group utilization">
        {data.groups.length === 0 ? <Empty title="No machine groups yet" /> : (
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Group</TableHead>
                <TableHead className="text-right"><Th label="Capacity h" formula={KPI.capacity.formula} /></TableHead>
                <TableHead className="text-right">Load h</TableHead>
                <TableHead className="text-right"><Th label="Utilization" formula={KPI.utilization.formula} /></TableHead>
                <TableHead className="text-right">Overload h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.groups.map((g) => {
                const l = loads.get(g.id);
                const isC = ev?.constraint?.groupId === g.id;
                const open = openRow === g.id;
                return (
                  <Fragment key={g.id}>
                    <TableRow className={isC ? "bg-accent/60" : undefined}>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-expanded={open} aria-label={`Show machines in ${g.name}`} onClick={() => setOpenRow(open ? null : g.id)}>
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{g.name}{isC && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Constraint</span>}</TableCell>
                      <TableCell className="tabular text-right">{num(l?.capacityHours, 1)}</TableCell>
                      <TableCell className="tabular text-right">{num(l?.loadHours, 1)}</TableCell>
                      <TableCell className="tabular text-right font-medium">{pct(l?.utilization, 1)}</TableCell>
                      <TableCell className={"tabular text-right " + ((l?.overloadHours ?? 0) > 0 ? "text-negative" : "")}>{num(l?.overloadHours, 1)}</TableCell>
                    </TableRow>
                    {open && data.machines.filter((m) => m.group_id === g.id).map((m) => (
                      <TableRow key={m.id} className="text-sm text-muted-foreground">
                        <TableCell />
                        <TableCell className="pl-8">{m.name}</TableCell>
                        <TableCell className="tabular text-right">{num(Number(m.hours_per_period) * Number(m.efficiency), 1)}</TableCell>
                        <TableCell className="tabular text-right" colSpan={3}>{num(Number(m.hours_per_period))} h × {pct(Number(m.efficiency))}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        )}
      </Panel>
      {canEdit && (
        <Button size="sm" onClick={addGroup}><Plus className="mr-1 h-4 w-4" /> Machine group</Button>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {data.groups.map((g) => {
          const l = loads.get(g.id);
          const machines = data.machines.filter((m) => m.group_id === g.id);
          const isC = ev?.constraint?.groupId === g.id;
          return (
            <Panel
              key={g.id}
              title={undefined}
              className={isC ? "border-primary" : undefined}
            >
              <div className="mb-4 flex items-center gap-2">
                <EditCell type="text" value={g.name} validate={required} disabled={!canEdit} className="max-w-[220px] font-semibold" onSave={(v) => db.update("machine_groups", g.id, { name: v })} />
                {isC && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Constraint</span>}
                {canEdit && (
                  <Button size="icon" variant="ghost" className="ml-auto" aria-label="Delete group" onClick={async () => (await confirm({ title: `Delete group ${g.name}?`, description: "Its machines and routings are deleted too." })) && db.remove("machine_groups", g.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{num(l?.loadHours, 1)} h load / {num(l?.capacityHours, 1)} h capacity</span>
                <span className="tabular font-medium">{pct(l?.utilization)}</span>
              </div>
              <Progress value={Math.min(100, (Number.isFinite(l?.utilization ?? 0) ? l?.utilization ?? 0 : 1) * 100)} className="h-2" />
              <div className="-mx-4 mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Hours / period</TableHead>
                      <TableHead>Efficiency</TableHead>
                      <TableHead className="text-right">Share of capacity</TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines.map((m) => {
                      const cap = Number(m.hours_per_period) * Number(m.efficiency);
                      return (
                        <TableRow key={m.id}>
                          <TableCell><EditCell type="text" value={m.name} disabled={!canEdit} onSave={(v) => db.update("machines", m.id, { name: v })} /></TableCell>
                          <TableCell><EditCell value={m.hours_per_period} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("machines", m.id, { hours_per_period: toNum(v) ?? 0 })} /></TableCell>
                          <TableCell><EditCell value={m.efficiency} validate={efficiencyRule} disabled={!canEdit} format={(v) => pct(Number(v))} onSave={(v) => db.update("machines", m.id, { efficiency: toNum(v) })} /></TableCell>
                          <TableCell className="tabular text-right text-sm">
                            {l && l.capacityHours > 0 ? pct(cap / l.capacityHours) : "—"}
                            <div className="text-xs text-muted-foreground">{l ? `${num(l.loadHours * (l.capacityHours > 0 ? cap / l.capacityHours : 0), 1)} h load` : ""}</div>
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <Button size="icon" variant="ghost" aria-label="Delete machine" disabled={machines.length <= 1} title={machines.length <= 1 ? "A group needs at least one machine" : undefined} onClick={async () => (await confirm({ title: `Delete ${m.name}?` })) && db.remove("machines", m.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => db.insert("machines", { group_id: g.id, name: `Machine ${machines.length + 1}` })}>
                  <Plus className="mr-1 h-4 w-4" /> Machine
                </Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Efficiency is a fraction (0.85 = 85%). Load is shared across the group's machines.</p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function RoutingsTab({ data, ev }: { data: CompanyData; ev: Evaluation | null }) {
  const { canEdit } = usePermissions();
  const db = useDb();
  const find = (pid: string, gid: string) => data.routings.find((r) => r.product_id === pid && r.group_id === gid);
  const save = (pid: string, gid: string, v: string) => {
    const r = find(pid, gid);
    const n = toNum(v);
    if (n == null) return r ? db.remove("routings", r.id) : undefined;
    return r ? db.update("routings", r.id, { minutes_per_unit: n }) : db.insert("routings", { product_id: pid, group_id: gid, minutes_per_unit: n });
  };
  return (
    <Panel title="Minutes per unit on each machine group">
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Product</TableHead>
              {data.groups.map((g) => (
                <TableHead key={g.id} className={ev?.constraint?.groupId === g.id ? "text-primary" : undefined}>{g.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                {data.groups.map((g) => (
                  <TableCell key={g.id}>
                    <EditCell value={find(p.id, g.id)?.minutes_per_unit} placeholder="—" disabled={!canEdit} onSave={(v) => save(p.id, g.id, v)} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Leave a cell empty if the product doesn't pass through that group.</p>
    </Panel>
  );
}

function MaterialsTab({ data }: { data: CompanyData }) {
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { data: me } = useMe();
  const db = useDb();
  const [productId, setProductId] = useState<string | undefined>(data.products[0]?.id);
  const lines = data.bom.filter((b) => b.product_id === productId);
  const unused = data.materials.filter((m) => !lines.some((l) => l.material_id === m.id));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Panel title="Materials" action={canEdit && <Button size="sm" onClick={() => db.insert("materials", { name: "New material" })}><Plus className="mr-1 h-4 w-4" /> Material</Button>}>
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>FX</TableHead>
                <TableHead>Inflation</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.materials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><EditCell type="text" value={m.name} disabled={!canEdit} onSave={(v) => db.update("materials", m.id, { name: v })} /></TableCell>
                  <TableCell><EditCell value={m.unit_cost} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("materials", m.id, { unit_cost: toNum(v) ?? 0 })} /></TableCell>
                  <TableCell><EditCell type="text" value={m.currency} disabled={!canEdit} className="w-20" onSave={(v) => db.update("materials", m.id, { currency: v.toUpperCase() })} /></TableCell>
                  <TableCell><EditCell value={m.fx} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("materials", m.id, { fx: toNum(v) ?? 1 })} /></TableCell>
                  <TableCell><EditCell value={m.inflation} disabled={!canEdit} format={(v) => pct(Number(v), 1)} onSave={(v) => db.update("materials", m.id, { inflation: toNum(v) ?? 0 })} /></TableCell>
                  {canEdit && <TableCell><Button size="icon" variant="ghost" aria-label="Delete material" onClick={async () => (await confirm({ title: `Delete ${m.name}?`, description: "It's removed from every bill of materials." })) && db.remove("materials", m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">FX converts to {me?.company.currency ?? "your currency"}. Inflation is a fraction (0.04 = 4%).</p>
      </Panel>
      <Panel title="Bill of materials">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="mb-4 w-full sm:w-64"><SelectValue placeholder="Choose product" /></SelectTrigger>
          <SelectContent>{data.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="-mx-4 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Qty per unit</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{data.materials.find((m) => m.id === l.material_id)?.name}</TableCell>
                  <TableCell><EditCell value={l.qty} validate={nonNegative} disabled={!canEdit} onSave={(v) => db.update("product_materials", l.id, { qty: toNum(v) ?? 0 })} /></TableCell>
                  {canEdit && <TableCell><Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => db.remove("product_materials", l.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {lines.length === 0 && <p className="text-sm text-muted-foreground">No BOM: the product's own material cost is used.</p>}
        {productId && (
          <p className="mt-3 text-sm">Material cost per unit: <span className="tabular font-medium">{money(productMaterialCost(data, productId), me?.company.currency, 2)}</span></p>
        )}
        {canEdit && productId && unused.length > 0 && (
          <Select value="" onValueChange={(mid) => db.insert("product_materials", { product_id: productId, material_id: mid, qty: 1 })}>
            <SelectTrigger className="mt-3 w-full sm:w-64"><SelectValue placeholder="+ Add material" /></SelectTrigger>
            <SelectContent>{unused.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Panel>
    </div>
  );
}
