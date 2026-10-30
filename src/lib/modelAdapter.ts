/**
 * The ONLY place database rows become the engine's `Model` / `Scenario` shapes.
 * No business math here: material cost from a BOM uses the engine's own helper.
 */
import { materialCostFromBom, type Model, type Scenario as EngineScenario } from "./profitVelocityEngine";
import type { Tables } from "@/integrations/supabase/types";

export interface CompanyData {
  groups: Tables<"machine_groups">[];
  machines: Tables<"machines">[];
  products: Tables<"products">[];
  materials: Tables<"materials">[];
  bom: Tables<"product_materials">[];
  routings: Tables<"routings">[];
  scenarios: Tables<"scenarios">[];
  inputs: Tables<"scenario_inputs">[];
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Material cost per product: from the BOM when one exists, else the product's own field. */
export function productMaterialCost(data: CompanyData, productId: string): number {
  const product = data.products.find((p) => p.id === productId);
  const lines = data.bom.filter((b) => b.product_id === productId);
  if (lines.length === 0) return num(product?.material_cost);
  return materialCostFromBom(
    lines.map((l) => {
      const m = data.materials.find((x) => x.id === l.material_id);
      return { qty: num(l.qty), unitCost: num(m?.unit_cost), fx: num(m?.fx ?? 1), inflation: num(m?.inflation) };
    }),
  );
}

export function parseAdjustments(raw: unknown): EngineScenario {
  if (!raw || typeof raw !== "object") return {};
  const a = raw as EngineScenario;
  return {
    price: a.price,
    materialCost: a.materialCost,
    volume: a.volume,
    mixShift: Array.isArray(a.mixShift) ? a.mixShift : undefined,
  };
}

export function parseVolumes(raw: unknown, productIds: string[]): Record<string, number> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const id of productIds) out[id] = num(obj[id]);
  return out;
}

/** Base model for a scenario: its volumes & opex, without its adjustments applied. */
export function toModel(data: CompanyData, scenarioId: string | null): Model {
  const input = data.inputs.find((i) => i.scenario_id === scenarioId);
  const productIds = data.products.map((p) => p.id);
  return {
    groups: data.groups.map((g) => ({ id: g.id, name: g.name })),
    machines: data.machines.map((m) => ({
      id: m.id,
      groupId: m.group_id,
      name: m.name,
      hoursPerPeriod: num(m.hours_per_period),
      efficiency: num(m.efficiency),
    })),
    products: data.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: num(p.price),
      materialCost: productMaterialCost(data, p.id),
      otherThroughputCost: num(p.other_throughput_cost),
      otherVariableCost: num(p.other_variable_cost),
      maxDemand: p.max_demand == null ? undefined : num(p.max_demand),
    })),
    routings: data.routings.map((r) => ({
      productId: r.product_id,
      groupId: r.group_id,
      minutesPerUnit: num(r.minutes_per_unit),
    })),
    volumes: parseVolumes(input?.volumes, productIds),
    operatingExpense: num(input?.operating_expense),
  };
}

export function scenarioInputs(data: CompanyData, scenarioId: string | null) {
  const input = data.inputs.find((i) => i.scenario_id === scenarioId);
  return {
    adjustments: parseAdjustments(input?.adjustments),
    pinnedGroupId: input?.pinned_group_id ?? undefined,
  };
}
