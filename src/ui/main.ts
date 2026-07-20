import { App } from "@modelcontextprotocol/ext-apps";
import { deliverInteractionResult } from "./bridge";
import { comparisonSelectionText } from "./comparison";
import { createInteractionResult, type InteractionResult } from "./result";
import {
  resolveVisibleControlIds,
  selectVisibleValues,
  type VisibilityCondition,
  type VisibilityValue
} from "./visibility";
import {
  controlStepIndex,
  isFinalStep,
  nextStepIndex,
  previousStepIndex,
  stepControlIds,
  type WizardStep
} from "./wizard";
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
  visibleWhen?: VisibilityCondition;
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

interface ComparisonCardOption {
  value: string;
  title: string;
  description?: string;
  badge?: string;
  pros: string[];
  cons: string[];
}

interface ComparisonCardsControl extends BaseControl {
  type: "comparison_cards";
  options: ComparisonCardOption[];
  defaultValue?: string;
}

type Control =
  | RadioControl
  | CheckboxGroupControl
  | SelectControl
  | RangeControl
  | TextControl
  | NumberControl
  | SwitchControl
  | ColorControl
  | ComparisonCardsControl;

interface ThemeCardPreview {
  type: "theme_card";
  title?: string;
  body?: string;
  bindings: {
    primaryColor?: string;
    brightness?: string;
    density?: string;
    style?: string;
  };
}

interface SummaryPreview {
  type: "summary";
  title?: string;
  bindings?: Record<string, string>;
}

type Preview = ThemeCardPreview | SummaryPreview;

interface Interaction {
  interactionId: string;
  title: string;
  description?: string;
  controls: Control[];
  submitLabel: string;
  cancelLabel?: string;
  preview?: Preview;
  steps?: WizardStep[];
}

const rootElement = document.querySelector<HTMLElement>("#app");
if (!rootElement) throw new Error("Missing #app root");
const root: HTMLElement = rootElement;

const bridge = new App({ name: "inbridge-widget", version: "0.9.0" });
let interaction: Interaction | undefined;
let completed = false;
let submissionInProgress = false;
let pendingResult: InteractionResult | undefined;
let currentStepIndex = 0;

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

function handleControlChange(controlId: string): void {
  clearInvalid(controlId);
  refreshWizardView();
}

function readControlValue(control: Control): VisibilityValue | undefined {
  const container = controlContainer(control.id);
  if (!container) return undefined;

  if (control.type === "radio" || control.type === "comparison_cards") {
    return container.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? "";
  }
  if (control.type === "checkbox_group") {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')).map(
      (input) => input.value
    );
  }
  if (control.type === "select") return container.querySelector<HTMLSelectElement>("select")?.value;
  if (control.type === "range") {
    const value = container.querySelector<HTMLInputElement>('input[type="range"]')?.value;
    return value === undefined ? undefined : Number(value);
  }
  if (control.type === "text") return container.querySelector<HTMLInputElement>('input[type="text"]')?.value;
  if (control.type === "number") {
    const value = container.querySelector<HTMLInputElement>('input[type="number"]')?.value;
    return value === undefined ? undefined : value === "" ? null : Number(value);
  }
  if (control.type === "switch") {
    return container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked;
  }
  return container.querySelector<HTMLInputElement>('input[type="color"]')?.value.toUpperCase();
}

function readAllValues(): Record<string, VisibilityValue> {
  if (!interaction) return {};
  const values: Record<string, VisibilityValue> = {};
  for (const control of interaction.controls) {
    const value = readControlValue(control);
    if (value !== undefined) values[control.id] = value;
  }
  return values;
}

function visibleControlIds(values = readAllValues()): Set<string> {
  return resolveVisibleControlIds(interaction?.controls ?? [], values);
}

function applyVisibility(): void {
  if (!interaction) return;
  const visible = visibleControlIds();
  const currentStepControls = interaction.steps
    ? stepControlIds(interaction.steps, currentStepIndex)
    : undefined;
  for (const control of interaction.controls) {
    const container = controlContainer(control.id);
    if (!container) continue;
    const isVisible = visible.has(control.id) && (!currentStepControls || currentStepControls.has(control.id));
    container.hidden = !isVisible;
    container.setAttribute("aria-hidden", String(!isVisible));
    if (!isVisible) container.removeAttribute("data-invalid");
  }
}

