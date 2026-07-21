import katex from "katex";

export interface RichTextSegment {
  type: "text" | "math";
  value: string;
  source: string;
  display: boolean;
}

const DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false }
] as const;

const BARE_MATH_MARKER = /(?:\\[A-Za-z]+|[_^=]|[α-ωΑ-ΩΣ∑∏∫√∞≤≥≠≈±×÷])/u;
const CJK_OR_FULLWIDTH = /([\p{Script=Han}\u3000-\u303f\uff00-\uffef]+)/gu;

const SYMBOL_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Σ|∑/gu, "\\sum "],
  [/Π|∏/gu, "\\prod "],
  [/α/gu, "\\alpha "], [/β/gu, "\\beta "], [/γ/gu, "\\gamma "],
  [/δ/gu, "\\delta "], [/ε/gu, "\\varepsilon "], [/ζ/gu, "\\zeta "],
  [/η/gu, "\\eta "], [/θ/gu, "\\theta "], [/ι/gu, "\\iota "],
  [/κ/gu, "\\kappa "], [/λ/gu, "\\lambda "], [/μ/gu, "\\mu "],
  [/ν/gu, "\\nu "], [/ξ/gu, "\\xi "], [/π/gu, "\\pi "],
  [/ρ/gu, "\\rho "], [/σ/gu, "\\sigma "], [/τ/gu, "\\tau "],
  [/υ/gu, "\\upsilon "], [/φ/gu, "\\phi "], [/χ/gu, "\\chi "],
  [/ψ/gu, "\\psi "], [/ω/gu, "\\omega "],
  [/≤/gu, "\\le "], [/≥/gu, "\\ge "], [/≠/gu, "\\ne "],
  [/≈/gu, "\\approx "], [/±/gu, "\\pm "], [/×/gu, "\\times "],
  [/÷/gu, "\\div "], [/∞/gu, "\\infty "], [/√/gu, "\\sqrt "]
];

export function normalizeMathSource(source: string): string {
  let normalized = source.trim();
  for (const [pattern, replacement] of SYMBOL_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized
    .replace(/(?<!\\)\bmax(?=_)/gu, "\\max")
    .replace(/(?<!\\)\bmin(?=_)/gu, "\\min")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function looksLikeBareMath(source: string): boolean {
  const candidate = source.trim();
  if (candidate.length < 2 || candidate.length > 500) return false;
  if (/https?:\/\/|www\.|@/iu.test(candidate)) return false;
  return BARE_MATH_MARKER.test(candidate) && /[A-Za-z0-9α-ωΑ-ΩΣ∑∏∫√∞]/u.test(candidate);
}

function implicitSegments(source: string): RichTextSegment[] {
  return source.split(CJK_OR_FULLWIDTH).filter(Boolean).flatMap<RichTextSegment>((part) => {
    if (!looksLikeBareMath(part)) {
      return { type: "text", value: part, source: part, display: false };
    }

    const leading = part.match(/^\s*/u)?.[0] ?? "";
    const trailing = part.match(/\s*$/u)?.[0] ?? "";
    const formula = part.slice(leading.length, part.length - trailing.length || undefined);
    const segments: RichTextSegment[] = [];
    if (leading) segments.push({ type: "text", value: leading, source: leading, display: false });
    segments.push({ type: "math", value: normalizeMathSource(formula), source: formula, display: false });
    if (trailing) segments.push({ type: "text", value: trailing, source: trailing, display: false });
    return segments;
  });
}

function nextDelimitedExpression(source: string, from: number) {
  let match: { index: number; end: number; expression: string; display: boolean } | undefined;
  for (const delimiter of DELIMITERS) {
    let index = source.indexOf(delimiter.left, from);
    while (index >= 0) {
      const expressionStart = index + delimiter.left.length;
      const closing = source.indexOf(delimiter.right, expressionStart);
      if (closing >= 0 && source.slice(expressionStart, closing).trim()) {
        const candidate = {
          index,
          end: closing + delimiter.right.length,
          expression: source.slice(expressionStart, closing),
          display: delimiter.display
        };
        if (!match || candidate.index < match.index || (candidate.index === match.index && candidate.end > match.end)) {
          match = candidate;
        }
        break;
      }
      index = source.indexOf(delimiter.left, expressionStart);
    }
  }
  return match;
}

export function parseRichText(source: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const match = nextDelimitedExpression(source, cursor);
    if (!match) {
      segments.push(...implicitSegments(source.slice(cursor)));
      break;
    }
    if (match.index > cursor) segments.push(...implicitSegments(source.slice(cursor, match.index)));
    segments.push({
      type: "math",
      value: normalizeMathSource(match.expression),
      source: match.expression,
      display: match.display
    });
    cursor = match.end;
  }
  return segments.reduce<RichTextSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (segment.type === "text" && previous?.type === "text") {
      previous.value += segment.value;
      previous.source += segment.source;
    } else {
      merged.push(segment);
    }
    return merged;
  }, []);
}

export function renderRichText(element: HTMLElement, source: string): void {
  element.replaceChildren();
  for (const segment of parseRichText(source)) {
    if (segment.type === "text") {
      element.append(document.createTextNode(segment.value));
      continue;
    }

    const math = document.createElement("span");
    math.className = segment.display ? "math math-display" : "math math-inline";
    try {
      katex.render(segment.value, math, {
        displayMode: segment.display,
        output: "mathml",
        strict: "warn",
        throwOnError: true,
        trust: false
      });
    } catch {
      math.className = "math-fallback";
      math.textContent = segment.source;
    }
    element.append(math);
  }
}
