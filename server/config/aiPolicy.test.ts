import { describe, expect, it } from "vitest";
import {
  AI_DEFAULT_MAX_OUTPUT_TOKENS,
  AI_MODEL_POLICY,
  AI_ROUTING_GROUPS,
  GLOBAL_MAX_OUTPUT_TOKENS,
  GROQ_MAX_CREDENTIALS,
  getEffectiveMaxOutputTokens,
  getModelPolicy,
  getRoutingGroupForSlot,
  getRoutingGroupForTask,
} from "./aiPolicy";

describe("predictable 20-key Groq policy", () => {
  it("uses a 2,000-token default output budget", () => {
    expect(AI_DEFAULT_MAX_OUTPUT_TOKENS).toBe(2000);
    expect(GLOBAL_MAX_OUTPUT_TOKENS).toBe(2000);
  });

  it("supports exactly 20 platform credential slots", () => {
    expect(GROQ_MAX_CREDENTIALS).toBe(20);
    expect(AI_ROUTING_GROUPS.reduce((sum, group) => sum + group.slots.length, 0)).toBe(20);
  });

  it("keeps three locked models in every workload group", () => {
    for (const group of AI_ROUTING_GROUPS) {
      expect(group.models, group.id).toHaveLength(3);
      for (const route of group.models) {
        expect(route.maxOutputTokens).toBeLessThanOrEqual(2000);
      }
    }
  });

  it("keeps smart-contract generation deterministic", () => {
    expect(getRoutingGroupForTask("generation").slots).toEqual([4, 5, 6]);
    expect(getModelPolicy("generation")[0].model).toBe("openai/gpt-oss-120b");
    expect(getModelPolicy("generation")[1].model).toBe("openai/gpt-oss-20b");
    expect(getModelPolicy("generation")[2].model).toBe("qwen/qwen3.6-27b");
  });

  it("keeps slot-to-workload assignment immutable", () => {
    expect(getRoutingGroupForSlot(1).id).toBe("architecture");
    expect(getRoutingGroupForSlot(4).id).toBe("generation");
    expect(getRoutingGroupForSlot(7).id).toBe("editing-repair");
    expect(getRoutingGroupForSlot(10).id).toBe("testing");
    expect(getRoutingGroupForSlot(13).id).toBe("security");
    expect(getRoutingGroupForSlot(16).id).toBe("documentation-copilot");
    expect(getRoutingGroupForSlot(19).id).toBe("research-compile");
  });

  it("does not contain the retired llama-3.3 model", () => {
    const allModels = Object.values(AI_MODEL_POLICY)
      .flat()
      .map((entry: any) => entry.model);
    expect(allModels).not.toContain("llama-3.3-70b-versatile");
  });

  it("never allows a caller to exceed the platform 2,000-token ceiling", () => {
    expect(getEffectiveMaxOutputTokens("openai/gpt-oss-120b", 65000)).toBe(2000);
    expect(getEffectiveMaxOutputTokens("qwen/qwen3.6-27b", 12000)).toBe(2000);
  });
});
