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

/** Limits on one player's link. */
export const LINK_LIMITS = {
  /** Messages held back for a player who can't keep up (~5 s of snapshots): past it the link closes instead of growing. */
  maxBacklog: 150,
  /** Time for a last message (reject, travel) to get there before the link closes. */
  closeDelayMs: 400,
} as const;

/**
 * A friend's data channel as the dedicated server's PlayerConn: the same
 * stream a browser host sends (one deflate stream for the whole connection,
 * shared/net/peerZip.ts, when the player asks for it, as every current client
 * does), and the same caps on what a player sends (chunked text only,
 * GUEST_TO_HOST_LIMITS; the server's MessageGuard rates whole messages).
 */
export function peerConn(dc: DataLike, log: (line: string) => void = () => undefined): PlayerConn {
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
  const close = (why?: string) => {
    if (closing) return;
    closing = true;
    if (why) log(`closing a player's link: ${why}`);
    setTimeout(() => {
      dc.close();
      finish();
    }, LINK_LIMITS.closeDelayMs).unref?.();
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
    close: () => close(),
    address: () => remoteAddress(dc),
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
