<div align="center">
  <img src="icon/icon.png" alt="InBridge icon" width="168" />
  <h1>InBridge</h1>
  <p><strong>Clear, safe, structured choices that continue naturally inside ChatGPT.</strong></p>
  <p>A personal-first, declarative, stateless MCP App.</p>

  <p>
    <a href="README.md">中文</a>
    ·
    <a href="https://mcp.example.com/health">Production status</a>
    ·
    <a href="docs/TEMPLATES.md">Templates</a>
    ·
    <a href="docs/OPERATIONS.md">Operations</a>
  </p>

  <p>
    <a href="https://github.com/xyzxyq/InBridge/actions/workflows/ci.yml"><img src="https://github.com/xyzxyq/InBridge/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <img src="https://img.shields.io/badge/version-0.10.0-8b5cf6" alt="Version 0.10.0" />
    <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22.x" />
    <img src="https://img.shields.io/badge/MCP%20Apps-1.7.4-2563eb" alt="MCP Apps 1.7.4" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  </p>
</div>

---

## Overview

InBridge is an MCP App for ChatGPT. When the model needs a user to choose a plan, approve an action, or configure parameters, InBridge renders a structured inline panel instead of relying on an ambiguous free-form reply.

After confirmation, the Widget writes a versioned structured result into model context and triggers the next turn automatically. The model can then read the exact selection and continue the original task.

The end-to-end flow is:

1. The model calls an InBridge tool.
2. ChatGPT loads the inline Widget.
3. The user selects, configures, confirms, or cancels.
4. The Widget freezes the result to prevent duplicate or mutated submissions; after success, a reselect action replaces the one-time submit controls.
5. `updateModelContext` writes the structured result into context.
6. `sendMessage` triggers the next model turn.
7. The model reads the result and continues the task.

The full loop has been validated in ChatGPT Developer Mode and is deployed on Vercel.

## Why InBridge

Plain-text choices work for simple questions, but become fragile when a task contains several options, constraints, or parameters:

- users have to copy option names or parameter values manually;
- the model may misinterpret an imprecise response;
- multi-field configurations lack required-field validation and a live summary;
- complex alternatives are hard to compare consistently;
- the user often has to send another message after confirming;
- Host capability or network failures can prevent a result from reaching the model.

InBridge turns these concerns into a controlled declarative protocol. The model describes allowed controls and data; the Widget owns rendering, validation, confirmation, delivery, and recovery.

## Features

### Controls

| Control | Type | Typical use |
| --- | --- | --- |
| Radio | `radio` | Mutually exclusive plans or preferences |
| Checkbox group | `checkbox_group` | Tags, environments, capability sets |
| Select | `select` | Single values with several candidates |
| Range | `range` | Budgets, intensity, brightness |
| Text | `text` | Notes and additional requirements |
| Number | `number` | Counts, seed values, thresholds |
| Switch | `switch` | Enable or disable an option |
| Color | `color` | Theme and chart colors |
| Comparison cards | `comparison_cards` | Rich side-by-side plan comparison |

### Composition and reliability

- strict required-field validation with focus feedback;
- declarative visibility using `equals`, `not_equals`, `includes`, and `not_includes`;
- hidden values automatically excluded from validation, previews, and results;
- optional 2–8 step wizards with per-step validation and preserved values;
- safe `summary` and `theme_card` live previews;
- distinct confirmed and cancelled semantics;
- frozen submission values and duplicate-submit protection;
- Host capability negotiation, retries, and copyable JSON fallback;
- a shared project icon exposed through the MCP server identity and production origin.

## Technical architecture

![InBridge technical architecture](docs/assets/architecture.png)

The diagram is authored in [LaTeX TikZ](docs/architecture.tex). A directly viewable [PDF export](docs/assets/architecture.pdf) is included as well. The README uses the PNG export for consistent rendering across GitHub and mobile Markdown clients.

### Layers

