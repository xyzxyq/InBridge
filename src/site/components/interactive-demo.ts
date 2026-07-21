import {
  createInitialDemoState,
  DEMO_SCENARIOS,
  resetScenario,
  themePreviewStyle,
  type DemoScenarioId,
  type DemoState
} from "../data/demo-scenarios";

const decisionOptions = [
  { value: "fast", title: "快速方案", badge: "交付优先", description: "优先跑通最小闭环", pros: "上线快 · 改动小", cons: "扩展空间有限" },
  { value: "safe", title: "稳健方案", badge: "推荐", description: "兼顾交付与长期维护", pros: "边界清晰 · 易扩展", cons: "首轮投入略高" },
  { value: "creative", title: "创新方案", badge: "探索", description: "优先验证全新交互方向", pros: "差异明显 · 潜力高", cons: "不确定性较高" }
];

function tabs(active: DemoScenarioId): string {
  return `<div class="demo-tabs" role="tablist" aria-label="演示场景">${DEMO_SCENARIOS.map(
    (scenario) => `<button type="button" role="tab" aria-selected="${scenario.id === active}" data-scenario="${scenario.id}">${scenario.label}</button>`
  ).join("")}</div>`;
}

function shell(active: DemoScenarioId, content: string): string {
  const scenario = DEMO_SCENARIOS.find((candidate) => candidate.id === active);
  return `${tabs(active)}<div class="demo-stage" data-demo-stage>
    <div class="demo-stage-heading"><div><span>INBRIDGE PANEL</span><h3>${scenario?.label ?? "交互演示"}</h3><p>${scenario?.description ?? ""}</p></div><span class="demo-only">交互演示</span></div>
    ${content}</div>`;
}

function confirmation(submitted: boolean, summary: string): string {
  if (submitted) return `<div class="demo-confirmation" role="status"><span>✓</span><div><b>结构化结果已就绪</b><p>模拟结果：${summary}</p></div></div>`;
  return "";
}

function decision(state: DemoState["decision"]): string {
  const selected = decisionOptions.find((option) => option.value === state.choice);
  return `<fieldset class="decision-grid"><legend class="sr-only">选择实施方案</legend>${decisionOptions.map((option) => `
    <label class="decision-card ${option.value === state.choice ? "selected" : ""}">
      <input type="radio" name="demo-decision" value="${option.value}" ${option.value === state.choice ? "checked" : ""} />
      <span class="decision-check" aria-hidden="true">${option.value === state.choice ? "✓" : ""}</span>
      <span class="decision-badge">${option.badge}</span><b>${option.title}</b><p>${option.description}</p>
      <small class="pro">＋ ${option.pros}</small><small class="con">− ${option.cons}</small>
    </label>`).join("")}</fieldset>
    <div class="demo-actions"><div aria-live="polite"><span>当前选择</span><b>${selected?.title ?? "尚未选择"}</b></div><button class="demo-submit" type="button" data-demo-submit>确认并继续</button></div>
    ${confirmation(state.submitted, selected?.title ?? "未选择")}`;
}

function experiment(state: DemoState["experiment"]): string {
  const steps = ["基础信息", "训练配置", "消融与确认"];
  const progress = `<ol class="demo-wizard-progress">${steps.map((label, index) => `<li class="${index < state.step ? "done" : index === state.step ? "current" : ""}"><span>${index < state.step ? "✓" : index + 1}</span>${label}</li>`).join("")}</ol>`;
  let controls = "";
  if (state.step === 0) controls = `<div class="demo-form-grid"><fieldset class="demo-field"><legend>研究方向</legend><div class="segmented"><label><input type="radio" name="direction" value="rl" ${state.direction === "rl" ? "checked" : ""}/><span>强化学习</span></label><label><input type="radio" name="direction" value="marl" ${state.direction === "marl" ? "checked" : ""}/><span>多智能体强化学习</span></label></div></fieldset><fieldset class="demo-field"><legend>运行环境</legend><div class="check-row"><label><input type="checkbox" name="environment" value="cartpole" ${state.environments.includes("cartpole") ? "checked" : ""}/> CartPole</label><label><input type="checkbox" name="environment" value="lunar" ${state.environments.includes("lunar") ? "checked" : ""}/> LunarLander</label><label><input type="checkbox" name="environment" value="atari" ${state.environments.includes("atari") ? "checked" : ""}/> Atari</label></div></fieldset></div>`;
  if (state.step === 1) controls = `<div class="demo-form-grid"><label class="demo-field range-field"><span>训练预算 <b>${state.budget}%</b></span><input type="range" name="budget" min="10" max="100" step="5" value="${state.budget}" /></label><label class="demo-field"><span>随机种子数量</span><input class="number-input" type="number" name="seeds" min="1" max="100" value="${state.seeds}" /></label></div>`;
  if (state.step === 2) controls = `<div class="demo-form-grid"><label class="demo-field switch-field"><span><b>消融实验</b><small>比较关键变量对结果的影响</small></span><input type="checkbox" name="ablation" role="switch" ${state.ablation ? "checked" : ""}/><i aria-hidden="true"></i></label><div class="experiment-summary"><span>最终确认</span><dl><div><dt>方向</dt><dd>${state.direction === "marl" ? "多智能体强化学习" : "强化学习"}</dd></div><div><dt>环境</dt><dd>${state.environments.length} 个</dd></div><div><dt>预算</dt><dd>${state.budget}%</dd></div><div><dt>种子</dt><dd>${state.seeds}</dd></div></dl></div></div>`;
  return `${progress}<div class="wizard-content">${controls}</div><div class="demo-actions wizard-actions"><button type="button" class="demo-back" data-demo-back ${state.step === 0 ? "disabled" : ""}>上一步</button><span>步骤 ${state.step + 1} / 3</span><button type="button" class="demo-submit" data-demo-next>${state.step === 2 ? "确认配置" : "下一步"}</button></div>${confirmation(state.submitted, `${state.direction.toUpperCase()} · ${state.budget}% 预算 · ${state.seeds} seeds`)}`;
}

