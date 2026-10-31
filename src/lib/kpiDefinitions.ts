// Text copied from the engine header. Display only — the math lives in profitVelocityEngine.ts.
export const KPI = {
  revenue: { label: "Revenue", formula: "Σ (volume × price)" },
  throughput: { label: "Throughput", formula: "Σ volume × T, where T = price − materialCost − otherThroughputCost" },
  contribution: { label: "Contribution margin", formula: "CM = T − otherVariableCost" },
  profit: { label: "Profit", formula: "Σ(volume × CM) − operatingExpense" },
  portfolioVelocity: { label: "Portfolio velocity", formula: "Σ(volume × T) ÷ constraint hours consumed" },
  velocity: { label: "Product velocity", formula: "T ÷ (constraint minutes per unit ÷ 60)  [currency / constraint-hour]" },
  score: { label: "Velocity score", formula: "velocity ÷ best velocity × 100 (floored at 0)" },
  capacity: { label: "Group capacity", formula: "Σ (hoursPerPeriod × efficiency) of the group's machines" },
  utilization: { label: "Utilization", formula: "load hours ÷ capacity hours" },
} as const;
