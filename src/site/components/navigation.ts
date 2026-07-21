export function initNavigation(): void {
  const navigation = document.querySelector<HTMLElement>("[data-navigation]");
  if (!navigation) return;

  const links = Array.from(navigation.querySelectorAll<HTMLAnchorElement>('.nav-links a[href^="#"]'));
  const sections = links
    .map((link) => document.querySelector<HTMLElement>(link.hash))
    .filter((section): section is HTMLElement => Boolean(section));

  const sync = () => {
    navigation.classList.toggle("is-scrolled", window.scrollY > 60);
    const marker = window.scrollY + window.innerHeight * 0.3;
    let active = sections[0]?.id;
    for (const section of sections) if (section.offsetTop <= marker) active = section.id;
    links.forEach((link) => link.classList.toggle("is-active", link.hash === `#${active}`));
  };

  window.addEventListener("scroll", sync, { passive: true });
  sync();
}
