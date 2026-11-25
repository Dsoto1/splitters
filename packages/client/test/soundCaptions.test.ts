import { describe, expect, it } from 'vitest';
import { CORE_WEAPONS } from '@tiletrigger/shared';
import { AudioSystem, SOUNDS } from '../src/audio/audio.ts';
import { CAPTION_MODES, parseCaptionMode } from '../src/game/captionPrefs.ts';
import { CAPTION_RULES, CaptionStack, FADE_MS, HOLD_MS, MAX_LINES, NO_DIR, RENDER_MS, SELF_RADIUS, SoundCaptions, captionRule, captionText, directionOf } from '../src/game/soundCaptions.ts';

const textOf = (id: string) => {
  const i = captionRule(id);
  return i < 0 ? undefined : CAPTION_RULES[i]!.text;
};

describe('the caption table', () => {
  it('captions the important sounds and keeps the rest out', () => {
    expect(textOf('fire.rifle')).toBe('Gunfire');
    expect(textOf('fire.heavy.l86.fast')).toBe('Gunfire');
    expect(textOf('fire.knife')).toBeNull();
    expect(textOf('fire.shotgun.pump')).toBeNull();
    expect(textOf('throw')).toBe('Grenade!');
    expect(textOf('explosion')).toBe('Explosion');
    expect(textOf('explosion.debris')).toBeNull();
    expect(textOf('explosion.vehicle')).toBeNull();
    expect(textOf('footstep')).toBe('Footsteps');
    expect(textOf('footstep.metal')).toBe('Footsteps');
    expect(textOf('vehicle.engine')).toBe('Vehicle');
    expect(textOf('door.open')).toBe('Door');
    expect(textOf('objective.new')).toBe('Objective updated');
    expect(textOf('ui.heartbeat')).toBe('Heartbeat (low health)');
    // Interface and own-feedback sounds never caption.
    for (const id of ['ui.hit', 'ui.kill', 'message', 'weather.rain', 'pickup.ammo', 'dryfire', 'land', 'death']) expect(captionRule(id), id).toBe(-1);
    // A prefix needs a whole word: 'throwable' isn't 'throw', 'footsteps' isn't 'footstep.'.
    expect(captionRule('throwable')).toBe(-1);
  });

  it('names only real sounds, and every weapon shot captions as gunfire', () => {
    const ids = Object.keys(SOUNDS);
    for (const r of CAPTION_RULES) if (!['fire.cycle'].includes(r.prefix)) expect(ids.some((id) => captionRule(id) >= 0 && (id === r.prefix || id.startsWith(r.prefix))), r.prefix).toBe(true);
    // Other players' shots are captioned by what they are (SessionAudio passes caption 'fire.shot'), whatever sound a
    // gun borrows (the Nailgun's is a door's); a gun's own fire.* sound captions as gunfire too.
    expect(textOf('fire.shot')).toBe('Gunfire');
    expect(textOf('fire.cycle')).toBeNull();
    for (const def of Object.values(CORE_WEAPONS)) {
      const id = def.view.sound ?? `fire.${def.id.replace(/^core\./, '')}`;
      if (def.kind === 'melee' || !id.startsWith('fire.') || id.startsWith('fire.knife')) continue;
      expect(textOf(id), `${def.id} ${id}`).toBe('Gunfire');
    }
  });

  it('reads a saved setting, anything else is off', () => {
    expect(CAPTION_MODES).toEqual(['off', 'on', 'dir']);
    expect(parseCaptionMode('dir')).toBe('dir');
    expect(parseCaptionMode('loud')).toBe('off');
    expect(parseCaptionMode(null)).toBe('off');
  });
});

describe('direction', () => {
  const ear = { x: 10, y: 1.6, z: 10 };
  it('is ahead, right, behind or left of the way you face', () => {
    // Yaw 0 faces +z; right is +x (the session's lean: right = (cos yaw, -sin yaw)).
    expect(directionOf(ear, 0, { x: 10, y: 0, z: 30 })).toBe(0);
    expect(directionOf(ear, 0, { x: 30, y: 0, z: 10 })).toBe(1);
    expect(directionOf(ear, 0, { x: 10, y: 0, z: -5 })).toBe(2);
    expect(directionOf(ear, 0, { x: -5, y: 0, z: 10 })).toBe(3);
    // Turned a quarter right (yaw π/2 faces +x): +x is ahead, -z right, +z left.
    expect(directionOf(ear, Math.PI / 2, { x: 40, y: 0, z: 10 })).toBe(0);
    expect(directionOf(ear, Math.PI / 2, { x: 10, y: 0, z: -20 })).toBe(1);
    expect(directionOf(ear, Math.PI / 2, { x: 10, y: 0, z: 40 })).toBe(3);
    // Quarters split at 45°; height doesn't count; right overhead has no direction.
    expect(directionOf(ear, 0, { x: 15, y: 50, z: 16 })).toBe(0);
    expect(directionOf(ear, 0, { x: 16, y: 0, z: 15 })).toBe(1);
    expect(directionOf(ear, 0, { x: 10.1, y: 9, z: 10 })).toBe(NO_DIR);
  });
});

