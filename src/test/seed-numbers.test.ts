import { describe, expect, it } from "vitest";
import { evaluate, optimizeMix } from "@/lib/profitVelocityEngine";
import { toModel, type CompanyData } from "@/lib/modelAdapter";

// Rows shaped like the database seed; checks the adapter + engine give the spec's expected numbers.
const c = "co";
const t = { created_at: "", updated_at: "", company_id: c };
const data = {
  groups: [{ ...t, id: "cnc", name: "CNC Machining" }, { ...t, id: "asm", name: "Assembly" }],
  machines: [
    { ...t, id: "m1", group_id: "cnc", name: "CNC 1", hours_per_period: 160, efficiency: 0.85 },
    { ...t, id: "m2", group_id: "cnc", name: "CNC 2", hours_per_period: 160, efficiency: 0.85 },
    { ...t, id: "m3", group_id: "asm", name: "Assembly 1", hours_per_period: 160, efficiency: 0.9 },
    { ...t, id: "m4", group_id: "asm", name: "Assembly 2", hours_per_period: 160, efficiency: 0.9 },
  ],
  products: [
    { ...t, id: "A", name: "A", price: 100, material_cost: 40, other_throughput_cost: 0, other_variable_cost: 5, max_demand: null },
    { ...t, id: "B", name: "B", price: 150, material_cost: 90, other_throughput_cost: 0, other_variable_cost: 10, max_demand: null },
    { ...t, id: "C", name: "C", price: 80, material_cost: 30, other_throughput_cost: 0, other_variable_cost: 0, max_demand: null },
  ],
  materials: [],
  bom: [],
  routings: [
    ["A", "cnc", 6], ["A", "asm", 3], ["B", "cnc", 12], ["B", "asm", 2], ["C", "cnc", 3], ["C", "asm", 6],
  ].map(([p, g, m], i) => ({ ...t, id: `r${i}`, product_id: p, group_id: g, minutes_per_unit: m })),
  scenarios: [],
  inputs: [{ ...t, id: "i", scenario_id: "s", volumes: { A: 1000, B: 600, C: 1500 }, operating_expense: 100000, adjustments: {}, pinned_group_id: null }],
} as unknown as CompanyData;

describe("spec seed data", () => {
  const ev = evaluate(toModel(data, "s"));
  it("constraint is CNC Machining at 108.5%, infeasible", () => {
    expect(ev.constraint?.name).toBe("CNC Machining");
    expect(ev.constraint!.utilization).toBeCloseTo(1.0846, 3);
    expect(ev.feasible).toBe(false);
  });
  it("velocities A=600 B=300 C=1000", () => {
    const v = Object.fromEntries(ev.products.map((p) => [p.productId, p.velocity]));
    expect(v).toEqual({ A: 600, B: 300, C: 1000 });
  });
  it("revenue 310,000, throughput 171,000, profit 60,000", () => {
    expect(ev.totals.revenue).toBe(310000);
    expect(ev.totals.throughput).toBe(171000);
    expect(ev.totals.profit).toBe(60000);
    expect(ev.totals.portfolioVelocity!).toBeCloseTo(579.66, 1);
  });
  it("optimize mix gives C 1500, A 1000, B 485, profit 54,250", () => {
    const o = optimizeMix(toModel(data, "s"));
    expect(o.volumes).toEqual({ A: 1000, B: 485, C: 1500 });
    expect(o.evaluation.totals.profit).toBe(54250);
  });
});
