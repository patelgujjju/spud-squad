import type { Room } from './room.js';
import type { JoinGate } from './joinGate.js';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  JOIN_GATES: DurableObjectNamespace<JoinGate>;
}