describe('the stack', () => {
  const gun = captionRule('fire.rifle');
  const steps = captionRule('footstep');
  const nade = captionRule('throw');
  const door = captionRule('door.open');

  it('merges repeats into one line with a count, steady sounds without one', () => {
    const s = new CaptionStack();
    for (let i = 0; i < 3; i++) s.push(gun, false, 3, false, 100 + i * 50);
    s.push(steps, false, 2, false, 200);
    s.push(steps, false, 2, false, 400);
    expect(s.lines.map((l) => captionText(l))).toEqual(['Gunfire, left ×3', 'Footsteps, behind']);
    // A different side or distance is its own line.
    s.push(gun, false, 1, true, 500);
    expect(captionText(s.lines.at(-1)!)).toBe('Gunfire, far right');
    s.push(nade, false, 0, false, 600);
    expect(captionText(s.lines.at(-1)!)).toBe('Grenade! ahead');
    s.push(gun, true, NO_DIR, false, 700);
    expect(captionText(s.lines.at(-1)!)).toBe('Friendly gunfire');
  });

  it('keeps at most MAX_LINES, dropping the lowest-ranked oldest', () => {
    const s = new CaptionStack();
    s.push(door, false, 0, false, 0);
    for (let d = 0; d < 4; d++) s.push(gun, false, d, false, 10 + d);
    expect(s.lines.length).toBe(MAX_LINES);
    expect(s.lines.some((l) => l.rule === door)).toBe(false);
    // A door doesn't push gunfire out.
    expect(s.push(door, false, 1, false, 20)).toBe(false);
    // A grenade does.
    expect(s.push(nade, false, 1, false, 30)).toBe(true);
    expect(s.lines.length).toBe(MAX_LINES);
    expect(captionText(s.lines.at(-1)!)).toBe('Grenade! right');
  });

  it('fades a line out HOLD_MS after its last sound, then lets it go', () => {
    const s = new CaptionStack();
    s.push(gun, false, 0, false, 0);
    s.push(gun, false, 0, false, 1500);
    s.expire(1500 + HOLD_MS + FADE_MS - 1);
    expect(s.lines.length).toBe(1);
    s.expire(1500 + HOLD_MS + FADE_MS);
    expect(s.lines.length).toBe(0);
    // Heard again after it faded: a fresh count.
    s.push(gun, false, 0, false, 9000);
    expect(captionText(s.lines[0]!)).toBe('Gunfire, ahead');
  });
});

/** A stand-in for the audio system: the listener, and the hook. */
function fakeAudio(yaw = 0) {
  return { onSound: null as AudioSystem['onSound'], earAt: { x: 0, y: 1.6, z: 0 }, earYaw: yaw } as unknown as AudioSystem;
}

function captions(audio: AudioSystem, friends: number[] = []) {
  let now = 1000;
  const c = new SoundCaptions(audio, (s) => (friends.includes(s) ? 'friend' : 'enemy'), () => null, () => now);
  c.setMode('dir');
  return { c, at: (t: number) => (now = t), texts: () => c.stack.lines.map((l) => captionText(l)) };
}

