import type {
  GameEvent,
  Level,
  PlayerView,
  ServerMessage,
  SpudView,
} from '@spud-squad/shared';
import type { GameAudio } from '../audio.js';
import type { ServerClock } from '../clock.js';

/** Drawing consumes snapshots/events. It never advances or mutates the game. */
export interface GameRenderer {
  init(): Promise<void>;
  setLevel(
    level: Level,
    start: Extract<ServerMessage, { type: 'levelStart' }>,
  ): void;
  setPlayers(players: PlayerView[]): void;
  setState(state: SpudView): void;
  event(event: GameEvent): void;
  visibility(): void;
  destroy(): void;
}
export interface RendererContext {
  host: HTMLElement;
  clock: ServerClock;
  audio: GameAudio;
}
export async function createRenderer(
  context: RendererContext,
): Promise<GameRenderer> {
  const { ThreeLevelRenderer } = await import('./three/renderer.js');
  return new ThreeLevelRenderer(context);
}
