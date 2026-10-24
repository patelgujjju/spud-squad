import { nicknameSchema, roomCodeSchema } from '@spud-squad/shared';
export interface Profile {
  nickname: string;
  muted: boolean;
}
export interface Session {
  code: string;
  token: string;
  nickname: string;
  seenAt: number;
}
export function getProfile(): Profile {
  const fallback = {
    nickname: `Soggy Mash ${crypto.getRandomValues(new Uint8Array(1))[0]! % 100}`,
    muted: false,
  };
  try {
    const value = JSON.parse(
      localStorage.getItem('spud.profile') ?? 'null',
    ) as unknown;
    if (
      value &&
      typeof value === 'object' &&
      'nickname' in value &&
      nicknameSchema.safeParse(value.nickname).success
    ) {
      return {
        nickname: String(value.nickname),
        muted: 'muted' in value && value.muted === true,
      };
    }
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  return fallback;
}
export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem('spud.profile', JSON.stringify(profile));
  } catch {
    /* optional */
  }
}
export function getSession(): Session | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem('spud.room') ?? 'null',
    ) as Partial<Session> | null;
    if (
      value &&
      roomCodeSchema.safeParse(value.code).success &&
      typeof value.token === 'string' &&
      typeof value.nickname === 'string' &&
      typeof value.seenAt === 'number' &&
      Date.now() - value.seenAt < 60_000
    )
      return value as Session;
  } catch {
    /* optional */
  }
  return null;
}
export function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem('spud.room', JSON.stringify(session));
    else sessionStorage.removeItem('spud.room');
  } catch {
    /* optional */
  }
}
