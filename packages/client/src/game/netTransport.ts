import { PROTOCOL_VERSION, type ClientMessage, type PlayerInput, type ServerMessage } from '@tiletrigger/shared';
import type { Transport } from './transport.ts';

/** WebSocket connection to the dedicated server, with RTT measurement. */
export class NetTransport implements Transport {
  private ws?: WebSocket;
  private pingId = 0;
  private pingTimer?: number;
  private closedByUs = false;
  rttMs = 0;
  bytesIn = 0;

  constructor(
    private readonly url: string,
    private readonly name: string,
    private readonly look?: string,
  ) {}

  get label(): string {
    return this.url;
  }

  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, look: this.look });
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: ++this.pingId, ct: performance.now() }), 1000);
    });
    ws.addEventListener('message', (e) => {
      const text = e.data as string;
      this.bytesIn += text.length;
      const msg = JSON.parse(text) as ServerMessage;
      if (msg.t === 'pong') {
        const sample = performance.now() - msg.ct;
        this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
        return;
      }
      onMessage(msg);
    });
    ws.addEventListener('close', (e) => {
      clearInterval(this.pingTimer);
      if (!this.closedByUs) onClose(e.reason || (e.code === 1006 ? 'could not reach server' : `closed (${e.code})`));
    });
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  sendReady(): void {
    this.send({ t: 'ready' });
  }

  close(): void {
    this.closedByUs = true;
    clearInterval(this.pingTimer);
    this.ws?.close();
  }

  private send(m: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}