function collectValues(
  validateRequired = true,
  controlsToValidate?: ReadonlySet<string>
): Record<string, unknown> | undefined {
  if (!interaction) return undefined;
  const allValues = readAllValues();
  const visible = visibleControlIds(allValues);

  if (validateRequired) {
    for (const control of interaction.controls) {
      if (!visible.has(control.id)) continue;
      if (controlsToValidate && !controlsToValidate.has(control.id)) continue;
      const value = allValues[control.id];
      const missing =
        value === undefined ||
        (control.required &&
          (value === null || value === "" || value === false || (Array.isArray(value) && value.length === 0)));
      if (missing) return markInvalid(control);
    }
  }

  return selectVisibleValues(allValues, visible);
}

function advanceWizard(): void {
  if (!interaction?.steps) return;
  const currentControls = stepControlIds(interaction.steps, currentStepIndex);
  if (!collectValues(true, currentControls)) return;
  currentStepIndex = nextStepIndex(currentStepIndex, interaction.steps.length);
  setStatus("");
  refreshWizardView();
}

function returnToPreviousStep(): void {
  if (!interaction?.steps) return;
  currentStepIndex = previousStepIndex(currentStepIndex, interaction.steps.length);
  setStatus("");
  refreshWizardView();
}

function lockForm(): void {
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, .actions button").forEach(
    (element) => {
      element.disabled = true;
    }
  );
}

function showRecovery(result: InteractionResult, allowCopy: boolean): void {
  const recovery = root.querySelector<HTMLElement>("[data-recovery]");
  const retry = root.querySelector<HTMLButtonElement>("[data-retry]");
  const fallback = root.querySelector<HTMLElement>("[data-fallback]");
  const output = root.querySelector<HTMLTextAreaElement>("[data-result-json]");
  if (!recovery || !retry || !fallback || !output) return;
  recovery.hidden = false;
  retry.disabled = false;
  output.value = JSON.stringify(result, null, 2);
  fallback.hidden = !allowCopy;
}

function hideRecovery(): void {
  const recovery = root.querySelector<HTMLElement>("[data-recovery]");
  const retry = root.querySelector<HTMLButtonElement>("[data-retry]");
  if (recovery) recovery.hidden = true;
  if (retry) retry.disabled = true;
}

async function copyFallback(): Promise<void> {
  const output = root.querySelector<HTMLTextAreaElement>("[data-result-json]");
  if (!output) return;
  await navigator.clipboard.writeText(output.value);
  setStatus("结果 JSON 已复制。请粘贴到对话中继续。", "success");
}

async function deliverPendingResult(): Promise<void> {
  if (!pendingResult || submissionInProgress || completed) return;
  submissionInProgress = true;
  hideRecovery();
  setStatus(pendingResult.status === "confirmed" ? "正在提交选择…" : "正在取消…");

  const outcome = await deliverInteractionResult(bridge, pendingResult);
  submissionInProgress = false;

  if (outcome === "sent_with_context" || outcome === "sent_with_inline_result") {
    completed = true;
    setStatus(
      pendingResult.status === "confirmed" ? "选择已提交，ChatGPT 将继续处理。" : "本次选择已取消。",
      "success"
    );
    return;
  }

  if (outcome === "context_only") {
    setStatus("结果已写入模型上下文，但未能触发下一轮。你可以重试自动提交。", "error");
    showRecovery(pendingResult, false);
    return;
  }

  setStatus("Host 暂不支持自动提交。请重试，或复制结果 JSON 到对话中。", "error");
  showRecovery(pendingResult, true);
}

async function submit(status: InteractionResult["status"]): Promise<void> {
  if (!interaction || completed || submissionInProgress || pendingResult) return;
  const values = status === "confirmed" ? collectValues() : {};
  if (!values) return;

  pendingResult = createInteractionResult(interaction.interactionId, status, values);
  lockForm();
  await deliverPendingResult();
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
    input.addEventListener("change", () => handleControlChange(control.id));
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    choices.append(label);
  }
  fieldset.append(choices);
  return fieldset;
}

function appendComparisonList(container: HTMLElement, titleText: string, items: string[]): void {
  if (items.length === 0) return;
  const section = document.createElement("section");
  section.className = "comparison-list";
  const title = document.createElement("h4");
  title.textContent = titleText;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.append(entry);
  });
  section.append(title, list);
  container.append(section);
}

function refreshComparisonSelection(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>("[data-comparison-option]").forEach((card) => {
    const input = card.querySelector<HTMLInputElement>('input[type="radio"]');
    const status = card.querySelector<HTMLElement>("[data-comparison-selection]");
    const selected = input?.checked ?? false;
    card.dataset.selected = String(selected);
    if (status) status.textContent = comparisonSelectionText(selected);
  });
}

