// Three tapered diagonal claw marks. Uses currentColor to follow the card palette.
export function clawIcon(doc) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('mt-claw-icon');
  for (const d of ['M12 2 8 13 2 21 7 10Z', 'M18 1 13 15 7 23 12 11Z', 'M23 3 19 15 13 23 17 12Z']) {
    const path = doc.createElementNS(ns, 'path');
    path.setAttribute('d', d);path.setAttribute('fill', 'currentColor');svg.append(path);
  }
  return svg;
}
