import { a3 as SCORE_LIMIT_MAX, Y as MAX_TEAMS, K as fireteamMode, a4 as TICK_RATE, a5 as isCoopMode, a6 as isWeaponSetId, a7 as WEAPON_SET_IDS, a8 as WEAPON_SET_DEFS, a9 as BOT_CAST_CHOICES, U as isTwoTeamMode, aa as fireteamSize, ab as DEFAULT_FIRETEAM_SIZE, J as isTeamMode, T as MODE_LABELS } from "./index-BAsW2uYW.js";
import { t as teamCount } from "./hostRules-B_Hae2mK.js";
import "./babylon-PnzH6wcM.js";
import "./vendor-BIr0ad6t.js";
const notCoop = (m) => !isCoopMode(m);
const teamMode = (m) => isTeamMode(m);
const onOff = { kind: "bool", on: "On", off: "Off" };
const choice = (...values) => ({ kind: "choice", values });
const castRuleValue = (cast) => cast === void 0 ? "map" : !cast.length ? "all" : cast[0];
const castFromRuleValue = (v) => v === void 0 || v === "map" ? void 0 : v === "all" ? [] : [v];
const SERVER_RULES = [
  {
    key: "score",
    label: "Score limit",
    help: "The score that wins (0: none). Per mode: kills in Deathmatch and Team Deathmatch, captures in CTF, rounds in Elimination…",
    type: { kind: "int", min: 0, max: SCORE_LIMIT_MAX, zero: "none" },
    apply: "restart",
    perMode: true,
    modes: (m) => notCoop(m),
    read: (r) => r.scoreLimit,
    write: (r, v) => r.scoreLimit = v
  },
  {
    key: "time",
    label: "Time limit",
    help: "Minutes until the match ends (0: no limit). Per mode.",
    type: { kind: "int", min: 0, max: 120, unit: "min", zero: "∞" },
    apply: "restart",
    perMode: true,
    modes: (m) => notCoop(m) && m !== "core.forts",
    read: (r) => Math.round(r.timeLimitSeconds / 60),
    write: (r, v) => r.timeLimitSeconds = v * 60
  },
  {
    key: "respawn",
    label: "Respawn delay",
    help: "Seconds before players are back in. Rounds modes and Zombies wait for the next round or wave instead. Per mode.",
    type: { kind: "int", min: 0, max: 30, unit: "s" },
    apply: "restart",
    perMode: true,
    read: (r) => Math.round(r.respawnDelayTicks / TICK_RATE),
    write: (r, v) => r.respawnDelayTicks = Math.round(v * TICK_RATE)
  },
  {
    key: "ff",
    label: "Friendly fire",
    help: "Whether shots and blasts hurt teammates (team modes and co-op).",
    type: choice(["off", "Off"], ["half", "Half"], ["on", "Full"]),
    apply: "restart",
    modes: (m) => teamMode(m) || isCoopMode(m),
    read: (r) => r.friendlyFire ?? "off",
    write: (r, v) => v === "off" ? delete r.friendlyFire : r.friendlyFire = v
  },
  {
    key: "mix",
    label: "Mix up weapon pickups",
    help: 'Every weapon pickup not marked "keep fixed" holds a random weapon of its kind, and a new one each time it comes back.',
    type: onOff,
    apply: "live",
    read: (r) => !!r.mixPickups,
    write: (r, v) => v ? r.mixPickups = true : delete r.mixPickups
  },
  {
    key: "drops",
    label: "Drop weapon on death",
    help: "A fallen player's or bot's primary lies at the body for 30 s with the ammo it had left (off clears the ones lying about).",
    type: onOff,
    apply: "live",
    modes: (m) => m !== "core.discs",
    read: (r) => r.dropWeapons !== false,
    write: (r, v) => v ? delete r.dropWeapons : r.dropWeapons = false
  },
  {
    key: "set",
    label: "Weapon set",
    help: "What everyone spawns with and what weapon and grenade pickups hold: map (the map's own default; most maps: standard), standard (knife, pistol, the map's pickups as placed), military, scifi, medieval, chaos or mixed (a random gun each life).",
    type: choice(["map", "Map default"], ...WEAPON_SET_IDS.map((id) => [id, WEAPON_SET_DEFS[id].name])),
    apply: "live",
    modes: (m) => m !== "core.discs",
    read: (r) => isWeaponSetId(r.weaponSet) ? r.weaponSet : "map",
    write: (r, v) => v === "map" || !isWeaponSetId(v) ? delete r.weaponSet : r.weaponSet = v
  },
  {
    key: "style",
    label: "Bot style",
    help: "Mixed: every character its own way. Arena: always moving (Quake). Tactical: cover and held angles (Counter-Strike).",
    type: choice(["mixed", "Mixed"], ["arena", "Arena"], ["tactical", "Tactical"]),
    apply: "live",
    read: (r) => r.botStyle ?? "mixed",
    write: (r, v) => v === "mixed" ? delete r.botStyle : r.botStyle = v
  },
  {
    key: "cast",
    label: "Bot characters",
    help: `Which characters random bots play, and so their names (a soldier is "Sgt. Dunmore"): map (the map's own; most maps: all), all, a group (soldiers, legends, folk, horror, animals, creatures) or a name theme (pirate, monkey, knight…).`,
    type: choice(["map", "Map default"], ["all", "All"], ...BOT_CAST_CHOICES.map((c) => [c.id, c.label])),
    apply: "live",
    read: (r) => castRuleValue(r.botCast),
    write: (r, v) => v === "map" ? delete r.botCast : r.botCast = castFromRuleValue(v) ?? []
  },
  {
    key: "teams",
    label: "Teams",
    help: "How many teams (2 to 8) in Team Deathmatch, King of the Hill and Elimination; CTF, Fort Wars, Bomb and Hostage are always two.",
    type: { kind: "int", min: 2, max: MAX_TEAMS },
    apply: "next",
    modes: (m) => teamMode(m) && !isTwoTeamMode(m),
    read: (r) => teamCount(r),
    write: () => void 0
  },
  {
    key: "assign",
    label: "Team balance",
    help: "Balanced: people spread evenly over the teams, bots fill the rest. Random: a random team with room.",
    type: choice(["balanced", "Balanced"], ["random", "Random"]),
    apply: "next",
    modes: teamMode,
    read: (r) => r.teamAssign === "random" ? "random" : "balanced",
    write: (r, v) => v === "random" ? r.teamAssign = "random" : delete r.teamAssign
  },
  {
    key: "teamnames",
    label: "Team names",
    help: "Names in team order, separated by commas (blank: the map's).",
    type: { kind: "list", max: 24 },
    apply: "next",
    modes: teamMode,
    read: (r) => r.teamNames?.join(", ") ?? "",
    write: (r, v) => setList(r, "teamNames", v)
  },
  {
    key: "teamcolors",
    label: "Team colours",
    help: "Colours in team order (#rrggbb), separated by commas (blank: the map's).",
    type: { kind: "list", max: 7, pattern: /^#[0-9a-f]{6}$/i },
    apply: "next",
    modes: teamMode,
    read: (r) => r.teamColors?.join(", ") ?? "",
    write: (r, v) => setList(r, "teamColors", v)
  },
  {
    key: "leaders",
    label: "Team leaders",
    help: "Each team has a leader (gold star) whose orders every bot on the team follows. Leader hunt (Team Deathmatch): downing the enemy leader scores 3 extra.",
    type: choice(["off", "Off"], ["on", "On"], ["vip", "Leader hunt"]),
    apply: "next",
    modes: teamMode,
    read: (r) => r.leaders === "vip" ? "vip" : r.leaders ? "on" : "off",
    write: (r, v) => v === "off" ? delete r.leaders : r.leaders = v === "vip" && r.mode === "core.tdm" ? "vip" : true
  },
  {
    key: "fireteams",
    label: "Fireteams",
    help: "Every player leads a squad of bots of this size (the leader included), ordered by the order wheel (hold B); bot-led squads of the same size fill each team.",
    type: choice(["off", "Off"], ["4", "Squads of 4"], ["5", "Squads of 5"], ["6", "Squads of 6"]),
    apply: "next",
    modes: fireteamMode,
    read: (r) => r.fireteams ? String(r.fireteams) : "off",
    write: (r, v) => v === "off" ? delete r.fireteams : r.fireteams = fireteamSize(Number(v) || DEFAULT_FIRETEAM_SIZE)
  },
  {
    key: "squadspawn",
    label: "Spawn on teammates",
    help: "Team modes: respawn beside a teammate who is out of the fight.",
    type: onOff,
    apply: "next",
    modes: teamMode,
    read: (r) => r.squadSpawn !== false,
    write: (r, v) => v ? delete r.squadSpawn : r.squadSpawn = false
  },
  {
    key: "streaks",
    label: "Kill streaks",
    help: "Rewards for kills without dying: UAV, Supply Pulse, Counter-UAV, Airstrike.",
    type: onOff,
    apply: "next",
    read: (r) => r.killstreaks !== false,
    write: (r, v) => v ? delete r.killstreaks : r.killstreaks = false
  },
  {
    key: "sizes",
    label: "Character sizes",
    help: "Matter: small characters are quicker targets with less health, large ones slower and tougher. Equal: everyone at standard size.",
    type: { kind: "bool", on: "Matter", off: "All equal" },
    apply: "next",
    read: (r) => r.bodySizes !== false,
    write: (r, v) => v ? delete r.bodySizes : r.bodySizes = false
  },
  {
    key: "stats",
    label: "Character stats",
    help: "On: each character's own health, speed, size, damage, stamina, jump, melee and armor (a character without them plays its size). Off: nobody's own stats count.",
    type: onOff,
    apply: "next",
    read: (r) => r.characterStats !== false,
    write: (r, v) => v ? delete r.characterStats : r.characterStats = false
  },
  {
    key: "randomchars",
    label: "Random characters",
    help: "Everyone, players and bots, plays a random character each life.",
    type: onOff,
    apply: "next",
    read: (r) => !!r.randomCharacters,
    write: (r, v) => v ? r.randomCharacters = true : delete r.randomCharacters
  },
  {
    key: "gravity",
    label: "Gravity",
    help: "Low, normal or heavy (default: the map's own).",
    type: choice(["low", "Low"], ["normal", "Normal"], ["heavy", "Heavy"]),
    apply: "next",
    read: (r) => r.gravity === void 0 ? "normal" : r.gravity <= 0.5 ? "low" : r.gravity >= 1.5 ? "heavy" : "normal",
    write: (r, v) => r.gravity = v === "low" ? 0.4 : v === "heavy" ? 1.6 : 1
  },
  {
    key: "fall",
    label: "Fall damage",
    help: "Drops past about 5 m hurt; about 16 m kills (default: the map's own).",
    type: onOff,
    apply: "next",
    read: (r) => !!r.fallDamage,
    write: (r, v) => r.fallDamage = !!v
  },
  {
    key: "lethality",
    label: "Lethality",
    help: "Arcade: everyone soaks about 40% more. Standard: the official balance. Tactical: about 30% less (very lethal).",
    type: choice(["arcade", "Arcade"], ["standard", "Standard"], ["tactical", "Tactical"]),
    apply: "next",
    read: (r) => r.lethality ?? "standard",
    write: (r, v) => v === "standard" ? delete r.lethality : r.lethality = v
  },
  {
    key: "ballistics",
    label: "Ballistics",
    help: "Arcade: fast bullets that barely drop. Standard: the official default. Advanced: slower bullets that drop more.",
    type: choice(["arcade", "Arcade"], ["standard", "Standard"], ["advanced", "Advanced"]),
    apply: "next",
    read: (r) => r.ballistics ?? "standard",
    write: (r, v) => v === "standard" ? delete r.ballistics : r.ballistics = v
  },
  {
    key: "emotes",
    label: "Emotes & messages",
    help: "Quick messages and the dance emote (pings always work).",
    type: onOff,
    apply: "next",
    read: (r) => r.emotes !== false,
    write: (r, v) => v ? delete r.emotes : r.emotes = false
  },
  {
    key: "weapons",
    label: "Weapons & pickups",
    help: "Normal: the map's weapons and pickups. Spears only: one throwing spear each. Discs only: bouncing arena discs (no pickups either way).",
    type: choice(["normal", "Normal"], ["spears", "Spears only"], ["discs", "Discs only"]),
    apply: "next",
    read: (r) => r.weapons ?? "normal",
    write: (r, v) => v === "normal" ? delete r.weapons : r.weapons = v
  },
  {
    key: "classes",
    label: "Classes",
    help: "Everyone picks one of nine classes; a limit caps how many on a team play the same one.",
    type: choice(["off", "Off"], ["on", "On"], ["1", "Max 1"], ["2", "Max 2"]),
    apply: "next",
    read: (r) => !r.classes ? "off" : r.classLimit ? String(r.classLimit) : "on",
    write: (r, v) => {
      delete r.classLimit;
      if (v === "off") return void delete r.classes;
      r.classes = true;
      if (v === "1" || v === "2") r.classLimit = Number(v);
    }
  },
  {
    key: "vehicles",
    label: "Vehicle damage",
    help: "Normal: vehicles burn and blow up. Tough: half damage. Off: they can't be destroyed.",
    type: choice(["normal", "Normal"], ["tough", "Tough"], ["off", "Off"]),
    apply: "next",
    read: (r) => r.vehicleDamage ?? "normal",
    write: (r, v) => v === "normal" ? delete r.vehicleDamage : r.vehicleDamage = v
  },
  {
    key: "flagreturn",
    label: "Flag return",
    help: "Seconds a dropped flag lies before it goes home (Capture the Flag, Fort Wars).",
    type: { kind: "int", min: 5, max: 120, step: 5, unit: "s" },
    apply: "next",
    modes: (m) => m === "core.ctf" || m === "core.forts",
    read: (r) => r.flagReturnSeconds ?? 30,
    write: (r, v) => r.flagReturnSeconds = v
  },
  {
    key: "hill",
    label: "Hill moves",
    help: "Seconds before the hill moves to the next spot (King of the Hill).",
    type: { kind: "int", min: 15, max: 300, step: 15, unit: "s" },
    apply: "next",
    modes: (m) => m === "core.koth",
    read: (r) => r.hillSeconds ?? 60,
    write: (r, v) => r.hillSeconds = v
  },
  {
    key: "fortbuild",
    label: "Build phase",
    help: "Minutes to build before the barrier drops (Fort Wars).",
    type: { kind: "int", min: 1, max: 6, unit: "min" },
    apply: "next",
    modes: (m) => m === "core.forts",
    read: (r) => Math.round((r.fortBuildSeconds ?? 150) / 60),
    write: (r, v) => r.fortBuildSeconds = v * 60
  },
  {
    key: "fortcombat",
    label: "Combat phase",
    help: "Minutes of Capture the Flag after each build phase (Fort Wars).",
    type: { kind: "int", min: 2, max: 20, unit: "min" },
    apply: "next",
    modes: (m) => m === "core.forts",
    read: (r) => Math.round((r.fortCombatSeconds ?? 300) / 60),
    write: (r, v) => r.fortCombatSeconds = v * 60
  },
  {
    key: "fortcycles",
    label: "Cycles",
    help: "Build-then-fight rounds before the match ends (Fort Wars).",
    type: { kind: "int", min: 1, max: 5 },
    apply: "next",
    modes: (m) => m === "core.forts",
    read: (r) => r.fortCycles ?? 1,
    write: (r, v) => r.fortCycles = v
  },
  {
    key: "fortbudget",
    label: "Build points",
    help: "Each team's budget: a block costs 2, a wall 4, a metal wall 8 (Fort Wars).",
    type: { kind: "int", min: 100, max: 800, step: 20 },
    apply: "next",
    modes: (m) => m === "core.forts",
    read: (r) => r.fortBudget ?? 420,
    write: (r, v) => r.fortBudget = v
  }
];
let byKey;
const ruleSpec = (key) => (byKey ??= new Map(SERVER_RULES.map((s) => [s.key, s]))).get(key.toLowerCase());
function setList(r, k, v) {
  if (!v.length || !v.some(Boolean)) delete r[k];
  else r[k] = v.slice(0, MAX_TEAMS);
}
const modeKey = (mode) => mode.replace(/^core\./, "");
function serverRuleFor(sr, key, mapId, mode) {
  const m = sr.maps?.[mapId];
  if (m && m[key] !== void 0) return { value: m[key], from: "map" };
  const spec = ruleSpec(key);
  if (spec?.perMode) {
    const v = sr.modes?.[modeKey(mode)]?.[key];
    return v === void 0 ? null : { value: v, from: "mode" };
  }
  return sr[key] === void 0 ? null : { value: sr[key], from: "all" };
}
function setServerRule(sr, key, value, where) {
  const spec = ruleSpec(key);
  const out = JSON.parse(JSON.stringify(sr));
  const put = (o) => value === void 0 ? delete o[spec.key] : o[spec.key] = value;
  if (where.map) {
    const maps = out.maps ??= {};
    put(maps[where.map] ??= {});
    if (!Object.keys(maps[where.map]).length) delete maps[where.map];
    if (!Object.keys(maps).length) delete out.maps;
  } else if (spec.perMode) {
    const modes = out.modes ??= {};
    const k = modeKey(where.mode);
    put(modes[k] ??= {});
    if (!Object.keys(modes[k]).length) delete modes[k];
    if (!Object.keys(modes).length) delete out.modes;
  } else put(out);
  return out;
}
function ruleText(spec, v) {
  const t = spec.type;
  if (v === "" || v === void 0 || v === null) return "default";
  if (t.kind === "int") return v === 0 && t.zero ? t.zero : `${String(v)}${t.unit ? ` ${t.unit}` : ""}`;
  if (t.kind === "bool") return v ? t.on : t.off;
  if (t.kind === "choice") return t.values.find(([x]) => x === v)?.[1] ?? String(v);
  return Array.isArray(v) ? v.join(", ") || "default" : String(v);
}
const PAIR_KEY = "tiletrigger.hostPair";
const PORT_KEY = "tiletrigger.hostPort";
const DEFAULT_PORT = 7797;
const RELEASES = "https://github.com/Dsoto1/splitters/releases/download/main-latest";
const HOST_DOWNLOADS = [
  { os: "windows", label: "Windows (64-bit)", file: "tiletrigger-host-windows-x64.zip", how: 'Unzip, then double-click "Start Tile Trigger Host.cmd". Windows may warn that the app is unrecognised: More info → Run anyway.' },
  { os: "macos", label: "macOS (Apple silicon)", file: "tiletrigger-host-macos-arm64.zip", how: 'Unzip, then right-click "Start Tile Trigger Host.command" → Open (the first time macOS asks, since the app is not notarised).' },
  { os: "macos", label: "macOS (Intel)", file: "tiletrigger-host-macos-x64.zip", how: "As above." },
  { os: "linux", label: "Linux (x64)", file: "tiletrigger-host-linux-x64.tar.gz", how: "Unpack, then run ./start-host.sh in a terminal." }
];
const el = (tag, props = {}, ...children) => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
};
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
    }
  }
};
function guessOs(ua = navigator.userAgent) {
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "macos";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return null;
}
function openHostPage(maps) {
  document.getElementById("menu")?.setAttribute("hidden", "");
  document.title = "Host a game · Tile Trigger";
  const takeFragment = () => {
    const frag = new URLSearchParams(location.hash.slice(1));
    if (frag.get("pair") && /^[a-f0-9]{48}$/.test(frag.get("pair"))) store.set(PAIR_KEY, frag.get("pair"));
    if (frag.get("port") && /^\d{2,5}$/.test(frag.get("port"))) store.set(PORT_KEY, frag.get("port"));
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  };
  takeFragment();
  const port = Number(new URLSearchParams(location.search).get("hostPort") ?? store.get(PORT_KEY) ?? DEFAULT_PORT);
  const api = `http://127.0.0.1:${port}/api`;
  const root = el("div", { className: "host-page", id: "host-page" });
  document.body.append(root);
  const service = el("div", { className: "panel hp-service", id: "hp-service" });
  root.append(
    el("div", { className: "hp-head" }, el("a", { href: "/", className: "link", textContent: "← Tile Trigger" }), el("h2", { innerHTML: "Host <em>a game</em>" })),
    el(
      "div",
      { className: "panel hp-browser" },
      el("h3", { textContent: "In your browser: nothing to install" }),
      el("p", { textContent: "Start any match, press Esc, then Host game (or Go online). Friends join with the code or from the game browser. The match runs in your tab: it ends when you close it, and takes up to 10 friends." }),
      el("a", { href: "/", className: "button primary", textContent: "Play a match" })
    ),
    el(
      "div",
      { className: "panel hp-dedicated" },
      el("h3", { textContent: "Dedicated host: optional download" }),
      el("p", { textContent: "For a server that stays up without a browser tab (up to 96 players with bots, 48 v 48), on a spare computer. It needs no port forwarding: players connect the way they join a friend's game. It shows in the game browser as a Dedicated host, run by you, not an official server. Nobody needs it to play or join." }),
      service
    )
  );
  let timer;
  const token = () => store.get(PAIR_KEY);
  const call = async (path, body) => {
    const res = await fetch(`${api}${path}`, {
      method: body === void 0 ? "GET" : "POST",
      headers: { ...token() ? { Authorization: `Bearer ${token()}` } : {}, ...body === void 0 ? {} : { "Content-Type": "application/json" } },
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: AbortSignal.timeout(4e3)
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  };
  const showDownloads = (why) => {
    const mine = guessOs();
    const list = el("ul", { className: "hp-downloads" });
    for (const d of [...HOST_DOWNLOADS].sort((a, b) => Number(b.os === mine) - Number(a.os === mine))) list.append(el("li", {}, el("a", { href: `${RELEASES}/${d.file}`, textContent: d.label, className: d.os === mine ? "button primary hp-download" : "link hp-download", rel: "noopener" }), el("small", { textContent: ` ${d.how}` })));
    const again = el("button", { textContent: "Look again", id: "hp-recheck" });
    again.addEventListener("click", () => void detect());
    service.replaceChildren(
      el("p", { className: "hint", id: "hp-state", textContent: why }),
      el("ol", { className: "hp-steps" }, el("li", { textContent: "Download the Host Service for your computer (below)." }), el("li", { textContent: "Unzip it and double-click the start file: a server window opens and your server starts (Frost Basin, 24 players and bots, listed in the game browser)." }), el("li", { textContent: "Manage it in that window (type help), or come back to this page: it finds the server and lets you change it, start and stop it." })),
      list,
      el("p", { className: "hint", textContent: "It runs as your own user (no administrator rights), opens nothing to the internet, and sends nothing but the game. Closing its window stops the server." }),
      again
    );
  };
  const showPairing = () => {
    const key = el("input", { id: "hp-pair", placeholder: "pairing key from the server window", autocomplete: "off", size: 50 });
    const use = el("button", { className: "primary", textContent: "Pair", id: "hp-pair-go" });
    use.addEventListener("click", () => {
      const v = key.value.trim().replace(/^.*#pair=/, "").replace(/&.*$/, "");
      if (!/^[a-f0-9]{48}$/.test(v)) return void (key.style.outline = "2px solid #e74c3c");
      store.set(PAIR_KEY, v);
      void detect();
    });
    service.replaceChildren(el("p", { id: "hp-state", textContent: "A Host Service is running on this computer, but this browser is not paired with it yet." }), el("p", { className: "hint", textContent: 'Open the "web control" link its window shows (it carries the pairing key), or paste that link here:' }), el("div", { className: "hc-row" }, key, use));
  };
  const fmtUptime = (s) => s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round(s % 3600 / 60)} min`;
  let lastStatus = null;
  const live = async (path, body) => {
    message.textContent = "…";
    try {
      const r = await call(path, body);
      message.textContent = r.status === 404 ? "This Host Service takes this change with the next Start (update it to change a running match from here)." : String(r.data.text ?? r.data.error ?? "").split("\n")[0];
    } catch {
      message.textContent = "Couldn't reach the Host Service.";
    }
    void refresh();
  };
  const rules = rulesSection((key, value) => {
    const s = lastStatus;
    if (s?.state === "running") return void live("/rules", { key, value: value === void 0 ? null : value });
    rules.draft = setServerRule(rules.draft, key, value, { mode: rules.modeOf() });
    rules.render(s, true);
  });
  let formBuilt = false;
  const form = el("form", { className: "hp-form", id: "hp-form" });
  const statusBox = el("div", { className: "hp-status", id: "hp-status" });
  const peopleBox = el("div", { className: "hp-people", id: "hp-people" });
  const message = el("p", { className: "hint", id: "hp-message" });
  const buildForm = (s) => {
    formBuilt = true;
    const c = s.config;
    const map = el("select", { id: "hp-map" });
    for (const m of maps) map.append(new Option(m.name, m.id, false, m.id === (c?.map ?? "frost_basin")));
    const mode = el("select", { id: "hp-mode" });
    const fillModes = () => {
      const m = maps.find((x) => x.id === map.value);
      const keep = mode.value || c?.mode || "";
      mode.replaceChildren(new Option("The map's own", ""), ...(m?.modes ?? []).map((x) => new Option(MODE_LABELS[x] ?? x, x, false, x === keep)));
    };
    map.addEventListener("change", fillModes);
    fillModes();
    const fill = el("input", { id: "hp-fill", type: "number", min: "1", max: "96", value: String(c?.botFill ?? 24) });
    const max = el("input", { id: "hp-max", type: "number", min: "1", max: "96", value: String(c?.maxPlayers ?? 16) });
    const name = el("input", { id: "hp-name", maxLength: 40, value: c?.name ?? "Dedicated host" });
    const vis = el("select", { id: "hp-visibility" });
    vis.append(new Option("In the game browser (and by code)", "listed", false, c?.visibility !== "code"), new Option("Join code only", "code", false, c?.visibility === "code"));
    const admin = el("input", { id: "hp-admin", type: "password", autocomplete: "new-password", placeholder: c?.adminTokenSet ? "set (leave empty to keep)" : "optional, 8+ characters" });
    const vote = el("input", { id: "hp-vote", type: "checkbox", checked: c?.mapVote !== false });
    rules.draft = JSON.parse(JSON.stringify(c?.rules ?? {}));
    rules.vote = vote;
    rules.modeOf = () => mode.value || maps.find((x) => x.id === map.value)?.modes[0] || "core.tdm";
    rules.mapOf = () => map.value;
    map.addEventListener("change", () => rules.render(lastStatus, true));
    mode.addEventListener("change", () => rules.render(lastStatus, true));
    vote.addEventListener("change", () => {
      if (lastStatus?.state !== "running") return;
      void live("/vote", { on: vote.checked });
    });
    const start = el("button", { className: "primary", id: "hp-start", type: "submit", textContent: "Start" });
    const stop = el("button", { id: "hp-stop", type: "button", textContent: "Stop" });
    const restart = el("button", { id: "hp-restart", type: "button", textContent: "Restart" });
    form.replaceChildren(
      el("label", {}, "Name in the game browser", name),
      el("label", {}, "Map", map),
      el("label", {}, "Mode", mode),
      el("label", {}, "Players and bots (96 = 48 v 48)", fill),
      el("label", {}, "People at most (your upload carries each: ~20 KB/s a player)", max),
      el("label", {}, "Visibility", vis),
      el("label", {}, "Admin token (in-game: Esc → Server admin)", admin),
      el("label", { className: "hp-check" }, vote, el("span", { textContent: "Vote on the next map: between matches everyone picks from two or three of our maps that fit (off: the rotation goes on; an empty one replays)" })),
      rules.box,
      el("div", { className: "hc-actions" }, start, restart, stop),
      message
    );
    const act = async (path, body) => {
      message.textContent = "…";
      try {
        const r = await call(path, body ?? {});
        message.textContent = r.ok ? "" : String(r.data.error ?? r.data.text ?? `the Host Service answered ${r.status}`);
      } catch {
        message.textContent = "Couldn't reach the Host Service.";
      }
      void refresh();
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void act("/start", {
        map: map.value,
        ...mode.value ? { mode: mode.value } : { mode: "" },
        botFill: Number(fill.value),
        maxPlayers: Number(max.value),
        name: name.value.trim(),
        visibility: vis.value,
        ...admin.value ? { adminToken: admin.value } : {},
        mapVote: vote.checked,
        rules: rules.draft
      });
    });
    stop.addEventListener("click", () => void act("/stop"));
    restart.addEventListener("click", () => void act("/restart"));
  };
  const render = (s) => {
    lastStatus = s;
    if (!formBuilt) {
      buildForm(s);
      service.replaceChildren(el("p", { id: "hp-state", className: "hp-connected", textContent: `Host Service ${s.version} on this computer` }), statusBox, peopleBox, form);
    }
    const h = s.host;
    const state = s.state === "running" && h ? `Running · join code ${h.code}` : s.state === "crashloop" ? "Stopped after repeated crashes" : s.state[0].toUpperCase() + s.state.slice(1);
    const lines = h && s.state === "running" ? [
      `${h.map} · ${MODE_LABELS[h.mode] ?? h.mode}${h.community ? " · Community map" : ""}`,
      `${h.players}/${h.maxPlayers} players, ${h.bots} bots · up ${fmtUptime(h.uptimeS)}`,
      h.online ? s.config?.visibility === "code" ? "Join code only" : h.listed ? "Listed in the game browser" : `Not listed yet${h.listingError ? `: ${h.listingError}` : ""}` : "Hub unreachable: players already in carry on; it reconnects by itself",
      `Tick ${h.tickMs.toFixed(1)} ms · upload ${h.upKBps} KB/s${h.relay ? " · relay available" : ""}`,
      ...perfLines(h.perf)
    ] : [];
    rules.render(s);
    statusBox.replaceChildren(el("b", { id: "hp-run-state", textContent: state }), ...lines.map((l) => el("div", { textContent: l })), ...s.lastError ? [el("div", { className: "hp-error", id: "hp-last-error", textContent: `Last error: ${s.lastError.summary}` })] : []);
    const people = h?.people ?? [];
    peopleBox.replaceChildren(
      ...people.length ? [el("h4", { textContent: "Players" })] : [],
      ...people.map((p) => {
        const kick = el("button", { textContent: "Kick", id: `hp-kick-${p.slot}` });
        kick.addEventListener("click", () => void call("/kick", { slot: p.slot }).then(() => refresh()));
        const ban = el("button", { textContent: "Ban", id: `hp-ban-${p.slot}` });
        ban.addEventListener("click", () => window.confirm(`Ban ${p.name}?`) && void call("/ban", { slot: p.slot }).then(() => refresh()));
        return el("div", { className: "hc-row" }, el("span", { textContent: `${p.name} ${p.account ? "(account)" : "(guest)"} · ${p.kills}/${p.deaths}${p.ping !== null ? ` · ${p.ping} ms` : ""}` }), kick, ban);
      }),
      ...s.bans.length ? [el("h4", { textContent: "Bans" })] : [],
      ...s.bans.map((b) => {
        const lift = el("button", { textContent: "Unban" });
        lift.addEventListener("click", () => void call("/unban", { id: b.id }).then(() => refresh()));
        return el("div", { className: "hc-row" }, el("span", { textContent: `${b.name} ${b.account ? "(account)" : "(guest)"}${b.until ? ` until ${new Date(b.until).toLocaleString()}` : ""}${b.reason ? `: ${b.reason}` : ""}` }), lift);
      })
    );
  };
  const refresh = async () => {
    try {
      const r = await call("/status");
      if (r.status === 401) {
        store.set(PAIR_KEY, null);
        formBuilt = false;
        return showPairing();
      }
      if (r.ok) render(r.data);
    } catch {
      formBuilt = false;
      window.clearInterval(timer);
      showDownloads("The Host Service stopped or was closed on this computer.");
    }
  };
  const detect = async () => {
    window.clearInterval(timer);
    service.replaceChildren(el("p", { id: "hp-state", className: "hint", textContent: "Looking for a Host Service on this computer…" }));
    try {
      const r = await call("/ping");
      if (r.data.service !== "tiletrigger-host") throw new Error("not ours");
      if (!r.data.paired) return showPairing();
      await refresh();
      timer = window.setInterval(() => void refresh(), 2e3);
    } catch {
      showDownloads("No Host Service is running on this computer.");
    }
  };
  window.addEventListener("hashchange", () => {
    if (!/pair=/.test(location.hash)) return;
    takeFragment();
    formBuilt = false;
    void detect();
  });
  void detect();
}
function perfLines(p) {
  if (!p) return [];
  const sp = p.split;
  const ms = (k) => (sp[k] ?? 0).toFixed(2);
  const sim = ["players", "mounts", "projectiles", "scenario"].reduce((s, k) => s + (sp[k] ?? 0), 0);
  return [
    `Tick split: bots ${ms("bots")} (think ${ms("botThink")} · perceive ${ms("botPerceive")} · path ${ms("botPath")} · aim ${ms("botAim")}) · sim ${sim.toFixed(2)} · snapshots ${ms("snapshot")} ms · slowest tick ${p.tickMax.toFixed(1)} ms`,
    `Snapshot ${(p.snapshotBytes / 1024).toFixed(1)} KB a client (largest ${(p.snapshotBytesMax / 1024).toFixed(1)} KB) · over budget ${p.spikes} this second, ${p.spikesTotal} in all${p.late ? ` · ${p.late} late` : ""}${p.spikeLog && p.spikesTotal ? ` (logs/${p.spikeLog})` : ""}`
  ];
}
const MAIN_RULES = ["score", "time", "respawn", "ff", "set", "mix", "drops", "teams", "assign"];
const WHEN = { live: "now", restart: "at the restart", next: "next match" };
function rulesSection(onSet) {
  const main = el("div", { className: "hp-rule-list", id: "hp-rules-main" });
  const more = el("div", { className: "hp-rule-list", id: "hp-rules-more" });
  const title = el("small", { id: "hp-rules-mode" });
  const moreBox = el("details", { className: "hp-rules-more" }, el("summary", { textContent: "More rules" }), more);
  const box = el("fieldset", { className: "hp-rules", id: "hp-rules" }, el("legend", {}, "Match rules ", title), el("p", { className: "hint", textContent: "Every Match setup rule, kept for every match this server plays (score, time and respawn for this mode). Default: the mode's own. Running, a change goes to the match at once and applies as its tag says." }), main, moreBox);
  let shown = "";
  const self = {
    box,
    draft: {},
    vote: null,
    modeOf: () => "core.tdm",
    mapOf: () => "",
    /** Draw the rules (again only when what they show changed, and never under the visitor's cursor). */
    render(s, force = false) {
      const running = s?.state === "running" && !!s.host;
      const mode = running && s.host.mode ? s.host.mode : self.modeOf();
      const mapId = running ? s.host.mapId ?? s.host.map : self.mapOf();
      const set = running ? s.config?.rules ?? {} : self.draft;
      if (running) self.draft = JSON.parse(JSON.stringify(set));
      const rows = new Map((running ? s.host.ruleRows ?? [] : []).map((r) => [r.key, r]));
      if (self.vote && running && s.host.rotation?.vote !== void 0 && document.activeElement !== self.vote) self.vote.checked = s.host.rotation.vote;
      const key = JSON.stringify([running, mode, mapId, set, [...rows.values()].map((r) => [r.key, r.pending, r.now])]);
      if (!force && key === shown || box.contains(document.activeElement)) return;
      shown = key;
      title.textContent = `· ${MODE_LABELS[mode] ?? mode}`;
      const specs = SERVER_RULES.filter((r) => !r.modes || r.modes(mode));
      main.replaceChildren(...specs.filter((r) => MAIN_RULES.includes(r.key)).map((r) => ruleRow(r, serverRuleFor(set, r.key, mapId, mode)?.value, rows.get(r.key), onSet)));
      more.replaceChildren(...specs.filter((r) => !MAIN_RULES.includes(r.key)).map((r) => ruleRow(r, serverRuleFor(set, r.key, mapId, mode)?.value, rows.get(r.key), onSet)));
      moreBox.hidden = !more.childElementCount;
      box.dataset.mode = modeKey(mode);
    }
  };
  return self;
}
function ruleRow(spec, value, row, onSet) {
  const t = spec.type;
  const id = `hp-rule-${spec.key}`;
  let control;
  const has = value !== void 0 && value !== null;
  if (t.kind === "int") {
    control = el("input", { id, type: "number", min: String(t.min), max: String(t.max), step: String(t.step ?? 1), value: has ? String(value) : "", placeholder: row ? `default (${ruleText(spec, row.now)})` : "default" });
    control.addEventListener("change", () => {
      const v = control.value.trim();
      const n = Number(v);
      if (v === "") return onSet(spec.key, void 0);
      if (!Number.isFinite(n) || n < t.min || n > t.max) return void (control.style.outline = "2px solid #e74c3c");
      onSet(spec.key, Math.round(n));
    });
  } else if (t.kind === "list") {
    control = el("input", { id, value: Array.isArray(value) ? value.join(", ") : has ? String(value) : "", placeholder: "default (the map's)", maxLength: 200 });
    control.addEventListener("change", () => {
      const items = control.value.split(",").map((x) => x.trim()).filter(Boolean);
      if (t.pattern && items.some((x) => !t.pattern.test(x))) return void (control.style.outline = "2px solid #e74c3c");
      onSet(spec.key, items.length ? items : void 0);
    });
  } else {
    const values = t.kind === "bool" ? [["on", t.on], ["off", t.off]] : t.values.map(([v, l]) => [v, l]);
    const sel = el("select", { id });
    const cur = t.kind === "bool" ? has ? value ? "on" : "off" : "" : has ? String(value) : "";
    sel.append(new Option(row ? `Default (${ruleText(spec, row.now)})` : "Default", "", false, cur === ""), ...values.map(([v, l]) => new Option(l, v, false, v === cur)));
    sel.addEventListener("change", () => onSet(spec.key, sel.value === "" ? void 0 : t.kind === "bool" ? sel.value === "on" : sel.value));
    control = sel;
  }
  const wait = row?.pending ? el("em", { className: "hp-rule-wait", textContent: ` · waits for the ${spec.apply === "restart" ? "restart" : "next match"}` }) : "";
  return el("label", { className: "hp-rule", title: spec.help }, el("span", {}, spec.label, el("i", { className: `hp-tag ${spec.apply}`, textContent: WHEN[spec.apply] }), wait), control);
}
export {
  HOST_DOWNLOADS,
  guessOs,
  openHostPage
};
