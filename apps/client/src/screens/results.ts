import type { HostMessage, LevelResults, RoomView } from '@spud-squad/shared';
import { button, element, playerName, timeLabel } from '../dom.js';

export class ResultsScreen {
  readonly node = element('section', 'results-screen screen-card');
  private ready: HTMLButtonElement;
  private next: HTMLButtonElement;
  private back: HTMLButtonElement;
  private room: RoomView;
  constructor(
    room: RoomView,
    results: LevelResults,
    private readonly me: string,
    host: (message: HostMessage) => void,
    ready: (value: boolean) => void,
  ) {
    this.room = room;
    const head = element('div', 'results-head');
    head.append(
      element('p', 'eyebrow', 'ESCAPED. BARELY.'),
      element('h1', 'screen-title', 'Spud lives another day.'),
    );
    const stats = element('div', 'result-stats');
    stats.append(
      element('strong', 'result-time', timeLabel(results.timeMs)),
      element(
        'span',
        'result-deaths',
        `${results.deaths} ${results.deaths === 1 ? 'death' : 'deaths'}`,
      ),
    );
    const stars = element(
      'span',
      'stars',
      '★'.repeat(results.stars) + '☆'.repeat(3 - results.stars),
    );
    stars.setAttribute('aria-label', `${results.stars} stars`);
    stats.append(stars);
    const awards = element('div', 'awards');
    const definitions = [
      [
        'hero',
        '↗',
        'Hero Press',
        results.awards.heroPress ? [results.awards.heroPress] : [],
        'The final push.',
      ],
      [
        'feeder',
        '≋',
        'Fryer Feeder',
        results.awards.fryerFeeder,
        'Last press before the most deaths.',
      ],
      [
        'masher',
        '✦',
        'Button Masher',
        results.awards.buttonMasher,
        'Most presses. No surprises.',
      ],
      [
        'asleep',
        '☾',
        'Asleep at the Button',
        results.awards.asleepAtTheButton,
        'Fewest presses. Saving energy.',
      ],
      [
        'clean',
        '✓',
        'Clean Hands',
        results.awards.cleanHands,
        'Zero deaths on their conscience.',
      ],
    ] as const;
    for (const [kind, icon, title, ids, description] of definitions) {
      const card = element('article', `award award-${kind}`);
      card.append(
        element('span', 'award-icon', icon),
        element('h2', 'award-title', title),
      );
      const names = element('div', 'award-names');
      if (!ids.length)
        names.append(
          element(
            'strong',
            '',
            kind === 'feeder' ? 'Nobody. Nice.' : 'The whole crew.',
          ),
        );
      for (const id of ids) {
        const player = results.players.find((person) => person.id === id);
        names.append(
          playerName(player?.nickname ?? 'Teammate', player?.color ?? 0),
        );
      }
      card.append(names, element('p', 'tiny', description));
      awards.append(card);
    }
    const actions = element('div', 'result-actions');
    this.ready = button(
      'Ready for more',
      () => ready(!this.room.players.find((player) => player.id === me)?.ready),
      'button secondary large',
    );
    this.next = button(
      'Next level →',
      () => host({ type: 'host', action: 'next' }),
      'button primary large',
    );
    this.back = button(
      'Back to lobby',
      () =>
        host({
          type: 'host',
          action: 'pickLevel',
          levelId: this.room.selectedLevel,
        }),
      'button quiet',
    );
    actions.append(this.ready, this.next, this.back);
    this.node.append(head, stats, awards, actions);
    this.update(room);
  }
  update(room: RoomView): void {
    this.room = room;
    this.ready.textContent = room.players.find(
      (player) => player.id === this.me,
    )?.ready
      ? '✓ Ready for more'
      : 'Ready for more';
    this.ready.setAttribute(
      'aria-pressed',
      String(
        room.players.find((player) => player.id === this.me)?.ready ?? false,
      ),
    );
    this.next.hidden = this.back.hidden = room.hostId !== this.me;
    this.next.disabled =
      room.players.length < 2 ||
      !room.players.every((player) => player.connected && player.ready);
  }
}
