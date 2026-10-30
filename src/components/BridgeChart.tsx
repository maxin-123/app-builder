import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bridge } from "@/lib/profitVelocityEngine";
import { money } from "@/lib/format";

/** Renders the engine's profit bridge as a waterfall. */
export function BridgeChart({ bridge, currency, baseLabel = "Base", endLabel = "Scenario" }: { bridge: Bridge; currency: string; baseLabel?: string; endLabel?: string }) {
  let prev = bridge.baseProfit;
  const rows = [
    { name: baseLabel, range: [0, bridge.baseProfit], kind: "total", value: bridge.baseProfit },
    ...bridge.steps.map((s) => {
      const r = { name: s.label, range: [prev, s.cumulativeProfit], kind: s.delta >= 0 ? "up" : "down", value: s.delta };
      prev = s.cumulativeProfit;
      return r;
    }),
    { name: endLabel, range: [0, bridge.scenarioProfit], kind: "total", value: bridge.scenarioProfit },
  ];
  const color = (k: string) => (k === "total" ? "var(--chart-1)" : k === "up" ? "var(--positive)" : "var(--negative)");
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} interval={0} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => money(v, currency)} width={80} />
          <Tooltip formatter={(_v, _n, item) => money((item.payload as { value: number }).value, currency)} />
          <Bar dataKey="range" radius={[3, 3, 3, 3]}>
            {rows.map((r) => <Cell key={r.name} fill={color(r.kind)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
