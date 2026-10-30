import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useCompanyData } from "./data";

interface Ctx {
  scenarioId: string | null;
  setScenarioId: (id: string) => void;
}
const ScenarioCtx = createContext<Ctx>({ scenarioId: null, setScenarioId: () => {} });
const KEY = "andaflows.scenario";

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const { data } = useCompanyData();
  const [scenarioId, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const exists = (id: string | null) => !!id && data.scenarios.some((s) => s.id === id);
    if (exists(scenarioId)) return;
    const stored = window.localStorage.getItem(KEY);
    const fallback =
      data.scenarios.find((s) => s.version_label === "Actual")?.id ?? data.scenarios[0]?.id ?? null;
    setId(exists(stored) ? stored : fallback);
  }, [data, scenarioId]);

  const setScenarioId = (id: string) => {
    window.localStorage.setItem(KEY, id);
    setId(id);
  };
  return <ScenarioCtx.Provider value={{ scenarioId, setScenarioId }}>{children}</ScenarioCtx.Provider>;
}

export const useScenario = () => useContext(ScenarioCtx);
