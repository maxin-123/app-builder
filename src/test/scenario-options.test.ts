import { describe, expect, it } from "vitest";
import { savedScenarioOptions } from "@/lib/scenario-options";

const saved = { id: "saved", name: "My plan", company_id: "company", created_at: "2026-10-31T00:00:00Z" };
const input = { scenario_id: saved.id, company_id: saved.company_id };

describe("scenario options", () => {
  it("requires a name", () => {
    expect(savedScenarioOptions([{ ...saved, name: "   " }], [input])).toEqual([]);
    expect(savedScenarioOptions([saved], [input])).toEqual([saved]);
  });
  it("requires a complete save, including the inputs", () => {
    expect(savedScenarioOptions([saved], [])).toEqual([]);
    expect(savedScenarioOptions([{ ...saved, created_at: "" }], [input])).toEqual([]);
    expect(savedScenarioOptions([saved], [input])).toEqual([saved]);
  });
});