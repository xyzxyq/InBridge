# Multi-Step Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, backward-compatible multi-step wizard to InBridge and ship `experiment_config` as a three-step ChatGPT interaction.

**Architecture:** Keep controls flat and add validated top-level step metadata. Put step calculations in a small UI-pure module, while `main.ts` owns DOM state, step-scoped validation, navigation, and the existing one-time result delivery flow.

**Tech Stack:** Node.js 22, TypeScript 5.9, Zod 4, Vitest 4, Vite 8, MCP Apps UI, Vanilla DOM APIs.

## Global Constraints

- `steps` is optional; interactions without it retain the current single-page behavior.
- A wizard contains 2–8 steps and assigns every control exactly once in original control order.
- Existing `visibleWhen`, preview, cancellation, retry, and JSON fallback semantics remain intact.
- Only the final confirmation calls `updateModelContext` and `sendMessage`.
- The result protocol remains `version: "1"`.
- Do not accept HTML, JavaScript, CSS, expressions, or external URLs.
- Use test-first red-green-refactor cycles for every behavior change.

---

### Task 1: Validate and normalize wizard declarations

**Files:**
- Modify: `tests/schema.test.ts`
- Modify: `tests/normalize.test.ts`
- Modify: `src/server/schemas.ts`
- Modify: `src/server/normalize.ts`

**Interfaces:**
- Produces: `interactionStepSchema` with `{ id, title, description?, controlIds }`.
- Produces: optional `steps` on `InteractionConfig` and `NormalizedInteraction`.
- Enforces: unique step IDs, exact control coverage, no duplicates, no unknown IDs, and original control ordering.

- [ ] **Step 1: Write failing schema and normalization tests**

Add tests that parse two ordered steps and preserve them through `normalizeInteraction`. Add separate rejection tests for duplicate step IDs, unknown control IDs, duplicate assignment, omitted controls, and reordered controls. Representative assertion:

```ts
const parsed = interactionConfigSchema.parse({
  ...validConfig,
  controls: [
    validConfig.controls[0],
    { id: "note", type: "text", label: "Note" }
  ],
  steps: [
    { id: "choice", title: "Choice", controlIds: ["plan"] },
    { id: "details", title: "Details", controlIds: ["note"] }
  ]
});
expect(parsed.steps?.map((step) => step.id)).toEqual(["choice", "details"]);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx vitest run tests/schema.test.ts tests/normalize.test.ts`

Expected: FAIL because `steps` is rejected by the strict interaction schema.

- [ ] **Step 3: Add the step schema and cross-field validation**

Add:

```ts
export const interactionStepSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  controlIds: z.array(idSchema).min(1).max(20)
}).strict();
```

Add `steps: z.array(interactionStepSchema).min(2).max(8).optional()` to both interaction schemas. In `superRefine`, compare flattened `controlIds` against `controls.map(control => control.id)` and emit precise issues for duplicate step IDs, unknown IDs, duplicate assignment, missing IDs, and order mismatch. Preserve parsed steps in `normalizeInteraction`.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run: `npx vitest run tests/schema.test.ts tests/normalize.test.ts`

Expected: both files PASS.

Run: `npm test`

Expected: all existing test files PASS.

- [ ] **Step 5: Commit the schema slice**

```powershell
git add -- src/server/schemas.ts src/server/normalize.ts tests/schema.test.ts tests/normalize.test.ts
git commit -m "feat: validate multi-step interactions"
```

---

### Task 2: Add deterministic wizard navigation logic

**Files:**
- Create: `src/ui/wizard.ts`
- Create: `tests/wizard.test.ts`

**Interfaces:**
- Produces: `WizardStep`.
- Produces: `clampStepIndex(index: number, stepCount: number): number`.
- Produces: `isFinalStep(index: number, stepCount: number): boolean`.
- Produces: `stepControlIds(steps: WizardStep[], index: number): ReadonlySet<string>`.
- Produces: `controlStepIndex(steps: WizardStep[], controlId: string): number`.

- [ ] **Step 1: Write failing pure-logic tests**

Cover lower and upper index clamping, final-step detection, current-step control selection, and lookup of a control's owning step:

```ts
expect(clampStepIndex(4, 3)).toBe(2);
expect(isFinalStep(2, 3)).toBe(true);
expect([...stepControlIds(steps, 1)]).toEqual(["budget", "seed_count"]);
expect(controlStepIndex(steps, "seed_count")).toBe(1);
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npx vitest run tests/wizard.test.ts`

Expected: FAIL because `src/ui/wizard.ts` does not exist.

- [ ] **Step 3: Implement the smallest pure module**

Implement the four exported functions without DOM access. Return an empty set for a missing step and `-1` for an unknown control. Throw only when `stepCount < 1`, because a caller cannot navigate a zero-step wizard.

- [ ] **Step 4: Run the new test and verify GREEN**

Run: `npx vitest run tests/wizard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the navigation slice**

```powershell
git add -- src/ui/wizard.ts tests/wizard.test.ts
git commit -m "feat: add wizard navigation model"
```

---

### Task 3: Publish the three-step experiment template

**Files:**
- Modify: `tests/templates.test.ts`
- Modify: `src/server/templates.ts`
- Modify: `docs/TEMPLATES.md`

**Interfaces:**
- Consumes: normalized optional `steps` from Task 1.
- Produces: `experiment_config.steps` with IDs `basics`, `training`, and `ablation_review`.

- [ ] **Step 1: Write the failing template assertion**

Extend the experiment test:

```ts
expect(interaction.steps).toEqual([
  {
    id: "basics",
    title: "基础信息",
    controlIds: ["research_direction", "environments", "information_density"]
  },
  {
    id: "training",
    title: "训练配置",
    controlIds: ["training_budget", "seed_count", "primary_color", "note"]
  },
  {
    id: "ablation_review",
    title: "消融与确认",
    controlIds: ["ablation", "ablation_variables"]
  }
]);
```

- [ ] **Step 2: Run the template test and verify RED**

Run: `npx vitest run tests/templates.test.ts`

Expected: FAIL because the template has no steps.

- [ ] **Step 3: Add steps to the experiment template**

Return the exact three-step declaration above from the `experiment_config` branch. Update its catalog description and `docs/TEMPLATES.md` to say it is a three-step wizard with a final summary.

- [ ] **Step 4: Run the template test and verify GREEN**

Run: `npx vitest run tests/templates.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the template slice**

