import { App } from "@modelcontextprotocol/ext-apps";
import { createInteractionResult, type InteractionResult } from "./result";
import "./styles.css";

interface Option {
  label: string;
  value: string;
}

interface BaseControl {
  id: string;
  label: string;
  description?: string;
  required: boolean;
}

interface RadioControl extends BaseControl {
  type: "radio";
  options: Option[];
  defaultValue?: string;
}

interface CheckboxGroupControl extends BaseControl {
  type: "checkbox_group";
  options: Option[];
  defaultValue: string[];
}

interface SelectControl extends BaseControl {
  type: "select";
  options: Option[];
  placeholder?: string;
  defaultValue?: string;
}

interface RangeControl extends BaseControl {
  type: "range";
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  showValue: boolean;
}

interface TextControl extends BaseControl {
  type: "text";
  placeholder?: string;
  defaultValue?: string;
  maxLength: number;
}

interface NumberControl extends BaseControl {
  type: "number";
  min?: number;
  max?: number;
  step: number;
  defaultValue?: number;
  placeholder?: string;
}

interface SwitchControl extends BaseControl {
  type: "switch";
  defaultValue: boolean;
}

interface ColorControl extends BaseControl {
  type: "color";
  defaultValue: string;
}

type Control =
  | RadioControl
  | CheckboxGroupControl
  | SelectControl
  | RangeControl
  | TextControl
  | NumberControl
  | SwitchControl
  | ColorControl;

interface Interaction {
  interactionId: string;
  title: string;
  description?: string;
  controls: Control[];
  submitLabel: string;
  cancelLabel?: string;
}

const rootElement = document.querySelector<HTMLElement>("#app");
if (!rootElement) throw new Error("Missing #app root");
const root: HTMLElement = rootElement;

const bridge = new App({ name: "inbridge-widget", version: "0.2.0" });
let interaction: Interaction | undefined;
let submitted = false;

function setStatus(message: string, kind: "info" | "success" | "error" = "info"): void {
  const status = root.querySelector<HTMLElement>("[data-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function controlContainer(id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-control-id="${CSS.escape(id)}"]`);
}

function markInvalid(control: Control): undefined {
  const container = controlContainer(control.id);
  container?.setAttribute("data-invalid", "true");
  container?.querySelector<HTMLElement>("input, select")?.focus();
  setStatus(`请完成“${control.label}”。`, "error");
  return undefined;
}

function clearInvalid(controlId: string): void {
  controlContainer(controlId)?.removeAttribute("data-invalid");
  setStatus("");
}

function collectValues(): Record<string, unknown> | undefined {
  if (!interaction) return undefined;
  const values: Record<string, unknown> = {};

  for (const control of interaction.controls) {
    const container = controlContainer(control.id);
    if (!container) return markInvalid(control);

    if (control.type === "radio") {
      const selected = container.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      if (control.required && !selected) return markInvalid(control);
      values[control.id] = selected?.value ?? "";
    }

    if (control.type === "checkbox_group") {
      const selected = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')
      ).map((input) => input.value);
      if (control.required && selected.length === 0) return markInvalid(control);
      values[control.id] = selected;
    }

    if (control.type === "select") {
      const input = container.querySelector<HTMLSelectElement>("select");
      if (!input || (control.required && input.value === "")) return markInvalid(control);
      values[control.id] = input.value;
    }

    if (control.type === "range") {
      const input = container.querySelector<HTMLInputElement>('input[type="range"]');
      if (!input) return markInvalid(control);
      values[control.id] = Number(input.value);
    }

    if (control.type === "text") {
      const input = container.querySelector<HTMLInputElement>('input[type="text"]');
      if (!input || (control.required && input.value.trim() === "")) return markInvalid(control);
      values[control.id] = input.value;
    }

    if (control.type === "number") {
      const input = container.querySelector<HTMLInputElement>('input[type="number"]');
      if (!input || (control.required && input.value === "")) return markInvalid(control);
      values[control.id] = input.value === "" ? null : Number(input.value);
    }

    if (control.type === "switch") {
      const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!input || (control.required && !input.checked)) return markInvalid(control);
      values[control.id] = input.checked;
    }

    if (control.type === "color") {
      const input = container.querySelector<HTMLInputElement>('input[type="color"]');
      if (!input) return markInvalid(control);
      values[control.id] = input.value.toUpperCase();
    }
  }

  return values;
}

