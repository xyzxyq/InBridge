export function initGlassHighlights(reducedMotion: boolean): void {
  if (reducedMotion || matchMedia("(pointer: coarse)").matches) return;
  document.querySelectorAll<HTMLElement>("[data-glass]").forEach((panel) => {
    let frame = 0;
    panel.addEventListener("pointermove", (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = panel.getBoundingClientRect();
        panel.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
        panel.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
      });
    });
  });
}
