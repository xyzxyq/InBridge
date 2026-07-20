import { describe, expect, it } from "vitest";
import { comparisonSelectionText } from "../src/ui/comparison.js";

describe("comparison card presentation", () => {
  it("describes selected and unselected states explicitly", () => {
    expect(comparisonSelectionText(true)).toBe("已选择");
    expect(comparisonSelectionText(false)).toBe("选择此方案");
  });
});
