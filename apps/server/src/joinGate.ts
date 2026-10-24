import { DurableObject } from 'cloudflare:workers';

/** One independent guard per hashed IP, with a strict rolling 60-second window. */
export class JoinGate extends DurableObject {
  async take(): Promise<boolean> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const recent = (
        (await this.ctx.storage.get<number[]>('attempts')) ?? []
      ).filter((at) => at > now - 60_000);
      if (recent.length >= 10) return false;
      recent.push(now);
      await this.ctx.storage.put('attempts', recent);
      await this.ctx.storage.setAlarm(now + 60_000);
      return true;
    });
  }
  override async alarm(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const recent = (
        (await this.ctx.storage.get<number[]>('attempts')) ?? []
      ).filter((at) => at > now - 60_000);
      if (recent.length) {
        await this.ctx.storage.put('attempts', recent);
        await this.ctx.storage.setAlarm(recent[recent.length - 1]! + 60_000);
      } else await this.ctx.storage.deleteAll();
    });
  }
}
