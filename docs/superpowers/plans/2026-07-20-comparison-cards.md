# Comparison Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure single-select comparison-card control and reusable template that submits one stable option value through the existing InBridge result flow.

**Architecture:** Extend the existing discriminated control schema with `comparison_cards`, reuse string-value validation and submission semantics, and render the new control with native radio inputs inside selectable cards. Keep card presentation logic isolated from transport, wizard, visibility, and result delivery behavior.

**Tech Stack:** Node.js 22, TypeScript 5.9, Zod 4, Vitest 4, Vite 8, MCP Apps UI, Vanilla DOM APIs.

## Global Constraints

- A comparison group contains 2–6 cards and allows exactly one selected value.
- The submitted result remains `version: "1"` and stores only the selected string value.
- Card content is plain text; reject images, URLs, HTML, CSS, scripts, and unknown fields.
- `comparison_cards` remains compatible with `visibleWhen` and Phase 9 steps.
- Existing controls, templates, previews, cancellation, retry, and fallback behavior must not regress.
- Use test-first red-green-refactor cycles for every production behavior.

---

### Task 1: Validate and normalize comparison-card controls

**Files:**
- Modify: `tests/schema.test.ts`
- Modify: `tests/normalize.test.ts`
- Modify: `src/server/schemas.ts`

**Interfaces:**
- Produces: `comparisonCardOptionSchema`.
- Produces: `comparisonCardsControlSchema` in `controlSchema`.
- Treats `comparison_cards` as a scalar string source for `equals` and `not_equals` conditions.

- [ ] **Step 1: Write failing schema tests**

Add tests for a valid card group, preservation through `normalizeInteraction`, invalid default values, duplicate option values, fewer than two and more than six cards, oversized pros/cons arrays, unknown URL fields, and a later control conditioned on a comparison value. Representative valid control:

```ts
{
  id: "plan",
  type: "comparison_cards",
  label: "Plan",
  required: true,
  options: [
    { value: "fast", title: "Fast", badge: "Recommended", pros: ["Quick"], cons: ["Limited"] },
    { value: "safe", title: "Safe", description: "Lower risk" }
  ],
  defaultValue: "fast"
}
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/schema.test.ts tests/normalize.test.ts`

Expected: FAIL because `comparison_cards` is not a supported discriminator value.

- [ ] **Step 3: Implement strict schemas and shared option validation**

Add:

```ts
export const comparisonCardOptionSchema = z.object({
  value: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  badge: z.string().min(1).max(40).optional(),
  pros: z.array(z.string().min(1).max(120)).max(5).optional().default([]),
  cons: z.array(z.string().min(1).max(120)).max(5).optional().default([])
}).strict();
```

Add a strict `comparison_cards` control with 2–6 options and optional `defaultValue`. Include it in `controlSchema`, reuse uniqueness and default-value checks, and include it wherever scalar option controls are validated for visibility conditions.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run: `npx vitest run tests/schema.test.ts tests/normalize.test.ts`

Expected: both files PASS.

Run: `npm test`

Expected: all test files PASS.

- [ ] **Step 5: Commit the schema slice**

```powershell
git add -- src/server/schemas.ts tests/schema.test.ts tests/normalize.test.ts
git commit -m "feat: validate comparison card controls"
```

---

### Task 2: Add the reusable comparison template

**Files:**
- Modify: `tests/templates.test.ts`
- Modify: `src/server/templates.ts`
- Modify: `docs/TEMPLATES.md`

**Interfaces:**
- Extends: `templateIdSchema` with `comparison`.
- Produces: a `comparison_cards` interaction through `buildInteractionTemplate`.
- Accepts: `interactionId`, `options`, `fieldLabel`, `defaultValue`, `required`, and standard shared template fields.

- [ ] **Step 1: Write failing catalog and rendering tests**

Expect five catalog IDs and a rendered control with the configured default:

```ts
expect(TEMPLATE_CATALOG.map((entry) => entry.id)).toContain("comparison");
const interaction = buildInteractionTemplate({
  templateId: "comparison",
  interactionId: "choose_plan",
  options: [
    { value: "fast", title: "Fast", pros: ["Quick"] },
    { value: "safe", title: "Safe", cons: ["Slower"] }
  ],
  defaultValue: "safe"
});
expect(interaction.controls[0]).toMatchObject({ type: "comparison_cards", defaultValue: "safe" });
```

Add a rejection assertion for a default not present in `options`.

- [ ] **Step 2: Run the template test and verify RED**

Run: `npx vitest run tests/templates.test.ts`

Expected: FAIL because `comparison` is not a template ID.

- [ ] **Step 3: Implement the template and documentation**

