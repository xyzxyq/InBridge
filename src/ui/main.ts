import { App } from "@modelcontextprotocol/ext-apps";
import { createInteractionResult, type InteractionResult } from "./result";
import "./styles.css";

interface RadioControl {
  id: string;
  type: "radio";
  label: string;
  description?: string;
  required: boolean;
  options: Array<{ label: string; value: string }>;
  defaultValue?: string;
}

interface Interaction {
  interactionId: string;
  title: string;
  description?: string;
  controls: RadioControl[];
  submitLabel: string;
  cancelLabel?: string;
}

const rootElement = document.querySelector<HTMLElement>("#app");
if (!rootElement) throw new Error("Missing #app root");
const root: HTMLElement = rootElement;

const bridge = new App({ name: "inbridge-widget", version: "0.1.0" });
let interaction: Interaction | undefined;
let submitted = false;

function setStatus(message: string, kind: "info" | "success" | "error" = "info"): void {
  const status = root.querySelector<HTMLElement>("[data-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function escapeSelector(value: string): string {
  return CSS.escape(value);
}

function collectValues(): Record<string, string> | undefined {
  if (!interaction) return undefined;
  const values: Record<string, string> = {};

  for (const control of interaction.controls) {
    const selected = root.querySelector<HTMLInputElement>(
      `input[name="${escapeSelector(control.id)}"]:checked`
    );
    if (selected) values[control.id] = selected.value;
    if (control.required && !selected) {
      const fieldset = root.querySelector<HTMLElement>(`[data-control-id="${escapeSelector(control.id)}"]`);
      fieldset?.setAttribute("data-invalid", "true");
      setStatus(`请选择“${control.label}”。`, "error");
      fieldset?.focus();
      return undefined;
    }
  }

  return values;
}

function lockForm(): void {
  root.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((element) => {
    element.disabled = true;
  });
}

function showCopyFallback(result: InteractionResult): void {
  const fallback = root.querySelector<HTMLElement>("[data-fallback]");
  const output = root.querySelector<HTMLTextAreaElement>("[data-result-json]");
  if (!fallback || !output) return;
  output.value = JSON.stringify(result, null, 2);
  fallback.hidden = false;
}

async function copyFallback(): Promise<void> {
  const output = root.querySelector<HTMLTextAreaElement>("[data-result-json]");
  if (!output) return;
  await navigator.clipboard.writeText(output.value);
  setStatus("结果 JSON 已复制。请粘贴到对话中继续。", "success");
}

async function submit(status: InteractionResult["status"]): Promise<void> {
  if (!interaction || submitted) return;
  const values = status === "confirmed" ? collectValues() : {};
  if (!values) return;

  submitted = true;
  lockForm();
  setStatus(status === "confirmed" ? "正在提交选择…" : "正在取消…");
  const result = createInteractionResult(interaction.interactionId, status, values);

  let contextUpdated = false;
  try {
    await bridge.updateModelContext({
      structuredContent: { inbridgeInteractionResult: result },
      content: [
        {
          type: "text",
          text: `InBridge interaction result:\n${JSON.stringify(result)}`
        }
      ]
    });
    contextUpdated = true;
  } catch (error) {
    console.warn("Unable to update model context", error);
  }

  const trigger =
    status === "cancelled"
      ? "我取消了上面的交互选择。请不要基于未确认的选项继续执行。"
      : contextUpdated
        ? "我已确认上面的交互选择。请读取 InBridge 同步的结构化结果并继续当前任务。"
        : `我已确认上面的交互选择，请根据此结果继续：${JSON.stringify(result)}`;

  try {
    const response = await bridge.sendMessage({
      role: "user",
      content: [{ type: "text", text: trigger }]
    });
    if (response.isError) throw new Error("Host rejected the follow-up message");
    setStatus(status === "confirmed" ? "选择已提交，ChatGPT 将继续处理。" : "本次选择已取消。", "success");
  } catch (error) {
    console.error("Unable to send follow-up message", error);
    if (contextUpdated) {
      setStatus("结果已写入模型上下文。请在对话中发送任意消息继续。", "error");
    } else {
      setStatus("自动提交失败。请复制下面的结果并粘贴到对话中。", "error");
      showCopyFallback(result);
    }
  }
}

function render(config: Interaction): void {
  interaction = config;
  root.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "panel";

  const heading = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = config.title;
  heading.append(title);
  if (config.description) {
    const description = document.createElement("p");
    description.textContent = config.description;
    heading.append(description);
  }
  panel.append(heading);

  const form = document.createElement("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit("confirmed");
  });

  for (const control of config.controls) {
    const fieldset = document.createElement("fieldset");
    fieldset.dataset.controlId = control.id;
    const legend = document.createElement("legend");
    legend.textContent = control.required ? `${control.label} *` : control.label;
    fieldset.append(legend);

    if (control.description) {
      const help = document.createElement("p");
      help.className = "help";
      help.textContent = control.description;
      fieldset.append(help);
    }

    const choices = document.createElement("div");
    choices.className = "choices";
    for (const option of control.options) {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = control.id;
      input.value = option.value;
      input.checked = option.value === control.defaultValue;
      input.addEventListener("change", () => {
        fieldset.removeAttribute("data-invalid");
        setStatus("");
      });
      const text = document.createElement("span");
      text.textContent = option.label;
      label.append(input, text);
      choices.append(label);
    }
    fieldset.append(choices);
    form.append(fieldset);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  const confirm = document.createElement("button");
  confirm.type = "submit";
  confirm.className = "primary";
  confirm.textContent = config.submitLabel;
  actions.append(confirm);

  if (config.cancelLabel) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = config.cancelLabel;
    cancel.addEventListener("click", () => void submit("cancelled"));
    actions.append(cancel);
  }

  form.append(actions);
  panel.append(form);

  const status = document.createElement("p");
  status.className = "status";
  status.dataset.status = "";
  status.setAttribute("role", "status");
  panel.append(status);

  const fallback = document.createElement("div");
  fallback.className = "fallback";
  fallback.dataset.fallback = "";
  fallback.hidden = true;
  const output = document.createElement("textarea");
  output.dataset.resultJson = "";
  output.readOnly = true;
  output.setAttribute("aria-label", "交互结果 JSON");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制结果 JSON";
  copy.addEventListener("click", () => void copyFallback());
  fallback.append(output, copy);
  panel.append(fallback);

  root.append(panel);
}

bridge.ontoolresult = (result) => {
  const config = result.structuredContent as unknown as Interaction | undefined;
  if (!config?.interactionId || !Array.isArray(config.controls)) {
    root.innerHTML = '<p class="fatal">交互配置无效，请在对话中改用文本方式继续。</p>';
    return;
  }
  render(config);
};

root.innerHTML = '<p class="loading">正在加载交互选项…</p>';
bridge.connect().catch((error) => {
  console.error("Unable to initialize MCP Apps bridge", error);
  root.innerHTML = '<p class="fatal">交互组件初始化失败，请在对话中改用文本方式继续。</p>';
});
