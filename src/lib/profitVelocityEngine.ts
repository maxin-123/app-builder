/* =============================================================================
 * AndaFlow — Profit Velocity Engine
 *
 * Pure functions. No dependencies. No I/O. Safe to run in the browser or Node.
 *
 * KEY MODELLING DECISION
 *   The constraint is identified at the MACHINE GROUP (work centre) level,
 *   never at the individual machine level.
 *   - A group is a set of machines that can substitute for each other.
 *   - Group capacity = Σ (hoursPerPeriod × efficiency) of its machines.
 *   - A single machine that cannot be substituted is a group of one.
 *   - Products are routed to groups (minutes per unit), not to machines.
 *
 * DEFINITIONS
 *   Throughput per unit (T)  = price − materialCost − otherThroughputCost
 *   Contribution margin (CM) = T − otherVariableCost
 *   Product velocity         = T ÷ (constraint minutes per unit ÷ 60)   [currency / constraint-hour]
 *   Velocity score           = velocity ÷ best velocity × 100 (floored at 0)
 *   Portfolio velocity       = Σ(volume × T) ÷ constraint hours consumed
 *   Profit                   = Σ(volume × CM) − operatingExpense
 *     (pure TOC users: leave otherVariableCost at 0 and put all labour in operatingExpense)
 * ========================================================================== */

// ---------------------------------------------------------------- Types ----

export interface MachineGroup {
  id: string;
  name: string;
}

export interface Machine {
  id: string;
  groupId: string;
  name: string;
  /** Available hours in the period (e.g. 160 for a month on one shift). */
  hoursPerPeriod: number;
  /** Usable fraction of available time, 0 < efficiency <= 1 (e.g. OEE). */
  efficiency: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  /** Total material cost per unit (see materialCostFromBom). */
  materialCost: number;
  /** Other truly variable cost per unit that reduces throughput (freight, commission). */
  otherThroughputCost?: number;
  /** Other variable cost per unit that reduces CM but not T (e.g. variable labour). */
  otherVariableCost?: number;
  /** Market demand cap per period, used by optimizeMix. Defaults to the current volume. */
  maxDemand?: number;
}

/** Time a product needs on a machine GROUP, per unit. */
export interface Routing {
  productId: string;
  groupId: string;
  minutesPerUnit: number;
}

export interface Model {
  groups: MachineGroup[];
  machines: Machine[];
  products: Product[];
  routings: Routing[];
  /** Planned units per product for the period. */
  volumes: Record<string, number>;
  /** Fixed operating expense for the period. */
  operatingExpense: number;
}

export interface GroupLoad {
  groupId: string;
  name: string;
  machineCount: number;
  capacityHours: number;
  loadHours: number;
  /** loadHours / capacityHours. Infinity if there is load but no capacity. */
  utilization: number;
  overloadHours: number;
}

export interface ConstraintInfo {
  groupId: string;
  name: string;
  utilization: number;
  /** true when the group is fully loaded (utilization >= 100%). */
  binding: boolean;
  /** true when the user pinned the constraint instead of auto-detection. */
  pinned: boolean;
}

export interface ProductResult {
  productId: string;
  name: string;
  volume: number;
  throughputPerUnit: number;
  contributionMarginPerUnit: number;
  constraintMinutesPerUnit: number;
  /** null when the product does not use the constraint. */
  velocity: number | null;
  /** 0..100, null when velocity is null. */
  score: number | null;
  /** 1 = best velocity; null when velocity is null. */
  rank: number | null;
  totalThroughput: number;
  totalContributionMargin: number;
}

export interface Totals {
  revenue: number;
  throughput: number;
  contributionMargin: number;
  operatingExpense: number;
  profit: number;
  constraintHours: number;
  /** Σ throughput ÷ constraint hours. null if the constraint is unused. */
  portfolioVelocity: number | null;
}

export interface Evaluation {
  groups: GroupLoad[];
  constraint: ConstraintInfo | null;
  products: ProductResult[];
  totals: Totals;
  /** true when no group is loaded above its capacity. */
  feasible: boolean;
  warnings: string[];
}

export interface EvaluateOptions {
  /** Pin the constraint to a group instead of auto-detecting it. */
  constraintGroupId?: string;
}

