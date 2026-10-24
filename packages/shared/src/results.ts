import type { LevelState } from './types.js';

export interface Results {
  timeMs: number;
  deaths: number;
  stars: number;
  awards: {
    fryerFeeder: string[];
    heroPress: string | null;
    buttonMasher: string[];
    asleepAtTheButton: string[];
    cleanHands: string[];
  };
}

export function getResults(state: LevelState): Results {
  if (state.finishedAt === null) throw new Error('Level has not finished');
  const counts = state.playerIds.map((id) => state.stats[id]!.presses);
  const deaths = state.playerIds.map((id) => state.stats[id]!.deathsCaused);
  const fastest =
    state.finishedAt < Math.round(state.level.parSeconds * 1000 * state.factor);
  return {
    timeMs: state.finishedAt,
    deaths: state.deaths,
    stars: 1 + Number(fastest) + Number(fastest && state.goldenChip),
    awards: {
      fryerFeeder: state.playerIds.filter(
        (id) =>
          state.stats[id]!.deathsCaused > 0 &&
          state.stats[id]!.deathsCaused === Math.max(...deaths),
      ),
      heroPress: state.heroId,
      buttonMasher: state.playerIds.filter(
        (id) => state.stats[id]!.presses === Math.max(...counts),
      ),
      asleepAtTheButton: state.playerIds.filter(
        (id) => state.stats[id]!.presses === Math.min(...counts),
      ),
      cleanHands: state.playerIds.filter(
        (id) => state.stats[id]!.deathsCaused === 0,
      ),
    },
  };
}
