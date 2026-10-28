import { PROTOCOL_VERSION, SnapshotDecoder, type ServerMessage } from '@tiletrigger/shared';
import { Unzipper } from '@tiletrigger/shared/peerZip';
import { PEER_PREFIX, loadPeer } from '../src/hubLink.ts';

/**
 * A player joining a host by join code as the browser does (client/src/game/peerLink.ts
 * PeerTransport: PeerJS through the hub's broker, raw serialization, compressed stream), in Node:
 * for tests and measurements.
 *
 * One difference from a browser, and why. This player's WebRTC is libdatachannel (node-datachannel),
 * and as the offerer it has a race: PeerConnection::setRemoteDescription hands the answer's ICE
 * credentials to the ICE agent first, and records the answer (with the host's certificate fingerprint)
 * only afterwards. If the host already knows this player's address (from the offer), its ICE checks
 * complete in that window on libdatachannel's own threads, DTLS starts, and the certificate check finds
 * no answer yet: "DTLS alert: unknown CA", the connection closed within milliseconds, and the join
 * waits out its 20 s. A busy machine (CI running the whole suite) widens the window. Browsers don't
 * have this race, and the Host Service is always the answerer (it can't be reached before it has
 * recorded the offer), so real players are not affected. This player closes the window: its offer
 * carries no addresses, and it sends its ICE candidates only once the answer is recorded (signaling
 * back to stable), so nothing can reach it before then.
 */

interface PeerConnectionLike {
  signalingState?: string;
  iceGatheringState?: string;
  iceConnectionState?: string;
  connectionState?: string;
  onicecandidate: ((e: unknown) => void) | null;
  addEventListener(type: string, cb: () => void): void;
}

export interface Guest {
  messages: ServerMessage[];
  bytes: number;
  snapshots: number;
  welcome: Extract<ServerMessage, { t: 'welcome' }> | null;
  rejected: string | null;
  closed: boolean;
  send(m: unknown): void;
  close(): void;
}

export interface GuestOptions {
  /** Tests: hold the host's answer this long before applying it (a slow signalling path, or a starved event loop). */
  answerDelayMs?: number;
  /** Tests: each signalling message this player sends (OFFER, CANDIDATE…), with its signaling state then and the SDP it carried. */
  onSignal?: (type: string, signalingState: string | undefined, sdp?: string) => void;
}

/** The offer without its addresses (trickle ICE sends them later). */
export const withoutCandidates = (sdp: string): string =>
  sdp
    .split('\r\n')
    .filter((l) => !l.startsWith('a=candidate:') && l !== 'a=end-of-candidates')
    .join('\r\n');

/** Holds a peer connection's outgoing ICE candidates until the remote answer is applied (signaling back to stable). */
export function holdCandidatesUntilAnswered(pc: PeerConnectionLike): void {
  const send = pc.onicecandidate;
  const held: unknown[] = [];
  let answered = false;
  pc.onicecandidate = (e) => (answered ? send?.(e) : held.push(e));
  pc.addEventListener('signalingstatechange', () => {
    if (answered || pc.signalingState !== 'stable') return;
    answered = true;
    for (const e of held.splice(0)) send?.(e);
  });
}

/** The offers this peer sends go without addresses (PeerJS's own sdpTransform can't: the polyfill's description is read-only). */
function offerWithoutCandidates(peer: unknown, signalingState: () => string | undefined, onSignal?: GuestOptions['onSignal']): void {
  const socket = (peer as { socket: { send(m: { type?: string; payload?: { sdp?: { type: string; sdp: string } } }): void } }).socket;
  const send = socket.send.bind(socket);
  socket.send = (m) => {
    const d = m.type === 'OFFER' ? m.payload?.sdp : undefined;
    const out = d ? { ...m, payload: { ...m.payload, sdp: { type: d.type, sdp: withoutCandidates(d.sdp) } } } : m;
    if (m.type && m.type !== 'HEARTBEAT') onSignal?.(m.type, signalingState(), out.payload?.sdp?.sdp);
    send(out);
  };
}

