import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMap, mapPlayerCaps, playableModes, type MapDocument } from '@tiletrigger/shared';
import { Tutorial, TUTORIAL_STEPS, type TutorialSample } from '../src/game/tutorial.ts';
import { TIP_GAP, TIP_IDS, TIP_SECONDS, TIP_STALE, TIP_TEXT, TipBook, type TipState } from '../src/game/tips.ts';
import { QUICK_MAPS, QUICK_MODES, pickQuickMap, quickSetup, type QuickCandidate } from '../src/frontend/quickPlay.ts';
import { keyMarkup } from '../src/game/coachHud.ts';

const map = (id: string): MapDocument => {
  const r = loadMap(JSON.parse(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(`${id} failed to load`);
  return r.map;
};

/** A frame standing still at the origin, looking ahead: change what a test needs. */
const still = (o: Partial<TutorialSample> = {}): TutorialSample => ({ dt: 1 / 60, alive: true, x: 0, z: 0, yaw: 0, pitch: 0, moving: false, sprinting: false, stance: 0, shots: 0, aimedShots: 0, reloading: false, held: 2, thrown: 0, driving: false, ...o });

describe('tutorial steps', () => {
  it('has the ten steps in order, each with words for keyboard and for touch', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['look', 'move', 'sprint', 'crouch', 'shoot', 'aim', 'reload', 'switch', 'throw', 'drive']);
    for (const s of TUTORIAL_STEPS) {
      expect(s.kb.length).toBeGreaterThan(5);
      expect(s.touch.length).toBeGreaterThan(5);
      expect(s.kb).not.toMatch(/\[(?![^\]]+\])/);
    }
  });

  it('completes each step only on its own action, never by waiting', () => {
    const t = new Tutorial();
    // Ten seconds of standing still: nothing.
    for (let i = 0; i < 600; i++) expect(t.update(still())).toBe(false);
    expect(t.step?.id).toBe('look');
    // Look: turning the view (the short way round across ±π counts small).
    let yaw = 3.0;
    t.update(still({ yaw }));
    for (let i = 0; i < 30 && t.step?.id === 'look'; i++) t.update(still({ yaw: (yaw += 0.1) > Math.PI ? yaw - 2 * Math.PI : yaw }));
    expect(t.step?.id).toBe('move');
    // Move: walking 5 m with a movement key; a teleport (respawn) doesn't count, nor does moving without a key.
    t.update(still({ x: 50, moving: true }));
    expect(t.amount).toBe(0);
    t.update(still({ x: 54 }));
    expect(t.amount).toBe(0);
    let x = 54;
    while (t.step?.id === 'move') t.update(still({ x: (x += 0.1), moving: true }));
    expect(x - 54).toBeCloseTo(5, 0);
    // Sprint: 1.2 s sprinting while moving.
    let frames = 0;
    while (t.step?.id === 'sprint') {
      t.update(still({ sprinting: true, moving: true }));
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(72);
    // Crouch: a moment crouched.
    while (t.step?.id === 'crouch') t.update(still({ stance: 1 }));
    // Shoot: three rounds; aiming shots don't count before the aim step, hip shots don't count in it.
    t.update(still({ shots: 2 }));
    expect(t.step?.id).toBe('shoot');
    expect(t.update(still({ shots: 1 }))).toBe(true);
    t.update(still({ shots: 5 }));
    expect(t.step?.id).toBe('aim');
    t.update(still({ shots: 1, aimedShots: 1 }));
    expect(t.update(still({ shots: 1, aimedShots: 1 }))).toBe(true);
    // Reload: a reload starting.
    expect(t.step?.id).toBe('reload');
    expect(t.update(still({ reloading: true }))).toBe(true);
    // Switch: another weapon in hand than when the step began.
    expect(t.step?.id).toBe('switch');
    t.update(still({ held: 2 }));
    expect(t.step?.id).toBe('switch');
    expect(t.update(still({ held: 1 }))).toBe(true);
    // Throw: a grenade thrown.
    expect(t.step?.id).toBe('throw');
    expect(t.update(still({ thrown: 1 }))).toBe(true);
    // Drive: 15 m in a driver's seat; walking there doesn't count.
    expect(t.step?.id).toBe('drive');
    for (let i = 0; i < 200; i++) t.update(still({ x: i * 0.2, moving: true }));
    expect(t.step?.id).toBe('drive');
    let d = 0;
    while (!t.done && d < 100) t.update(still({ x: (d += 0.5), driving: true }));
    expect(t.done).toBe(true);
    expect(t.step).toBeNull();
    expect(t.progress).toBe(1);
  });

  it('dead frames do nothing', () => {
    const t = new Tutorial();
    t.goTo(4);
    t.update(still({ alive: false, shots: 10 }));
    expect(t.step?.id).toBe('shoot');
    expect(t.amount).toBe(0);
  });

  it('every step can be done in a few seconds of play: well under 3 minutes for all ten', () => {
    // At walking pace (5.2 m/s), a buggy at 10 m/s, a reload or throw in a second: the goals themselves.
    const seconds = { look: 1, move: 5 / 5.2, sprint: 1.2, crouch: 0.4, shoot: 1, aim: 1, reload: 1, switch: 1, throw: 1, drive: 15 / 10 } as const;
    const doing = TUTORIAL_STEPS.reduce((n, s) => n + seconds[s.id], 0);
    // Reading each card (~6 s) and walking to the buggy (~25 m from the farthest west spawn) on top.
    expect(doing + TUTORIAL_STEPS.length * 6 + 25 / 5.2).toBeLessThan(120);
  });
});

