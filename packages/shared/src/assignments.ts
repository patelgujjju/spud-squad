import { BASIC_BUTTONS } from './buttons.js';
import type { Button } from './buttons.js';

export function shufflePlayers(
  playerIds: readonly string[],
  seed: number,
): string[] {
  if (!Number.isSafeInteger(seed))
    throw new Error('Seed must be a safe integer');
  let value = seed >>> 0;
  const players = [...playerIds];
  for (let index = players.length - 1; index > 0; index--) {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const target = Math.floor(
      (((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000) * (index + 1),
    );
    [players[index], players[target]] = [players[target]!, players[index]!];
  }
  return players;
}

export function assignButtons(
  playerIds: readonly string[],
  seed: number,
  buttons: readonly Button[] = BASIC_BUTTONS,
): Record<string, Button[]> {
  if (
    playerIds.length < 1 ||
    playerIds.length > 10 ||
    new Set(playerIds).size !== playerIds.length ||
    playerIds.some((id) => !/^[A-Za-z0-9_-]{1,64}$/.test(id))
  ) {
    throw new Error('Expected 1–10 unique player IDs');
  }
  if (
    buttons.length === 0 ||
    new Set(buttons).size !== buttons.length ||
    buttons.some(
      (button) => ![...BASIC_BUTTONS, 'STOP', 'JUMP'].includes(button),
    ) ||
    (buttons.includes('STOP') && buttons.includes('JUMP'))
  ) {
    throw new Error('Expected unique buttons with at most one special button');
  }
  const players = shufflePlayers(playerIds, seed);
  const table: Record<number, Button[][]> = {
    1: [[...buttons]],
    2: [
      ['LEFT', 'RIGHT', 'GRAB'],
      ['UP', 'DOWN', 'STOP', 'JUMP'],
    ],
    3: [
      ['LEFT', 'RIGHT'],
      ['UP', 'DOWN'],
      ['GRAB', 'STOP', 'JUMP'],
    ],
    4: [['LEFT'], ['RIGHT'], ['UP', 'DOWN'], ['GRAB', 'STOP', 'JUMP']],
  };
  const groups =
    table[players.length] ??
    players.map((_, index) => [buttons[index % buttons.length]!]);
  if (players.length === 5) {
    const special = buttons.find(
      (button) => button === 'STOP' || button === 'JUMP',
    );
    if (special) {
      // Five players each get a basic button; GRAB's owner also gets the special.
      groups.splice(
        0,
        groups.length,
        ...BASIC_BUTTONS.map((button): Button[] =>
          button === 'GRAB' ? [button, special] : [button],
        ),
      );
    }
  }
  return Object.fromEntries(
    players.map((id, index) => [
      id,
      groups[index]!.filter((button) => buttons.includes(button)),
    ]),
  );
}
