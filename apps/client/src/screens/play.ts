import type {
  Button,
  GameEvent,
  RoomView,
  ServerMessage,
  SpudView,
} from '@spud-squad/shared';
import type { GameAudio } from '../audio.js';
import type { ServerClock } from '../clock.js';
import type { LevelRenderer } from '../game/renderer.js';
import { GameControls } from '../game/controls.js';
import { element, playerName, timeLabel } from '../dom.js';
import { HINTS, levelById } from '../levels.js';

export class PlayScreen {
  readonly node = element('section', 'play-screen');
  private host = element('div', 'canvas-host');
  private timer = element('strong', 'play-timer', '0:00.0');
  private deaths = element('span', 'death-counter', '0 deaths');
  private title = element('span', 'play-level');
  private hint = element('p', 'play-hint');
  private connection = element('div', 'connection-banner', 'Connecting…');
  private roster = element('aside', 'play-roster');
  private controls: GameControls;
  private renderer: LevelRenderer | null = null;
  private level: Extract<ServerMessage, { type: 'levelStart' }> | null = null;
  private state: SpudView | null = null;
  private room: RoomView;
  private connected = true;
  private loaded = false;
  private destroyed = false;
  private interval: number;
  private abort = new AbortController();
  constructor(
    room: RoomView,
    private readonly me: string,
    private readonly clock: ServerClock,
    private readonly audio: GameAudio,
    press: (button: Button) => void,
  ) {
    this.room = room;
    const top = element('div', 'game-top');
    const hud = element('div', 'play-hud');
    hud.append(this.title, this.timer, this.deaths);
    this.host.setAttribute('role', 'img');
    this.host.setAttribute('aria-label', 'Loading the factory grid');
    this.host.append(element('div', 'board-loading', 'Opening the factory…'));
    this.host.dataset.testid = 'board';
    this.connection.setAttribute('role', 'status');
    this.connection.hidden = true;
    top.append(hud, this.host, this.hint, this.connection);
    this.controls = new GameControls(audio, press);
    this.controls.setEnabled(false);
    this.node.append(top, this.controls.node, this.roster);
    const prevent = (event: Event): void => event.preventDefault();
    const signal = this.abort.signal;
    for (const type of [
      'gesturestart',
      'gesturechange',
      'gestureend',
      'touchmove',
    ])
      this.node.addEventListener(type, prevent, { passive: false, signal });
    this.node.addEventListener('contextmenu', prevent, { signal });
    this.node.addEventListener('selectstart', prevent, { signal });
    this.interval = window.setInterval(() => {
      if (this.level)
        this.timer.textContent = timeLabel(
          this.clock.now() - this.level.startTime,
        );
    }, 100);
    this.update(room);
    void this.init();
  }
  private async init(): Promise<void> {
    try {
      const { LevelRenderer } = await import('../game/renderer.js');
      if (this.destroyed) return;
      this.renderer = new LevelRenderer(this.host, this.clock, this.audio);
      await this.renderer.init();
      if (this.destroyed) return;
      this.host.querySelector('.board-loading')?.remove();
      this.loaded = true;
      this.renderer.setPlayers(this.room.players);
      if (this.level) this.setLevel(this.level);
      if (this.state) this.renderer.setState(this.state);
      this.controls.setEnabled(this.connected && !!this.level);
    } catch {
      if (!this.destroyed)
        this.host.replaceChildren(
          element(
            'p',
            'graphics-error',
            'Could not open the graphics. Refresh this page to rejoin.',
          ),
        );
    }
  }
  update(room: RoomView): void {
    this.room = room;
    this.renderer?.setPlayers(room.players);
    const mine = room.players.find((player) => player.id === this.me);
    this.controls.setButtons(mine?.buttons ?? []);
    this.roster.replaceChildren(
      element('h2', 'eyebrow', 'THE BUTTON BRIGADE'),
      ...room.players.map((player) => {
        const row = element('div', 'play-player');
        row.dataset.player = player.id;
        row.append(
          playerName(player.nickname, player.color),
          element(
            'span',
            'tiny',
            player.connected
              ? player.buttons.join(' + ')
              : 'Away — holding their buttons',
          ),
        );
        return row;
      }),
    );
  }
  setLevel(message: Extract<ServerMessage, { type: 'levelStart' }>): void {
    this.level = message;
    const level = levelById.get(message.levelId);
    if (!level) return;
    this.title.textContent = `${level.id} · ${level.name}`;
    this.hint.textContent = HINTS[level.id] ?? '';
    this.renderer?.setLevel(level, message);
    this.renderer?.setPlayers(this.room.players);
    if (this.state) this.renderer?.setState(this.state);
    this.controls.setButtons(message.assignments[this.me] ?? []);
    this.controls.setEnabled(this.loaded && this.connected);
  }
  setState(state: SpudView): void {
    this.state = state;
    this.deaths.textContent = `${state.deaths} ${state.deaths === 1 ? 'death' : 'deaths'}`;
    this.renderer?.setState(state);
  }
  event(event: GameEvent): void {
    this.renderer?.event(event);
    if (event.type === 'press') {
      for (const row of this.roster.querySelectorAll<HTMLElement>(
        '[data-player]',
      ))
        row.classList.toggle(
          'last-presser',
          row.dataset.player === event.playerId,
        );
    }
  }
  setConnected(connected: boolean): void {
    this.connected = connected;
    this.connection.hidden = connected;
    this.connection.textContent =
      'Connection lost. Reconnecting for up to 60 seconds…';
    this.controls.setEnabled(connected && this.loaded && !!this.level);
  }
  reject(): void {
    this.controls.reject();
  }
  visibility(): void {
    this.renderer?.visibility();
  }
  destroy(): void {
    this.destroyed = true;
    clearInterval(this.interval);
    this.abort.abort();
    this.controls.destroy();
    this.renderer?.destroy();
  }
}
