---
status: awaiting_human_verify
trigger: "Production ChatGPT Apps failure for InBridge Phase 7: list_interaction_templates followed by render_interaction_template with experiment_config defaults yields ‘加载应用时出错 / Failed to fetch template’ after v0.7.0/commit 7bcaa39; raw MCP smoke and resource read pass."
created: 2026-07-20T19:40:00+08:00
updated: 2026-07-20T19:46:52+08:00
---

## Current Focus

hypothesis: Confirmed root cause has been addressed locally by separating the discoverable MCP object shape from strict internal variant parsing.
test: Deploy the scoped changes, refresh/reconnect the ChatGPT App connector, and repeat the original list_interaction_templates then render_interaction_template prompt.
expecting: ChatGPT receives the complete tools/list input schema, calls the template with the intended arguments, fetches interaction-v7.html, and displays the inline widget instead of the red error card.
next_action: Human/parent production verification after deployment; do not archive until confirmed.

## Symptoms

expected: After list_interaction_templates, render_interaction_template with defaults (MARL, CartPole, budget 80, seed 8, ablation on) should display an inline ChatGPT Apps widget.
actual: ChatGPT shows a red application card saying “加载应用时出错 / Failed to fetch template” with Retry. Recent Vercel logs show POST /mcp 200/202 and no server error; a few unrelated/prior GET /mcp requests returned 405.
errors: “加载应用时出错 / Failed to fetch template”
reproduction: In production ChatGPT Apps, prompt so the model first calls list_interaction_templates and then only render_interaction_template using experiment_config defaults: MARL, CartPole, budget 80, seed 8, ablation enabled.
started: Began immediately after v0.7.0 / commit 7bcaa39. The prior render_interaction widget worked.

## Eliminated

## Evidence

- timestamp: 2026-07-20T19:40:00+08:00
  checked: Reporter-provided production observations
  found: Raw MCP smoke and direct resource read pass, and render-related POST /mcp requests return 200/202 without server errors.
  implication: The failure is likely at the ChatGPT host/template handoff boundary rather than a general MCP outage or handler exception.

- timestamp: 2026-07-20T19:41:00+08:00
  checked: Differential for commit 7bcaa39 in src/server/mcp.ts
  found: The pre-existing resource callback and render_interaction registration are unchanged except both now reference interaction-v7.html; the commit adds list_interaction_templates and render_interaction_template, and bumps server/widget versions.
  implication: Template construction cannot itself produce a fetch error before the host loads the widget; the highest-value suspects are new-tool descriptor/resource linkage and the URI version change.

- timestamp: 2026-07-20T19:42:00+08:00
  checked: Common bug pattern scan
  found: The symptom maps to Data Shape/API Contract and Environment/Config; no null, timing, state, or import error is reported by the server.
  implication: Tests should compare actual MCP wire shapes and resolved resource URIs, not UI form values.

- timestamp: 2026-07-20T19:43:00+08:00
  checked: Production tools/list output supplied by the parallel production inspection
  found: render_interaction_template.inputSchema is exactly {type: object, properties: {}}, whereas render_interaction exports its full schema.
  implication: ChatGPT receives no templateId or interactionId contract. The top-level discriminatedUnion(...).superRefine(...) is the unique schema-shape difference and is now the primary falsifiable cause.

- timestamp: 2026-07-20T19:43:30+08:00
  checked: Existing local smoke test
  found: Build and smoke pass, including direct list, template call, and resources/read.
  implication: The existing smoke bypasses model argument generation and never asserts tools/list schema content, explaining why it missed the production failure.

- timestamp: 2026-07-20T19:44:00+08:00
  checked: New in-memory MCP tools/list regression on current code
  found: Test fails deterministically; received inputSchema is exactly {type: object, properties: {}} instead of containing required templateId and interactionId.
  implication: The production descriptor defect is locally reproduced and causally tied to schema export, ruling out widget URI/resource fetching as the initiating failure.

- timestamp: 2026-07-20T19:45:00+08:00
  checked: Focused regression suite after schema split
  found: Both tools/list descriptor and production-equivalent experiment_config tool-call tests pass; server and UI type checks also pass.
  implication: The fix restores model-visible arguments without bypassing strict internal parsing or changing widget/resource behavior.

## Resolution

root_cause: render_interaction_template passed a top-level z.discriminatedUnion(...).superRefine(...) as registerAppTool inputSchema. The SDK/ext-apps registration path cannot export that shape and silently published an empty object schema, so ChatGPT had no template argument contract and the failed app-tool flow surfaced as “Failed to fetch template.”
fix: Added a plain discoverable interactionTemplateToolInputSchema for MCP tools/list, registered its raw object shape, and explicitly parsed callback arguments through the existing strict discriminated-union schema before rendering. Added wire-level descriptor and production-call regression tests.
verification: Focused regression 2/2 passed; type checks passed; full Vitest suite 39/39 passed; clean Vite/TypeScript production build passed; local end-to-end smoke passed template discovery, production-equivalent template rendering, legacy custom rendering, and resources/read; git diff --check passed. Production ChatGPT verification remains pending deployment by the parent/user.
files_changed: [src/server/templates.ts, src/server/mcp.ts, tests/mcp-schema.test.ts]
