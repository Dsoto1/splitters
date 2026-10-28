import { PROTOCOL_VERSION, SnapshotDecoder, type ClientMessage, type PlayerInput, type ServerMessage } from '@tiletrigger/shared';
import type { Transport } from './transport.ts';
import { SnapshotCoalescer } from './snapshotMerge.ts';
import { playerKey } from './playerKey.ts';

const ADMIN_KEY = 'tiletrigger.admin.';

/** The admin token this tab uses on `url`: ?admin=… in the page address, else the one entered in the pause menu. */
export function adminToken(url: string): string | undefined {
  const fromPage = new URLSearchParams(location.search).get('admin');
  if (fromPage) return fromPage;
  try {
    return sessionStorage.getItem(ADMIN_KEY + url) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remember an admin token for `url` in this tab, so a map change (reconnect) keeps you admin. */
export function rememberAdminToken(url: string, token: string): void {
  try {
    sessionStorage.setItem(ADMIN_KEY + url, token);
  } catch {
    // Private windows: lasts until the next reconnect.
  }
}

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
    // A page that falls behind (a long frame, a slow machine with 96 players in view) handles the snapshots waiting for it as one.
    const snapshots = (this.snapshots = new SnapshotCoalescer((m) => !this.closedByUs && onMessage(m)));
    const players = new SnapshotDecoder();
    ws.addEventListener('open', () => {
      const admin = adminToken(this.url);
      this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, look: this.look, pk: playerKey(), ...(admin ? { admin } : {}) });
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', id: ++this.pingId, ct: performance.now(), ...(this.rttMs ? { rtt: Math.round(this.rttMs) } : {}) }), 1000);
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
      if (msg.t === 'snapshot') players.snapshot(msg);
      snapshots.push(msg);
    });
    ws.addEventListener('close', (e) => {
      clearInterval(this.pingTimer);
      snapshots.flush();
      if (!this.closedByUs) onClose(e.reason || (e.code === 1006 ? 'could not reach server' : `closed (${e.code})`));
    });
  }

  private snapshots?: SnapshotCoalescer;

  flush(): void {
    this.snapshots?.flush();
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.send({ t: 'input', inputs });
  }

  sendReady(): void {
    this.send({ t: 'ready' });
  }

  sendCommand(msg: Extract<ClientMessage, { t: 'host' | 'admin' }>): void {
    if (msg.t === 'admin') rememberAdminToken(this.url, msg.token);
    this.send(msg);
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
