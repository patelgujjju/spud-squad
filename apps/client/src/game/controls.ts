import type { Button } from '@spud-squad/shared';
import { element } from '../dom.js';
import type { GameAudio } from '../audio.js';

export const ICONS: Record<Button, string> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
  GRAB: '✊',
  STOP: '■',
  JUMP: '↟',
};
const KEYS: Record<string, Button> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Space: 'GRAB',
};
const HINT: Record<Button, string> = {
  UP: '↑ key',
  DOWN: '↓ key',
  LEFT: '← key',
  RIGHT: '→ key',
  GRAB: 'Space',
  STOP: 'Shift',
  JUMP: 'Shift',
};
export class GameControls {
  readonly node = element('section', 'controls');
  private panel = element('div', 'button-grid');
  private status = element(
    'p',
    'control-status',
    'Your buttons. Your responsibility.',
  );
  private buttons = new Map<Button, HTMLButtonElement>();
  private pointers = new Map<number, Button>();
  private heldKeys = new Map<string, Button>();
  private abort = new AbortController();
  private enabled = true;
  private owned = '';
  constructor(
    private readonly audio: GameAudio,
    private readonly send: (button: Button) => void,
  ) {
    const label = element('div', 'control-heading');
    label.append(
      element('span', 'eyebrow', 'YOUR BUTTONS'),
      element('span', 'tiny', 'TAP · DON’T HOLD'),
    );
    this.status.setAttribute('role', 'status');
    this.node.append(label, this.panel, this.status);
    const signal = this.abort.signal;
    window.addEventListener('keydown', this.keydown, { signal });
    window.addEventListener('keyup', this.keyup, { signal });
    window.addEventListener('blur', () => this.clear(), { signal });
  }
  setButtons(owned: readonly Button[]): void {
    if (this.owned === owned.join(',')) return;
    this.owned = owned.join(',');
    this.clear();
    this.buttons.clear();
    this.panel.replaceChildren();
    this.panel.dataset.count = String(owned.length);
    for (const value of owned) {
      const button = element('button', 'game-button');
      button.type = 'button';
      button.dataset.button = value;
      button.setAttribute('aria-label', value);
      button.disabled = !this.enabled;
      const icon = element('span', 'button-icon', ICONS[value]);
      icon.setAttribute('aria-hidden', 'true');
      button.append(
        icon,
        element('span', 'button-word', value),
        element('kbd', '', HINT[value]),
      );
      button.addEventListener('pointerdown', (event) => {
        if (
          !this.enabled ||
          (event.pointerType === 'mouse' && event.button !== 0)
        )
          return;
        event.preventDefault();
        this.pointers.set(event.pointerId, value);
        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          /* synthetic/unsupported */
        }
        this.activate(value);
      });
      const release = (event: PointerEvent): void => {
        this.pointers.delete(event.pointerId);
        this.refresh();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      // Assistive technology's virtual click has no preceding pointer event.
      button.addEventListener('click', (event) => {
        if (event.detail === 0 && this.enabled) this.activate(value);
      });
      this.buttons.set(value, button);
      this.panel.append(button);
    }
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const button of this.buttons.values()) button.disabled = !enabled;
    if (!enabled) this.clear();
  }
  reject(): void {
    this.status.textContent = 'Not your button! Ask your teammate.';
    this.audio.play('buzz');
    this.node.classList.remove('wrong-button');
    void this.node.offsetWidth;
    this.node.classList.add('wrong-button');
  }
  private activate(value: Button): void {
    this.audio.unlock();
    this.refresh();
    const button = this.buttons.get(value)!;
    button.classList.add('is-pressed');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ripple = element('i', 'button-ripple');
      ripple.setAttribute('aria-hidden', 'true');
      button.append(ripple);
      void ripple
        .animate(
          [
            { transform: 'translate(-50%,-50%) scale(.1)', opacity: 0.75 },
            { transform: 'translate(-50%,-50%) scale(2.5)', opacity: 0 },
          ],
          { duration: 420, easing: 'ease-out' },
        )
        .finished.then(() => ripple.remove());
    }
    try {
      if (/Android/i.test(navigator.userAgent)) navigator.vibrate?.(12);
    } catch {
      /* optional */
    }
    this.status.textContent = `${value}!`;
    // All local feedback above happens synchronously before network I/O.
    this.send(value);
    window.setTimeout(() => this.refresh(), 140);
  }
  private keydown = (event: KeyboardEvent): void => {
    if (
      (event.target as HTMLElement).closest(
        'input, textarea, select, [contenteditable]',
      )
    )
      return;
    const special = this.buttons.has('STOP')
      ? 'STOP'
      : this.buttons.has('JUMP')
        ? 'JUMP'
        : undefined;
    const value =
      KEYS[event.code] ??
      (event.code.startsWith('Shift') ? special : undefined);
    if (!value && !event.code.startsWith('Shift')) return;
    event.preventDefault();
    if (event.repeat || !this.enabled) return;
    this.audio.unlock();
    if (!value || !this.buttons.has(value)) {
      this.reject();
      return;
    }
    this.heldKeys.set(event.code, value);
    this.activate(value);
  };
  private keyup = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
    this.refresh();
  };
  private refresh(): void {
    const held = new Set([
      ...this.pointers.values(),
      ...this.heldKeys.values(),
    ]);
    for (const [value, button] of this.buttons)
      button.classList.toggle('is-pressed', held.has(value));
  }
  private clear(): void {
    this.pointers.clear();
    this.heldKeys.clear();
    this.refresh();
  }
  destroy(): void {
    this.abort.abort();
    this.clear();
  }
}