| Layer | Responsibility | Main implementation |
| --- | --- | --- |
| HTTP boundary | Stateless MCP requests, health, icon, security headers, safe errors | Express 5, Streamable HTTP |
| Configuration core | Whitelist schemas, defaults, cross-field validation, templates | Zod 4, TypeScript |
| MCP layer | Tool discovery and calls, UI resource, server identity | MCP SDK, MCP Apps SDK |
| Widget layer | Controls, Host theme sync, visibility, wizard, preview, accessibility, state | Native DOM, CSS, MCP Apps bridge |
| Result delivery | Context update, next-turn trigger, retry, manual fallback | `updateModelContext`, `sendMessage` |
| Operations | CI gates, deployment, logs, rate limits, remote monitoring | Vercel, GitHub Actions |

### Stateless server model

Every `POST /mcp` request creates an independent `McpServer` and `StreamableHTTPServerTransport`. The server does not rely on in-process user sessions. Temporary interaction state remains in the active Widget, while the final result returns to the conversation through standard Host capabilities.

This model works well with serverless deployment and reduces cross-user state leakage and cleanup requirements.

### Widget delivery

Vite builds the Widget into one IIFE JavaScript bundle and one CSS asset. When the MCP UI resource is read, the server inlines both files into HTML and returns `text/html;profile=mcp-app`. The current Widget does not require external scripts, styles, images, or network requests.

The Widget follows ChatGPT's active light or dark appearance through MCP Apps `hostContext.theme` and listens for live theme changes. It falls back to the system `prefers-color-scheme` only when the Host omits a theme. Semantic tokens drive surfaces, borders, text, and focus states so a light card never clashes with a dark conversation.

## MCP surface

### Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `https://mcp.example.com/mcp` | `POST` | Stateless Streaming HTTP MCP endpoint |
| `https://mcp.example.com/health` | `GET` | Service health and version |
| `https://mcp.example.com/icon.png` | `GET` | Project and MCP service icon |

### Tools

| Tool | Purpose |
| --- | --- |
| `list_interaction_templates` | Lists stable templates and their intended use |
| `render_interaction_template` | Builds a consistent validated interaction from a template |
| `render_interaction` | Builds a custom declarative interaction when no template fits |

Prefer templates for common decisions, confirmations, and configuration workflows. Use `render_interaction` only when a task genuinely needs a custom combination of fields.

### Built-in templates

| Template | Purpose | Key behavior |
| --- | --- | --- |
| `decision` | Single or multiple selection | Summary, defaults, required control |
| `confirmation` | Approve or reject an action | Separate confirm, reject, and cancel semantics |
| `experiment_config` | Machine-learning experiment design | Nine fields, three-step wizard, conditional ablation controls |
| `theme_config` | Theme and visual parameters | Live color, brightness, density, and style preview |
| `comparison` | Technical or strategic comparison | Two to six selectable cards with pros and cons |

See [Template documentation](docs/TEMPLATES.md) for the complete parameter reference.

## Result protocol and recovery

Confirmed interactions use a stable versioned structure:

```json
{
  "version": "1",
  "interactionId": "choose_plan_001",
  "status": "confirmed",
  "values": {
    "choice": "safe"
  },
  "submittedAt": "2026-07-20T12:00:00.000Z"
}
```

Cancelled results always use `status: "cancelled"` and an empty `values` object, so unconfirmed input cannot influence the model.

The Widget reports four delivery outcomes:

| Outcome | Meaning |
| --- | --- |
| `sent_with_context` | Structured context and the follow-up message both succeeded |
| `sent_with_inline_result` | Context update was unavailable, so the message included the full JSON |
| `context_only` | Context was updated but the next turn could not be triggered; retry is available |
| `manual_copy` | Neither Host capability was available; retry and copyable JSON are provided |

Once submission starts, values are frozen. Retrying sends the same immutable result instead of rereading the form. After successful delivery, submit and cancel disappear and only **Reselect** remains. Reselecting restores editing for a corrected submission without restoring cancel, keeping the one-time interaction unambiguous.

## Security model

The central rule is: the model provides data and declarations, never executable UI.

