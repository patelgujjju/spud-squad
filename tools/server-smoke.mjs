import { setTimeout as delay } from 'node:timers/promises';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8787');
const created = await fetch(new URL('/rooms', origin), { method: 'POST' });
if (!created.ok) throw new Error(`Create failed: ${created.status}`);
const { code } = await created.json();
const sockets = [];

async function join(nickname) {
  const url = new URL(`/rooms/${code}/ws`, origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(url);
  sockets.push(ws);
  const queue = [];
  const waiters = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.type === 'error') console.error(message);
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
    else queue.push(message);
  });
  const take = (type) => {
    const index = queue.findIndex((message) => message.type === type);
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return new Promise((resolve) => waiters.push({ type, resolve }));
  };
  const send = (message) => ws.send(JSON.stringify(message));
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  send({ type: 'join', code, nickname, skin: 'spud' });
  const welcome = await take('welcome');
  return { send, take, welcome };
}

const timeout = setTimeout(() => {
  console.error('Server smoke test timed out');
  process.exit(1);
}, 15_000);
try {
  const a = await join('Smoke A');
  const b = await join('Smoke B');
  for (const peer of [a, b]) {
    peer.send({ type: 'ready', ready: true });
    peer.send({ type: 'ping', timestamp: Date.now() });
    await peer.take('pong');
  }
  a.send({ type: 'host', action: 'start' });
  const level = await a.take('levelStart');
  let seq = 0;
  for (const button of [
    'RIGHT',
    'RIGHT',
    'RIGHT',
    'DOWN',
    'DOWN',
    'RIGHT',
    'RIGHT',
    'RIGHT',
  ]) {
    const peer = level.assignments[a.welcome.playerId].includes(button) ? a : b;
    peer.send({ type: 'press', button, seq: seq++ });
    await delay(220);
  }
  const { results } = await a.take('results');
  if (results.deaths !== 0 || results.stars !== 3)
    throw new Error('Unexpected result');
  console.log(
    `Room ${code}: two WebSocket players finished 1-1 in ${results.timeMs} ms, ${results.stars} stars.`,
  );
} finally {
  clearTimeout(timeout);
  await Promise.all(
    sockets.map(
      (ws) =>
        new Promise((resolve, reject) => {
          if (ws.readyState === WebSocket.CLOSED) {
            resolve();
            return;
          }
          const closing = setTimeout(
            () => reject(new Error('WebSocket close handshake timed out')),
            2000,
          );
          ws.addEventListener(
            'close',
            () => {
              clearTimeout(closing);
              resolve();
            },
            { once: true },
          );
          ws.close();
        }),
    ),
  );
}
