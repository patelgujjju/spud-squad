import { DurableObject } from 'cloudflare:workers';
import {
  advance,
  applyPress,
  createLevelState,
  getResults,
  releaseButtons,
  roomCodeSchema,
  clientMessageSchema,
  spudView,
} from '@spud-squad/shared';
import type {
  ClientMessage,
  HostMessage,
  JoinMessage,
  LevelState,
  RoomView,
  ServerMessage,
  Transition,
} from '@spud-squad/shared';
import type { Env } from './env.js';
import { levels } from './levels.js';
import { allowedName } from './nameFilter.js';
import { digest, MAX_MESSAGE_BYTES } from './security.js';
import { RoomStorage, socketDataSchema } from './roomStorage.js';
import type { Player, RoomData, SocketData } from './roomStorage.js';

export const RECONNECT_MS = 60_000;
export const EMPTY_ROOM_MS = 15 * 60_000;
const JOIN_TIMEOUT_MS = 10_000;
interface LiveLevel {
  state: LevelState;
  startTime: number;
  participants: { id: string; nickname: string; color: number }[];
}

export class Room extends DurableObject<Env> {
  private store: RoomStorage;
  private data: RoomData | null;
  private players = new Map<string, Player>();
  private sockets = new Map<string, WebSocket>();
  private rates = new Map<string, { lastSeq: number; pressTimes: number[] }>();
  private game: LiveLevel | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new RoomStorage(ctx.storage.sql);
    this.data = this.store.loadRoom();
    for (const player of this.store.loadPlayers())
      this.players.set(player.id, player);
    for (const ws of ctx.getWebSockets()) {
      const attachment = this.attachment(ws);
      if (!attachment) continue;
      this.sockets.set(attachment.connectionId, ws);
      if (
        attachment.playerId &&
        this.players.get(attachment.playerId)?.connectionId ===
          attachment.connectionId
      )
        this.rates.set(attachment.playerId, {
          lastSeq: attachment.lastSeq,
          pressTimes: attachment.pressTimes,
        });
    }
    let changed = false;
    for (const player of this.players.values()) {
      if (
        player.connectionId !== null &&
        !this.sockets.has(player.connectionId)
      ) {
        player.connectionId = null;
        player.disconnectedAt = Date.now();
        player.ready = false;
        this.store.savePlayer(player);
        changed = true;
      }
    }
    // Lobby/results restore from SQLite and attachments. A deployment/eviction
    // during a live level aborts to the lobby: live state is never persisted.
    if (this.data?.phase === 'playing') {
      this.data.phase = 'lobby';
      this.data.notice = 'The level was interrupted. Ready up to restart.';
      this.resetReady();
      changed = true;
    }
    if (changed) {
      this.updatePresence();
      ctx.blockConcurrencyWhile(() => this.scheduleAlarm());
    }
  }

  async claim(code: string): Promise<boolean> {
    if (
      !roomCodeSchema.safeParse(code).success ||
      !this.ctx.id.equals(this.env.ROOMS.idFromName(code)) ||
      this.data
    )
      return false;
    this.data = {
      code,
      hostId: null,
      selectedLevel: '1-1',
      locked: false,
      phase: 'lobby',
      emptySince: Date.now(),
      results: null,
      notice: null,
    };
    this.saveRoom();
    await this.scheduleAlarm();
    return true;
  }

  override async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.split('/')[2];
    if (!this.data || code !== this.data.code)
      return Response.json({ error: 'Room not found' }, { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket upgrade required', { status: 426 });
    if (this.sockets.size >= 20)
      return Response.json(
        { error: 'Too many pending connections' },
        { status: 429 },
      );
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: SocketData = {
      connectionId: crypto.randomUUID(),
      playerId: null,
      openedAt: Date.now(),
      lastSeq: -1,
      pressTimes: [],
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    this.sockets.set(attachment.connectionId, server);
    await this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    ws: WebSocket,
    raw: string | ArrayBuffer,
  ): Promise<void> {
    const attachment = this.attachment(ws);
    if (!attachment || !this.sockets.has(attachment.connectionId)) return;
    if (
      typeof raw !== 'string' ||
      new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES
    )
      return;
    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      this.error(ws, 'INVALID_MESSAGE', 'Expected JSON');
      return;
    }
    const parsed = clientMessageSchema.safeParse(value);
    if (!parsed.success) {
      this.error(ws, 'INVALID_MESSAGE', 'Invalid message');
      return;
    }
    const message = parsed.data;
    if (message.type === 'join') {
      await this.join(ws, attachment, message);
      return;
    }
    const player = attachment.playerId
      ? this.players.get(attachment.playerId)
      : undefined;
    if (!player || player.connectionId !== attachment.connectionId) {
      this.error(ws, 'JOIN_REQUIRED', 'Join the room first');
      return;
    }
    if (message.type === 'ping') {
      this.send(ws, {
        type: 'pong',
        timestamp: message.timestamp,
        serverTime: Date.now(),
      });
      return;
    }
    if (message.type === 'press') {
      this.press(ws, attachment, player, message);
      return;
    }
    if (message.type === 'ready') {
      if (this.data?.phase === 'playing') {
        this.error(ws, 'LEVEL_RUNNING', 'Wait for results');
        return;
      }
      if (player.ready !== message.ready) {
        player.ready = message.ready;
        this.store.savePlayer(player);
        this.broadcastRoom();
      }
      return;
    }
    await this.host(ws, player, message);
  }

  private async join(
    ws: WebSocket,
    attachment: SocketData,
    message: JoinMessage,
  ): Promise<void> {
    if (!this.data || message.code !== this.data.code) {
      this.error(
        ws,
        'WRONG_ROOM',
        'That room code does not match this connection',
      );
      return;
    }
    if (attachment.playerId) {
      this.error(ws, 'ALREADY_JOINED', 'This connection already joined');
      return;
    }
    if (!allowedName(message.nickname)) {
      this.error(ws, 'INVALID_NAME', 'Choose a different nickname');
      return;
    }
    const token = message.reconnectToken ?? crypto.randomUUID();
    const hash = await digest(token);
    // Re-read membership after crypto yields; capacity/claim changes below are synchronous.
    if (!this.data || this.sockets.get(attachment.connectionId) !== ws) return;
    if (this.attachment(ws)?.playerId) {
      this.error(ws, 'ALREADY_JOINED', 'This connection already joined');
      return;
    }
    const now = Date.now();
    const reconnect = message.reconnectToken
      ? [...this.players.values()].find((player) => player.tokenHash === hash)
      : undefined;
    let player: Player;
    if (message.reconnectToken) {
      if (
        !reconnect ||
        (reconnect.disconnectedAt !== null &&
          now - reconnect.disconnectedAt >= RECONNECT_MS)
      ) {
        this.error(
          ws,
          'RECONNECT_EXPIRED',
          'Reconnect expired. Join again without the old token.',
        );
        return;
      }
      player = reconnect;
      if (player.connectionId) {
        const old = this.sockets.get(player.connectionId);
        this.sockets.delete(player.connectionId);
        old?.close(4001, 'Reconnected on another socket');
      }
    } else {
      if (this.data.locked) {
        this.error(ws, 'ROOM_LOCKED', 'This room is locked');
        return;
      }
      if (this.data.phase === 'playing') {
        this.error(ws, 'LEVEL_RUNNING', 'Join between levels');
        return;
      }
      if (this.players.size >= 10) {
        this.error(ws, 'ROOM_FULL', 'This room has ten players');
        return;
      }
      const used = new Set(
        [...this.players.values()].map((member) => member.color),
      );
      const color = Array.from({ length: 10 }, (_, index) => index).find(
        (index) => !used.has(index),
      )!;
      player = {
        id: crypto.randomUUID(),
        nickname: message.nickname,
        skin: message.skin,
        color,
        joinedAt: now,
        disconnectedAt: null,
        connectionId: null,
        ready: false,
        tokenHash: hash,
      };
      this.players.set(player.id, player);
    }
    player.connectionId = attachment.connectionId;
    player.disconnectedAt = null;
    this.store.savePlayer(player);
    attachment.playerId = player.id;
    const rate = this.rates.get(player.id) ?? { lastSeq: -1, pressTimes: [] };
    this.rates.set(player.id, rate);
    attachment.lastSeq = rate.lastSeq;
    attachment.pressTimes = rate.pressTimes;
    ws.serializeAttachment(attachment);
    this.data.emptySince = null;
    this.chooseHost();
    this.saveRoom();
    this.send(ws, {
      type: 'welcome',
      playerId: player.id,
      reconnectToken: token,
      nextSeq: rate.lastSeq + 1,
      room: this.view(),
      serverTime: now,
    });
    if (this.game) {
      this.send(ws, this.levelStart());
      this.sendSpud(ws);
    }
    if (this.data.results)
      this.send(ws, {
        type: 'results',
        results: this.data.results,
        serverTime: now,
      });
    this.broadcastRoom();
    await this.scheduleAlarm();
  }

  private press(
    ws: WebSocket,
    attachment: SocketData,
    player: Player,
    message: Extract<ClientMessage, { type: 'press' }>,
  ): void {
    if (!this.game) {
      this.error(ws, 'NOT_PLAYING', 'No level is running');
      return;
    }
    const now = Date.now();
    const rate = this.rates.get(player.id)!;
    if (message.seq <= rate.lastSeq) {
      this.error(ws, 'STALE_PRESS', 'Sequence number must increase');
      return;
    }
    rate.lastSeq = message.seq;
    rate.pressTimes = rate.pressTimes.filter((at) => at > now - 1000);
    attachment.lastSeq = rate.lastSeq;
    attachment.pressTimes = rate.pressTimes;
    if (rate.pressTimes.length >= 15) {
      ws.serializeAttachment(attachment);
      this.error(ws, 'PRESS_LIMIT', 'At most fifteen presses per second');
      return;
    }
    rate.pressTimes.push(now);
    ws.serializeAttachment(attachment);
    if (!this.game.state.assignments[player.id]?.includes(message.button)) {
      this.error(ws, 'NOT_YOUR_BUTTON', 'Not your button!');
      return;
    }
    this.transition(
      applyPress(this.game.state, player.id, message.button, this.elapsed(now)),
    );
  }

  private async host(
    ws: WebSocket,
    player: Player,
    message: HostMessage,
  ): Promise<void> {
    if (!this.data || this.data.hostId !== player.id) {
      this.error(ws, 'HOST_ONLY', 'Only the host can do that');
      return;
    }
    if (message.action === 'kick') {
      if (
        !message.playerId ||
        message.playerId === player.id ||
        !this.players.has(message.playerId)
      ) {
        this.error(ws, 'INVALID_ACTION', 'Choose another player');
        return;
      }
      this.removePlayer(message.playerId);
      this.updatePresence();
      this.broadcastRoom();
      await this.scheduleAlarm();
      return;
    }
    if (message.action === 'lock') {
      if (message.locked === undefined) {
        this.error(ws, 'INVALID_ACTION', 'Missing lock state');
        return;
      }
      this.data.locked = message.locked;
      this.saveRoom();
      this.broadcastRoom();
      return;
    }
    if (this.data.phase === 'playing') {
      this.error(ws, 'LEVEL_RUNNING', 'Wait for results');
      return;
    }
    if (message.action === 'pickLevel') {
      if (!message.levelId || !levels.has(message.levelId)) {
        this.error(ws, 'INVALID_LEVEL', 'Choose a prototype level');
        return;
      }
      this.data.selectedLevel = message.levelId;
      this.data.phase = 'lobby';
      this.data.results = null;
      this.resetReady();
      this.saveRoom();
      this.broadcastRoom();
      return;
    }
    if (message.action === 'next' && this.data.phase !== 'results') {
      this.error(ws, 'INVALID_ACTION', 'Finish the current level first');
      return;
    }
    const connected = [...this.players.values()].filter(
      (member) => member.connectionId !== null,
    );
    if (
      connected.length < 2 ||
      connected.length !== this.players.size ||
      !connected.every((member) => member.ready)
    ) {
      this.error(
        ws,
        'NOT_READY',
        'At least two players must join and everyone must be ready',
      );
      return;
    }
    if (message.action === 'next') {
      const ids = [...levels.keys()];
      this.data.selectedLevel =
        ids[(ids.indexOf(this.data.selectedLevel) + 1) % ids.length]!;
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.game = {
      state: createLevelState(
        levels.get(this.data.selectedLevel)!,
        seed,
        connected.map((member) => member.id),
      ),
      startTime: Date.now(),
      participants: connected.map(({ id, nickname, color }) => ({
        id,
        nickname,
        color,
      })),
    };
    this.data.phase = 'playing';
    this.data.results = null;
    this.data.notice = null;
    this.resetReady();
    this.saveRoom();
    this.broadcastRoom();
    this.broadcast(this.levelStart());
    this.sendSpud();
    this.loop = setInterval(() => this.tick(), 100);
  }

  private elapsed(now: number): number {
    return Math.max(this.game!.state.time, now - this.game!.startTime);
  }
  private tick(): void {
    if (
      !this.game ||
      ![...this.players.values()].some((player) => player.connectionId !== null)
    ) {
      this.stopLoop();
      return;
    }
    this.transition(advance(this.game.state, this.elapsed(Date.now())));
  }
  private transition(result: Transition): void {
    if (!this.game || !this.data) return;
    const previous = this.game.state;
    const landed =
      previous.position[0] !== result.state.position[0] ||
      previous.position[1] !== result.state.position[1] ||
      (previous.hop !== null && result.state.hop === null);
    this.game.state = result.state;
    for (const event of result.events)
      this.broadcast({ type: 'event', event, serverTime: Date.now() });
    if (result.events.length || landed) this.sendSpud();
    if (result.state.status === 'finished') {
      const results = {
        ...getResults(result.state),
        players: this.game.participants,
      };
      this.stopLoop();
      this.game = null;
      this.data.phase = 'results';
      this.data.results = results;
      this.resetReady();
      this.saveRoom();
      this.broadcast({ type: 'results', results, serverTime: Date.now() });
      this.broadcastRoom();
    }
  }
  private levelStart(): Extract<ServerMessage, { type: 'levelStart' }> {
    const game = this.game!;
    return {
      type: 'levelStart',
      levelId: game.state.level.id,
      seed: game.state.seed,
      startTime: game.startTime,
      assignments: game.state.assignments,
      groupFactor: game.state.factor,
    };
  }
  private sendSpud(ws?: WebSocket): void {
    if (!this.game) return;
    const message: ServerMessage = {
      type: 'spud',
      state: spudView(this.game.state),
      serverTime: Date.now(),
      whoPressed: this.game.state.lastPress,
    };
    if (ws) this.send(ws, message);
    else this.broadcast(message);
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    // Explicitly finish the handshake; never echo a reserved abnormal code.
    try {
      ws.close([1005, 1006, 1015].includes(code) ? 1000 : code, reason);
    } catch {
      /* transport already gone */
    }
    await this.disconnected(ws);
  }
  override async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, 'Socket error');
    await this.disconnected(ws);
  }
  private async disconnected(ws: WebSocket): Promise<void> {
    const attachment = this.attachment(ws);
    if (!attachment) return;
    this.sockets.delete(attachment.connectionId);
    const player = attachment.playerId
      ? this.players.get(attachment.playerId)
      : undefined;
    if (player?.connectionId === attachment.connectionId) {
      player.connectionId = null;
      player.disconnectedAt = Date.now();
      player.ready = false;
      this.store.savePlayer(player);
      this.updatePresence();
      this.broadcastRoom();
    }
    await this.scheduleAlarm();
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    for (const [id, ws] of this.sockets) {
      const attachment = this.attachment(ws);
      if (
        !attachment?.playerId &&
        attachment &&
        now >= attachment.openedAt + JOIN_TIMEOUT_MS
      ) {
        this.error(ws, 'JOIN_TIMEOUT', 'Join timed out');
        ws.close(1008, 'Join timed out');
        this.sockets.delete(id);
      }
    }
    for (const player of this.players.values()) {
      if (
        player.disconnectedAt !== null &&
        now >= player.disconnectedAt + RECONNECT_MS
      )
        this.removePlayer(player.id);
    }
    this.updatePresence();
    if (
      this.data?.emptySince !== null &&
      this.data &&
      now >= this.data.emptySince + EMPTY_ROOM_MS
    ) {
      for (const ws of this.sockets.values()) ws.close(1001, 'Room expired');
      this.sockets.clear();
      this.players.clear();
      this.rates.clear();
      this.stopLoop();
      this.game = null;
      this.data = null;
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.store = new RoomStorage(this.ctx.storage.sql);
      return;
    }
    this.broadcastRoom();
    await this.scheduleAlarm();
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    if (player.connectionId) {
      const ws = this.sockets.get(player.connectionId);
      this.sockets.delete(player.connectionId);
      ws?.close(4003, 'Removed from room');
    }
    this.players.delete(id);
    this.rates.delete(id);
    this.store.deletePlayer(id);
    if (this.game) {
      this.game.state = releaseButtons(
        this.game.state,
        id,
        [...this.players.values()]
          .filter((member) => member.connectionId !== null)
          .map((member) => member.id),
      );
      if (this.data)
        this.data.notice = `${player.nickname}'s buttons were handed to the remaining players.`;
    }
  }
  private chooseHost(): void {
    if (!this.data) return;
    const connected = [...this.players.values()]
      .filter((member) => member.connectionId !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    if (!connected.some((member) => member.id === this.data!.hostId))
      this.data.hostId = connected[0]?.id ?? null;
  }
  private updatePresence(): void {
    if (!this.data) return;
    this.chooseHost();
    if (
      ![...this.players.values()].some((player) => player.connectionId !== null)
    ) {
      this.data.emptySince ??= Date.now();
      this.stopLoop();
      this.game = null;
      if (this.data.phase === 'playing') {
        this.data.phase = 'lobby';
        this.data.notice = 'Everyone disconnected. Ready up to restart.';
        this.resetReady();
      }
    }
    this.saveRoom();
  }
  private resetReady(): void {
    for (const player of this.players.values())
      if (player.ready) {
        player.ready = false;
        this.store.savePlayer(player);
      }
  }
  private stopLoop(): void {
    if (this.loop !== null) clearInterval(this.loop);
    this.loop = null;
  }
  private saveRoom(): void {
    if (this.data) this.store.saveRoom(this.data);
  }
  private async scheduleAlarm(): Promise<void> {
    const deadlines: number[] = [];
    if (this.data?.emptySince !== null && this.data)
      deadlines.push(this.data.emptySince + EMPTY_ROOM_MS);
    for (const player of this.players.values())
      if (player.disconnectedAt !== null)
        deadlines.push(player.disconnectedAt + RECONNECT_MS);
    for (const ws of this.sockets.values()) {
      const attachment = this.attachment(ws);
      if (attachment && !attachment.playerId)
        deadlines.push(attachment.openedAt + JOIN_TIMEOUT_MS);
    }
    if (deadlines.length)
      await this.ctx.storage.setAlarm(
        Math.max(Date.now() + 1, Math.min(...deadlines)),
      );
    else await this.ctx.storage.deleteAlarm();
  }
  private attachment(ws: WebSocket): SocketData | null {
    const parsed = socketDataSchema.safeParse(
      ws.deserializeAttachment() as unknown,
    );
    return parsed.success ? parsed.data : null;
  }
  private view(): RoomView {
    const data = this.data!;
    return {
      code: data.code,
      hostId: data.hostId,
      mode: 'campaign',
      selectedLevel: data.selectedLevel,
      locked: data.locked,
      phase: data.phase,
      results: data.results,
      notice: data.notice,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        nickname: player.nickname,
        skin: player.skin,
        color: player.color,
        ready: player.ready,
        connected: player.connectionId !== null,
        joinedAt: player.joinedAt,
        reconnectUntil:
          player.disconnectedAt === null
            ? null
            : player.disconnectedAt + RECONNECT_MS,
        buttons: this.game?.state.assignments[player.id] ?? [],
      })),
    };
  }
  private broadcastRoom(): void {
    if (this.data) this.broadcast({ type: 'room', room: this.view() });
  }
  private broadcast(message: ServerMessage): void {
    for (const player of this.players.values()) {
      const ws = player.connectionId
        ? this.sockets.get(player.connectionId)
        : undefined;
      if (ws) this.send(ws, message);
    }
  }
  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* close/error handler owns presence */
    }
  }
  private error(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }
}
