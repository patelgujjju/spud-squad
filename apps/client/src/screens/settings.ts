import { button, element } from '../dom.js';
import { getQuality, setQuality } from '../game/quality.js';
import type { QualityMode } from '../game/quality.js';

export function openSettings(): void {
  const dialog = element('dialog', 'settings-dialog');
  dialog.setAttribute('aria-labelledby', 'settings-title');
  // Modal navigation must not reach the level's window keyboard controls.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  const title = element('h2', '', 'Settings');
  title.id = 'settings-title';
  const fieldset = element('fieldset', 'quality-options');
  fieldset.append(element('legend', '', 'Graphics quality'));
  const choices: [QualityMode, string, string][] = [
    [
      'auto',
      'Auto',
      'Full detail. Reduces shadows and particles if the frame rate stays low.',
    ],
    ['high', 'High', 'Soft shadows, dust and sparks.'],
    ['low', 'Low', 'No shadows or particles. The whole level stays readable.'],
  ];
  for (const [value, label, description] of choices) {
    const row = element('label', 'quality-choice');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'graphics-quality';
    radio.value = value;
    radio.checked = getQuality() === value;
    radio.addEventListener('change', () => setQuality(value));
    const text = element('span');
    text.append(
      element('strong', '', label),
      element('span', 'tiny', description),
    );
    row.append(radio, text);
    fieldset.append(row);
  }
  dialog.append(
    title,
    fieldset,
    button('Done', () => dialog.close(), 'button primary'),
  );
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