- all input objects use strict schemas and reject unknown fields;
- control counts, strings, options, and arrays have explicit limits;
- model-provided HTML, JavaScript, CSS, expressions, and event handlers are rejected;
- image URLs, external resources, and arbitrary network requests are rejected;
- visibility conditions can only reference earlier controls, preventing self-reference and cycles;
- preview bindings must target compatible existing controls;
- request bodies are limited to 64 KB;
- safe errors never echo request bodies or user selections;
- logs contain only request IDs, paths, status codes, and duration;
- responses include `nosniff`, no-referrer, and restrictive Permissions Policy headers;
- Vercel Firewall applies an IP rate limit to `/mcp`.

## Quick start

### Requirements

- Node.js 22.x;
- npm 11 or a compatible release;
- ChatGPT Developer Mode and custom MCP App/Connector access for ChatGPT integration.

### Install and build

```bash
git clone git@github.com:xyzxyq/InBridge.git
cd InBridge
npm install
npm run build
npm start
```

The server listens on `http://localhost:3000` by default:

```text
GET  http://localhost:3000/health
GET  http://localhost:3000/icon.png
POST http://localhost:3000/mcp
```

Use a different port with:

```bash
PORT=4100 npm start
```

PowerShell:

```powershell
$env:PORT = "4100"
npm start
```

### Development

```bash
npm run build:ui
npm run dev
```

`tsx watch` restarts the server on server-side changes. Re-run `npm run build:ui` after UI changes because the server reads the Widget bundle from `dist/ui`.

## Connect to ChatGPT

1. Enable Developer Mode in ChatGPT settings.
2. Create or edit a custom MCP App in the Apps/Connectors settings.
3. Set the MCP server URL to `https://mcp.example.com/mcp`.
4. Save, refresh, or reconnect the app.
5. Enable InBridge in a new conversation.
6. Ask the model to use it explicitly, for example:

```text
Use InBridge's comparison template to show three implementation plans.
Give each card concise pros and cons, then wait for me to confirm.
```

ChatGPT setting labels may change between product releases. The essential steps are enabling Developer Mode and adding the HTTPS `/mcp` endpoint as a custom connector.

## Usage examples

### Comparison template

```json
{
  "templateId": "comparison",
  "interactionId": "choose_implementation",
  "title": "Choose an implementation plan",
  "options": [
    {
      "value": "fast",
      "title": "Fast plan",
      "description": "Prioritize the smallest working loop",
      "badge": "Delivery first",
      "pros": ["Fast release", "Small change set"],
      "cons": ["Limited long-term extensibility"]
    },
    {
      "value": "safe",
      "title": "Maintainable plan",
      "description": "Prioritize clear boundaries and future growth",
      "badge": "Recommended",
      "pros": ["Clear architecture", "Easy to extend"],
      "cons": ["Longer first iteration"]
    }
  ]
}
```

### Custom interaction

```json
{
  "interactionId": "plan_choice_001",
  "title": "Choose a plan",
  "description": "The task will continue with your confirmed plan.",
  "controls": [
    {
      "id": "plan",
      "type": "radio",
      "label": "Plan",
      "required": true,
      "options": [
        { "label": "Plan A", "value": "a" },
        { "label": "Plan B", "value": "b" },
        { "label": "Plan C", "value": "c" }
      ]
    }
  ],
  "submitLabel": "Confirm and continue",
  "cancelLabel": "Cancel"
}
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run smoke
```

Or run the complete pre-release sequence:

```bash
npm run verify
npm run build
npm run smoke
```

The local smoke test starts the compiled server and performs real checks for:

- `GET /health`;
- `GET /icon.png` and MCP server identity icon metadata;
- MCP initialize;
- `tools/list`;
- template discovery and rendering;
- custom `render_interaction`;
- `resources/read` and inline Widget content.

Run the same suite against production:

```bash
INBRIDGE_BASE_URL=https://mcp.example.com npm run smoke
```

Tests cover schemas, templates, conditional visibility, wizard navigation, result delivery, Host fallbacks, HTTP security boundaries, and MCP wire shapes.

## Repository layout