function lockForm(): void {
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button").forEach(
    (element) => {
      element.disabled = true;
    }
  );
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
      content: [{ type: "text", text: `InBridge interaction result:\n${JSON.stringify(result)}` }]
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
    const response = await bridge.sendMessage({ role: "user", content: [{ type: "text", text: trigger }] });
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

function appendDescription(container: HTMLElement, description?: string): void {
  if (!description) return;
  const help = document.createElement("p");
  help.className = "help";
  help.textContent = description;
  container.append(help);
}

function createChoiceGroup(control: RadioControl | CheckboxGroupControl): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.dataset.controlId = control.id;
  const legend = document.createElement("legend");
  legend.textContent = control.required ? `${control.label} *` : control.label;
  fieldset.append(legend);
  appendDescription(fieldset, control.description);

  const choices = document.createElement("div");
  choices.className = "choices";
  for (const option of control.options) {
    const label = document.createElement("label");
    label.className = "choice";
    const input = document.createElement("input");
    input.type = control.type === "radio" ? "radio" : "checkbox";
    input.name = control.id;
    input.value = option.value;
    input.checked =
      control.type === "radio"
        ? option.value === control.defaultValue
        : control.defaultValue.includes(option.value);
    input.addEventListener("change", () => clearInvalid(control.id));
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    choices.append(label);
  }
  fieldset.append(choices);
  return fieldset;
}

function createField(control: Exclude<Control, RadioControl | CheckboxGroupControl>): HTMLElement {
  const container = document.createElement("div");
  container.className = `control control-${control.type}`;
  container.dataset.controlId = control.id;
  const inputId = `control-${control.id}`;

  const label = document.createElement("label");
  label.className = "control-label";
  label.htmlFor = inputId;
  label.textContent = control.required ? `${control.label} *` : control.label;
  container.append(label);
  appendDescription(container, control.description);

  if (control.type === "select") {
    const select = document.createElement("select");
    select.id = inputId;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = control.placeholder ?? "请选择";
    placeholder.disabled = control.required;
    placeholder.selected = control.defaultValue === undefined;
    select.append(placeholder);
    for (const option of control.options) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      element.selected = option.value === control.defaultValue;
      select.append(element);
    }
    select.addEventListener("change", () => clearInvalid(control.id));
    container.append(select);
  }

  if (control.type === "range") {
    const row = document.createElement("div");
    row.className = "range-row";
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "range";
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(control.defaultValue ?? control.min);
    row.append(input);
    if (control.showValue) {
      const output = document.createElement("output");
      output.value = input.value;
      input.addEventListener("input", () => {
        output.value = input.value;
      });
      row.append(output);
    }
    container.append(row);
  }

  if (control.type === "text" || control.type === "number") {
    const input = document.createElement("input");
    input.id = inputId;
    input.type = control.type;
    input.placeholder = control.placeholder ?? "";
    if (control.type === "text") {
      input.maxLength = control.maxLength;
      input.value = control.defaultValue ?? "";
    } else {
      input.step = String(control.step);
      if (control.min !== undefined) input.min = String(control.min);
      if (control.max !== undefined) input.max = String(control.max);
      if (control.defaultValue !== undefined) input.value = String(control.defaultValue);
    }
    input.addEventListener("input", () => clearInvalid(control.id));
    container.append(input);
  }

  if (control.type === "switch") {
    label.className = "switch-row";
    label.textContent = "";
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "checkbox";
    input.checked = control.defaultValue;
    input.addEventListener("change", () => clearInvalid(control.id));
    const track = document.createElement("span");
    track.className = "switch-track";
    track.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = control.required ? `${control.label} *` : control.label;
    label.append(input, track, text);
    container.insertBefore(label, container.firstChild);
    container.append(...Array.from(container.children).filter((child) => child !== label));
  }

  if (control.type === "color") {
    const row = document.createElement("div");
    row.className = "color-row";
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "color";
    input.value = control.defaultValue;
    const output = document.createElement("output");
    output.value = input.value.toUpperCase();
    input.addEventListener("input", () => {
      output.value = input.value.toUpperCase();
    });
    row.append(input, output);
    container.append(row);
  }

  return container;
}

function render(config: Interaction): void {
  interaction = config;
  submitted = false;
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
    form.append(
      control.type === "radio" || control.type === "checkbox_group"
        ? createChoiceGroup(control)
        : createField(control)
    );
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
