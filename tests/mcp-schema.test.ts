import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server/mcp.js";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

async function connectedClient(): Promise<Client> {
  const server = createMcpServer();
  const client = new Client({ name: "mcp-schema-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  closeCallbacks.push(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

describe("MCP tool descriptors", () => {
  it("publishes the required template selector fields through tools/list", async () => {
    const client = await connectedClient();
    const result = await client.listTools();
    const tool = result.tools.find((candidate) => candidate.name === "render_interaction_template");

    expect(tool).toBeDefined();
    expect(tool?.inputSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["templateId", "interactionId"]),
      properties: {
        templateId: expect.objectContaining({}),
        interactionId: expect.objectContaining({})
      }
    });
  });

  it("renders the production experiment configuration through the exported schema", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "render_interaction_template",
      arguments: {
        templateId: "experiment_config",
        interactionId: "production_experiment",
        defaultDirection: "marl",
        defaultEnvironments: ["cartpole"],
        defaultBudget: 80,
        defaultSeedCount: 8,
        defaultAblation: true,
        defaultAblationVariables: ["network_architecture"]
      }
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      interactionId: "production_experiment",
      controls: expect.arrayContaining([
        expect.objectContaining({ id: "research_direction", defaultValue: "marl" }),
        expect.objectContaining({ id: "environments", defaultValue: ["cartpole"] }),
        expect.objectContaining({ id: "training_budget", defaultValue: 80 }),
        expect.objectContaining({ id: "seed_count", defaultValue: 8 }),
        expect.objectContaining({ id: "ablation", defaultValue: true }),
        expect.objectContaining({
          id: "ablation_variables",
          defaultValue: ["network_architecture"],
          visibleWhen: { controlId: "ablation", operator: "equals", value: true }
        })
      ])
    });
  });

  it("publishes conditional-control fields through tools/list", async () => {
    const client = await connectedClient();
    const result = await client.listTools();
    const customTool = result.tools.find((candidate) => candidate.name === "render_interaction");
    const templateTool = result.tools.find((candidate) => candidate.name === "render_interaction_template");

    expect(JSON.stringify(customTool?.inputSchema)).toContain('"visibleWhen"');
    expect(templateTool?.inputSchema.properties).toHaveProperty("ablationVariableOptions");
    expect(templateTool?.inputSchema.properties).toHaveProperty("defaultAblationVariables");
  });
});
