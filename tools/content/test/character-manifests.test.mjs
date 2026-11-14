import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as npcs from '../npcs.mjs';
import * as roulette from '../roulette.mjs';
import { CLIP_SETS_DIR, MANIFEST_DIR, QUEUE_FILE, TIERS, armsOf, buildSpec, clipSetProblems, looksProblems, looksSource, manifestProblems, readClipSets, readManifests, stubFromQueue } from '../character-manifests.mjs';

describe('character manifests', () => {
  const list = readManifests();

  it('are all valid, and the generated looks match them', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(looksProblems(list)).toEqual([]);
  });

  it('turn into what the prepare tool builds', () => {
    // A model from the owner's Drive is Meshy Community CC0 unless the owner says they made it (2026-11-06): the Goblin
    // was recorded as owned until the audit of that day, the Alien Biker until the owner said it was community too
    // (the same day). Only a model the owner made, or one we generate through the Meshy API, is owned.
    const goblin = buildSpec(list.find((m) => m.id === 'meshy_goblin'));
    expect(goblin.pack).toBe('meshy-community-characters');
    expect(goblin.community).toEqual({ model: 'Goblin', date: '2026-10-26' });
    const biker = list.find((m) => m.id === 'meshy_alienbiker');
    expect(buildSpec(biker).pack).toBe('meshy-community-characters');
    expect(buildSpec(biker).community).toEqual({ model: 'stylized alien biker', date: '2026-11-01' });
    expect(buildSpec({ ...biker, source: { license: 'owned', author: 'the owner', date: '2026-11-01', url: null, file: biker.source.file } }).pack).toBe('meshy-owned');
    expect(goblin.file.test('Meshy_AI_Goblin_1026113732_texture.fbx')).toBe(true);
    expect(goblin.joints.LeftHandTip).toEqual([0.258, 0.317, 0.2]);
    expect(goblin.joints.head_end).toEqual([0, 0.95, 0.14]);
    // A Meshy rigging task the owner ran (fetch-meshy.mjs downloads by it).
    const ashwalker = buildSpec(list.find((m) => m.id === 'meshy_ashwalker'));
    expect(ashwalker.meshy.rig).toBe('01a18a0b-1e9b-7362-a818-d0779745bb32');
    // The Iron Knight's model since 2026-11-05: a community download (no task IDs), its triangle budget its own.
    const knight = buildSpec(list.find((m) => m.id === 'meshy_knight'));
    expect(knight.meshy).toBeUndefined();
    expect(knight.pack).toBe('meshy-community-characters');
    expect(knight.triangles).toBe(11000);
    expect(armsOf({ id: 'meshy_x', firstPerson: { arms: 'own' } })).toBe('meshy_x_fparms');
    const cat = buildSpec(list.find((m) => m.id === 'meshy_cat'));
    expect(cat.pack).toBe('meshy-community-characters');
    expect(cat.community).toEqual({ model: 'T Pose Cat', date: '2026-03-11' });
  });

  it('catch mistakes with a message saying what is wrong', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_cat.json'), 'utf8'));
    expect(manifestProblems(good, 'meshy_cat.json')).toEqual([]);
    const bad = { ...good, body: 'robot', source: { ...good.source, license: 'CC-BY' }, fixes: { ...good.fixes, wings: true, hands: { curl: 9 } }, landmarks: { ...good.landmarks, L: good.landmarks.L.slice(1) } };
    const p = manifestProblems(bad, 'meshy_cat.json');
    expect(p.join('\n')).toMatch(/body: male or female/);
    expect(p.join('\n')).toMatch(/source.license/);
    expect(p.join('\n')).toMatch(/fixes.wings: unknown/);
    expect(p.join('\n')).toMatch(/fixes.hands.curl/);
    expect(p.join('\n')).toMatch(/landmarks.L: 10 points/);
    expect(manifestProblems(good, 'meshy_dog.json').join('\n')).toMatch(/does not match the file name/);
    // A player look says what it is (Character Select's group); an NPC-only body needn't.
    expect(manifestProblems({ ...good, group: undefined }, 'meshy_cat.json').join('\n')).toMatch(/group: what the character is/);
    expect(manifestProblems({ ...good, group: 'pets' }, 'meshy_cat.json').join('\n')).toMatch(/group: what the character is/);
    expect(manifestProblems({ ...good, group: undefined, use: 'npc' }, 'meshy_cat.json')).toEqual([]);
    // The far copy's share (main's character-lod.mjs).
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, lod: 0.45 } }, 'meshy_cat.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, lod: 1 } }, 'meshy_cat.json').join('\n')).toMatch(/fixes.lod: 0.15–0.6/);
    expect(buildSpec({ ...good, fixes: { ...good.fixes, lod: 0.45 } }).lod).toBe(0.45);
    // A hand bent as one, whatever gaps are found.
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { r: { mitten: true, curl: 1.2 } } } }, 'meshy_cat.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { mitten: 'yes' } } }, 'meshy_cat.json').join('\n')).toMatch(/fixes.hands.mitten/);
    // A fanned hand's fingers brought together as it closes (a share, 0-1).
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { scale: 0.8, together: 1, r: { curl: 0.6 } } } }, 'meshy_cat.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { together: 2 } } }, 'meshy_cat.json').join('\n')).toMatch(/fixes.hands.together/);
    // Blue badges painted out: every one, or only inside boxes of the download's colour map (a flag beside the badge
    // stays); boxes are the download's layout, so not with a rebake.
    const scrubbed = (scrubBlue, surface) => manifestProblems({ ...good, fixes: { ...good.fixes, scrubBlue, ...(surface ? { surface } : {}) } }, 'meshy_cat.json');
    expect(scrubbed('#a8582a')).toEqual([]);
    expect(scrubbed({ color: '#e6e6e6', within: [[0.635, 0.512, 0.678, 0.559]] })).toEqual([]);
    for (const bad of ['blue', { color: '#e6e6e6' }, { color: '#e6e6e6', within: [[0.7, 0.5, 0.6, 0.6]] }, { color: '#e6e6e6', within: [[0, 0, 1.2, 1]] }, { color: '#e6e6e6', within: [[0, 0, 1, 1]], edge: 2 }]) expect(scrubbed(bad).join('\n'), JSON.stringify(bad)).toMatch(/fixes.scrubBlue/);
    expect(scrubbed({ color: '#e6e6e6', within: [[0, 0, 1, 1]] }, 'rebake').join('\n')).toMatch(/fixes.scrubBlue/);
    expect(buildSpec({ ...good, fixes: { ...good.fixes, scrubBlue: { color: '#e6e6e6', within: [[0, 0, 0.5, 0.5]] } } }).scrubBlue).toEqual({ color: '#e6e6e6', within: [[0, 0, 0.5, 0.5]] });
    // This look's own hands and arms on a gun (GripTune), written into its generated look.
    const grip = { elbowDown: 0.3, supportPistol: [0, 0.04, -0.08], curlL: 1.4, rollR: 0.4 };
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, grip } }, 'meshy_cat.json')).toEqual([]);
    expect(looksSource([{ ...good, fixes: { ...good.fixes, grip } }])).toContain('grip: { elbowDown: 0.3, supportPistol: [0, 0.04, -0.08], curlL: 1.4, rollR: 0.4 }');
    const gp = (g) => manifestProblems({ ...good, fixes: { ...good.fixes, grip: g } }, 'meshy_cat.json').join('\n');
    expect(gp({ wrist: 1 })).toMatch(/fixes.grip: \{/);
    expect(gp({ curlR: 2 })).toMatch(/fixes.grip.curlR/);
    expect(gp({ supportLong: [0, 0.3, 0] })).toMatch(/fixes.grip.supportLong/);
    expect(gp({ rollL: 'a' })).toMatch(/fixes.grip.rollL/);
    // Hard parts bound whole to one joint in the download's own pose (fixes.skin.rigid: Starfarer's back pack).
    const pack = { joint: 'spine_03', box: [[-0.1, 0.6, -0.15, 0.1, 0.8, -0.04]], blend: 0.025, except: '^Head$' };
    const rigid = (r) => manifestProblems({ ...good, fixes: { ...good.fixes, skin: { rigid: r } } }, 'meshy_cat.json').join('\n');
    expect(rigid([pack])).toBe('');
    expect(rigid([{ joint: 'spine_03', box: [-0.1, 0.6, -0.15, 0.1, 0.8, -0.04] }])).toBe('');
    for (const bad of [[], [{ ...pack, joint: 'spine_09' }], [{ ...pack, box: [0.1, 0.6, -0.15, -0.1, 0.8, -0.04] }], [{ ...pack, box: [[0, 0, 0]] }], [{ ...pack, blend: 0.5 }], [{ ...pack, except: '(' }], [{ ...pack, wings: true }], pack]) expect(rigid(bad), JSON.stringify(bad)).toMatch(/fixes.skin.rigid/);
    const starfarer = buildSpec(list.find((m) => m.id === 'meshy_darkastronaut'));
    expect(starfarer.skin.rigid[0]).toMatchObject({ joint: 'spine_03', except: '^Head$' });
  });

  it('move with the default clip set, name another, or opt out with a reason', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_cat.json'), 'utf8'));
    expect(manifestProblems({ ...good, clips: 'shooter' }, 'meshy_cat.json')).toEqual([]);
    expect(manifestProblems({ ...good, clips: false, clipsWhy: 'a four-legged walk' }, 'meshy_cat.json')).toEqual([]);
    expect(manifestProblems({ ...good, clips: false }, 'meshy_cat.json').join('\n')).toMatch(/clipsWhy/);
    expect(manifestProblems({ ...good, clipsWhy: 'no reason' }, 'meshy_cat.json').join('\n')).toMatch(/clipsWhy/);
    expect(manifestProblems({ ...good, clips: true }, 'meshy_cat.json').join('\n')).toMatch(/clips: the clip set/);
    // The generated look: nothing for the default, the set's id, or false.
    const lines = looksSource([{ ...good, clips: false, clipsWhy: 'x' }, { ...good, id: 'meshy_cat2', look: 'core.cat2', name: 'Cat 2', order: 999, clips: 'shooter' }, { ...good, id: 'meshy_cat3', look: 'core.cat3', name: 'Cat 3', order: 1000 }]);
    expect(lines).toMatch(/core\.biscuit',[^\n]*clips: false/);
    expect(lines).toMatch(/core\.cat2',[^\n]*clips: 'shooter'/);
    expect(lines).not.toMatch(/core\.cat3',[^\n]*clips:/);
  });

  it('shared clip sets: each clip from a recorded download', () => {
    const sets = readClipSets();
    expect(sets.map((c) => c.id)).toContain('shooter');
    const good = JSON.parse(readFileSync(join(CLIP_SETS_DIR, 'shooter.json'), 'utf8'));
    expect(clipSetProblems(good, 'shooter.json')).toEqual([]);
    // Every source is a CC0 model the owner rigged and animated, with its licence recorded.
    for (const s of Object.values(good.sources)) expect([s.license, s.rig]).toEqual(['CC0', 'owner']);
    const bad = { ...good, sources: { ...good.sources, x: { license: 'CC-BY', file: '(' } }, clips: { clip_walk: good.clips.clip_walk, clip_dance: { from: 'nobody', clip: 'Dance' } } };
    const p = clipSetProblems(bad, 'shooter.json').join('\n');
    expect(p).toMatch(/sources.x.license/);
    expect(p).toMatch(/sources.x.file/);
    expect(p).toMatch(/clips.clip_dance: not a clip set clip/);
    expect(p).toMatch(/clip_walk and clip_run at least/);
  });

  it('carry a rolling body and an unnamed rig\'s joint names', () => {
    const roller = list.find((m) => m.id === 'meshy_rollerbot');
    const spec = buildSpec(roller);
    expect(spec.locomotion).toBe('roll');
    expect(spec.rigJoints.Bone_001).toBe('Hips');
    expect(looksSource(list)).toMatch(/id: 'core\.rollerbot'.*locomotion: 'roll'/);
    expect(manifestProblems(roller, 'meshy_rollerbot.json')).toEqual([]);
    expect(manifestProblems({ ...roller, locomotion: 'hover' }, 'meshy_rollerbot.json').join('\n')).toMatch(/locomotion: roll/);
    const twice = { ...roller.source.joints, Bone_000: 'Hips' };
    expect(manifestProblems({ ...roller, source: { ...roller.source, joints: twice } }, 'meshy_rollerbot.json').join('\n')).toMatch(/each Meshy joint once/);
    expect(manifestProblems({ ...roller, source: { ...roller.source, joints: { Bone_000: 'Pelvis' } } }, 'meshy_rollerbot.json').join('\n')).toMatch(/source.joints/);
  });

  it('take the intake queue\'s characters and creatures as queued stubs', () => {
    const queue = JSON.parse(readFileSync(QUEUE_FILE, 'utf8')).queue.filter((e) => e.kind === 'character' || e.kind === 'creature');
    expect(queue.length).toBeGreaterThan(0);
    for (const e of queue) {
      const stub = stubFromQueue(e);
      expect(manifestProblems(stub, `${e.id}.json`), e.id).toEqual([]);
    }
    // A queued stub gets no look until it is filled in.
    const stub = stubFromQueue(queue[0]);
    expect(looksSource([...list, stub])).toBe(looksSource(list));
    expect(manifestProblems({ ...stub, status: undefined }, `${stub.id}.json`).length).toBeGreaterThan(0);
  });

  it('carry a tier: experimental reaches the generated look, core and left out do not, anything else is a problem', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_cat.json'), 'utf8'));
    expect(TIERS).toEqual(['core', 'experimental']);
    // A manifest names a tier only to say experimental (core is the one left out); the ten of 2026-11-11 were promoted
    // by the owner on 2026-11-12 and the twelve of 2026-11-13 on 2026-11-14, so today none does.
    expect(list.filter((m) => m.tier !== undefined && m.tier !== 'experimental').map((m) => m.id)).toEqual([]);
    for (const tier of TIERS) expect(manifestProblems({ ...good, tier }, 'meshy_cat.json')).toEqual([]);
    for (const tier of ['beta', 'Experimental', '', null, true]) expect(manifestProblems({ ...good, tier }, 'meshy_cat.json').join('\n')).toMatch(/tier: core or experimental/);
    const line = (m) => looksSource([m]).split('\n').find((l) => l.includes(`id: '${m.look}'`));
    expect(line({ ...good, tier: 'experimental' })).toMatch(/group: 'animals', tier: 'experimental'/);
    // Absent = core: an explicit core writes the same look as none.
    expect(line({ ...good, tier: 'core' })).toBe(line(good));
    expect(line(good)).not.toMatch(/tier:/);
  });

  it('an experimental character named by an NPC role or by Roulette is a problem', () => {
    const n = npcs.load();
    const role = n.npcs.roles.find((r) => r.look);
    expect(npcs.build(n).problems).toEqual([]);
    expect(npcs.build({ ...n, experimentalLooks: [role.look] }).problems.join('\n')).toMatch(new RegExp(`look ${role.look.replace('.', '\\.')} is an experimental character`));
    const r = roulette.load();
    const look = Object.keys(r.data.characters)[0];
    expect(roulette.build(r).problems).toEqual([]);
    expect(roulette.build({ ...r, looks: { ...r.looks, experimental: new Set([look]) } }).problems.join('\n')).toMatch(/is an experimental character .* Roulette never deals one/);
  });
});
