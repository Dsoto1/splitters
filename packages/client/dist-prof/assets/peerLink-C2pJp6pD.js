import { $ as $416260bce337df90$export$ecd1fc136c422448 } from "./peerjs-CJ9C5uk5.js";
import { S as SnapshotCoalescer, a as adminToken, p as playerKey, r as rememberAdminToken, C as CHUNK, U as Unzipper, R as Reassembler, M as MessageGuard, G as GUEST_TO_HOST_LIMITS, b as plainPiece, H as HOST_TO_GUEST_LIMITS, c as SnapshotDecoder } from "./netTransport-CfuKuNhr.js";
import { as as sessionIce, at as baseIceServers, au as loadRelay, av as PROTOCOL_VERSION, aw as myParty, ax as isJoinCode, ai as sanitizeName, ay as parseCheckpoint, az as BROWSER_HOST_MAX_GUESTS, aA as hubSetting, aB as accessToken, ak as hubAddress } from "./index-BAsW2uYW.js";
import { n as netProbe } from "./netProbe-Bv9gS1yd.js";
import "./babylon-PnzH6wcM.js";
import "./vendor-BIr0ad6t.js";
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const BLOCKED = ["666", "ASS", "FUK", "FUC", "FCK", "SHT", "CUM", "CNT", "DCK", "DIK", "FAG", "GAY", "JEW", "KKK", "NAZ", "NGR", "NGA", "PSS", "PUS", "RAP", "SEX", "SXY", "TIT", "TWT", "WTF", "XXX", "HEL", "DED", "KYS"];
const LEET = { "5": "S", "3": "E", "4": "A", "7": "T", "8": "B" };
function acceptableJoinCode(code) {
  const read = code.replace(/[53478]/g, (d) => LEET[d]);
  return !BLOCKED.some((b) => code.includes(b) || read.includes(b));
}
const cryptoBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const UNBIASED = 256 - 256 % JOIN_CODE_ALPHABET.length;
function makeJoinCode(bytes = cryptoBytes) {
  for (; ; ) {
    let code = "";
    while (code.length < 6) {
      for (const b of bytes(12)) {
        if (b >= UNBIASED) continue;
        code += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length];
        if (code.length === 6) break;
      }
    }
    if (acceptableJoinCode(code)) return code;
  }
}
const PREFIX = "tiletrigger-";
const HOST_SILENT_MS = 2e4;
const cleanJoinCode = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
function peerOptions(config) {
  const custom = new URLSearchParams(location.search).get("peer");
  const base = { config, debug: 0 };
  if (!custom) {
    const hub = hubAddress();
    return hub ? { ...base, host: hub.host, port: hub.port, path: `${hub.path}broker`, secure: hub.secure } : base;
  }
  const m = /^(?:(wss?|https?):\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/.exec(custom);
  if (!m) return base;
  const secure = m[1] === "wss" || m[1] === "https";
  return { ...base, host: m[2], port: Number(m[3] ?? (secure ? 443 : 80)), path: m[4] ?? "/", secure };
}
let chunkIds = 0;
function sendPieces(conn, pieces) {
  if (!conn.open) return;
  const t0 = netProbe.on ? performance.now() : 0;
  for (const piece of pieces) conn.send(piece);
  if (netProbe.on) {
    netProbe.sent++;
    for (const piece of pieces) netProbe.sentBytes += piece.length;
    netProbe.sendMs += performance.now() - t0;
  }
}
function sendText(conn, text) {
  if (!conn.open) return;
  if (text.length <= CHUNK) return void conn.send(text);
  const id = ++chunkIds;
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send(`${id}|${i}|${n}|${text.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}
function onText(conn, cb, o) {
  conn.on("data", textHandler(conn, cb, o));
}
function textHandler(conn, cb, o) {
  const parts = new Reassembler(o.limits);
  let unzip = null;
  const abuse = (why) => {
    console.warn(`closing a connection: ${why}`);
    conn.close();
  };
  return (data) => {
    if (!conn.open) return;
    const verdict = o.guard?.check() ?? "ok";
    if (verdict === "kick") return abuse("too many messages");
    if (verdict === "drop") return;
    try {
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        o.wire?.(bytes.length);
        const t0 = netProbe.on ? performance.now() : 0;
        const text2 = (unzip ??= new Unzipper(o.limits.maxBytes)).piece(bytes);
        if (netProbe.on) {
          netProbe.inflateMs += performance.now() - t0;
          netProbe.recvBytes += bytes.length;
          if (text2 !== null) netProbe.recvChars += text2.length;
        }
        if (text2 !== null) cb(text2);
        return;
      }
      const text = String(data);
      o.wire?.(text.length);
      const whole = parts.add(text);
      if (whole !== null) cb(whole);
    } catch (e) {
      abuse(e.message);
    }
  };
}
const EARLY_MESSAGES = 32;
function linkFor(conn) {
  const zip = conn.metadata?.z === 1;
  let deliver = null;
  const early = [];
  conn.on("data", (data) => deliver ? deliver(data) : early.length < EARLY_MESSAGES && early.push(data));
  return {
    zip,
    send: (text) => zip ? sendPieces(conn, [plainPiece(text)]) : sendText(conn, text),
    sendPieces: (pieces) => sendPieces(conn, pieces),
    // A friend's messages are small and rate-limited (the same budget as the dedicated server's clients).
    onMessage: (cb) => {
      deliver = textHandler(conn, cb, { limits: GUEST_TO_HOST_LIMITS, guard: new MessageGuard() });
      for (const data of early.splice(0)) deliver(data);
    },
    onClose: (cb) => {
      conn.on("close", cb);
      conn.on("error", cb);
    },
    close: () => conn.close(),
    // The browser's own network threads keep the connection up while the friend's page is busy.
    connected: () => {
      const pc = conn.peerConnection;
      const state = pc?.connectionState ?? pc?.iceConnectionState;
      return conn.open && (state === "connected" || state === "completed");
    }
  };
}
class PeerHost {
  peer;
  links = /* @__PURE__ */ new Map();
  config = { iceServers: baseIceServers() };
  refresh;
  code = "";
  relay = false;
  /** Friends' links that came while nothing took them (a successor's standby code before its match runs). */
  held = [];
  admitTo;
  /**
   * `admit`: where friends' connections go; a map change points it at the next match (same code, friends rejoin).
   * Null: hold them until it's set (a successor's standby code, opened before there's a match to let them into).
   */
  constructor(admit) {
    this.admitTo = admit;
  }
  get admit() {
    return (link) => {
      if (this.admitTo) return this.admitTo(link);
      if (this.held.length < BROWSER_HOST_MAX_GUESTS) this.held.push(link);
      else link.close();
    };
  }
  set admit(f) {
    this.admitTo = f;
    for (const link of this.held.splice(0)) f(link);
  }
  /** The hub's relay credentials for this game, renewed before they expire (new friends' connections use the latest). */
  async fetchIce(code) {
    const got = await sessionIce(code, "host");
    if (!got.relay && this.relay) return;
    this.relay = got.relay;
    this.config.iceServers = [...baseIceServers(), ...got.servers];
    window.clearTimeout(this.refresh);
    if (got.relay && got.ttl > 0) this.refresh = window.setTimeout(() => this.peer && void this.fetchIce(code), Math.max(60, got.ttl / 2) * 1e3);
  }
  /** Resolves with the join code once the broker has registered it (and the hub's relay, if any, is set up for it). */
  start() {
    return new Promise((resolve, reject) => {
      const tryCode = (attempt) => {
        const code = makeJoinCode();
        const peer = new $416260bce337df90$export$ecd1fc136c422448(PREFIX + code, peerOptions(this.config));
        peer.on("open", () => {
          this.peer = peer;
          this.code = code;
          void this.fetchIce(code).then(() => resolve(code));
        });
        peer.on(
          "connection",
          (conn) => conn.on("open", () => {
            this.links.get(conn.peer)?.close();
            this.links.set(conn.peer, conn);
            conn.on("close", () => this.links.get(conn.peer) === conn && this.links.delete(conn.peer));
            this.admit(linkFor(conn));
          })
        );
        peer.on("disconnected", () => {
          if (this.peer === peer && !peer.destroyed) window.setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 1e3);
        });
        peer.on("error", (e) => {
          if (e.type === "unavailable-id" && attempt < 4) {
            peer.destroy();
            tryCode(attempt + 1);
          } else if (!this.peer) reject(new Error(`could not open a join code (${e.type ?? e.message})`));
        });
      };
      tryCode(0);
    });
  }
  close() {
    window.clearTimeout(this.refresh);
    for (const link of this.held.splice(0)) link.close();
    this.peer?.destroy();
    this.peer = void 0;
  }
}
class PeerTransport {
  constructor(code, name, look) {
    this.code = code;
    this.name = name;
    this.look = look;
  }
  code;
  name;
  look;
  peer;
  conn;
  pingTimer;
  closedByUs = false;
  rttMs = 0;
  bytesIn = 0;
  /**
   * How the host went, once the link to it closed after we were in: `left` (it said `bye`: on purpose) or
   * `dropped` (the link just died: maybe a blip). Null while the host is there, or when we never got in.
   */
  hostGone = null;
  /** Host handoff (net/handoff.ts): the successor the host named, and, asked to stand by, our standby code and checkpoint. */
  handoff = { successor: null, standby: null, checkpoint: null };
  standbyOpening = false;
  /** The successor named when the host asked us to stand by (null: nobody): we were asked to replace them. */
  standbyFor = null;
  /** The host is a dedicated one (a Host Service: it keeps places and comes back), not a player's browser. */
  dedicated = false;
  /** The host let us in (its welcome came), even if the match is still loading here. */
  welcomed = false;
  /** Our link to the host is open (it may still be starting its match: a successor taking over). */
  linked = false;
  saidBye = false;
  get label() {
    return `code ${this.code}`;
  }
  relay = false;
  start(onMessage, onClose) {
    void Promise.all([sessionIce(this.code, "guest"), accountTicket(this.code)]).then(([ice, ticket]) => {
      this.relay = ice.relay;
      this.ticket = ticket;
      if (!this.closedByUs) this.open(onMessage, onClose, [...baseIceServers(), ...ice.servers]);
    });
  }
  ticket = null;
  open(onMessage, onClose, iceServers) {
    const peer = new $416260bce337df90$export$ecd1fc136c422448(peerOptions({ iceServers }));
    this.peer = peer;
    const snapshots = this.snapshots = new SnapshotCoalescer((m) => !this.closedByUs && onMessage(m));
    const players = new SnapshotDecoder();
    let opened = false;
    let brokered = false;
    let heardAt = 0;
    const fail = (reason) => {
      if (this.closedByUs) return;
      this.closedByUs = true;
      snapshots.clear();
      clearInterval(this.pingTimer);
      clearTimeout(timeout);
      peer.destroy();
      onClose(reason);
    };
    const unreachable = () => {
      const hub = new URLSearchParams(location.search).get("peer") ?? hubSetting();
      if (!hub) return "couldn't reach the matchmaking service — check your internet connection";
      const local = /^(localhost|127\.|\[::1\])/.test(hub.replace(/^\w+:\/\//, ""));
      return `couldn't reach the matchmaking service at ${hub}${local ? ` — that address means "this computer", so it only works on the host's own machine: ask them to host without a localhost hub` : " — check the address and that the hub is running"}`;
    };
    const relayHint = loadRelay() || this.relay ? "even through the relay" : "the host can set a relay in Options and send you a new invite link, or play on the same Wi-Fi";
    const noDirect = `found the game but couldn't connect to it — your networks block direct connections: ${relayHint}`;
    const giveUp = () => {
      if (opened) return;
      fail(brokered ? noDirect : unreachable());
    };
    let timeout = window.setTimeout(giveUp, 2e4);
    peer.on("error", (e) => {
      const type = e.type;
      if (type === "peer-unavailable") fail(`no game open with code ${this.code} — check the code, and that the host still has the match open (Esc → Host game)`);
      else if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
        if (!brokered) fail(unreachable());
      } else if (type === "webrtc" || type === "negotiation-failed") fail(noDirect);
      else fail(`connection failed (${type ?? e.message})`);
    });
    peer.on("open", () => {
      brokered = true;
      clearTimeout(timeout);
      timeout = window.setTimeout(giveUp, 3e4);
      const conn = peer.connect(PREFIX + this.code, { reliable: true, serialization: "raw", metadata: { z: 1 } });
      this.conn = conn;
      conn.on("iceStateChanged", (state) => {
        if (state === "failed" && !opened) fail(noDirect);
      });
      conn.on("open", () => {
        opened = true;
        this.linked = true;
        clearTimeout(timeout);
        const admin = adminToken(`code:${this.code}`);
        this.send({ t: "hello", protocol: PROTOCOL_VERSION, name: this.name, look: this.look, pk: playerKey(), party: myParty(), ...this.ticket ? { ticket: this.ticket } : {}, ...admin ? { admin } : {} });
        heardAt = performance.now();
        let tickAt = heardAt;
        this.pingTimer = window.setInterval(() => {
          const now = performance.now();
          if (now - tickAt > 3e3) heardAt = now;
          tickAt = now;
          if (!this.dedicated && now - heardAt > HOST_SILENT_MS) return hostLost("silent");
          this.send({ t: "ping", id: 0, ct: performance.now(), ...this.rttMs ? { rtt: Math.round(this.rttMs) } : {} });
        }, 1e3);
      });
      const hostLost = (why) => {
        if (opened && !this.closedByUs) {
          this.hostGone = this.saidBye ? "left" : "dropped";
          console.warn(`the host's link went (${why}${this.saidBye ? ", after its goodbye" : ""})`);
        }
        fail(!opened ? noDirect : this.saidBye ? "the host left the game" : "lost the connection to the host");
      };
      onText(
        conn,
        (text) => {
          const t0 = performance.now();
          heardAt = t0;
          const msg = JSON.parse(text);
          if (netProbe.on) {
            const t1 = performance.now();
            netProbe.parseMs += t1 - t0;
            if (msg.t === "snapshot") {
              netProbe.arrivals.push(t1);
              netProbe.ticks.push(msg.tick);
            }
          }
          if (msg.t === "pong") {
            const sample = performance.now() - msg.ct;
            this.rttMs = this.rttMs ? this.rttMs * 0.8 + sample * 0.2 : sample;
            return;
          }
          if (msg.t === "bye") {
            this.saidBye = true;
            const l = msg.listing;
            if (this.handoff.standby && l && typeof l.id === "string" && typeof l.secret === "string") this.handoff.listing = { id: l.id, secret: l.secret };
            return void window.setTimeout(() => hostLost("goodbye"), 1500);
          }
          if (msg.t === "welcome") {
            this.dedicated = !!msg.dedicated;
            this.welcomed = true;
          }
          if (msg.t === "standby" || msg.t === "successor" || msg.t === "checkpoint") return this.onHandoff(msg);
          if (msg.t === "snapshot") players.snapshot(msg);
          snapshots.push(msg);
        },
        { limits: HOST_TO_GUEST_LIMITS, wire: (bytes) => this.bytesIn += bytes }
      );
      conn.on("close", () => hostLost("closed"));
    });
  }
  /** Host handoff messages: only what the host says over its own link counts (nobody else can name a successor). */
  onHandoff(msg) {
    if (this.dedicated || this.closedByUs) return;
    const h = this.handoff;
    if (msg.t === "standby") {
      if (h.standby) return this.send({ t: "standby", code: h.standby.code });
      if (this.standbyOpening) return;
      this.standbyOpening = true;
      this.standbyFor = h.successor?.code ?? null;
      const host = new PeerHost(null);
      void host.start().then(
        (code) => {
          this.standbyOpening = false;
          if (this.closedByUs || h.successor && h.successor.code !== this.standbyFor) return host.close();
          h.standby = host;
          this.send({ t: "standby", code });
        },
        () => this.standbyOpening = false
      );
      return;
    }
    if (msg.t === "successor") {
      h.successor = isJoinCode(msg.code) ? { code: msg.code, slot: typeof msg.slot === "number" ? msg.slot : null, name: typeof msg.name === "string" ? sanitizeName(msg.name) : "A player" } : null;
      const named = h.successor?.code;
      if (named && named === h.standby?.code) this.standbyFor = null;
      if (h.standby && named && named !== h.standby.code && named !== this.standbyFor) {
        h.standby.close();
        h.standby = null;
        h.checkpoint = null;
      }
      return;
    }
    if (!h.standby) return;
    const cp = parseCheckpoint(msg.cp);
    if (cp) h.checkpoint = { cp, at: performance.now() };
  }
  /** The host has gone: what we know for a handoff. The standby code (if any) is now the caller's to host on, or close. */
  takeHandoff() {
    const h = this.handoff;
    this.handoff = { successor: null, standby: null, checkpoint: null };
    return h;
  }
  snapshots;
  flush() {
    this.snapshots?.flush();
  }
  sendInputs(inputs) {
    if (inputs.length) this.send({ t: "input", inputs });
  }
  sendReady() {
    this.send({ t: "ready" });
  }
  sendSpectate(on) {
    this.send({ t: "spectate", on });
  }
  sendVote(i) {
    this.send({ t: "vote", i });
  }
  /** Admin login and commands: a dedicated host (Host Service) runs them for its admin; a browser host refuses them. */
  sendCommand(msg) {
    if (msg.t === "admin") rememberAdminToken(`code:${this.code}`, msg.token);
    this.send(msg);
  }
  close() {
    this.closedByUs = true;
    if (!this.hostGone) {
      this.handoff.standby?.close();
      this.handoff.standby = null;
    }
    clearInterval(this.pingTimer);
    this.conn?.close();
    this.peer?.destroy();
  }
  send(m) {
    if (this.conn) sendText(this.conn, JSON.stringify(m));
  }
}
const peerSignaling = {
  host: (admit) => new PeerHost(admit),
  join: (code, name, look) => new PeerTransport(cleanJoinCode(code), name, look)
};
async function accountTicket(code) {
  const token = accessToken();
  const hub = hubAddress();
  if (!token || !hub) return null;
  try {
    const res = await fetch(`${hub.secure ? "https" : "http"}://${hub.host}:${hub.port}${hub.path}api/v1/ticket?code=${code}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5e3) });
    return res.ok ? (await res.json()).ticket ?? null : null;
  } catch {
    return null;
  }
}
export {
  PeerHost,
  PeerTransport,
  cleanJoinCode,
  makeJoinCode,
  peerSignaling
};
