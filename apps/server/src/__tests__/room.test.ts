import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evictDurableObject,
  reset,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
import { digest } from '../security.js';
import {
  connections,
  createRoom,
  env,
  inspect,
  join,
  request,
  socket,
  start,
  stub,
} from './helpers.js';

let now: number;
beforeEach(() => {
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(async () => {
  for (const ws of connections.splice(0)) {
    try {
      ws.close(1000, 'Test complete');
    } catch {
      /* already closed */
    }
  }
  await reset();
  vi.restoreAllMocks();
});

describe('worker routes and room claims', () => {
  it('serializes concurrent IP attempts and keeps recent attempts when an old alarm fires', async () => {
    const gate = env.JOIN_GATES.get(
      env.JOIN_GATES.idFromName(await digest('concurrent')),
    );
    const outcomes = await Promise.all(
      Array.from({ length: 11 }, () => gate.take()),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(10);
    now += 30_000;
    await runDurableObjectAlarm(gate);
    expect(await gate.take()).toBe(false);
    now += 30_000;
    expect(await gate.take()).toBe(true);
    await runDurableObjectAlarm(gate);
    expect(
      await runInDurableObject(gate, (_instance, ctx) =>
        ctx.storage.get<number[]>('attempts'),
      ),
    ).toEqual([now]);
  });
  it('retries a code collision through POST /rooms and bounds allocation failures', async () => {
    await stub('AAAAA').claim('AAAAA');
    const random = vi.spyOn(crypto, 'getRandomValues');
    random.mockImplementationOnce((array) => {
      if (array instanceof Uint8Array) array.fill(0);
      return array;
    });
    random.mockImplementationOnce((array) => {
      if (array instanceof Uint8Array) array.fill(1);
      return array;
    });
    expect(await createRoom()).toBe('BBBBB');
    random.mockImplementation((array) => {
      if (array instanceof Uint8Array) array.fill(0);
      return array;
    });
    expect((await request('/rooms', { method: 'POST' })).status).toBe(503);
  });
  it('claims independent codes atomically and rejects an active code collision', async () => {
    const code = await createRoom();
    expect(await stub(code).claim(code)).toBe(false);
    expect(await stub('AAAAA').claim('BBBBB')).toBe(false);
    expect(await stub('AAAAA').claim('AAAAA')).toBe(true);
    expect(await inspect(code, (room) => room.data?.code)).toBe(code);
  });
  it('returns clear errors for wrong codes, malformed codes, missing upgrade and malformed create JSON', async () => {
    expect(
      (
        await request('/rooms/ZZZZZ/ws', {
          headers: { Upgrade: 'websocket', 'CF-Connecting-IP': 'wrong' },
        })
      ).status,
    ).toBe(404);
    expect(
      (await request('/rooms/00000/ws', { headers: { Upgrade: 'websocket' } }))
        .status,
    ).toBe(400);
    expect((await request('/rooms/AAAAA/ws')).status).toBe(426);
    expect(
      (await request('/rooms', { method: 'POST', body: '{' })).status,
    ).toBe(400);
    expect(
      (
        await request('/rooms', {
          method: 'POST',
          body: JSON.stringify({ mode: 'crowd' }),
        })
      ).status,
    ).toBe(400);
    expect(
      (await request('/rooms', { method: 'POST', body: 'x'.repeat(1025) }))
        .status,
    ).toBe(400);
  });
  it('enforces ten join attempts per IP across different codes', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < 10; i++)
      expect(
        (
          await request(`/rooms/${i % 2 ? 'AAAAA' : 'BBBBB'}/ws`, {
            headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
          })
        ).status,
      ).toBe(404);
    expect(
      (
        await request('/rooms/CCCCC/ws', {
          headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
        })
      ).status,
    ).toBe(429);
    now += 60_000;
    expect(
      (
        await request('/rooms/CCCCC/ws', {
          headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
        })
      ).status,
    ).toBe(404);
    const other = env.JOIN_GATES.get(
      env.JOIN_GATES.idFromName(await digest('other')),
    );
    expect(await other.take()).toBe(true);
  });
});

describe('join and idle hibernation', () => {
  it('recovers a lost live instance to the lobby without persisting game state', async () => {
    const code = await createRoom();
    const { a } = await start(code);
    // Simulate deployment cancelling callbacks before discarding the instance.
    // A normal live interval intentionally prevents graceful hibernation.
    await inspect(code, (room) => {
      if (room.loop !== null) clearInterval(room.loop);
      room.loop = null;
    });
    await evictDurableObject(stub(code));
    await a.peer.barrier();
    expect(
      await inspect(code, (room) => ({
        game: room.game,
        loop: room.loop,
        phase: room.data?.phase,
      })),
    ).toEqual({ game: null, loop: null, phase: 'lobby' });
    expect(await inspect(code, (room) => room.data?.notice)).toContain(
      'interrupted',
    );
  });
  it('reconciles saved connections with actual socket attachments on wake-up', async () => {
    const code = await createRoom();
    const a = await join(code, 'A');
    // Simulate a saved connected record whose transport did not survive a restart.
    await inspect(code, (room, ctx) => {
      const player = {
        ...room.players.get(a.welcome.playerId)!,
        connectionId: crypto.randomUUID(),
      };
      ctx.storage.sql.exec(
        'UPDATE players SET data = ? WHERE id = ?',
        JSON.stringify(player),
        player.id,
      );
    });
    await evictDurableObject(stub(code));
    expect(
      await inspect(
        code,
        (room) => room.players.get(a.welcome.playerId)?.connectionId,
      ),
    ).toBeNull();
    expect(await inspect(code, (room) => room.data?.hostId)).toBeNull();
    const returned = await join(code, 'A', a.welcome.reconnectToken);
    expect(returned.welcome.playerId).toBe(a.welcome.playerId);
    expect(returned.welcome.room.hostId).toBe(a.welcome.playerId);
  });
  it('records only one player when a socket sends concurrent join messages', async () => {
    const code = await createRoom();
    const peer = await socket(code);
    const message = {
      type: 'join',
      code,
      nickname: 'Mash',
      skin: 'spud',
    } as const;
    peer.send(message);
    peer.send(message);
    await peer.take('welcome');
    expect((await peer.take('error')).code).toBe('ALREADY_JOINED');
    expect(await inspect(code, (room) => room.players.size)).toBe(1);
  });
  it('restores a disconnected player and hashed token from SQLite after lobby hibernation', async () => {
    const code = await createRoom();
    const a = await join(code, 'A');
    const b = await join(code, 'B');
    a.peer.ws.close(1000, 'Lost network');
    await b.peer.take(
      'room',
      (message) => message.room.hostId === b.welcome.playerId,
    );
    await evictDurableObject(stub(code));
    now += 20_000;
    const returned = await join(code, 'A', a.welcome.reconnectToken);
    expect(returned.welcome.playerId).toBe(a.welcome.playerId);
    expect(returned.welcome.room.players).toHaveLength(2);
    expect(
      await inspect(
        code,
        (room) => room.players.get(a.welcome.playerId)?.tokenHash,
      ),
    ).not.toBe(a.welcome.reconnectToken);
  });
  it('drops binary and over-1-KB UTF-8 frames without affecting the next valid message', async () => {
    const code = await createRoom();
    const peer = await socket(code);
    peer.ws.send(new Uint8Array([1, 2, 3]).buffer);
    peer.ws.send(
      JSON.stringify({ type: 'join', code, nickname: '世'.repeat(400) }),
    );
    peer.send({ type: 'join', code, nickname: 'Mash', skin: 'spud' });
    expect((await peer.take('welcome')).room.players).toHaveLength(1);
    expect(peer.messages.some((message) => message.type === 'error')).toBe(
      false,
    );
  });
  it('expires unauthenticated sockets after ten seconds without idle timers', async () => {
    const code = await createRoom();
    const peer = await socket(code);
    expect(await inspect(code, (room) => room.loop)).toBeNull();
    now += 10_000;
    await runDurableObjectAlarm(stub(code));
    expect((await peer.take('error')).code).toBe('JOIN_TIMEOUT');
  });
  it('joins two players by code and restores lobby, host, readiness and per-socket identity after eviction', async () => {
    const code = await createRoom();
    const a = await join(code, 'Alice');
    const b = await join(code, 'Bob');
    expect(b.welcome.room.players).toHaveLength(2);
    expect(b.welcome.room.hostId).toBe(a.welcome.playerId);
    a.peer.send({ type: 'ready', ready: true });
    await a.peer.barrier();
    expect(
      await inspect(code, (_room, ctx) => ctx.storage.getAlarm()),
    ).toBeNull();
    await evictDurableObject(stub(code));
    await a.peer.barrier();
    await b.peer.barrier();
    expect(
      await inspect(code, (room) => ({
        players: room.players.size,
        host: room.data?.hostId,
        loop: room.loop,
        ready: room.players.get(a.welcome.playerId)?.ready,
      })),
    ).toEqual({
      players: 2,
      host: a.welcome.playerId,
      loop: null,
      ready: true,
    });
  });
  it('rejects an eleventh player, reserves disconnected seats during grace and allows reconnect into a full room', async () => {
    const code = await createRoom();
    const first = await join(code, 'First');
    for (let i = 1; i < 10; i++) await join(code, `Mash ${i}`);
    const extra = await socket(code);
    extra.send({ type: 'join', code, nickname: 'Eleventh', skin: 'spud' });
    expect((await extra.take('error')).code).toBe('ROOM_FULL');
    const returned = await join(code, 'First', first.welcome.reconnectToken);
    expect(returned.welcome.playerId).toBe(first.welcome.playerId);
    expect(returned.welcome.room.players).toHaveLength(10);
  });
  it('rejects mismatched join codes, invalid names, arbitrary state payloads and unauthenticated actions', async () => {
    const code = await createRoom();
    const peer = await socket(code);
    peer.send({ type: 'ping', timestamp: now });
    expect((await peer.take('error')).code).toBe('JOIN_REQUIRED');
    peer.send({
      type: 'join',
      code: code === 'AAAAA' ? 'BBBBB' : 'AAAAA',
      nickname: 'Mash',
      skin: 'spud',
    });
    expect((await peer.take('error')).code).toBe('WRONG_ROOM');
    for (const nickname of ['F.u.c.k', 'मादरचोद', 'chutiya']) {
      peer.send({ type: 'join', code, nickname, skin: 'spud' });
      expect((await peer.take('error')).code).toBe('INVALID_NAME');
    }
    peer.ws.send(
      JSON.stringify({
        type: 'press',
        button: 'RIGHT',
        seq: 0,
        position: [7, 3],
      }),
    );
    expect((await peer.take('error')).code).toBe('INVALID_MESSAGE');
  });
});

describe('authoritative presses and host actions', () => {
  it('requires two ready players, validates level selection, and supports room locking and kicking', async () => {
    const code = await createRoom();
    const a = await join(code, 'A');
    a.peer.send({ type: 'host', action: 'start' });
    expect((await a.peer.take('error')).code).toBe('NOT_READY');
    a.peer.send({ type: 'host', action: 'pickLevel', levelId: '5-10' });
    expect((await a.peer.take('error')).code).toBe('INVALID_LEVEL');
    a.peer.send({ type: 'host', action: 'pickLevel', levelId: '2-1' });
    await a.peer.barrier();
    expect(await inspect(code, (room) => room.data?.selectedLevel)).toBe('2-1');
    a.peer.send({ type: 'host', action: 'lock', locked: true });
    await a.peer.barrier();
    const blocked = await socket(code);
    blocked.send({ type: 'join', code, nickname: 'B', skin: 'spud' });
    expect((await blocked.take('error')).code).toBe('ROOM_LOCKED');
    a.peer.send({ type: 'host', action: 'lock', locked: false });
    await a.peer.barrier();
    const b = await join(code, 'B');
    a.peer.send({ type: 'host', action: 'kick', playerId: b.welcome.playerId });
    await a.peer.barrier();
    expect(await inspect(code, (room) => room.players.size)).toBe(1);
    const kicked = await socket(code);
    kicked.send({
      type: 'join',
      code,
      nickname: 'B',
      skin: 'spud',
      reconnectToken: b.welcome.reconnectToken,
    });
    expect((await kicked.take('error')).code).toBe('RECONNECT_EXPIRED');
  });
  it('retains the per-player rolling press limit across a reconnect', async () => {
    const code = await createRoom();
    const { a, b, level } = await start(code);
    const member = level.assignments[a.welcome.playerId]!.includes('RIGHT')
      ? a
      : b;
    for (let seq = 0; seq < 15; seq++)
      member.peer.send({ type: 'press', button: 'RIGHT', seq });
    await member.peer.barrier();
    const returned = await join(
      code,
      member.welcome.room.players.find(
        (player) => player.id === member.welcome.playerId,
      )!.nickname,
      member.welcome.reconnectToken,
    );
    expect(returned.welcome.nextSeq).toBe(15);
    returned.peer.send({ type: 'press', button: 'RIGHT', seq: 15 });
    expect((await returned.peer.take('error')).code).toBe('PRESS_LIMIT');
  });
  it('runs slicer deaths and checkpoint respawns through the shared engine', async () => {
    const code = await createRoom();
    const a = await join(code, 'A');
    const b = await join(code, 'B');
    a.peer.send({ type: 'host', action: 'pickLevel', levelId: '2-1' });
    await a.peer.barrier();
    a.peer.send({ type: 'ready', ready: true });
    b.peer.send({ type: 'ready', ready: true });
    await a.peer.barrier();
    await b.peer.barrier();
    a.peer.send({ type: 'host', action: 'start' });
    const level = await a.peer.take('levelStart');
    const right = level.assignments[a.welcome.playerId]!.includes('RIGHT')
      ? a.peer
      : b.peer;
    for (let seq = 0; seq < 4; seq++) {
      right.send({ type: 'press', button: 'RIGHT', seq });
      await right.barrier();
      now += 150;
      await inspect(code, (room) => room.tick());
    }
    expect(
      (await a.peer.take('event', (message) => message.event.type === 'death'))
        .event,
    ).toMatchObject({ t: 600, at: [5, 1] });
    now += 1500;
    await inspect(code, (room) => room.tick());
    expect(await inspect(code, (room) => room.game!.state.position)).toEqual([
      3, 1,
    ]);
    for (let seq = 4; seq < 8; seq++) {
      right.send({ type: 'press', button: 'RIGHT', seq });
      await right.barrier();
      now += 150;
      await inspect(code, (room) => room.tick());
    }
    expect((await a.peer.take('results')).results.deaths).toBe(1);
  });
  it('requires host permissions and readiness; starts a 10 Hz loop and rejects unowned buttons', async () => {
    const code = await createRoom();
    const { a, b, level } = await start(code);
    expect(await inspect(code, (room) => room.loop !== null)).toBe(true);
    b.peer.send({ type: 'host', action: 'lock', locked: true });
    expect((await b.peer.take('error')).code).toBe('HOST_ONLY');
    const unowned = ['UP', 'RIGHT'].find(
      (button) =>
        !level.assignments[a.welcome.playerId]!.includes(
          button as 'UP' | 'RIGHT',
        ),
    ) as 'UP' | 'RIGHT';
    a.peer.send({ type: 'press', button: unowned, seq: 0 });
    expect((await a.peer.take('error')).code).toBe('NOT_YOUR_BUTTON');
    expect(await inspect(code, (room) => room.game?.state.position)).toEqual([
      1, 1,
    ]);
    const right = level.assignments[a.welcome.playerId]!.includes('RIGHT')
      ? a
      : b;
    right.peer.send({ type: 'press', button: 'RIGHT', seq: 1 });
    await right.peer.barrier();
    now += 150;
    await inspect(code, (room) => room.tick());
    expect(await inspect(code, (room) => room.game?.state.position)).toEqual([
      2, 1,
    ]);
  });
  it('drops presses above fifteen per rolling second and rejects replayed sequence numbers', async () => {
    const code = await createRoom();
    const { a, b, level } = await start(code);
    const peer = level.assignments[a.welcome.playerId]!.includes('RIGHT')
      ? a.peer
      : b.peer;
    for (let seq = 0; seq < 15; seq++)
      peer.send({ type: 'press', button: 'RIGHT', seq });
    await peer.barrier();
    peer.send({ type: 'press', button: 'RIGHT', seq: 15 });
    expect((await peer.take('error')).code).toBe('PRESS_LIMIT');
    peer.send({ type: 'press', button: 'RIGHT', seq: 14 });
    expect((await peer.take('error')).code).toBe('STALE_PRESS');
    expect(
      await inspect(code, (room) =>
        Object.values(room.game!.state.stats).reduce(
          (sum, stats) => sum + stats.presses,
          0,
        ),
      ),
    ).toBe(15);
    now += 1000;
    peer.send({ type: 'press', button: 'RIGHT', seq: 16 });
    await peer.barrier();
    expect(
      await inspect(code, (room) =>
        Object.values(room.game!.state.stats).reduce(
          (sum, stats) => sum + stats.presses,
          0,
        ),
      ),
    ).toBe(16);
  });
  it('never writes SQLite on presses or ticks, finishes via the engine and restores results after hibernation', async () => {
    const code = await createRoom();
    const { a, b, level } = await start(code);
    const before = await inspect(
      code,
      (_room, ctx) =>
        ctx.storage.sql
          .exec<{ total: number }>('SELECT total_changes() AS total')
          .one().total,
    );
    let seq = 0;
    const route = [
      'RIGHT',
      'RIGHT',
      'RIGHT',
      'DOWN',
      'DOWN',
      'RIGHT',
      'RIGHT',
      'RIGHT',
    ] as const;
    for (const button of route.slice(0, -1)) {
      const member = level.assignments[a.welcome.playerId]!.includes(button)
        ? a
        : b;
      member.peer.send({ type: 'press', button, seq: seq++ });
      await member.peer.barrier();
      now += 150;
      await inspect(code, (room) => room.tick());
    }
    const during = await inspect(
      code,
      (_room, ctx) =>
        ctx.storage.sql
          .exec<{ total: number }>('SELECT total_changes() AS total')
          .one().total,
    );
    expect(during).toBe(before);
    const last = level.assignments[a.welcome.playerId]!.includes('RIGHT')
      ? a
      : b;
    last.peer.send({ type: 'press', button: 'RIGHT', seq });
    await last.peer.barrier();
    now += 150;
    await inspect(code, (room) => room.tick());
    const result = await a.peer.take('results');
    expect(result.results).toMatchObject({ deaths: 0, stars: 3, timeMs: 1200 });
    expect(
      await inspect(code, (room) => ({
        loop: room.loop,
        game: room.game,
        phase: room.data?.phase,
      })),
    ).toEqual({ loop: null, game: null, phase: 'results' });
    await evictDurableObject(stub(code));
    await a.peer.barrier();
    expect(await inspect(code, (room) => room.data?.results)).toEqual(
      result.results,
    );
  });
});

describe('reconnect, host migration and cleanup', () => {
  it('preserves identity and buttons when a player returns within sixty seconds', async () => {
    const code = await createRoom();
    const { a, b, level } = await start(code);
    a.peer.ws.close(1000, 'Disconnected');
    await b.peer.take('room', (message) =>
      message.room.players.some(
        (player) => player.id === a.welcome.playerId && !player.connected,
      ),
    );
    now += 59_999;
    const returned = await join(code, 'Alice', a.welcome.reconnectToken);
    expect(returned.welcome.playerId).toBe(a.welcome.playerId);
    const resume = await returned.peer.take('levelStart');
    expect(resume.assignments[a.welcome.playerId]).toEqual(
      level.assignments[a.welcome.playerId],
    );
    expect(returned.welcome.room.hostId).toBe(b.welcome.playerId);
  });
  it('expires missing players, redistributes their buttons, and rejects stale reconnect tokens', async () => {
    const code = await createRoom();
    const { a, b } = await start(code);
    a.peer.ws.close(1000, 'Disconnected');
    await b.peer.take(
      'room',
      (message) => message.room.hostId === b.welcome.playerId,
    );
    now += 60_000;
    expect(await runDurableObjectAlarm(stub(code))).toBe(true);
    expect(
      await inspect(code, (room) => room.players.has(a.welcome.playerId)),
    ).toBe(false);
    expect(
      await inspect(
        code,
        (room) => room.game!.state.assignments[b.welcome.playerId]!.length,
      ),
    ).toBe(5);
    const old = await socket(code);
    old.send({
      type: 'join',
      code,
      nickname: 'Alice',
      skin: 'spud',
      reconnectToken: a.welcome.reconnectToken,
    });
    expect((await old.take('error')).code).toBe('RECONNECT_EXPIRED');
    const route = [
      'RIGHT',
      'RIGHT',
      'RIGHT',
      'DOWN',
      'DOWN',
      'RIGHT',
      'RIGHT',
      'RIGHT',
    ] as const;
    for (const [seq, button] of route.entries()) {
      b.peer.send({ type: 'press', button, seq });
      await b.peer.barrier();
      now += 150;
      await inspect(code, (room) => room.tick());
    }
    const results = await b.peer.take('results');
    expect(results.results.players.map((player) => player.id)).toContain(
      a.welcome.playerId,
    );
  });
  it('moves host immediately to the longest-present connected player', async () => {
    const code = await createRoom();
    const a = await join(code, 'A');
    now++;
    const b = await join(code, 'B');
    now++;
    const c = await join(code, 'C');
    a.peer.ws.close(1000, 'Host left');
    const changed = await c.peer.take(
      'room',
      (message) => message.room.hostId === b.welcome.playerId,
    );
    expect(
      changed.room.players.find((player) => player.id === a.welcome.playerId)
        ?.connected,
    ).toBe(false);
  });
  it('stops gameplay when everyone leaves and deletes room data after fifteen minutes', async () => {
    const code = await createRoom();
    const { a, b } = await start(code);
    a.peer.ws.close(1000, 'Left');
    await b.peer.take(
      'room',
      (message) => message.room.hostId === b.welcome.playerId,
    );
    b.peer.ws.close(1000, 'Left');
    // Wait for the final close handler through a test-only room callback.
    await vi.waitFor(async () =>
      expect(await inspect(code, (room) => room.loop)).toBeNull(),
    );
    expect(await inspect(code, (room) => room.game)).toBeNull();
    now += 60_000;
    await runDurableObjectAlarm(stub(code));
    expect(await inspect(code, (room) => room.players.size)).toBe(0);
    now += 14 * 60_000;
    await runDurableObjectAlarm(stub(code));
    expect(await inspect(code, (room) => room.data)).toBeNull();
    expect(
      await inspect(
        code,
        (_room, ctx) =>
          ctx.storage.sql
            .exec<{ count: number }>('SELECT count(*) AS count FROM players')
            .one().count,
      ),
    ).toBe(0);
    expect(await stub(code).claim(code)).toBe(true);
  });
});
