import type { HostMessage, RoomView } from '@spud-squad/shared';
import { button, element, playerName, toast } from '../dom.js';
import { levels } from '../levels.js';

export class LobbyScreen {
  readonly node = element('section', 'lobby-screen screen-card');
  private players = element('ul', 'lobby-players');
  private levelButtons = new Map<string, HTMLButtonElement>();
  private ready: HTMLButtonElement;
  private start: HTMLButtonElement;
  private lock: HTMLButtonElement;
  private hint = element('p', 'lobby-hint');
  private notice = element('p', 'notice');
  private room: RoomView;
  constructor(
    room: RoomView,
    private readonly me: string,
    private readonly host: (message: HostMessage) => void,
    ready: (value: boolean) => void,
  ) {
    this.room = room;
    const head = element('div', 'lobby-head');
    const code = element('div', 'room-code', room.code);
    code.dataset.testid = 'room-code';
    const invite = element('div', 'invite');
    const link = element('input', 'invite-link');
    link.readOnly = true;
    link.value = `${location.origin}/r/${room.code}`;
    link.setAttribute('aria-label', 'Invite link');
    const share = button(
      'Share invite ↗',
      () => {
        void this.share(link);
      },
      'button secondary',
    );
    invite.append(share, link);
    const title = element('div');
    title.append(
      element('p', 'eyebrow', 'YOUR PRIVATE ROOM'),
      code,
      element('p', 'tiny', 'Send this code to your crew.'),
    );
    head.append(title, invite);
    this.node.append(
      head,
      element('h1', 'screen-title', 'Assemble the squad.'),
      this.notice,
    );
    const columns = element('div', 'lobby-columns');
    const roster = element('div');
    roster.append(
      element('h2', 'section-title', 'On potato duty'),
      this.players,
    );
    const selection = element('div');
    selection.append(element('h2', 'section-title', 'Pick your escape'));
    const levelGrid = element('div', 'level-grid');
    for (const level of levels) {
      const tile = button(
        '',
        () =>
          this.host({ type: 'host', action: 'pickLevel', levelId: level.id }),
        'level-option',
      );
      tile.dataset.level = level.id;
      tile.append(
        element('span', 'level-number', level.id),
        element('strong', '', level.name),
        element(
          'span',
          'tiny',
          level.objects.some((object) => object.type === 'slicer')
            ? 'WATCH THE BLADE'
            : level.id === '1-4'
              ? 'FIND THE KEY'
              : 'FIND THE EXIT',
        ),
      );
      this.levelButtons.set(level.id, tile);
      levelGrid.append(tile);
    }
    selection.append(levelGrid);
    columns.append(roster, selection);
    const actions = element('div', 'lobby-actions');
    this.ready = button(
      'Ready',
      () => ready(!this.room.players.find((player) => player.id === me)?.ready),
      'button secondary large',
    );
    this.start = button(
      'Start level →',
      () => host({ type: 'host', action: 'start' }),
      'button primary large',
    );
    this.lock = button(
      'Lock room',
      () => host({ type: 'host', action: 'lock', locked: !this.room.locked }),
      'button quiet',
    );
    actions.append(this.ready, this.start, this.lock);
    this.node.append(columns, this.hint, actions);
    this.update(room);
  }
  update(room: RoomView): void {
    this.room = room;
    const isHost = room.hostId === this.me;
    this.players.replaceChildren(
      ...room.players.map((player) => {
        const row = element('li', 'lobby-player');
        row.append(
          playerName(player.nickname, player.color),
          element(
            'span',
            'player-state',
            !player.connected
              ? 'Away · 60s grace'
              : player.ready
                ? '✓ Ready'
                : player.id === room.hostId
                  ? 'Host'
                  : 'Getting ready',
          ),
        );
        if (isHost && player.id !== this.me) {
          const kick = button(
            '×',
            () =>
              this.host({ type: 'host', action: 'kick', playerId: player.id }),
            'kick',
          );
          kick.setAttribute('aria-label', `Remove ${player.nickname}`);
          row.append(kick);
        }
        return row;
      }),
    );
    for (const [id, tile] of this.levelButtons) {
      tile.disabled = !isHost;
      tile.classList.toggle('selected', room.selectedLevel === id);
      tile.setAttribute('aria-pressed', String(room.selectedLevel === id));
    }
    this.ready.textContent = room.players.find(
      (player) => player.id === this.me,
    )?.ready
      ? '✓ Ready — waiting for crew'
      : 'I’m ready';
    this.ready.setAttribute(
      'aria-pressed',
      String(
        room.players.find((player) => player.id === this.me)?.ready ?? false,
      ),
    );
    this.start.hidden = !isHost;
    this.lock.hidden = !isHost;
    this.lock.textContent = room.locked ? 'Unlock room' : 'Lock room';
    this.start.disabled =
      room.players.length < 2 ||
      !room.players.every((player) => player.connected && player.ready);
    this.hint.textContent =
      room.players.length < 2
        ? 'You need at least two players. Invite a friend to start.'
        : 'Everyone taps Ready. The host starts the escape.';
    this.notice.textContent = room.notice ?? '';
    this.notice.hidden = !room.notice;
  }
  private async share(link: HTMLInputElement): Promise<void> {
    try {
      if (navigator.share)
        await navigator.share({
          title: 'Spud Squad',
          text: `Join my squad: ${this.room.code}`,
          url: link.value,
        });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link.value);
        toast('Invite link copied.');
      } else {
        link.focus();
        link.select();
        toast('Copy the selected invite link.');
      }
    } catch {
      link.focus();
      link.select();
    }
  }
}