```powershell
git add -- src/server/templates.ts tests/templates.test.ts docs/TEMPLATES.md
git commit -m "feat: make experiment template a wizard"
```

---

### Task 4: Render and operate the wizard in the MCP Widget

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`
- Modify: `tests/wizard.test.ts`

**Interfaces:**
- Consumes: `WizardStep`, `clampStepIndex`, `isFinalStep`, and `stepControlIds` from Task 2.
- Preserves: `submit(status)`, result delivery, recovery, condition filtering, and preview renderers.

- [ ] **Step 1: Add failing navigation-state tests**

Add a pure `nextStepIndex(current, stepCount)` and `previousStepIndex(current, stepCount)` expectation to `tests/wizard.test.ts`:

```ts
expect(nextStepIndex(0, 3)).toBe(1);
expect(nextStepIndex(2, 3)).toBe(2);
expect(previousStepIndex(1, 3)).toBe(0);
expect(previousStepIndex(0, 3)).toBe(0);
```

- [ ] **Step 2: Run the wizard test and verify RED**

Run: `npx vitest run tests/wizard.test.ts`

Expected: FAIL because the two navigation functions are not exported.

- [ ] **Step 3: Implement navigation functions and wire the DOM**

Add the two functions to `wizard.ts`. In `main.ts`:

- extend `Interaction` with `steps?: WizardStep[]`;
- reset `currentStepIndex = 0` in `render`;
- render an ordered progress list with `aria-current="step"`;
- tag each control container with its owning step;
- hide controls outside the current step while keeping conditional visibility calculation global;
- make `collectValues` accept an optional allowed-control set for step-scoped validation;
- on form submit, validate the current step and advance unless it is final;
- add “上一步” on steps after the first;
- show the configured submit label only on the final step;
- show the preview only on the final step;
- keep cancel available on every step.

Use one `refreshWizardView()` function to update progress state, control visibility, preview visibility, button labels, and button availability after every navigation or control change.

- [ ] **Step 4: Style progress and navigation accessibly**

Add `.wizard-progress`, `.wizard-steps`, `.wizard-step`, current/completed state, and compact mobile rules. Use text, weight, borders, and `aria-current`, not color alone.

- [ ] **Step 5: Run type checks, tests, and build**

Run: `npm run typecheck && npm test && npm run build`

Expected: type checking succeeds, all tests pass, and Vite emits `dist/ui/widget.js` and `dist/ui/widget.css`.

- [ ] **Step 6: Commit the Widget slice**

```powershell
git add -- src/ui/main.ts src/ui/styles.css src/ui/wizard.ts tests/wizard.test.ts
git commit -m "feat: render multi-step interaction wizard"
```

---

### Task 5: Version, document, and verify the real closure

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/server/mcp.ts`
- Modify: `src/ui/main.ts`
- Modify: `README.md`
- Create: `docs/PHASE-9-MULTI-STEP-WIZARD.md`
- Create: `tests/fixtures/wizard-host.html`

**Interfaces:**
- Produces: package and Widget version `0.9.0`.
- Produces: resource URI `ui://inbridge/interaction-v9.html`.
- Produces: a local browser fixture that exercises the three-step flow without ChatGPT.

- [ ] **Step 1: Add the release metadata and fixture**

Update both package version fields, the App version, and `WIDGET_URI`. Build a fixture containing the produced Widget assets and a deterministic experiment tool result. The fixture bridge must record `updateModelContext` and `sendMessage` payloads for inspection.

- [ ] **Step 2: Update user and operator documentation**

Document the declaration format, constraints, navigation semantics, backward compatibility, and ChatGPT acceptance prompt. Update README's version, capabilities, and roadmap status.

- [ ] **Step 3: Run the complete local verification**

Run: `npm run verify && npm run build && npm run smoke`

Expected: all checks pass and the local MCP smoke test confirms health, template discovery, rendering, custom rendering, and resource reading.

- [ ] **Step 4: Perform browser acceptance**

Open `tests/fixtures/wizard-host.html`, advance through all three steps, return once to confirm values remain, disable ablation to confirm its variables disappear, and submit. Verify exactly one model-context update and one follow-up message, with no hidden `ablation_variables` value and no browser console errors.

- [ ] **Step 5: Commit and publish**

```powershell
git add -- package.json package-lock.json src/server/mcp.ts src/ui/main.ts README.md docs/PHASE-9-MULTI-STEP-WIZARD.md tests/fixtures/wizard-host.html
git commit -m "release: ship multi-step wizard"
git push origin main
```

Deploy the resulting `main` revision to Vercel, run the production smoke test against `https://mcp.example.com`, verify `/health` reports `0.9.0`, and wait for GitHub CI and production monitor success.

- [ ] **Step 6: Ask for ChatGPT UAT**

Ask the user to call `list_interaction_templates`, then only `render_interaction_template` with `templateId: "experiment_config"`. Acceptance requires three visible steps, retained values after back navigation, a conditional ablation field, one final submission, and ChatGPT accurately repeating the structured result.
