export function initHeroParallax(reducedMotion: boolean): void {
  const visual = document.querySelector<HTMLElement>("[data-hero-parallax]");
  if (!visual || reducedMotion || matchMedia("(pointer: coarse)").matches) return;

  let frame = 0;
  visual.addEventListener("pointermove", (event) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const bounds = visual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      visual.style.setProperty("--hero-rx", `${(-y * 2.4).toFixed(2)}deg`);
      visual.style.setProperty("--hero-ry", `${(x * 2.4).toFixed(2)}deg`);
    });
  });
  visual.addEventListener("pointerleave", () => {
    visual.style.removeProperty("--hero-rx");
    visual.style.removeProperty("--hero-ry");
  });
}
