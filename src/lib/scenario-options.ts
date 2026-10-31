/** Picker options are complete, persisted scenarios, never incomplete saves or unnamed drafts. */
export function savedScenarioOptions<S extends { id: string; name: string; created_at: string; company_id: string }>(
  scenarios: S[],
  inputs: { scenario_id: string; company_id: string }[],
): S[] {
  return scenarios.filter((scenario) =>
    Boolean(scenario.id && scenario.created_at && scenario.name.trim()) &&
    inputs.some((input) => input.scenario_id === scenario.id && input.company_id === scenario.company_id),
  );
}