/** M1 has no ad SDK or ad requests. Future placements have this single boundary. */
export function betweenLevels(): Promise<void> {
  return Promise.resolve();
}
