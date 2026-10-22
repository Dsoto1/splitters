import { PROTOCOL_VERSION, type ClientMessage, type PlayerInput, type ServerMessage } from '@chronosplit/shared';

/** WebSocket connection to the dedicated server, with RTT measurement. */
export class Connection {
  private readonly ws: WebSocket;
  private pingId = 0;
  private pingTimer?: number;
  rttMs = 0;
  bytesIn = 0;

  constructor(
    url: string,
    name: string,
    private readonly onMessage: (m: ServerMessage) => void,
    onClose: (reason: string) => void,
  ) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name });
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: ++this.pingId, ct: performance.now() }), 1000);
    });
    this.ws.addEventListener('message', (e) => {
      const text = e.data as string;
      this.bytesIn += text.length;
      const msg = JSON.parse(text) as ServerMessage;
      if (msg.t === 'pong') {
        const sample = performance.now() - msg.ct;
        this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
        return;
      }
      this.onMessage(msg);
    });
    this.ws.addEventListener('close', (e) => {
      clearInterval(this.pingTimer);
      onClose(e.reason || (e.code === 1006 ? 'could not reach server' : `closed (${e.code})`));
    });
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  private send(m: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}
