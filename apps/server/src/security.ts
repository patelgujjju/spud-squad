import { ROOM_ALPHABET } from '@spud-squad/shared';

export const MAX_MESSAGE_BYTES = 1024;
export function generateCode(): string {
  // Rejection sampling avoids modulo bias for the allowed alphabet.
  const limit = 256 - (256 % ROOM_ALPHABET.length);
  let code = '';
  while (code.length < 5) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    for (const byte of bytes) {
      if (byte < limit && code.length < 5)
        code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
    }
  }
  return code;
}
export async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
export async function readSmallJson(request: Request): Promise<unknown> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_MESSAGE_BYTES) {
      await reader.cancel();
      throw new Error('Request exceeds 1 KB');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return size ? (JSON.parse(new TextDecoder().decode(bytes)) as unknown) : {};
}
