/**
 * Contextual help: anything with `data-tip` (the (i) marks in menus) shows its
 * text in a floating card while hovered or focused. One card for the page, kept
 * on top of scrolling panels so it is never clipped.
 */
let card: HTMLDivElement | null = null;

export function installTooltips(root: HTMLElement = document.body): void {
  if (card) return;
  card = document.createElement('div');
  card.className = 'tip-card';
  card.hidden = true;
  document.body.append(card);
  const show = (target: EventTarget | null) => {
    const t = (target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
    if (!t || !card) return hide();
    card.textContent = t.dataset.tip ?? '';
    card.hidden = false;
    const r = t.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    // Beside the mark, preferring its left (the setup panel sits on the right), inside the window.
    let x = r.left - w - 10;
    if (x < 8) x = Math.min(window.innerWidth - w - 8, r.right + 10);
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, r.top + r.height / 2 - h / 2));
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const hide = () => card && (card.hidden = true);
  // A finger has no hover: a tap on the (i) shows its card until the next tap anywhere.
  root.addEventListener('pointerover', (e) => e.pointerType !== 'touch' && show(e.target));
  root.addEventListener('pointerout', (e) => e.pointerType !== 'touch' && !(e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]') && hide());
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if ((e.target as HTMLElement | null)?.closest?.('[data-tip]')) show(e.target);
    else hide();
  });
  root.addEventListener('focusin', (e) => show(e.target));
  root.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
}