function theme(state: DemoState["theme"]): string {
  const styles = themePreviewStyle(state);
  const css = Object.entries(styles).map(([key, value]) => `${key}:${value}`).join(";");
  return `<div class="theme-demo"><div class="theme-controls"><label class="demo-field"><span>视觉风格</span><select name="theme-style"><option value="minimal" ${state.style === "minimal" ? "selected" : ""}>极简</option><option value="academic" ${state.style === "academic" ? "selected" : ""}>学术</option><option value="business" ${state.style === "business" ? "selected" : ""}>商务</option><option value="magazine" ${state.style === "magazine" ? "selected" : ""}>杂志</option></select></label><label class="demo-field color-field"><span>主色</span><span><input type="color" name="theme-color" value="${state.color}"/><code>${state.color.toUpperCase()}</code></span></label><label class="demo-field range-field"><span>亮度 <b>${state.brightness}%</b></span><input type="range" name="theme-brightness" min="20" max="100" value="${state.brightness}" /></label><fieldset class="demo-field"><legend>信息密度</legend><div class="segmented density"><label><input type="radio" name="density" value="low" ${state.density === "low" ? "checked" : ""}/><span>舒展</span></label><label><input type="radio" name="density" value="medium" ${state.density === "medium" ? "checked" : ""}/><span>平衡</span></label><label><input type="radio" name="density" value="high" ${state.density === "high" ? "checked" : ""}/><span>紧凑</span></label></div></fieldset></div><div class="theme-preview" style="${css}"><span>LIVE PREVIEW</span><div class="preview-orb"></div><h4>实验结果概览</h4><p>由安全参数驱动的实时主题预览。</p><div class="preview-bars"><i></i><i></i><i></i><i></i></div><button type="button">查看详情</button></div></div><div class="demo-actions"><div><span>当前主题</span><b>${state.style} · ${state.density}</b></div><button class="demo-submit" type="button" data-demo-submit>确认主题</button></div>${confirmation(state.submitted, `${state.style} · ${state.color.toUpperCase()} · ${state.brightness}%`)}`;
}

export function initInteractiveDemo(): void {
  const root = document.querySelector<HTMLElement>("[data-interactive-demo]");
  if (!root) return;
  let active: DemoScenarioId = "decision";
  let state = createInitialDemoState();

  const render = () => {
    const content = active === "decision" ? decision(state.decision) : active === "experiment" ? experiment(state.experiment) : theme(state.theme);
    root.innerHTML = shell(active, content);
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLButtonElement>("[data-scenario]");
    if (tab) {
      active = tab.dataset.scenario as DemoScenarioId;
      state = resetScenario(state, active);
      render();
      root.querySelector<HTMLButtonElement>(`[data-scenario="${active}"]`)?.focus();
      return;
    }
    if (target.closest("[data-demo-back]")) {
      state.experiment.step = Math.max(0, state.experiment.step - 1);
      render();
      root.querySelector<HTMLButtonElement>("[data-demo-back]")?.focus();
      return;
    }
    if (target.closest("[data-demo-next]")) {
      if (state.experiment.step < 2) state.experiment.step += 1;
      else state.experiment.submitted = true;
      render();
      root.querySelector<HTMLButtonElement>(state.experiment.submitted ? "[data-demo-back]" : "[data-demo-next]")?.focus();
      return;
    }
    if (target.closest("[data-demo-submit]")) {
      if (active === "decision") state.decision.submitted = true;
      if (active === "theme") state.theme.submitted = true;
      render();
    }
  });

  root.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.name === "budget") {
      state.experiment.budget = Number(input.value);
      const label = input.closest("label")?.querySelector("b");
      if (label) label.textContent = `${state.experiment.budget}%`;
      return;
    }
    if (input.name === "seeds") {
      state.experiment.seeds = Math.max(1, Math.min(100, Number(input.value) || 1));
      return;
    }
    if (input.name === "theme-brightness" || input.name === "theme-color") {
      if (input.name === "theme-brightness") {
        state.theme.brightness = Number(input.value);
        const label = input.closest("label")?.querySelector("b");
        if (label) label.textContent = `${state.theme.brightness}%`;
      } else {
        state.theme.color = input.value;
        const code = input.closest("label")?.querySelector("code");
        if (code) code.textContent = state.theme.color.toUpperCase();
      }
      const preview = root.querySelector<HTMLElement>(".theme-preview");
      if (preview) Object.entries(themePreviewStyle(state.theme)).forEach(([key, value]) => preview.style.setProperty(key, value));
      return;
    }
    if (input.name === "demo-decision") state.decision = { choice: input.value, submitted: false };
    if (input.name === "direction") state.experiment.direction = input.value;
    if (input.name === "environment" && input instanceof HTMLInputElement) {
      state.experiment.environments = input.checked ? [...state.experiment.environments, input.value] : state.experiment.environments.filter((value) => value !== input.value);
    }
    if (input.name === "ablation" && input instanceof HTMLInputElement) state.experiment.ablation = input.checked;
    if (input.name === "theme-style") state.theme.style = input.value;
    if (input.name === "density") state.theme.density = input.value;
    const focusSelector = input instanceof HTMLInputElement && (input.type === "radio" || input.type === "checkbox")
      ? `[name="${input.name}"][value="${input.value}"]`
      : `[name="${input.name}"]`;
    render();
    root.querySelector<HTMLElement>(focusSelector)?.focus();
  });
  render();
}
