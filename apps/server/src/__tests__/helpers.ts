import { env as bindings, exports as workerExports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { expect } from 'vitest';
import type {
  ClientMessage,
  LevelState,
  ServerMessage,
} from '@spud-squad/shared';
import type { Env } from '../env.js';
import type { Room } from '../room.js';
import type { RoomData, Player } from '../roomStorage.js';

export const env = bindings as Env;
export const worker = workerExports as unknown as { default: Fetcher };
let ip = 0;
export const connections: WebSocket[] = [];
export function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return worker.default.fetch(`http://spud.test${path}`, init);
}
export async function createRoom(): Promise<string> {
  const response = await request('/rooms', { method: 'POST' });
  expect(response.status).toBe(201);
  const result = (await response.json()) as { code: string };
  expect(result.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
  return result.code;
}
export const stub = (code: string) => env.ROOMS.get(env.ROOMS.idFromName(code));
export interface Probe {
  data: RoomData | null;
  players: Map<string, Player>;
  game: { state: LevelState; startTime: number } | null;
  loop: number | null;
  tick(): void;
}
export function inspect<T>(
  code: string,
  callback: (room: Probe, ctx: DurableObjectState) => T | Promise<T>,
): Promise<T> {
  return runInDurableObject(stub(code), (room: Room, ctx) =>
    callback(room as unknown as Probe, ctx),
  );
}
export class Peer {
  messages: ServerMessage[] = [];
  private waiters: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
  }[] = [];
  constructor(readonly ws: WebSocket) {
    ws.addEventListener('message', (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      const index = this.waiters.findIndex((waiter) =>
        waiter.predicate(message),
      );
      if (index >= 0) this.waiters.splice(index, 1)[0]!.resolve(message);
      else this.messages.push(message);
    });
    ws.accept();
  }
  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }
  async take<T extends ServerMessage['type']>(
    type: T,
    predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () =>
      true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (message: ServerMessage): boolean =>
      message.type === type &&
      predicate(message as Extract<ServerMessage, { type: T }>);
    const index = this.messages.findIndex(match);
    if (index >= 0)
      return this.messages.splice(index, 1)[0] as Extract<
        ServerMessage,
        { type: T }
      >;
    return new Promise<ServerMessage>((resolve) =>
      this.waiters.push({ predicate: match, resolve }),
    ) as Promise<Extract<ServerMessage, { type: T }>>;
  }
  async barrier(): Promise<void> {
    const timestamp = Date.now();
    this.send({ type: 'ping', timestamp });
    await this.take('pong', (message) => message.timestamp === timestamp);
  }
}
export async function socket(
  code: string,
  ipAddress = `192.0.${Math.floor(++ip / 250)}.${(ip % 250) + 1}`,
): Promise<Peer> {
  const response = await request(`/rooms/${code}/ws`, {
    headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ipAddress },
  });
  expect(response.status).toBe(101);
  const ws = response.webSocket!;
  connections.push(ws);
  return new Peer(ws);
}
export async function join(
  code: string,
  nickname = 'Mash',
  token?: string,
): Promise<{
  peer: Peer;
  welcome: Extract<ServerMessage, { type: 'welcome' }>;
}> {
  const peer = await socket(code);
  peer.send({
    type: 'join',
    code,
    nickname,
    skin: 'spud',
    ...(token ? { reconnectToken: token } : {}),
  });
  const welcome = await peer.take('welcome');
  return { peer, welcome };
}
export async function start(code: string) {
  const a = await join(code, 'Alice');
  const b = await join(code, 'Bob');
  a.peer.send({ type: 'ready', ready: true });
  b.peer.send({ type: 'ready', ready: true });
  await a.peer.barrier();
  await b.peer.barrier();
  a.peer.send({ type: 'host', action: 'start' });
  const level = await a.peer.take('levelStart');
  return { a, b, level };
}
