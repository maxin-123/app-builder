import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toModel, scenarioInputs, type CompanyData } from "./modelAdapter";
import {
  applyScenario,
  evaluate,
  ModelError,
  type Evaluation,
  type Model,
  type Scenario as EngineScenario,
} from "./profitVelocityEngine";

export type Role = "admin" | "analyst" | "viewer";

export interface Me {
  userId: string;
  email: string;
  fullName: string | null;
  role: Role;
  company: Tables<"companies">;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const profile = await must(supabase.from("profiles").select("*").eq("user_id", u.user.id).single());
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
      const company = await must(supabase.from("companies").select("*").eq("id", profile.company_id).single());
      return {
        userId: u.user.id,
        email: u.user.email ?? "",
        fullName: profile.full_name,
        role: (role?.role ?? "viewer") as Role,
        company,
      };
    },
  });
}

export function usePermissions() {
  const { data: me } = useMe();
  const role = me?.role;
  return {
    me,
    isAdmin: role === "admin",
    canEdit: role === "admin" || role === "analyst",
    canLock: (s: Tables<"scenarios">) => role === "admin" || (role === "analyst" && s.created_by === me?.userId),
  };
}

export function useCompanyData() {
  return useQuery({
    queryKey: ["company-data"],
    queryFn: async (): Promise<CompanyData> => {
      const [groups, machines, products, materials, bom, routings, scenarios, inputs] = await Promise.all([
        must(supabase.from("machine_groups").select("*").order("created_at")),
        must(supabase.from("machines").select("*").order("created_at")),
        must(supabase.from("products").select("*").order("created_at")),
        must(supabase.from("materials").select("*").order("created_at")),
        must(supabase.from("product_materials").select("*")),
        must(supabase.from("routings").select("*")),
        must(supabase.from("scenarios").select("*").order("created_at")),
        must(supabase.from("scenario_inputs").select("*")),
      ]);
      return { groups, machines, products, materials, bom, routings, scenarios, inputs };
    },
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["company-data"] });
}

export interface ScenarioRun {
  baseModel: Model;
  adjustments: EngineScenario;
  model: Model;
  pinnedGroupId?: string;
  evaluation: Evaluation;
}

export function runScenario(data: CompanyData, scenarioId: string | null, override?: EngineScenario): ScenarioRun {
  const baseModel = toModel(data, scenarioId);
  const stored = scenarioInputs(data, scenarioId);
  const adjustments = override ?? stored.adjustments;
  const pinnedGroupId = stored.pinnedGroupId;
  const model = applyScenario(baseModel, adjustments);
  const evaluation = evaluate(model, { constraintGroupId: pinnedGroupId });
  return { baseModel, adjustments, model, pinnedGroupId, evaluation };
}

export interface ScenarioAnalysis {
  run: ScenarioRun | null;
  compare: ScenarioRun | null;
  compareLabel: string;
  shift: { from: string; to: string } | null;
  issues: string[];
}

/** Runs the engine for a scenario and the scenario it is compared against. */
export function useScenarioAnalysis(data: CompanyData | undefined, scenarioId: string | null, override?: EngineScenario): ScenarioAnalysis {
  return useMemo(() => analyzeScenario(data, scenarioId, override), [data, scenarioId, override]);
}

export function analyzeScenario(data: CompanyData | undefined, scenarioId: string | null, override?: EngineScenario): ScenarioAnalysis {
  {
    if (!data || !scenarioId) return { run: null, compare: null, compareLabel: "", shift: null, issues: [] };
    try {
      const run = runScenario(data, scenarioId, override);
      const s = data.scenarios.find((x) => x.id === scenarioId);
      const base = s?.base_scenario_id ? data.scenarios.find((x) => x.id === s.base_scenario_id) : undefined;
      let compare: ScenarioRun;
      let compareLabel: string;
      if (base) {
        compare = runScenario(data, base.id);
        compareLabel = base.name;
      } else {
        const evaluation = evaluate(run.baseModel, { constraintGroupId: run.pinnedGroupId });
        compare = { ...run, adjustments: {}, model: run.baseModel, evaluation };
        compareLabel = "Before adjustments";
      }
      const a = compare.evaluation.constraint;
      const b = run.evaluation.constraint;
      const shift = a && b && a.groupId !== b.groupId ? { from: a.name, to: b.name } : null;
      return { run, compare, compareLabel, shift, issues: [] };
    } catch (e) {
      const issues = e instanceof ModelError ? e.issues : [e instanceof Error ? e.message : String(e)];
      return { run: null, compare: null, compareLabel: "", shift: null, issues };
    }
  }
}