/** Fractional change: 0.05 = +5%. `all` and `byProduct` combine multiplicatively. */
export interface Adjustment {
  all?: number;
  byProduct?: Record<string, number>;
}

export interface MixShift {
  productId: string;
  /** Change in the product's share of total volume, in fractional points: 0.05 = +5 pts. */
  deltaPoints: number;
}

export interface Scenario {
  price?: Adjustment;
  materialCost?: Adjustment;
  volume?: Adjustment;
  mixShift?: MixShift[];
}

export interface BridgeStep {
  label: string;
  delta: number;
  cumulativeProfit: number;
}

export interface Bridge {
  baseProfit: number;
  scenarioProfit: number;
  steps: BridgeStep[];
}

export type SensitivityVariable = "price" | "materialCost" | "mix";

export interface SensitivityPoint {
  x: number;
  productVelocity: number | null;
  portfolioVelocity: number | null;
  profit: number;
}

export interface Optimization {
  volumes: Record<string, number>;
  evaluation: Evaluation;
  warnings: string[];
}

export interface BomLine {
  qty: number;
  unitCost: number;
  /** Multiplier to the reporting currency. Default 1. */
  fx?: number;
  /** Fractional inflation: 0.04 = +4%. Default 0. */
  inflation?: number;
}

// --------------------------------------------------------------- Errors ----

export class ModelError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super("Invalid model:\n- " + issues.join("\n- "));
    this.name = "ModelError";
    this.issues = issues;
  }
}

const EPS = 1e-9;
const n = (x: number | undefined): number => x ?? 0;

// ----------------------------------------------------------- Unit economics

export function throughputPerUnit(p: Product): number {
  return p.price - p.materialCost - n(p.otherThroughputCost);
}

export function contributionMarginPerUnit(p: Product): number {
  return throughputPerUnit(p) - n(p.otherVariableCost);
}

/** Material cost per unit from a bill of materials, including FX and inflation. */
export function materialCostFromBom(lines: BomLine[]): number {
  return lines.reduce(
    (sum, l) => sum + l.qty * l.unitCost * (l.fx ?? 1) * (1 + (l.inflation ?? 0)),
    0,
  );
}

// ----------------------------------------------------------- Validation ----

export function validateModel(m: Model): void {
  const issues: string[] = [];
  const dupes = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(`Duplicate ${what} id "${id}"`);
      seen.add(id);
    }
  };
  dupes(m.groups.map((g) => g.id), "group");
  dupes(m.machines.map((x) => x.id), "machine");
  dupes(m.products.map((p) => p.id), "product");

  const groupIds = new Set(m.groups.map((g) => g.id));
  const productIds = new Set(m.products.map((p) => p.id));

  for (const mc of m.machines) {
    if (!groupIds.has(mc.groupId)) issues.push(`Machine "${mc.name}" belongs to unknown group "${mc.groupId}"`);
    if (!(mc.hoursPerPeriod >= 0)) issues.push(`Machine "${mc.name}" has invalid hoursPerPeriod`);
    if (!(mc.efficiency > 0 && mc.efficiency <= 1)) issues.push(`Machine "${mc.name}" efficiency must be > 0 and <= 1`);
  }
  for (const g of m.groups) {
    if (!m.machines.some((mc) => mc.groupId === g.id)) issues.push(`Group "${g.name}" has no machines`);
  }
  for (const p of m.products) {
    if (!(p.price >= 0)) issues.push(`Product "${p.name}" has invalid price`);
    if (!(p.materialCost >= 0)) issues.push(`Product "${p.name}" has invalid materialCost`);
    if (!(n(p.otherThroughputCost) >= 0)) issues.push(`Product "${p.name}" has invalid otherThroughputCost`);
    if (!(n(p.otherVariableCost) >= 0)) issues.push(`Product "${p.name}" has invalid otherVariableCost`);
  }
  const seenRoutes = new Set<string>();
  for (const r of m.routings) {
    if (!productIds.has(r.productId)) issues.push(`Routing references unknown product "${r.productId}"`);
    if (!groupIds.has(r.groupId)) issues.push(`Routing references unknown group "${r.groupId}"`);
    if (!(r.minutesPerUnit >= 0)) issues.push(`Routing ${r.productId}/${r.groupId} has invalid minutesPerUnit`);
    const key = `${r.productId}|${r.groupId}`;
    if (seenRoutes.has(key)) issues.push(`Duplicate routing for product "${r.productId}" on group "${r.groupId}"`);
    seenRoutes.add(key);
  }
  for (const [id, v] of Object.entries(m.volumes)) {
    if (!productIds.has(id)) issues.push(`Volume given for unknown product "${id}"`);
    if (!(v >= 0) || !Number.isFinite(v)) issues.push(`Volume for "${id}" must be a finite number >= 0`);
  }
  if (!(m.operatingExpense >= 0)) issues.push("operatingExpense must be >= 0");

  if (issues.length) throw new ModelError(issues);
}

