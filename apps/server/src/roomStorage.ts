import { z } from 'zod';
import type { LevelResults, RoomView } from '@spud-squad/shared';

export interface RoomData {
  code: string;
  hostId: string | null;
  selectedLevel: string;
  locked: boolean;
  phase: RoomView['phase'];
  emptySince: number | null;
  results: LevelResults | null;
  notice: string | null;
}
export interface Player {
  id: string;
  nickname: string;
  skin: 'spud';
  color: number;
  joinedAt: number;
  disconnectedAt: number | null;
  connectionId: string | null;
  ready: boolean;
  tokenHash: string;
}
export const socketDataSchema = z.strictObject({
  connectionId: z.string().uuid(),
  playerId: z.string().nullable(),
  openedAt: z.number(),
  lastSeq: z.number(),
  pressTimes: z.array(z.number()).max(15),
});
export type SocketData = z.infer<typeof socketDataSchema>;

/** No simulation data is accepted by this storage boundary. */
export class RoomStorage {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
    );
  }
  loadRoom(): RoomData | null {
    const row = this.sql
      .exec<{ data: string }>('SELECT data FROM room WHERE id = 1')
      .toArray()[0];
    return row ? (JSON.parse(row.data) as RoomData) : null;
  }
  loadPlayers(): Player[] {
    return this.sql
      .exec<{ data: string }>('SELECT data FROM players ORDER BY rowid')
      .toArray()
      .map((row) => JSON.parse(row.data) as Player);
  }
  saveRoom(room: RoomData): void {
    this.sql.exec(
      'INSERT INTO room (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      JSON.stringify(room),
    );
  }
  savePlayer(player: Player): void {
    this.sql.exec(
      'INSERT INTO players (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      player.id,
      JSON.stringify(player),
    );
  }
  deletePlayer(id: string): void {
    this.sql.exec('DELETE FROM players WHERE id = ?', id);
  }
}
