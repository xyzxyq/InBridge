import { USE_CASES } from "../data/use-cases";

function motif(type: (typeof USE_CASES)[number]["motif"]): string {
  const motifs: Record<typeof type, string> = {
    choice: '<i></i><i class="active"></i><i></i>',
    confirm: '<i class="check">✓</i><i></i>',
    experiment: '<i></i><i></i><i class="tall"></i><i></i>',
    theme: '<i class="swatch"></i><i class="slider"></i>',
    learn: '<i class="book"></i><i class="dot"></i>',
    loop: '<i class="node"></i><i class="path"></i><i class="node end"></i>'
  };
  return motifs[type];
}

export function renderUseCases(): void {
  const root = document.querySelector<HTMLElement>("[data-use-cases]");
  if (!root) return;
  root.innerHTML = USE_CASES.map(
    (item) => `<article class="use-case use-case-${item.size} reveal">
      <div class="case-motif motif-${item.motif}" aria-hidden="true">${motif(item.motif)}</div>
      <div><span>${item.tag}</span><h3>${item.title}</h3><p>${item.description}</p></div>
    </article>`
  ).join("");
}
