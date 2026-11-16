import type { PlayerConn } from '@tiletrigger/server/server';
import { CHUNK, GUEST_TO_HOST_LIMITS, Reassembler, Zipper } from '@tiletrigger/shared/peerZip';

/** What the Host Service needs of a PeerJS DataConnection (a fake one in tests). */
export interface DataLike {
  readonly open: boolean;
  readonly metadata: unknown;
  /** Messages PeerJS holds back because the channel's own buffer is full (a player that can't keep up). */
  readonly bufferSize?: number;
  /** The underlying RTCPeerConnection (node-datachannel's polyfill: selectedCandidatePair()). */
  readonly peerConnection?: unknown;
  send(data: string | Uint8Array): void;
  close(): void;
  on(event: 'data', cb: (data: unknown) => void): unknown;
  on(event: 'close' | 'error', cb: (...args: unknown[]) => void): unknown;
}

const claimed = new WeakSet<DataLike>();

/** Limits on one player's link. */
export const LINK_LIMITS = {
  /** Messages held back for a player who can't keep up (~5 s of snapshots): past it the link closes instead of growing. */
  maxBacklog: 150,
  /** A link the host closes on its own (a player that can't keep up, or sent what it mustn't): it goes after this. */
  closeDelayMs: 400,
  /**
   * A link the server closes, which may just have sent a last message (a reject saying why, a travel): held open
   * until the player hangs up, as the browser does once it has read it (session.ts, 'reject'), and this long at
   * most. A fixed short wait lost the message: on a congested link it can still be queued (or waiting on a
   * resend) when the channel closes, and the player only saw the link drop (host.test's kick, on loaded runners).
   */
  closeWaitMs: 5000,
} as const;

/**
 * A friend's data channel as the dedicated server's PlayerConn: the same
 * stream a browser host sends (one deflate stream for the whole connection,
 * shared/net/peerZip.ts, when the player asks for it, as every current client
 * does), and the same caps on what a player sends (chunked text only,
 * GUEST_TO_HOST_LIMITS; the server's MessageGuard rates whole messages).
 */
export function peerConn(dc: DataLike, log: (line: string) => void = () => undefined): PlayerConn {
  // One player, one deflate stream per channel: a second PlayerConn on the same channel would interleave
  // two streams the friend can't inflate (see hubLink.ts admitWhenOpen). Refuse it outright.
  if (claimed.has(dc)) throw new Error('this connection already has a player');
  claimed.add(dc);
  const zip = (dc.metadata as { z?: unknown } | undefined)?.z === 1 ? new Zipper() : null;
  const parts = new Reassembler(GUEST_TO_HOST_LIMITS);
  let closing = false;
  let closed = false;
  const closeHandlers: (() => void)[] = [];
  const finish = () => {
    if (closed) return;
    closed = true;
    for (const cb of closeHandlers.splice(0)) cb();
  };
  /** Stop sending, then close: after `waitMs`, or as soon as the player hangs up (finish, from the channel's close). */
  const close = (why?: string, waitMs: number = LINK_LIMITS.closeDelayMs) => {
    if (closing) return;
    closing = true;
    if (why) log(`closing a player's link: ${why}`);
    setTimeout(() => {
      if (closed) return;
      dc.close();
      finish();
    }, waitMs).unref?.();
  };
  dc.on('close', finish);
  dc.on('error', finish);
  return {
    send(text) {
      if (closing || !dc.open) return 0;
      if ((dc.bufferSize ?? 0) > LINK_LIMITS.maxBacklog) {
        close('too far behind (its connection is too slow for this match)');
        return 0;
      }
      if (zip) {
        let bytes = 0;
        for (const piece of zip.pieces(text)) {
          dc.send(piece);
          bytes += piece.length;
        }
        return bytes;
      }
      if (text.length <= CHUNK) dc.send(text);
      else {
        const id = Math.floor(Math.random() * 1e9);
        const n = Math.ceil(text.length / CHUNK);
        for (let i = 0; i < n; i++) dc.send(`\u0001${id}|${i}|${n}|${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
      }
      return text.length;
    },
    close: () => close(undefined, LINK_LIMITS.closeWaitMs),
    address: () => remoteAddress(dc),
    up: () => !closing && linkUp(dc),
    onMessage(cb) {
      dc.on('data', (data) => {
        if (closing) return;
        // Players send text; anything else is not one of ours.
        if (typeof data !== 'string') return close('sent binary data');
        try {
          const whole = parts.add(data);
          if (whole !== null) cb(whole);
        } catch (e) {
          close((e as Error).message);
        }
      });
    },
    onClose(cb) {
      if (closed) cb();
      else closeHandlers.push(cb);
    },
  };
}

/** Whether the link's peer connection is up (node-datachannel's polyfill: connectionState, else iceConnectionState). */
export function linkUp(dc: DataLike): boolean {
  try {
    const pc = dc.peerConnection as { connectionState?: string; iceConnectionState?: string } | undefined;
    const state = pc?.connectionState ?? pc?.iceConnectionState;
    return dc.open && (state === 'connected' || state === 'completed');
  } catch {
    return false;
  }
}

/** The player's address when the link is direct; a relayed link only shows the relay's (useless for a ban). */
export function remoteAddress(dc: DataLike): string | undefined {
  try {
    const pair = (dc.peerConnection as { selectedCandidatePair?: () => { remote?: { address?: string; type?: string } } | null } | undefined)?.selectedCandidatePair?.();
    const r = pair?.remote;
    return r?.address && r.type !== 'relay' ? r.address : undefined;
  } catch {
    return undefined;
  }
}