function createComparisonCards(control: ComparisonCardsControl): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "comparison-control";
  fieldset.dataset.controlId = control.id;
  const legend = document.createElement("legend");
  legend.textContent = control.required ? `${control.label} *` : control.label;
  fieldset.append(legend);
  appendDescription(fieldset, control.description);

  const grid = document.createElement("div");
  grid.className = "comparison-grid";
  for (const option of control.options) {
    const card = document.createElement("label");
    card.className = "comparison-card";
    card.dataset.comparisonOption = option.value;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = control.id;
    input.value = option.value;
    input.checked = option.value === control.defaultValue;
    input.addEventListener("change", () => {
      refreshComparisonSelection(grid);
      handleControlChange(control.id);
    });

    const content = document.createElement("span");
    content.className = "comparison-card-content";
    if (option.badge) {
      const badge = document.createElement("span");
      badge.className = "comparison-badge";
      badge.textContent = option.badge;
      content.append(badge);
    }
    const title = document.createElement("strong");
    title.className = "comparison-title";
    title.textContent = option.title;
    content.append(title);
    if (option.description) {
      const description = document.createElement("span");
      description.className = "comparison-description";
      description.textContent = option.description;
      content.append(description);
    }
    appendComparisonList(content, "优势", option.pros);
    appendComparisonList(content, "限制", option.cons);
    const selection = document.createElement("span");
    selection.className = "comparison-selection";
    selection.dataset.comparisonSelection = "";
    content.append(selection);
    card.append(input, content);
    grid.append(card);
  }
  fieldset.append(grid);
  refreshComparisonSelection(grid);
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
    select.addEventListener("change", () => handleControlChange(control.id));
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
        handleControlChange(control.id);
      });
      row.append(output);
    } else {
      input.addEventListener("input", () => handleControlChange(control.id));
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
    input.addEventListener("input", () => handleControlChange(control.id));
    container.append(input);
  }

  if (control.type === "switch") {
    label.className = "switch-row";
    label.textContent = "";
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "checkbox";
    input.checked = control.defaultValue;
    input.addEventListener("change", () => handleControlChange(control.id));
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
      handleControlChange(control.id);
    });
    row.append(input, output);
    container.append(row);
  }

  return container;
}

function formatPreviewValue(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : "未选择";
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (value === null || value === undefined || value === "") return "未填写";
  return String(value);
}

function renderThemeCard(container: HTMLElement, preview: ThemeCardPreview, values: Record<string, unknown>): void {
  const card = document.createElement("article");
  card.className = "theme-card";

  const colorValue = preview.bindings.primaryColor ? values[preview.bindings.primaryColor] : undefined;
  const color = typeof colorValue === "string" && /^#[0-9A-Fa-f]{6}$/.test(colorValue) ? colorValue : "#2563EB";
  card.style.setProperty("--preview-color", color);

  const brightnessValue = preview.bindings.brightness ? values[preview.bindings.brightness] : undefined;
  const brightness = typeof brightnessValue === "number" && Number.isFinite(brightnessValue)
    ? Math.min(100, Math.max(0, brightnessValue))
    : 50;
  card.style.filter = `brightness(${0.65 + brightness / 200})`;

  const densityValue = preview.bindings.density ? values[preview.bindings.density] : undefined;
  const density = densityValue === "low" || densityValue === "high" ? densityValue : "medium";
  card.classList.add(`density-${density}`);

  const styleValue = preview.bindings.style ? values[preview.bindings.style] : undefined;
  const allowedStyles = new Set(["minimal", "tech", "academic", "business", "magazine"]);
  const style = typeof styleValue === "string" && allowedStyles.has(styleValue) ? styleValue : "minimal";
  card.classList.add(`style-${style}`);

  const accent = document.createElement("div");
  accent.className = "theme-accent";
  const tag = document.createElement("span");
  tag.className = "theme-tag";
  tag.textContent = style.toUpperCase();
  const title = document.createElement("h4");
  title.textContent = preview.title ?? "示例标题";
  const body = document.createElement("p");
  body.textContent = preview.body ?? "预览会安全地响应颜色、明暗、密度和风格参数。";
  card.append(accent, tag, title, body);
  container.append(card);
}

function renderSummary(container: HTMLElement, preview: SummaryPreview, values: Record<string, unknown>): void {
  if (!interaction) return;
  const list = document.createElement("dl");
  list.className = "summary-list";
  const entries = preview.bindings && Object.keys(preview.bindings).length > 0
    ? Object.entries(preview.bindings)
    : interaction.controls.map((control) => [control.label, control.id] as const);

  for (const [label, controlId] of entries) {
    if (!Object.hasOwn(values, controlId)) continue;
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = formatPreviewValue(values[controlId]);
    list.append(term, detail);
  }
  container.append(list);
}