// ------------------------------------------------- Capacity & constraint ----

export function groupCapacityHours(model: Model, groupId: string): number {
  return model.machines
    .filter((m) => m.groupId === groupId)
    .reduce((s, m) => s + m.hoursPerPeriod * m.efficiency, 0);
}

export function loadByGroup(model: Model): GroupLoad[] {
  return model.groups.map((g) => {
    const capacityHours = groupCapacityHours(model, g.id);
    let loadHours = 0;
    for (const r of model.routings) {
      if (r.groupId === g.id) loadHours += ((model.volumes[r.productId] ?? 0) * r.minutesPerUnit) / 60;
    }
    const utilization = capacityHours > EPS ? loadHours / capacityHours : loadHours > EPS ? Infinity : 0;
    return {
      groupId: g.id,
      name: g.name,
      machineCount: model.machines.filter((m) => m.groupId === g.id).length,
      capacityHours,
      loadHours,
      utilization,
      overloadHours: Math.max(0, loadHours - capacityHours),
    };
  });
}

function pickConstraint(groups: GroupLoad[], pinnedId?: string): ConstraintInfo | null {
  if (pinnedId !== undefined) {
    const g = groups.find((x) => x.groupId === pinnedId);
    if (!g) throw new ModelError([`constraintGroupId "${pinnedId}" is not a group in this model`]);
    return { groupId: g.groupId, name: g.name, utilization: g.utilization, binding: g.utilization >= 1 - EPS, pinned: true };
  }
  const loaded = groups.filter((g) => g.loadHours > EPS);
  if (loaded.length === 0) return null;
  loaded.sort(
    (a, b) =>
      (b.utilization - a.utilization) || (b.loadHours - a.loadHours) || a.groupId.localeCompare(b.groupId),
  );
  const g = loaded[0];
  return { groupId: g.groupId, name: g.name, utilization: g.utilization, binding: g.utilization >= 1 - EPS, pinned: false };
}

// ------------------------------------------------------------ Evaluation ----