```text
InBridge/
├── icon/
│   └── icon.png                 # Project and MCP service icon
├── src/
│   ├── server/
│   │   ├── app.ts               # Express app and routes
│   │   ├── http.ts              # Logging, headers, safe errors
│   │   ├── mcp.ts               # MCP tools, resource, identity
│   │   ├── normalize.ts         # Interaction normalization
│   │   ├── schemas.ts           # Declarative whitelist schemas
│   │   └── templates.ts         # Template catalog and builders
│   └── ui/
│       ├── main.ts              # Widget renderer and state machine
│       ├── bridge.ts            # Host capabilities and delivery
│       ├── lifecycle.ts         # One-time submit and reselect state model
│       ├── result.ts            # Versioned result protocol
│       ├── theme.ts             # Host/system theme resolution
│       ├── visibility.ts        # Conditional visibility model
│       ├── wizard.ts            # Wizard navigation model
│       └── styles.css           # Responsive Widget styles
├── tests/                       # Unit, protocol, and HTTP tests
├── scripts/smoke-test.ts        # Local/remote MCP smoke test
├── docs/
│   ├── architecture.tex         # TikZ architecture source
│   ├── assets/architecture.*    # README diagram exports
│   ├── TEMPLATES.md             # Template reference
│   └── OPERATIONS.md            # Release, monitoring, rollback
├── server.ts                    # Vercel Express Function entry
├── vite.config.ts               # Widget IIFE build
└── vercel.json                  # Production build configuration
```

## npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch server TypeScript changes |
| `npm run build:ui` | Build Widget JavaScript and CSS |
| `npm run build:server` | Compile server TypeScript |
| `npm run build` | Clean and build UI plus server |
| `npm run typecheck` | Type-check server and UI |
| `npm test` | Run Vitest |
| `npm run verify` | Type-check and run tests |
| `npm run smoke` | Run the local or remote MCP smoke test |

## Deployment and operations

The repository is connected to Vercel. A push to `main` triggers a production build, and Vercel runs the following gate before replacing production:

```text
npm run verify
    ↓
npm run build
    ↓
Vercel Express Function
```

GitHub Actions applies the same gate to pushes and pull requests. A separate Production monitor runs the full remote smoke test every six hours.

Manual production deployment:

```bash
vercel --prod
```

See the [Operations guide](docs/OPERATIONS.md) for logs, Firewall behavior, and rollback procedures.

## Current boundaries and roadmap

The current release focuses on short-lived structured interactions with explicit confirmation. It does not provide:

- persistent server-side forms or user sessions;
- arbitrary rich text, HTML, CSS, or script rendering;
- model-provided images or external URLs;
- automatic actions without explicit confirmation;
- durable preference storage;
- OAuth or multi-tenant identity isolation.

Conditional controls, multi-step wizards, comparison cards, Host theme sync, and a dedicated submission lifecycle are complete. Candidate next steps include:

- controlled slide, chart, and document previews;
- explicitly authorized presets;
- browser-level Widget E2E coverage;
- focused keyboard and touch accessibility regression coverage.

## Design and reference documents

- [Original development specification](plan/interactive-chat-ui-bridge-development-spec.md)
- [Template reference](docs/TEMPLATES.md)
- [Conditional controls contract](docs/PHASE-8-CONDITIONAL-CONTROLS.md)
- [Multi-step wizard](docs/PHASE-9-MULTI-STEP-WIZARD.md)
- [Comparison Cards](docs/PHASE-10-COMPARISON-CARDS.md)
- [Production operations](docs/OPERATIONS.md)
- [OpenAI Apps SDK documentation](https://developers.openai.com/apps-sdk/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Contributing

Issues and pull requests are welcome for defects, design proposals, and compatibility reports. Changes to the interaction protocol should update the schemas, wire-level tests, template documentation, and smoke suite together.

Before submitting a change, run:

```bash
npm run verify
npm run build
npm run smoke
```

## License

This repository does not currently include an open-source license. Until an explicit license file is added, all rights are reserved; do not assume the code may be redistributed under MIT, Apache-2.0, or another open-source license.
