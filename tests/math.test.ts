import { describe, expect, it } from "vitest";
import { normalizeMathSource, parseRichText } from "../src/ui/math.js";

describe("mathematical rich text", () => {
  it("parses inline and display LaTeX delimiters without changing surrounding prose", () => {
    const segments = parseRichText("贝尔曼方程为 $V^\\pi(s)=\\sum_a Q(s,a)$。\\[x^2+y^2=z^2\\]");

    expect(segments.map(({ type, value, display }) => ({ type, value, display }))).toEqual([
      { type: "text", value: "贝尔曼方程为 ", display: false },
      { type: "math", value: "V^\\pi(s)=\\sum_a Q(s,a)", display: false },
      { type: "text", value: "。", display: false },
      { type: "math", value: "x^2+y^2=z^2", display: true }
    ]);
  });

  it("recognizes the undelimited notation commonly produced in option labels", () => {
    const segments = parseRichText("状态价值函数 V^π(s) 的更新目标");
    const formula = segments.find((segment) => segment.type === "math");

    expect(formula).toMatchObject({ source: "V^π(s)", value: "V^\\pi (s)", display: false });
  });

  it("normalizes unicode reinforcement-learning notation for KaTeX", () => {
    expect(normalizeMathSource("V^π(s)=Σ_a π(a|s)[r+γV^π(s')]")).toBe(
      "V^\\pi (s)=\\sum _a \\pi (a|s)[r+\\gamma V^\\pi (s')]"
    );
    expect(normalizeMathSource("\\max_a Q(s,a)+max_a Q(s,a)")).toBe("\\max_a Q(s,a)+\\max_a Q(s,a)");
  });

  it("leaves ordinary prose, URLs, and unmatched delimiters untouched", () => {
    for (const value of ["Q-learning 更新规则", "访问 https://example.com/a_b", "价格是 $5"]) {
      expect(parseRichText(value)).toEqual([{ type: "text", value, source: value, display: false }]);
    }
  });
});