function refreshPreview(): void {
  if (!interaction?.preview) return;
  const container = root.querySelector<HTMLElement>("[data-preview]");
  if (!container) return;
  const values = collectValues(false) ?? {};
  container.replaceChildren();

  const title = document.createElement("h3");
  title.textContent = interaction.preview.title ?? (interaction.preview.type === "summary" ? "当前配置" : "实时预览");
  container.append(title);
  if (interaction.preview.type === "theme_card") {
    renderThemeCard(container, interaction.preview, values);
  } else {
    renderSummary(container, interaction.preview, values);
  }
}

function refreshWizardView(): void {
  if (!interaction) return;
  applyVisibility();

  const steps = interaction.steps;
  const preview = root.querySelector<HTMLElement>("[data-preview]");
  const previous = root.querySelector<HTMLButtonElement>("[data-previous-step]");
  const primary = root.querySelector<HTMLButtonElement>("[data-primary-action]");

  if (!steps) {
    if (preview) preview.hidden = false;
    if (previous) previous.hidden = true;
    if (primary) primary.textContent = interaction.submitLabel;
    refreshPreview();
    return;
  }

  const finalStep = isFinalStep(currentStepIndex, steps.length);
  const progress = root.querySelector<HTMLElement>("[data-wizard-progress-text]");
  if (progress) progress.textContent = `步骤 ${currentStepIndex + 1} / ${steps.length}`;

  root.querySelectorAll<HTMLElement>("[data-wizard-step]").forEach((item, index) => {
    const state = index < currentStepIndex ? "completed" : index === currentStepIndex ? "current" : "upcoming";
    item.dataset.state = state;
    if (state === "current") item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  const description = root.querySelector<HTMLElement>("[data-step-description]");
  if (description) {
    description.textContent = steps[currentStepIndex]?.description ?? "";
    description.hidden = !description.textContent;
  }
  if (previous) previous.hidden = currentStepIndex === 0;
  if (primary) primary.textContent = finalStep ? interaction.submitLabel : "下一步";
  if (preview) preview.hidden = !finalStep;
  if (finalStep) refreshPreview();
}

function render(config: Interaction): void {
  interaction = config;
  completed = false;
  submissionInProgress = false;
  pendingResult = undefined;
  currentStepIndex = 0;
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

  if (config.steps) {
    const navigation = document.createElement("nav");
    navigation.className = "wizard-progress";
    navigation.setAttribute("aria-label", "配置步骤");
    const progressText = document.createElement("p");
    progressText.className = "wizard-progress-text";
    progressText.dataset.wizardProgressText = "";
    const stepList = document.createElement("ol");
    stepList.className = "wizard-steps";
    stepList.style.setProperty("--wizard-step-count", String(config.steps.length));
    config.steps.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = "wizard-step";
      item.dataset.wizardStep = String(index);
      const number = document.createElement("span");
      number.className = "wizard-step-number";
      number.textContent = String(index + 1);
      const label = document.createElement("span");
      label.textContent = step.title;
      item.append(number, label);
      stepList.append(item);
    });
    const stepDescription = document.createElement("p");
    stepDescription.className = "help wizard-step-description";
    stepDescription.dataset.stepDescription = "";
    navigation.append(progressText, stepList, stepDescription);
    panel.append(navigation);
  }

  const form = document.createElement("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (interaction?.steps && !isFinalStep(currentStepIndex, interaction.steps.length)) {
      advanceWizard();
      return;
    }
    void submit("confirmed");
  });

  for (const control of config.controls) {
    const element = control.type === "comparison_cards"
      ? createComparisonCards(control)
      : control.type === "radio" || control.type === "checkbox_group"
        ? createChoiceGroup(control)
        : createField(control);
    if (config.steps) element.dataset.stepIndex = String(controlStepIndex(config.steps, control.id));
    form.append(element);
  }

  if (config.preview) {
    const preview = document.createElement("section");
    preview.className = "preview";
    preview.dataset.preview = "";
    form.append(preview);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.dataset.previousStep = "";
  previous.textContent = "上一步";
  previous.addEventListener("click", returnToPreviousStep);
  actions.append(previous);
  const confirm = document.createElement("button");
  confirm.type = "submit";
  confirm.className = "primary";
  confirm.dataset.primaryAction = "";
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

  const recovery = document.createElement("div");
  recovery.className = "recovery";
  recovery.dataset.recovery = "";
  recovery.hidden = true;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.dataset.retry = "";
  retry.textContent = "重试自动提交";
  retry.addEventListener("click", () => void deliverPendingResult());
  recovery.append(retry);

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
  recovery.append(fallback);
  panel.append(recovery);

  root.append(panel);
  refreshWizardView();
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
