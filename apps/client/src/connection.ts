import { serverMessageSchema } from '@spud-squad/shared';
import type { Button, ClientMessage, ServerMessage } from '@spud-squad/shared';
import { ServerClock } from './clock.js';
import { saveSession } from './storage.js';

export type ConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'offline';
export class RoomConnection {
  readonly clock = new ServerClock();
  private socket: WebSocket | null = null;
  private generation = 0;
  private token: string | undefined;
  private code = '';
  private nickname = '';
  private seq = 0;
  private retryTimer: number | undefined;
  private pingTimer: number | undefined;
  private retryStarted = 0;
  private attempts = 0;
  private welcomed = false;
  private stopped = true;
  status: ConnectionStatus = 'offline';
  constructor(
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onStatus: (status: ConnectionStatus) => void,
    private readonly onFatal: (message: string) => void,
  ) {}

  connect(code: string, nickname: string, token?: string): void {
    this.leave(false);
    this.stopped = false;
    this.code = code;
    this.nickname = nickname;
    this.token = token;
    this.welcomed = false;
    this.attempts = 0;
    this.retryStarted = 0;
    this.open();
  }
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.onStatus(status);
  }
  private open(): void {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.setStatus(this.welcomed ? 'reconnecting' : 'connecting');
    const url = new URL(`/rooms/${this.code}/ws`, window.location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.onopen = () => {
      if (generation !== this.generation) return;
      this.send(
        {
          type: 'join',
          code: this.code,
          nickname: this.nickname,
          skin: 'spud',
          ...(this.token ? { reconnectToken: this.token } : {}),
        },
        true,
      );
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      if (generation !== this.generation) return;
      let value: unknown;
      try {
        value = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }
      const parsed = serverMessageSchema.safeParse(value);
      if (!parsed.success) {
        this.fatal(
          'The server sent an unsupported update. Refresh to try again.',
        );
        return;
      }
      const message = parsed.data;
      if (message.type === 'welcome') {
        this.token = message.reconnectToken;
        this.seq = message.nextSeq;
        this.welcomed = true;
        this.retryStarted = 0;
        this.attempts = 0;
        this.clock.welcome(message.serverTime);
        this.setStatus('connected');
        this.remember();
        this.send({ type: 'ping', timestamp: Date.now() });
      }
      if (message.type === 'pong')
        this.clock.pong(message.timestamp, message.serverTime);
      if (
        message.type === 'error' &&
        [
          'ROOM_FULL',
          'WRONG_ROOM',
          'ROOM_LOCKED',
          'INVALID_NAME',
          'RECONNECT_EXPIRED',
          'LEVEL_RUNNING',
        ].includes(message.code) &&
        this.status !== 'connected'
      ) {
        this.fatal(message.message);
        return;
      }
      this.onMessage(message);
    };
    ws.onclose = (event) => {
      if (generation !== this.generation || this.stopped) return;
      if (event.code === 4003 || event.code === 4001) {
        this.fatal(
          event.code === 4003
            ? 'The host removed you from this room.'
            : 'This player reconnected in another window.',
        );
        return;
      }
      if (!this.welcomed) {
        this.fatal(
          `Could not find or reach room ${this.code}. Check the code and your connection.`,
        );
        return;
      }
      this.retryStarted ||= Date.now();
      this.setStatus('reconnecting');
      this.retry();
    };
    ws.onerror = () => {
      /* close provides one retry path */
    };
  }
  private retry(): void {
    if (this.stopped) return;
    if (Date.now() - this.retryStarted >= 60_000 || this.attempts >= 8) {
      this.fatal('Reconnect timed out. Join the room again.');
      return;
    }
    const delay = Math.min(
      800 * 2 ** this.attempts,
      10_000,
      60_000 - (Date.now() - this.retryStarted),
    );
    this.retryTimer = window.setTimeout(() => {
      if (Date.now() - this.retryStarted >= 60_000) {
        this.fatal('Reconnect timed out. Join the room again.');
        return;
      }
      if (navigator.onLine) {
        this.attempts++;
        this.open();
      } else this.retry();
    }, delay);
  }
  send(message: ClientMessage, joining = false): boolean {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      (!joining && this.status !== 'connected')
    )
      return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
  press(button: Button): void {
    if (button === 'STOP' || button === 'JUMP') return;
    if (this.status === 'connected')
      this.send({ type: 'press', button, seq: this.seq++ });
  }
  setPlaying(playing: boolean): void {
    clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    if (playing) {
      this.synchronize();
      this.pingTimer = window.setInterval(() => {
        if (!document.hidden) this.synchronize();
      }, 10_000);
    }
  }
  synchronize(): void {
    this.send({ type: 'ping', timestamp: Date.now() });
  }
  remember(): void {
    if (this.token && !this.stopped)
      saveSession({
        code: this.code,
        token: this.token,
        nickname: this.nickname,
        seenAt: Date.now(),
      });
  }
  private fatal(message: string): void {
    this.leave();
    this.onFatal(message);
  }
  leave(clear = true): void {
    this.remember();
    this.stopped = true;
    ++this.generation;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.setPlaying(false);
    this.socket?.close(1000, 'Left room');
    this.socket = null;
    this.status = 'offline';
    if (clear) saveSession(null);
  }
}