export function evaluate(model: Model, options: EvaluateOptions = {}): Evaluation {
  validateModel(model);
  const groups = loadByGroup(model);
  const constraint = pickConstraint(groups, options.constraintGroupId);
  const warnings: string[] = [];

  const minutesOnConstraint = (productId: string): number =>
    constraint
      ? model.routings.find((r) => r.productId === productId && r.groupId === constraint.groupId)?.minutesPerUnit ?? 0
      : 0;

  const rows: ProductResult[] = model.products.map((p) => {
    const volume = model.volumes[p.id] ?? 0;
    const T = throughputPerUnit(p);
    const CM = contributionMarginPerUnit(p);
    const minutes = minutesOnConstraint(p.id);
    return {
      productId: p.id,
      name: p.name,
      volume,
      throughputPerUnit: T,
      contributionMarginPerUnit: CM,
      constraintMinutesPerUnit: minutes,
      velocity: minutes > EPS ? T / (minutes / 60) : null,
      score: null,
      rank: null,
      totalThroughput: volume * T,
      totalContributionMargin: volume * CM,
    };
  });

  const withVelocity = rows.filter((r) => r.velocity !== null);
  const best = withVelocity.reduce((mx, r) => Math.max(mx, r.velocity as number), -Infinity);
  for (const r of withVelocity) {
    r.score = best > EPS ? Math.max(0, ((r.velocity as number) / best) * 100) : 0;
  }
  [...withVelocity]
    .sort((a, b) => (b.velocity as number) - (a.velocity as number))
    .forEach((r, i) => {
      r.rank = i + 1;
    });

  const revenue = model.products.reduce((s, p) => s + (model.volumes[p.id] ?? 0) * p.price, 0);
  const throughput = rows.reduce((s, r) => s + r.totalThroughput, 0);
  const contributionMargin = rows.reduce((s, r) => s + r.totalContributionMargin, 0);
  const constraintHours = constraint ? groups.find((g) => g.groupId === constraint.groupId)!.loadHours : 0;

  const overloaded = groups.filter((g) => g.overloadHours > EPS);
  const feasible = overloaded.length === 0;
  if (!feasible) {
    warnings.push(
      "Plan exceeds capacity on: " +
        overloaded.map((g) => `${g.name} (${g.overloadHours.toFixed(1)} h over)`).join(", ") +
        ". The profit shown is not achievable as planned.",
    );
  }
  if (!constraint) {
    warnings.push("No product is routed through any machine group, so velocity is not available.");
  } else if (!constraint.binding) {
    warnings.push(
      `No machine group is fully loaded (highest: ${constraint.name} at ${(constraint.utilization * 100).toFixed(0)}%). ` +
        "The constraint is likely market demand, not capacity.",
    );
  }

  return {
    groups,
    constraint,
    products: rows,
    totals: {
      revenue,
      throughput,
      contributionMargin,
      operatingExpense: model.operatingExpense,
      profit: contributionMargin - model.operatingExpense,
      constraintHours,
      portfolioVelocity: constraintHours > EPS ? throughput / constraintHours : null,
    },
    feasible,
    warnings,
  };
}

// ------------------------------------------------------------- Scenarios ----

function factor(adj: Adjustment | undefined, productId: string): number {
  if (!adj) return 1;
  const f = (1 + n(adj.all)) * (1 + n(adj.byProduct?.[productId]));
  if (f < 0) throw new ModelError([`Adjustment for "${productId}" would make a value negative`]);
  return f;
}

export function applyPrice(model: Model, adj?: Adjustment): Model {
  if (!adj) return model;
  return { ...model, products: model.products.map((p) => ({ ...p, price: p.price * factor(adj, p.id) })) };
}

export function applyMaterialCost(model: Model, adj?: Adjustment): Model {
  if (!adj) return model;
  return { ...model, products: model.products.map((p) => ({ ...p, materialCost: p.materialCost * factor(adj, p.id) })) };
}

export function applyVolume(model: Model, adj?: Adjustment): Model {
  if (!adj) return model;
  const volumes: Record<string, number> = {};
  for (const [id, v] of Object.entries(model.volumes)) volumes[id] = v * factor(adj, id);
  return { ...model, volumes };
}

/** Shift mix while keeping total volume constant; other products scale proportionally. */
export function applyMix(model: Model, shifts?: MixShift[]): Model {
  if (!shifts || shifts.length === 0) return model;
  const volumes = { ...model.volumes };
  const total = Object.values(volumes).reduce((s, v) => s + v, 0);
  if (total <= EPS) return model;
  for (const s of shifts) {
    if (!(s.productId in volumes)) throw new ModelError([`Mix shift references unknown product "${s.productId}"`]);
    const share = volumes[s.productId] / total;
    const target = Math.min(1, Math.max(0, share + s.deltaPoints));
    const othersTotal = total - volumes[s.productId];
    if (othersTotal <= EPS) {
      if (target < 1 - EPS) throw new ModelError(["Cannot shift mix away from the only product with volume"]);
      continue;
    }
    const scale = ((1 - target) * total) / othersTotal;
    for (const id of Object.keys(volumes)) {
      volumes[id] = id === s.productId ? target * total : volumes[id] * scale;
    }
  }
  return { ...model, volumes };
}

export function applyScenario(model: Model, scenario: Scenario): Model {
  return applyMix(applyVolume(applyMaterialCost(applyPrice(model, scenario.price), scenario.materialCost), scenario.volume), scenario.mixShift);
}

