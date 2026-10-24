export class ServerClock {
  private offset = 0;
  private bestRtt = Infinity;
  welcome(serverTime: number): void {
    this.offset = serverTime - Date.now();
    this.bestRtt = Infinity;
  }
  pong(sent: number, serverTime: number): void {
    const received = Date.now();
    const rtt = received - sent;
    if (rtt <= this.bestRtt) {
      this.bestRtt = rtt;
      this.offset = serverTime - (sent + received) / 2;
    }
  }
  now(): number {
    return Date.now() + this.offset;
  }
}