export async function joinAsGuest(hub: string, code: string, name: string, extra: Record<string, unknown> = {}, o: GuestOptions = {}): Promise<Guest> {
  const { Peer } = await loadPeer();
  const u = new URL(hub);
  const peer = new Peer({ host: u.hostname, port: Number(u.port || 80), path: '/broker', secure: false, debug: 0, config: { iceServers: [] } } as never);
  if (o.answerDelayMs) {
    // A late answer: everything else from the broker on time.
    const p = peer as unknown as { _handleMessage(m: { type?: string }): void };
    const handle = p._handleMessage.bind(peer);
    p._handleMessage = (m) => (m.type === 'ANSWER' ? void setTimeout(() => handle(m), o.answerDelayMs) : handle(m));
  }
  const unzip = new Unzipper();
  const decoder = new SnapshotDecoder();
  const g: Guest = { messages: [], bytes: 0, snapshots: 0, welcome: null, rejected: null, closed: false, send: () => undefined, close: () => peer.destroy() };
  await new Promise<void>((resolve, reject) => {
    let conn: ReturnType<typeof peer.connect> | undefined;
    const t0 = Date.now();
    const events: string[] = [];
    const note = (e: string) => events.length < 30 && events.push(`${Date.now() - t0} ms ${e}`);
    // Where it got stuck, if it does: broker, negotiation, ICE or the channel.
    const state = () => {
      const pc = conn?.peerConnection as unknown as PeerConnectionLike | undefined;
      const dc = conn?.dataChannel as { readyState?: string } | undefined;
      return `broker ${peer.open ? 'open' : peer.disconnected ? 'disconnected' : 'connecting'}, connection ${conn ? (conn.open ? 'open' : 'not open') : 'none'}, signaling ${pc?.signalingState}, ice ${pc?.iceGatheringState}/${pc?.iceConnectionState}, pc ${pc?.connectionState}, channel ${dc?.readyState}; ${events.join(', ')}`;
    };
    const timer = setTimeout(() => reject(new Error(`guest ${name} could not connect in 20 s (${state()})`)), 20_000);
    peer.on('error', (e) => {
      note(`peer error ${(e as { type?: string }).type}`);
      if ((e as { type?: string }).type !== 'webrtc') reject(e);
    });
    peer.on('open', () => {
      offerWithoutCandidates(peer, () => (conn?.peerConnection as unknown as PeerConnectionLike | undefined)?.signalingState, o.onSignal);
      const c = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'raw', metadata: { z: 1 } });
      conn = c;
      const pc = c.peerConnection as unknown as PeerConnectionLike;
      holdCandidatesUntilAnswered(pc);
      pc.addEventListener('connectionstatechange', () => note(`pc ${pc.connectionState}`));
      g.send = (m) => c.open && c.send(JSON.stringify(m));
      c.on('error', (e) => note(`connection error ${(e as { type?: string }).type}`));
      c.on('open', () => {
        clearTimeout(timer);
        g.send({ t: 'hello', protocol: PROTOCOL_VERSION, name, ...extra });
        resolve();
      });
      c.on('data', (data) => {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);
        g.bytes += bytes.length;
        const text = unzip.piece(bytes);
        if (text === null) return;
        const msg = JSON.parse(text) as ServerMessage;
        if (msg.t === 'snapshot') {
          decoder.snapshot(msg);
          g.snapshots++;
        }
        if (msg.t === 'welcome') g.welcome = msg;
        if (msg.t === 'reject') g.rejected = msg.reason;
        g.messages.push(msg);
        if (g.messages.length > 200) g.messages.splice(0, 100);
      });
      c.on('close', () => {
        note('connection closed');
        g.closed = true;
      });
    });
  });
  return g;
}
