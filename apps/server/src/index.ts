import { z } from 'zod';
import { roomCodeSchema } from '@spud-squad/shared';
import type { Env } from './env.js';
import { digest, generateCode, readSmallJson } from './security.js';
export { Room } from './room.js';
export { JoinGate } from './joinGate.js';

const createSchema = z.strictObject({ mode: z.literal('campaign').optional() });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET')
      return Response.json({ ok: true });
    if (url.pathname === '/rooms' && request.method === 'POST') {
      try {
        if (!createSchema.safeParse(await readSmallJson(request)).success)
          return Response.json(
            { error: 'Invalid room settings' },
            { status: 400 },
          );
      } catch {
        return Response.json(
          { error: 'Invalid JSON or request exceeds 1 KB' },
          { status: 400 },
        );
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await room.claim(code))
          return Response.json({ code }, { status: 201 });
      }
      return Response.json(
        { error: 'Unable to allocate a room; try again' },
        { status: 503 },
      );
    }
    const match = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (match && request.method === 'GET') {
      const parsed = roomCodeSchema.safeParse(match[1]);
      if (!parsed.success)
        return Response.json({ error: 'Invalid room code' }, { status: 400 });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
        return new Response('WebSocket upgrade required', { status: 426 });
      const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
      const guard = env.JOIN_GATES.get(
        env.JOIN_GATES.idFromName(await digest(ip)),
      );
      if (!(await guard.take()))
        return Response.json(
          { error: 'Too many join attempts; try again in a minute' },
          { status: 429, headers: { 'Retry-After': '60' } },
        );
      return env.ROOMS.get(env.ROOMS.idFromName(parsed.data)).fetch(request);
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