describe('first-time tips', () => {
  const memory = (state: TipState = { off: false, seen: [] }) => {
    const saves: TipState[] = [];
    return { saves, persist: { load: () => state, save: (s: TipState) => void saves.push(s) } };
  };

  it('shows each tip once, ever, and remembers it as seen when it shows', () => {
    const m = memory();
    const tips = new TipBook(m.persist);
    tips.trigger('reload', 0);
    expect(tips.update(0)).toBe('reload');
    expect(m.saves.at(-1)?.seen).toEqual(['reload']);
    // Over, then the same situation again: nothing.
    expect(tips.update(TIP_SECONDS + 0.1)).toBeNull();
    tips.trigger('reload', 20);
    expect(tips.update(20)).toBeNull();
    // A new match in the same browser: still seen.
    const again = new TipBook({ load: () => m.saves.at(-1)!, save: () => undefined });
    again.trigger('reload', 0);
    expect(again.update(0)).toBeNull();
  });

  it('never shows two at once: the next waits for the first to go, plus a gap', () => {
    const tips = new TipBook(memory().persist);
    tips.trigger('vehicle', 0);
    expect(tips.update(0)).toBe('vehicle');
    tips.trigger('pickup', 0.1);
    tips.trigger('pickup', 0.2);
    expect(tips.update(0.2)).toBe('vehicle');
    expect(tips.update(TIP_SECONDS - 0.1)).toBe('vehicle');
    expect(tips.update(TIP_SECONDS)).toBeNull();
    expect(tips.update(TIP_SECONDS + TIP_GAP - 0.1)).toBeNull();
    expect(tips.update(TIP_SECONDS + TIP_GAP)).toBe('pickup');
  });

  it('drops a tip whose moment passed while another showed (it shows another time)', () => {
    const tips = new TipBook(memory().persist);
    tips.trigger('death', 0);
    tips.trigger('armor', 0);
    expect(tips.update(0)).toBe('death');
    expect(tips.update(TIP_STALE + 1)).toBeNull();
    expect(tips.seen('armor')).toBe(false);
  });

  it('shows nothing when switched off; seen tips stay seen', () => {
    const tips = new TipBook(memory({ off: true, seen: ['shield'] }).persist);
    expect(tips.enabled).toBe(false);
    for (const id of TIP_IDS) tips.trigger(id, 0);
    expect(tips.update(0)).toBeNull();
    expect(tips.seen('shield')).toBe(true);
  });

  it('has words for every tip, keyboard and touch, and key caps escape the text', () => {
    for (const id of TIP_IDS) expect(TIP_TEXT[id].kb && TIP_TEXT[id].touch).toBeTruthy();
    expect(keyMarkup('Press [R] <now>')).toBe('Press <kbd>R</kbd> &lt;now&gt;');
  });
});

describe('Quick Play', () => {
  const all = (): QuickCandidate[] => [...new Set(Object.values(QUICK_MAPS).flat())].map((key) => ({ key, modes: playableModes(map(key)), recommendedMax: map(key).metadata.recommendedPlayers.max, official: true }));

  it('lists only maps of the suite that play the mode', () => {
    for (const mode of QUICK_MODES) for (const key of QUICK_MAPS[mode]) expect(playableModes(map(key))).toContain(mode);
  });

  it('picks from the mode list, never a map that is not ours, and not the last one when there is another', () => {
    const maps = all();
    const own: QuickCandidate = { key: 'own:1', modes: ['core.tdm', 'core.deathmatch'], recommendedMax: 4, official: false };
    for (let r = 0; r < 1; r += 0.05) {
      const k = pickQuickMap('core.deathmatch', [...maps, own], 48, 'citadel', r)!;
      expect(QUICK_MAPS['core.deathmatch']).toContain(k);
      expect(k).not.toBe('citadel');
    }
    expect(pickQuickMap('core.tdm', [own], 48, null, 0)).toBeNull();
  });

  it('on a device that runs fewer players, prefers maps that fit it', () => {
    const maps = all();
    for (let r = 0; r < 1; r += 0.1) {
      const k = pickQuickMap('core.tdm', maps, 12, null, r)!;
      expect(maps.find((m) => m.key === k)!.recommendedMax).toBeLessThanOrEqual(12);
    }
  });

  it("plays the map's recommended players for the mode, normal bots, two even teams in TDM", () => {
    const sandgate = map('sandgate');
    const tdm = quickSetup('core.tdm', sandgate, 'sandgate', 48);
    const rec = mapPlayerCaps(sandgate, 'core.tdm').recommended;
    expect(tdm.teams).toEqual([rec / 2, rec / 2]);
    expect(tdm.skill).toBe('normal');
    const citadel = map('citadel');
    const dm = quickSetup('core.deathmatch', citadel, 'citadel', 48);
    expect(dm.bots + 1).toBe(mapPlayerCaps(citadel, 'core.deathmatch').recommended);
    expect(dm.teams).toBeUndefined();
    // A phone's limit caps it.
    expect(quickSetup('core.deathmatch', citadel, 'citadel', 8).bots).toBe(7);
  });
});