/** Profit bridge: base → price → material cost → volume → mix → scenario. Deltas sum exactly. */
export function profitBridge(model: Model, scenario: Scenario): Bridge {
  const profitOf = (m: Model) => evaluate(m).totals.profit;
  const baseProfit = profitOf(model);
  const stages: Array<[string, (m: Model) => Model]> = [
    ["Price", (m) => applyPrice(m, scenario.price)],
    ["Material cost", (m) => applyMaterialCost(m, scenario.materialCost)],
    ["Volume", (m) => applyVolume(m, scenario.volume)],
    ["Mix", (m) => applyMix(m, scenario.mixShift)],
  ];
  const steps: BridgeStep[] = [];
  let current = model;
  let prev = baseProfit;
  for (const [label, fn] of stages) {
    current = fn(current);
    const p = profitOf(current);
    steps.push({ label, delta: p - prev, cumulativeProfit: p });
    prev = p;
  }
  return { baseProfit, scenarioProfit: prev, steps };
}

/**
 * Sensitivity curves for one product. The constraint group is fixed from the
 * base model (or the pinned option) so curves do not jump between groups.
 * x is a fractional change for price / materialCost, and fractional points for mix.
 */
export function sensitivity(
  model: Model,
  productId: string,
  variable: SensitivityVariable,
  xs: number[],
  options: EvaluateOptions = {},
): SensitivityPoint[] {
  const base = evaluate(model, options);
  const constraintGroupId = base.constraint?.groupId;
  return xs.map((x) => {
    const scenario: Scenario =
      variable === "price"
        ? { price: { byProduct: { [productId]: x } } }
        : variable === "materialCost"
          ? { materialCost: { byProduct: { [productId]: x } } }
          : { mixShift: [{ productId, deltaPoints: x }] };
    const ev = evaluate(applyScenario(model, scenario), { constraintGroupId });
    return {
      x,
      productVelocity: ev.products.find((p) => p.productId === productId)?.velocity ?? null,
      portfolioVelocity: ev.totals.portfolioVelocity,
      profit: ev.totals.profit,
    };
  });
}

// -------------------------------------------------------- Mix optimiser ----

/**
 * Greedy single-constraint optimiser: fill constraint hours with the highest
 * velocity products first, each capped by maxDemand (default: current volume).
 * Products with T <= 0 get zero volume; products that do not use the constraint
 * run at full demand. If another group becomes overloaded the result carries a
 * warning — that is a multi-constraint problem and needs a proper LP.
 */
export function optimizeMix(model: Model, options: EvaluateOptions = {}): Optimization {
  const base = evaluate(model, options);
  if (!base.constraint) throw new ModelError(["No constraint found: no product is routed through any machine group"]);
  const cg = base.constraint.groupId;
  const capacity = groupCapacityHours(model, cg);
  const minutesFor = new Map(model.routings.filter((r) => r.groupId === cg).map((r) => [r.productId, r.minutesPerUnit]));
  const demandOf = (p: Product) => p.maxDemand ?? model.volumes[p.id] ?? 0;

  const volumes: Record<string, number> = {};
  const candidates: Array<{ p: Product; minutes: number; velocity: number }> = [];
  for (const p of model.products) {
    const T = throughputPerUnit(p);
    if (T <= 0) {
      volumes[p.id] = 0;
      continue;
    }
    const minutes = minutesFor.get(p.id) ?? 0;
    if (minutes <= EPS) {
      volumes[p.id] = demandOf(p);
      continue;
    }
    candidates.push({ p, minutes, velocity: T / (minutes / 60) });
  }
  candidates.sort((a, b) => b.velocity - a.velocity);

  let remaining = capacity;
  for (const c of candidates) {
    const maxUnits = Math.floor((remaining * 60) / c.minutes + EPS);
    const units = Math.max(0, Math.min(demandOf(c.p), maxUnits));
    volumes[c.p.id] = units;
    remaining = Math.max(0, remaining - (units * c.minutes) / 60);
  }

  const evaluation = evaluate({ ...model, volumes }, { constraintGroupId: cg });
  const warnings = evaluation.groups
    .filter((g) => g.groupId !== cg && g.overloadHours > EPS)
    .map((g) => `${g.name} becomes overloaded (${g.overloadHours.toFixed(1)} h over): this is a multi-constraint case.`);
  return { volumes, evaluation, warnings };
}
