import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PROTOCOL_VERSION, type RosterEntry, type ServerMessage } from '@tiletrigger/shared';
import { makeMap } from '../../shared/test/helpers.ts';
import { LocalTransport, type RemoteLink } from '../src/game/localTransport.ts';
import { MUTE_MAX, MuteList, type MuteStore } from '../src/game/chatMute.ts';

// The browser match runs on timers and reads the tab's visibility: enough of a window for it.
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.window ??= globalThis;
  g.document ??= { hidden: false };
});

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

/** A friend's connection (Host game) that records what the host sends. */
function friend() {
  const got: ServerMessage[] = [];
  let onMsg: ((t: string) => void) | null = null;
  const link: RemoteLink = {
    send: (text) => got.push(JSON.parse(text) as ServerMessage),
    onMessage: (cb) => void (onMsg = cb),
    onClose: () => undefined,
    close: () => undefined,
  };
  return { link, got, say: (m: object) => onMsg?.(JSON.stringify(m)), chats: () => got.filter((m): m is Extract<ServerMessage, { t: 'chat' }> => m.t === 'chat') };
}

const until = async (cond: () => boolean, ms = 15000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

const open: LocalTransport[] = [];
afterEach(() => open.splice(0).forEach((t) => t.close()));

describe('chat in a browser-hosted match (Host game): the host relays', () => {
  it("passes friends' lines on filtered, team chat to the sender's team only, and holds back a flood", async () => {
    const t = new LocalTransport(yard(), { name: 'Host', botFill: 4, difficulty: 'normal', rules: { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] } });
    open.push(t);
    const got: ServerMessage[] = [];
    t.start((m) => got.push(m), () => undefined);
    await until(() => got.some((m) => m.t === 'host'));
    expect(got.find((m): m is Extract<ServerMessage, { t: 'welcome' }> => m.t === 'welcome')!.ch).toBe(1);
    const friends = [friend(), friend(), friend()];
    friends.forEach((f, i) => {
      t.accept(f.link);
      f.say({ t: 'hello', protocol: PROTOCOL_VERSION, name: `Friend${i}` });
    });
    const slots = friends.map((f) => f.got.find((m): m is Extract<ServerMessage, { t: 'welcome' }> => m.t === 'welcome')!.slot);
    expect(friends[0]!.got.find((m) => m.t === 'welcome')).toMatchObject({ ch: 1 });
    const roster = (): RosterEntry[] => [...got].reverse().find((m): m is Extract<ServerMessage, { t: 'roster' }> => m.t === 'roster')!.players;
    await until(() => slots.every((s) => roster().some((p) => p.slot === s && !p.bot)));
    const team = (slot: number) => roster().find((p) => p.slot === slot)!.team;
    const me = roster().find((p) => p.name === 'Host')!;

    // All chat: everyone hears it (the host's own page too), the filter's word masked.
    const bad = 'shpx'.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 84) % 26) + 97));
    friends[0]!.say({ t: 'chat', x: `nice ${bad} shot` });
    for (const f of friends) expect(f.chats().at(-1)).toEqual({ t: 'chat', s: slots[0], x: 'nice **** shot' });
    await until(() => got.some((m) => m.t === 'chat' && m.s === slots[0]));

    // Team chat: only the sender's team (the host's page included when it's on it).
    friends[0]!.say({ t: 'chat', x: 'push left', tm: 1 });
    const mine = team(slots[0]!);
    friends.forEach((f, i) => expect(f.chats().some((m) => m.x === 'push left'), `friend ${i}`).toBe(team(slots[i]!) === mine));
    expect(friends[0]!.chats().find((m) => m.x === 'push left')).toEqual({ t: 'chat', s: slots[0], x: 'push left', tm: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(got.some((m) => m.t === 'chat' && m.x === 'push left')).toBe(me.team === mine);

    // The host types too: through the same gate, to everyone.
    t.sendChat('hello all', false);
    await until(() => got.some((m) => m.t === 'chat' && m.x === 'hello all'));
    for (const f of friends) expect(f.chats().some((m) => m.x === 'hello all' && m.s === me.slot)).toBe(true);

    // A flood: a few lines pass, then the sender alone is told to slow down; nobody else hears the rest.
    for (let i = 0; i < 8; i++) friends[1]!.say({ t: 'chat', x: `spam ${i}` });
    expect(friends[1]!.chats().some((m) => m.s === -1 && /slow down/i.test(m.x))).toBe(true);
    expect(friends[2]!.chats().filter((m) => m.x.startsWith('spam'))).toHaveLength(4);
    expect(friends[2]!.chats().some((m) => m.s === -1)).toBe(false);
    // The same line twice in a row: dropped, with a word to the sender.
    friends[2]!.say({ t: 'chat', x: 'gg' });
    friends[2]!.say({ t: 'chat', x: 'GG' });
    expect(friends[2]!.chats().at(-1)).toEqual({ t: 'chat', s: -1, x: 'You just said that' });
    expect(friends[0]!.chats().filter((m) => m.x.toLowerCase() === 'gg')).toHaveLength(1);
  });
});

describe('mute (chatMute.ts): remembered on the device', () => {
  const store = (): MuteStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it('mutes and unmutes by name (any case), and a new list on the same device remembers', () => {
    const s = store();
    const a = new MuteList(s);
    expect(a.has('Rex')).toBe(false);
    a.set('Rex', true);
    expect(a.has('rex ')).toBe(true);
    expect(new MuteList(s).has('REX')).toBe(true);
    expect(a.toggle('rex')).toBe(false);
    expect(new MuteList(s).has('Rex')).toBe(false);
    expect(a.has(undefined)).toBe(false);
  });

  it('keeps at most MUTE_MAX names (the oldest go) and survives a broken or blocked store', () => {
    const s = store();
    const a = new MuteList(s);
    for (let i = 0; i < MUTE_MAX + 5; i++) a.set(`p${i}`, true);
    expect(a.size).toBe(MUTE_MAX);
    expect(a.has('p0')).toBe(false);
    expect(a.has(`p${MUTE_MAX + 4}`)).toBe(true);
    s.data.set('cs.chatMuted', '{not json');
    expect(new MuteList(s).size).toBe(0);
    const blocked: MuteStore = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const b = new MuteList(blocked);
    b.set('Rex', true);
    expect(b.has('Rex')).toBe(true);
  });
});