describe('SoundCaptions', () => {
  it('captions what others do, not your own sounds, nor a teammate\'s steps', () => {
    const audio = fakeAudio();
    const { c, texts } = captions(audio, [5]);
    expect(audio.onSound).toBe(c.hear);
    c.hear('fire.rifle', { x: -20, y: 1, z: 0 }, 20, 250, 3);
    c.hear('fire.rifle', { x: 20, y: 1, z: 0 }, 20, 250, 5);
    c.hear('footstep', { x: 0, y: 0, z: -8 }, 8, 30, 3);
    c.hear('footstep', { x: 0, y: 0, z: 8 }, 8, 30, 5);
    // Your own shot isn't positioned; the player you watch is at your ear.
    c.hear('fire.rifle', undefined, 0, 250, undefined);
    c.hear('fire.rifle', { x: 0.4, y: 1.4, z: 0.3 }, SELF_RADIUS - 0.5, 250, 7);
    expect(texts()).toEqual(['Gunfire, left', 'Friendly gunfire, right', 'Footsteps, behind']);
    // Far: past FAR_SHARE of the range.
    c.hear('fire.rifle', { x: 0, y: 1, z: 200 }, 200, 250, 3);
    expect(texts().at(-1)).toBe('Gunfire, far ahead');
    // Objective cues have no place: captioned without a direction.
    c.hear('objective.new', undefined, 0, 60, undefined);
    expect(texts().at(-1)).toBe('Objective updated');
  });

  it('without direction, says only what; off, it lets go of the hook', () => {
    const audio = fakeAudio();
    const { c, texts } = captions(audio);
    c.setMode('on');
    c.hear('fire.rifle', { x: -20, y: 1, z: 0 }, 20, 250, 3);
    c.hear('fire.rifle', { x: 0, y: 1, z: 200 }, 200, 250, 3);
    expect(texts()).toEqual(['Gunfire ×2']);
    c.setMode('off');
    expect(audio.onSound).toBeNull();
    expect(c.stack.lines.length).toBe(0);
  });

  it('redraws at most every RENDER_MS, and only when something changed', () => {
    const audio = fakeAudio();
    const { c, at } = captions(audio);
    for (let t = 0; t < 1000; t += 5) {
      at(1000 + t);
      c.hear('fire.rifle', { x: -20, y: 1, z: 0 }, 20, 250, 3);
      c.update(1000 + t);
    }
    expect(c.stats.renders).toBeLessThanOrEqual(Math.ceil(1000 / RENDER_MS) + 1);
    expect(c.stats.renders).toBeGreaterThan(1);
    const before = c.stats.renders;
    // Nothing new, nothing fading yet: no redraw.
    c.update(2000 + RENDER_MS);
    c.update(2000 + RENDER_MS * 2);
    expect(c.stats.renders).toBeLessThanOrEqual(before + 1);
    // 200 sounds a second make one line.
    expect(c.stack.lines.length).toBe(1);
    expect(c.stack.lines[0]!.count).toBe(99);
  });
});

describe('the audio system\'s hook', () => {
  it('hears world sounds within their range only, even with audio not started', () => {
    const audio = new AudioSystem();
    audio.setListener({ x: 0, y: 1.6, z: 0 }, 0, 0);
    const heard: string[] = [];
    audio.onSound = (id, at, dist, cull, by) => heard.push(`${id}@${Math.round(dist)}/${cull}${at ? '' : ' own'}${by === undefined ? '' : ` by ${by}`}`);
    // Footsteps carry 30 m (near), gunfire 250 m (far).
    audio.play('footstep', { at: { x: 0, y: 0, z: 20 }, by: 2 });
    audio.play('footstep', { at: { x: 0, y: 0, z: 40 }, by: 2 });
    audio.play('fire.rifle', { at: { x: 200, y: 1.6, z: 0 }, by: 2 });
    audio.play('fire.rifle', { at: { x: 300, y: 1.6, z: 0 }, by: 2 });
    audio.play('fire.rifle');
    expect(heard).toEqual(['footstep@20/30 by 2', 'fire.rifle@200/250 by 2', 'fire.rifle@0/250 own']);
  });

  it('through SoundCaptions: out of range or your own makes no caption', () => {
    const audio = new AudioSystem();
    audio.setListener({ x: 0, y: 1.6, z: 0 }, 0, 0);
    const c = new SoundCaptions(audio, () => 'enemy', () => null);
    c.setMode('dir');
    audio.play('footstep', { at: { x: 0, y: 0, z: 40 }, by: 2 });
    audio.play('fire.rifle', { at: { x: 0, y: 1.6, z: 300 }, by: 2 });
    audio.play('fire.rifle');
    audio.play('reload.start');
    expect(c.stack.lines.length).toBe(0);
    audio.play('fire.rifle', { at: { x: 0, y: 1.6, z: -100 }, by: 2 });
    expect(c.stack.lines.map((l) => captionText(l))).toEqual(['Gunfire, behind']);
    c.dispose();
    expect(audio.onSound).toBeNull();
  });
});
