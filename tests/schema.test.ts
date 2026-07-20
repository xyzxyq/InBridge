import { describe, expect, it } from "vitest";
import { interactionConfigSchema } from "../src/server/schemas.js";

const validConfig = {
  interactionId: "choice_001",
  title: "请选择一个方案",
  controls: [
    {
      id: "plan",
      type: "radio" as const,
      label: "方案",
      required: true,
      options: [
        { label: "方案 A", value: "a" },
        { label: "方案 B", value: "b" }
      ]
    }
  ]
};

describe("interactionConfigSchema", () => {
  it("accepts a valid radio interaction", () => {
    expect(interactionConfigSchema.parse(validConfig)).toMatchObject(validConfig);
  });

  it("rejects arbitrary HTML fields", () => {
    expect(() => interactionConfigSchema.parse({ ...validConfig, html: "<script>alert(1)</script>" })).toThrow();
  });

  it("rejects duplicate control ids", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        controls: [validConfig.controls[0], validConfig.controls[0]]
      })
    ).toThrow(/control ids must be unique/);
  });

  it("rejects a default value outside the option set", () => {
    expect(() =>
      interactionConfigSchema.parse({
        ...validConfig,
        controls: [{ ...validConfig.controls[0], defaultValue: "missing" }]
      })
    ).toThrow(/defaultValue must match an option value/);
  });
});
