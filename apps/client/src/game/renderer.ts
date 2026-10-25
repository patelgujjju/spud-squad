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
  ): void | Promise<void>;
  setPlayers(players: PlayerView[]): void;
  setState(state: SpudView): void;
  event(event: GameEvent): void;
  visibility(): void;
  skipIntro?(): void;
  setOverview?(active: boolean): void;
  destroy(): void;
}
export interface RendererContext {
  host: HTMLElement;
  clock: ServerClock;
  audio: GameAudio;
}
export async function createRenderer(
  context: RendererContext,
  levelId = '1-1',
): Promise<GameRenderer> {
  if (levelId === '1-1' || levelId === '2-1') {
    const { FactoryRenderer } = await import('./factory/renderer.js');
    return new FactoryRenderer(context);
  }
  const { ThreeLevelRenderer } = await import('./three/renderer.js');
  return new ThreeLevelRenderer(context);
}
