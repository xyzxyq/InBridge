export function initArchitecture(reducedMotion: boolean): void {
  const flow = document.querySelector<HTMLElement>("[data-architecture]");
  if (!flow) return;
  const light = () => flow.querySelectorAll("li").forEach((item, index) => {
    window.setTimeout(() => item.classList.add("is-lit"), reducedMotion ? 0 : index * 100);
  });
  if (reducedMotion || !("IntersectionObserver" in window)) return light();
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return;
    light();
    observer.disconnect();
  }, { threshold: 0.35 });
  observer.observe(flow);
}
