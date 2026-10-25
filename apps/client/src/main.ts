import { nicknameSchema, roomCodeSchema } from '@spud-squad/shared';
import type { HostMessage, RoomView, ServerMessage } from '@spud-squad/shared';
import { GameAudio } from './audio.js';
import { RoomConnection } from './connection.js';
import { button, element, toast } from './dom.js';
import { getProfile, getSession, saveProfile } from './storage.js';
import { LevelWakeLock } from './wakeLock.js';
import { HomeScreen } from './screens/home.js';
import { LobbyScreen } from './screens/lobby.js';
import { PlayScreen } from './screens/play.js';
import { ResultsScreen } from './screens/results.js';
import { openSettings } from './screens/settings.js';
import './styles.css';
import './styles/factory.css';

const profile = getProfile();
const audio = new GameAudio(profile.muted);
const awake = new LevelWakeLock();
const app = document.querySelector<HTMLElement>('#app')!;
const topbar = element('header', 'topbar');
const brand = button(
  'SPUD SQUAD',
  () => {
    if (!room) home();
  },
  'brand',
);
const status = element('span', 'topbar-room', 'ONE POTATO. SHARED CONTROL.');
const mute = button(
  '',
  () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    profile.muted = audio.muted;
    saveProfile(profile);
    updateMute();
  },
  'button mute',
);
const leave = button(
  'Leave room',
  () => {
    connection.leave();
    room = null;
    playerId = '';
    history.replaceState(null, '', '/');
    home();
  },
  'button leave',
);
leave.hidden = true;
const settings = button('⚙', openSettings, 'button settings-toggle');
settings.setAttribute('aria-label', 'Settings');
settings.title = 'Settings';
topbar.append(brand, status, mute, settings, leave);
const screen = element('div', 'screen');
app.append(topbar, screen);
let room: RoomView | null = null;
let playerId = '';
let current: HomeScreen | LobbyScreen | PlayScreen | ResultsScreen | null =
  null;
let phase = 'home';
const connection = new RoomConnection(
  receive,
  (state) => {
    if (state === 'connecting') status.textContent = 'JOINING THE CREW…';
    else if (state === 'reconnecting') status.textContent = 'RECONNECTING…';
    else if (room) status.textContent = `ROOM ${room.code}`;
    if (current instanceof PlayScreen)
      current.setConnected(state === 'connected');
  },
  (message) => {
    room = null;
    playerId = '';
    home(message);
  },
);

function updateMute(): void {
  mute.textContent = audio.muted ? '♪ Sound off' : '♪ Sound on';
  mute.setAttribute('aria-label', 'Mute sound');
  mute.setAttribute('aria-pressed', String(audio.muted));
}
function change(next: typeof current, nextPhase: string): void {
  if (current instanceof PlayScreen) current.destroy();
  current = next;
  phase = nextPhase;
  document.body.classList.toggle('in-game', nextPhase === 'playing');
  awake.setActive(nextPhase === 'playing');
  connection.setPlaying(nextPhase === 'playing');
  if (next) screen.replaceChildren(next.node);
  screen.dataset.screen = nextPhase;
  window.scrollTo(0, 0);
  const title = screen.querySelector<HTMLElement>('h1');
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
function home(error = ''): void {
  leave.hidden = true;
  status.textContent = 'ONE POTATO. SHARED CONTROL.';
  const invited = /^\/r\/([A-Z2-9]{5})$/.exec(location.pathname)?.[1] ?? '';
  const view = new HomeScreen(
    profile.nickname,
    invited,
    () => {
      void create();
    },
    () => joinHome(),
  );
  change(view, 'home');
  if (error) view.showError(error);
}
function validName(): string | null {
  if (!(current instanceof HomeScreen)) return null;
  const name = nicknameSchema.safeParse(current.nickname.value);
  if (!name.success) {
    current.showError(
      'Use a nickname with 1–20 letters, numbers, spaces, dots or dashes.',
    );
    return null;
  }
  profile.nickname = name.data;
  saveProfile(profile);
  return name.data;
}
async function create(): Promise<void> {
  const name = validName();
  if (!name || !(current instanceof HomeScreen)) return;
  const view = current;
  view.busy(true);
  try {
    const response = await fetch('/rooms', { method: 'POST' });
    if (!response.ok)
      throw new Error(
        'Could not create a room. Check your connection and try again.',
      );
    const value = (await response.json()) as { code?: unknown };
    const code = roomCodeSchema.parse(value.code);
    connection.connect(code, name);
  } catch (error) {
    view.showError(
      error instanceof Error ? error.message : 'Could not create a room.',
    );
  }
}
function joinHome(): void {
  const name = validName();
  if (!name || !(current instanceof HomeScreen)) return;
  const code = roomCodeSchema.safeParse(
    current.code.value.trim().toUpperCase(),
  );
  if (!code.success) {
    current.showError('Enter the five-character code your host shared.');
    return;
  }
  current.busy(true);
  connection.connect(code.data, name);
}
function host(message: HostMessage): void {
  connection.send(message);
}
function ready(value: boolean): void {
  connection.send({ type: 'ready', ready: value });
}
function showRoom(next: RoomView): void {
  room = next;
  status.textContent = `ROOM ${next.code}`;
  leave.hidden = false;
  if (phase !== next.phase) {
    if (next.phase === 'playing')
      change(
        new PlayScreen(next, playerId, connection.clock, audio, (value) =>
          connection.press(value),
        ),
        'playing',
      );
    else if (next.phase === 'results' && next.results)
      change(
        new ResultsScreen(next, next.results, playerId, host, ready),
        'results',
      );
    else change(new LobbyScreen(next, playerId, host, ready), 'lobby');
  } else if (
    current instanceof LobbyScreen ||
    current instanceof ResultsScreen ||
    current instanceof PlayScreen
  )
    current.update(next);
}
function receive(message: ServerMessage): void {
  switch (message.type) {
    case 'welcome':
      playerId = message.playerId;
      history.replaceState(null, '', `/r/${message.room.code}`);
      showRoom(message.room);
      break;
    case 'room':
      showRoom(message.room);
      break;
    case 'levelStart':
      if (current instanceof PlayScreen) current.setLevel(message);
      break;
    case 'spud':
      if (current instanceof PlayScreen) current.setState(message.state);
      break;
    case 'event':
      if (current instanceof PlayScreen) current.event(message.event);
      break;
    case 'results':
      if (room)
        showRoom({ ...room, phase: 'results', results: message.results });
      break;
    case 'error':
      if (message.code === 'NOT_YOUR_BUTTON' && current instanceof PlayScreen)
        current.reject();
      else
        toast(
          message.code === 'PRESS_LIMIT'
            ? 'Easy, masher! Fifteen presses a second is plenty.'
            : message.message,
        );
      break;
    case 'pong':
      break;
  }
}
window.addEventListener('pointerdown', () => audio.unlock(), {
  capture: true,
  passive: true,
});
window.addEventListener('keydown', () => audio.unlock(), { capture: true });
window.addEventListener('pagehide', () => connection.remember());
document.addEventListener('visibilitychange', () => {
  connection.remember();
  audio.visibility();
  void awake.update();
  if (current instanceof PlayScreen) {
    current.visibility();
    if (!document.hidden) connection.synchronize();
  }
});
function resumeSession(): void {
  const session = getSession();
  if (
    session &&
    (!/^\/r\//.test(location.pathname) ||
      location.pathname === `/r/${session.code}`)
  ) {
    if (current instanceof HomeScreen) current.busy(true);
    connection.connect(session.code, session.nickname, session.token);
  }
}
updateMute();
home();
resumeSession();
