import { ai as sanitizeName, aj as GAME_MODES, V as MAX_PLAYER_SLOTS, ak as hubAddress } from "./index-BAsW2uYW.js";
import "./babylon-PnzH6wcM.js";
import "./vendor-BIr0ad6t.js";
const LAN_GAME_PORTS = [7777, 7778, 7779, 7780];
const ADDRESS_RE = /^wss?:\/\/[\w.[\]:-]{1,80}$/;
const int = (v, min, max) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
function parseServerInfo(v) {
  if (typeof v !== "object" || v === null) return null;
  const o = v;
  if (o.game !== "tiletrigger") return null;
  const version = int(o.version, 0, 1e6);
  const players = int(o.players, 0, MAX_PLAYER_SLOTS);
  const bots = int(o.bots, 0, MAX_PLAYER_SLOTS);
  const max = int(o.max, 1, MAX_PLAYER_SLOTS);
  const name = typeof o.name === "string" ? sanitizeName(o.name).slice(0, 40) : null;
  const map = typeof o.map === "string" ? sanitizeName(o.map).slice(0, 40) : null;
  const mode = typeof o.mode === "string" && GAME_MODES.includes(o.mode) ? o.mode : null;
  const addresses = Array.isArray(o.addresses) ? o.addresses.filter((a) => typeof a === "string" && ADDRESS_RE.test(a)).slice(0, 8) : [];
  if (version === null || players === null || bots === null || max === null || !name || !map || !mode) return null;
  return { game: "tiletrigger", version, name, map, mode, players, bots, max, addresses };
}
const SAVED_KEY = "tiletrigger.lanHosts";
function savedLanHosts() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 16) : [];
  } catch {
    return [];
  }
}
function saveLanHosts(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...new Set(list)].slice(0, 16)));
  } catch {
  }
}
function probeUrls(entry) {
  const m = /^(?:wss?:\/\/|https?:\/\/)?(\[[^\]]+\]|[^:/\s]+)(?::(\d+))?\/?$/.exec(entry.trim());
  if (!m) return [];
  const ports = m[2] ? [Number(m[2])] : [...LAN_GAME_PORTS];
  return ports.map((p) => `http://${m[1]}:${p}/info`);
}
function reachable(url) {
  if (location.protocol !== "https:") return true;
  return /^http:\/\/(localhost|127\.|\[::1\])/.test(url);
}
async function probe(url, ms) {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });
    return res.ok ? parseServerInfo(await res.json()) : null;
  } catch {
    return null;
  }
}
async function scanLan(extra = savedLanHosts(), ms = 900) {
  const hosts = [...new Set([location.hostname, "localhost", ...extra].filter(Boolean))];
  const urls = [...new Set(hosts.flatMap(probeUrls))];
  const blocked = urls.filter((u) => !reachable(u)).length;
  const games = /* @__PURE__ */ new Map();
  const direct = urls.filter(reachable).map(async (u) => {
    const info = await probe(u, ms);
    if (!info) return;
    const url = u.replace(/^http/, "ws").replace(/\/info$/, "");
    games.set(url, { url, info, via: "direct" });
  });
  const hub = hubAddress();
  const fromHub = hub ? (async () => {
    try {
      const res = await fetch(`${hub.secure ? "https" : "http"}://${hub.host}:${hub.port}${hub.path}lobby/lan`, { cache: "no-store", signal: AbortSignal.timeout(ms + 600) });
      if (!res.ok) return;
      const body = await res.json();
      for (const raw of body.servers ?? []) {
        const info = parseServerInfo(raw);
        const url = info?.addresses.find((a) => reachable(a.replace(/^ws/, "http")));
        if (info && url && ![...games.values()].some((g) => g.info.addresses.includes(url))) games.set(url, { url, info, via: "hub" });
      }
    } catch {
    }
  })() : Promise.resolve();
  await Promise.all([...direct, fromHub]);
  const seen = /* @__PURE__ */ new Set();
  const out = [...games.values()].filter((g) => {
    const key = `${g.info.name}|${g.info.map}|${g.url.split(":").pop()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { games: out, blocked };
}
export {
  probeUrls,
  reachable,
  saveLanHosts,
  savedLanHosts,
  scanLan
};
