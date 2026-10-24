export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
export function button(
  text: string,
  action: () => void,
  className = 'button',
): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function timeLabel(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
let toastTimer: number | undefined;
export function toast(message: string): void {
  const node = document.querySelector<HTMLElement>('#toast')!;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.hidden = true;
  }, 3500);
}
export const COLORS = [
  '#b94e12',
  '#00747d',
  '#6650a5',
  '#b9374e',
  '#245ca7',
  '#836600',
  '#9c3d84',
  '#44702e',
  '#855d37',
  '#52646e',
];
export const SHAPES = ['●', '▲', '■', '◆', '✚', '★', '⬟', '▰', '◈', '◒'];
export function playerName(name: string, color: number): HTMLElement {
  const node = element(
    'span',
    'player-name',
    `${SHAPES[color] ?? '●'} ${name}`,
  );
  node.style.setProperty('--player-color', COLORS[color] ?? COLORS[0]!);
  return node;
}