Add a strict request schema with defaults from the design. Add the catalog entry and `buildInteractionTemplate` branch. Produce one `comparison_cards` control plus a `summary` preview bound as `{ [fieldLabel]: "choice" }`. Document a complete call example in `docs/TEMPLATES.md`.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run: `npx vitest run tests/templates.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the template slice**

```powershell
git add -- src/server/templates.ts tests/templates.test.ts docs/TEMPLATES.md
git commit -m "feat: add comparison interaction template"
```

---

### Task 3: Render accessible selectable cards

**Files:**
- Create: `src/ui/comparison.ts`
- Create: `tests/comparison.test.ts`
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`

**Interfaces:**
- Produces: `comparisonSelectionText(selected: boolean): "已选择" | "选择此方案"`.
- Extends UI `Control` with `ComparisonCardsControl` and `ComparisonCardOption`.
- Reuses: `readControlValue`, `markInvalid`, `handleControlChange`, visibility resolution, summary rendering, and `submit`.

- [ ] **Step 1: Write the failing presentation-state test**

```ts
expect(comparisonSelectionText(true)).toBe("已选择");
expect(comparisonSelectionText(false)).toBe("选择此方案");
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npx vitest run tests/comparison.test.ts`

Expected: FAIL because `src/ui/comparison.ts` does not exist.

- [ ] **Step 3: Implement the pure helper and card renderer**

Create the helper, then add `createComparisonCards(control)` in `main.ts`. Render a fieldset containing label-wrapped native radio inputs, optional badge/description, titled pros and cons lists, and a live selection-state span. On change, update every state span and call `handleControlChange(control.id)`.

Update `readControlValue` so `comparison_cards` reads the checked radio value. Route the control to `createComparisonCards` before the existing radio/checkbox and generic-field branches. The existing required validation must focus the first radio when nothing is selected.

- [ ] **Step 4: Add responsive and accessible styles**

Add `.comparison-grid`, `.comparison-card`, `.comparison-card-content`, `.comparison-badge`, `.comparison-list`, and `.comparison-selection`. Use `:has(input:checked)` for visual state, `:focus-within` for keyboard focus, 2–3 responsive columns on desktop, and one column below 560px.

- [ ] **Step 5: Run type checks, tests, and build**

Run: `npm run typecheck && npm test && npm run build`

Expected: type checks pass, all tests pass, and Vite emits the Widget bundle.

- [ ] **Step 6: Commit the Widget slice**

```powershell
git add -- src/ui/comparison.ts src/ui/main.ts src/ui/styles.css tests/comparison.test.ts
git commit -m "feat: render comparison cards"
```

---

### Task 4: Release, browser-test, and publish Phase 10

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/server/app.ts`
- Modify: `src/server/mcp.ts`
- Modify: `src/ui/main.ts`
- Modify: `scripts/smoke-test.ts`
- Modify: `README.md`
- Create: `docs/PHASE-10-COMPARISON-CARDS.md`
- Create: `tests/fixtures/comparison-host.html`

**Interfaces:**
- Produces: package, server, client, and health version `0.10.0`.
- Produces: resource URI `ui://inbridge/interaction-v10.html`.
- Extends: smoke verification to require the `comparison` template and render it.

- [ ] **Step 1: Update release metadata and smoke assertions**

Update all version constants and the resource URI. Extend smoke assertions to expect five templates, call the `comparison` template with two cards, assert its control type and default value, and read the v10 resource through the exported `WIDGET_URI`.

- [ ] **Step 2: Add release documentation and browser fixture**

Document schema, template use, accessibility, security limits, and ChatGPT acceptance. Create a fixture that records context-update and message counts and renders three cards with no default selection.

- [ ] **Step 3: Run complete local verification**

Run: `npm run verify && npm run build && npm run smoke`

Expected: all tests, build steps, template calls, and resource reads PASS.

- [ ] **Step 4: Perform real browser acceptance**

Using Playwright CLI, verify that submitting with no selection stays on the form and shows an error, clicking the full “稳健方案” card selects it, the selection text changes to “已选择”, and submission records exactly one context update and one message with `{ choice: "safe" }`. Check desktop and mobile snapshots and require zero console errors and zero warnings.

- [ ] **Step 5: Commit the release slice**

```powershell
git add -- package.json package-lock.json src/server/app.ts src/server/mcp.ts src/ui/main.ts scripts/smoke-test.ts README.md docs/PHASE-10-COMPARISON-CARDS.md tests/fixtures/comparison-host.html
git commit -m "release: ship comparison cards"
```

- [ ] **Step 6: Merge, push, deploy, and request UAT**

After branch completion, merge to `main`, push to `origin/main`, wait for GitHub CI and Vercel production readiness, run production smoke and the production monitor, then ask the user to invoke only `render_interaction_template` with `templateId: "comparison"` and confirm ChatGPT reads the selected value.
