import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as npcs from '../npcs.mjs';
import * as roulette from '../roulette.mjs';
import { CLIP_SETS_DIR, COLLECTIONS, MANIFEST_DIR, QUEUE_FILE, TIERS, armsOf, buildSpec, gripFitOf, gripFitSource, clipSetProblems, looksProblems, looksSource, manifestProblems, readClipSets, readManifests, stubFromQueue } from '../character-manifests.mjs';

describe('character manifests', () => {
  const list = readManifests();

  it('are all valid, and the generated looks match them', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(looksProblems(list)).toEqual([]);
  });

  it('turn into what the prepare tool builds', () => {
    // A model from the owner's Drive is Meshy Community CC0 unless the owner says they made it (2026-11-06): the Alien
    // Biker was recorded as owned until the owner said it was community too (the same day). Only a model the owner made,
    // or one we generate through the Meshy API, is owned. (The Goblin, this test's first example, was removed 2026-11-25,
    // and the Pirate got the owner's rigged model 2026-11-26: Flt. Lt. Ember, another textured FBX rigged here from its
    // landmarks, stands in.)
    const pirate = buildSpec(list.find((m) => m.id === 'meshy_pilot'));
    expect(pirate.pack).toBe('meshy-community-characters');
    expect(pirate.community).toEqual({ model: 'T Pose Pilot', date: '2026-05-10' });
    // (The Alien Biker was removed 2026-11-26; Patches, still a community model, stands in.)
    const biker = list.find((m) => m.id === 'meshy_hoboclown');
    expect(buildSpec(biker).pack).toBe('meshy-community-characters');
    expect(buildSpec(biker).community).toEqual({ model: biker.source.community.model, date: biker.source.date });
    expect(buildSpec({ ...biker, source: { license: 'owned', author: 'the owner', date: '2026-11-01', url: null, file: biker.source.file } }).pack).toBe('meshy-owned');
    expect(pirate.file.test('Meshy_AI_T_Pose_Pilot_0510_texture.fbx')).toBe(true);
    expect(pirate.joints.LeftHandTip).toEqual([0.475, 0.748, -0.012]);
    expect(pirate.joints.head_end).toEqual([0, 1, 0]);
    // A Meshy rigging task the owner ran (fetch-meshy.mjs downloads by it).
    const brannock = buildSpec(list.find((m) => m.id === 'meshy_brannock'));
    expect(brannock.meshy.rig).toBe('01a18a02-443b-7442-ad18-a291c82dc28c');
    // A replaced model (the owner's 2026-11-26 batch): owned, its rigged download matched by name.
    const fredNow = buildSpec(list.find((m) => m.id === 'meshy_fishyfred'));
    expect(fredNow.pack).toBe('meshy-owned');
    expect(fredNow.file.test('Meshy_AI_bass_diver_3d_20261125_animated_mixamo_All_animation.glb')).toBe(true);
    // The Iron Knight's model since 2026-11-05: a community download (no task IDs), its triangle budget its own.
    const knight = buildSpec(list.find((m) => m.id === 'meshy_knight'));
    expect(knight.meshy).toBeUndefined();
    expect(knight.pack).toBe('meshy-community-characters');
    expect(knight.triangles).toBe(11000);
    expect(armsOf({ id: 'meshy_x', firstPerson: { arms: 'own' } })).toBe('meshy_x_fparms');
    // Everyone else wears the universal arms (grips auto-fit, owner 2026-11-18), tinted from the model.
    expect(armsOf({ id: 'meshy_x', body: 'male' })).toBe('ranger_arms_m');
    expect(armsOf({ id: 'meshy_x', body: 'female' })).toBe('ranger_arms_f');
    // The Visitor: the owner's classic grey alien since 2026-11-26 (a community T-pose alien before).
    const cat = buildSpec(list.find((m) => m.id === 'meshy_alien'));
    expect(cat.pack).toBe('meshy-owned');
  });

  it('catch mistakes with a message saying what is wrong', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_pilot.json'), 'utf8'));
    expect(manifestProblems(good, 'meshy_pilot.json')).toEqual([]);
    const bad = { ...good, body: 'robot', source: { ...good.source, license: 'CC-BY' }, fixes: { ...good.fixes, wings: true, hands: { curl: 9 } }, landmarks: { ...good.landmarks, L: good.landmarks.L.slice(1) } };
    const p = manifestProblems(bad, 'meshy_pilot.json');
    expect(p.join('\n')).toMatch(/body: male or female/);
    expect(p.join('\n')).toMatch(/source.license/);
    expect(p.join('\n')).toMatch(/fixes.wings: unknown/);
    expect(p.join('\n')).toMatch(/fixes.hands.curl/);
    expect(p.join('\n')).toMatch(/landmarks.L: 10 points/);
    expect(manifestProblems(good, 'meshy_dog.json').join('\n')).toMatch(/does not match the file name/);
    // A player look says what it is (Character Select's group); an NPC-only body needn't.
    expect(manifestProblems({ ...good, group: undefined }, 'meshy_pilot.json').join('\n')).toMatch(/group: what the character is/);
    expect(manifestProblems({ ...good, group: 'pets' }, 'meshy_pilot.json').join('\n')).toMatch(/group: what the character is/);
    expect(manifestProblems({ ...good, group: undefined, use: 'npc' }, 'meshy_pilot.json')).toEqual([]);
    // The far copy's share (main's character-lod.mjs).
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, lod: 0.45 } }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, lod: 1 } }, 'meshy_pilot.json').join('\n')).toMatch(/fixes.lod: 0.15–0.6/);
    // A look's own pistol hold (2026-11-26): forward / down / out, each within 0.3 m.
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, holdPistol: { out: -0.1 } } }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, holdPistol: { out: -0.4 } } }, 'meshy_pilot.json').join('\n')).toMatch(/fixes.holdPistol.out/);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, holdPistol: { in: 0.1 } } }, 'meshy_pilot.json').join('\n')).toMatch(/fixes.holdPistol: \{ forward, down, out \}/);
    expect(buildSpec({ ...good, fixes: { ...good.fixes, lod: 0.45 } }).lod).toBe(0.45);
    // A hand bent as one, whatever gaps are found.
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { r: { mitten: true, curl: 1.2 } } } }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { mitten: 'yes' } } }, 'meshy_pilot.json').join('\n')).toMatch(/fixes.hands.mitten/);
    // A fanned hand's fingers brought together as it closes (a share, 0-1).
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { scale: 0.8, together: 1, r: { curl: 0.6 } } } }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, hands: { together: 2 } } }, 'meshy_pilot.json').join('\n')).toMatch(/fixes.hands.together/);
    // Blue badges painted out: every one, or only inside boxes of the download's colour map (a flag beside the badge
    // stays); boxes are the download's layout, so not with a rebake.
    const scrubbed = (scrubBlue, surface) => manifestProblems({ ...good, fixes: { ...good.fixes, scrubBlue, ...(surface ? { surface } : {}) } }, 'meshy_pilot.json');
    expect(scrubbed('#a8582a')).toEqual([]);
    expect(scrubbed({ color: '#e6e6e6', within: [[0.635, 0.512, 0.678, 0.559]] })).toEqual([]);
    for (const bad of ['blue', { color: '#e6e6e6' }, { color: '#e6e6e6', within: [[0.7, 0.5, 0.6, 0.6]] }, { color: '#e6e6e6', within: [[0, 0, 1.2, 1]] }, { color: '#e6e6e6', within: [[0, 0, 1, 1]], edge: 2 }]) expect(scrubbed(bad).join('\n'), JSON.stringify(bad)).toMatch(/fixes.scrubBlue/);
    expect(scrubbed({ color: '#e6e6e6', within: [[0, 0, 1, 1]] }, 'rebake').join('\n')).toMatch(/fixes.scrubBlue/);
    expect(buildSpec({ ...good, fixes: { ...good.fixes, scrubBlue: { color: '#e6e6e6', within: [[0, 0, 0.5, 0.5]] } } }).scrubBlue).toEqual({ color: '#e6e6e6', within: [[0, 0, 0.5, 0.5]] });
    // Colours shifted by rule (Azure Sentinel's teal lenses to amber): hue in degrees, saturation and lightness 0-1.
    const recolored = (recolor) => manifestProblems({ ...good, fixes: { ...good.fixes, recolor } }, 'meshy_pilot.json');
    const lenses = [{ hue: [160, 200], sat: [0.3, 1], toHue: 36, satScale: 1.1 }, { light: [0.05, 0.42], toSat: 0.28, amount: 0.75 }];
    expect(recolored(lenses)).toEqual([]);
    for (const bad of [[], {}, [{ hue: [0, 400] }], [{ sat: [0.8, 0.2] }], [{ toHue: 360 }], [{ amount: 2 }], [{ lightScale: 0 }], [{ shade: 1 }]]) expect(recolored(bad).join('\n'), JSON.stringify(bad)).toMatch(/fixes.recolor/);
    expect(buildSpec({ ...good, fixes: { ...good.fixes, recolor: lenses } }).recolor).toEqual(lenses);
    // This look's own hands and arms on a gun (GripTune), written into its generated look.
    const grip = { elbowDown: 0.3, supportPistol: [0, 0.04, -0.08], curlL: 1.4, rollR: 0.4 };
    expect(manifestProblems({ ...good, fixes: { ...good.fixes, grip } }, 'meshy_pilot.json')).toEqual([]);
    expect(looksSource([{ ...good, fixes: { ...good.fixes, grip } }])).toContain('grip: { elbowDown: 0.3, supportPistol: [0, 0.04, -0.08], curlL: 1.4, rollR: 0.4');
    // The grip fit's offsets (content/grip-fit.json) go in their own table, without the ones the manifest sets itself.
    const fitted = gripFitOf('meshy_pilot')?.grip ?? {};
    const table = gripFitSource([{ ...good, fixes: { ...good.fixes, grip } }]);
    for (const [k, v] of Object.entries(fitted)) expect(table.includes(`${k}: [${v.join(', ')}]`)).toBe(!(k in grip));
    expect(table).toMatch(/arms: \{ skin: '#[0-9a-f]{6}'/);
    const gp = (g) => manifestProblems({ ...good, fixes: { ...good.fixes, grip: g } }, 'meshy_pilot.json').join('\n');
    expect(gp({ wrist: 1 })).toMatch(/fixes.grip: \{/);
    expect(gp({ curlR: 2 })).toMatch(/fixes.grip.curlR/);
    expect(gp({ supportLong: [0, 0.3, 0] })).toMatch(/fixes.grip.supportLong/);
    expect(gp({ rollL: 'a' })).toMatch(/fixes.grip.rollL/);
    // Hard parts bound whole to one joint in the download's own pose (fixes.skin.rigid: Starfarer's back pack).
    const pack = { joint: 'spine_03', box: [[-0.1, 0.6, -0.15, 0.1, 0.8, -0.04]], blend: 0.025, except: '^Head$' };
    const rigid = (r) => manifestProblems({ ...good, fixes: { ...good.fixes, skin: { rigid: r } } }, 'meshy_pilot.json').join('\n');
    expect(rigid([pack])).toBe('');
    expect(rigid([{ joint: 'spine_03', box: [-0.1, 0.6, -0.15, 0.1, 0.8, -0.04] }])).toBe('');
    for (const bad of [[], [{ ...pack, joint: 'spine_09' }], [{ ...pack, box: [0.1, 0.6, -0.15, -0.1, 0.8, -0.04] }], [{ ...pack, box: [[0, 0, 0]] }], [{ ...pack, blend: 0.5 }], [{ ...pack, except: '(' }], [{ ...pack, wings: true }], pack]) expect(rigid(bad), JSON.stringify(bad)).toMatch(/fixes.skin.rigid/);
    // (Starfarer's pack was the one in use until the owner's new model replaced it, 2026-11-26: the spec still carries one.)
    const packed = buildSpec({ ...good, fixes: { ...good.fixes, skin: { rigid: [pack] } } });
    expect(packed.skin.rigid[0]).toMatchObject({ joint: 'spine_03', except: '^Head$' });
  });

  it('move with the default clip set, name another, or opt out with a reason', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_pilot.json'), 'utf8'));
    expect(manifestProblems({ ...good, clips: 'shooter' }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, clips: false, clipsWhy: 'a four-legged walk' }, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems({ ...good, clips: false }, 'meshy_pilot.json').join('\n')).toMatch(/clipsWhy/);
    expect(manifestProblems({ ...good, clipsWhy: 'no reason' }, 'meshy_pilot.json').join('\n')).toMatch(/clipsWhy/);
    expect(manifestProblems({ ...good, clips: true }, 'meshy_pilot.json').join('\n')).toMatch(/clips: the clip set/);
    // The generated look: nothing for the default, the set's id, or false.
    const lines = looksSource([{ ...good, clips: false, clipsWhy: 'x' }, { ...good, id: 'meshy_alien2', look: 'core.cat2', name: 'Cat 2', order: 999, clips: 'shooter' }, { ...good, id: 'meshy_alien3', look: 'core.cat3', name: 'Cat 3', order: 1000 }]);
    expect(lines).toMatch(/core\.ember',[^\n]*clips: false/);
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
    expect(looksSource(list)).toMatch(/w\('core\.rollerbot'.*locomotion: 'roll'/);
    expect(manifestProblems(roller, 'meshy_rollerbot.json')).toEqual([]);
    expect(manifestProblems({ ...roller, locomotion: 'fly' }, 'meshy_rollerbot.json').join('\n')).toMatch(/locomotion: roll or hover/);
    // Hovering (owner, 2026-11-27): a height with it, and only with it.
    expect(manifestProblems({ ...roller, hover: 0.3 }, 'meshy_rollerbot.json').join('\n')).toMatch(/hover: with locomotion hover/);
    expect(manifestProblems({ ...roller, locomotion: 'hover', hover: 2 }, 'meshy_rollerbot.json').join('\n')).toMatch(/hover: with locomotion hover/);
    expect(manifestProblems({ ...roller, locomotion: 'hover', hover: 0.3 }, 'meshy_rollerbot.json')).toEqual([]);
    const vanguard = list.find((m) => m.id === 'meshy_vanguard');
    expect(looksSource(list)).toMatch(/w\('core\.vanguard'.*locomotion: 'hover', hover: 0\.3/);
    expect(vanguard.locomotion).toBe('hover');
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
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_pilot.json'), 'utf8'));
    expect(TIERS).toEqual(['core', 'experimental']);
    // A manifest names a tier only to say experimental (core is the one left out); the ten of 2026-11-11 were promoted
    // by the owner on 2026-11-12, and the twelve of 2026-11-13 and the twelve of 2026-11-14 on 2026-11-14; the batch of 2026-11-21/22 is experimental until the owner looks it over.
    expect(list.filter((m) => m.tier !== undefined && m.tier !== 'experimental').map((m) => m.id)).toEqual([]);
    for (const tier of TIERS) expect(manifestProblems({ ...good, tier }, 'meshy_pilot.json')).toEqual([]);
    for (const tier of ['beta', 'Experimental', '', null, true]) expect(manifestProblems({ ...good, tier }, 'meshy_pilot.json').join('\n')).toMatch(/tier: core or experimental/);
    const line = (m) => looksSource([m]).split('\n').find((l) => l.includes(`w('${m.look}',`));
    expect(line({ ...good, tier: 'experimental' })).toMatch(/group: 'soldiers', branch: 'army', tier: 'experimental'/);
    // Absent = core: an explicit core writes the same look as none.
    expect(line({ ...good, tier: 'core' })).toBe(line(good));
    expect(line(good)).not.toMatch(/tier:/);
  });

  it('carry a Character Select collection (the Chrono Crew): a known one reaches the generated look, anything else is a problem', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_pilot.json'), 'utf8'));
    expect(COLLECTIONS).toEqual(['chrono']);
    expect(manifestProblems({ ...good, collection: 'chrono' }, 'meshy_pilot.json')).toEqual([]);
    for (const collection of ['Chrono', 'crew', '', null, 1]) expect(manifestProblems({ ...good, collection }, 'meshy_pilot.json').join('\n')).toMatch(/collection: a Character Select collection/);
    const line = (m) => looksSource([m]).split('\n').find((l) => l.includes(`w('${m.look}',`));
    expect(line({ ...good, collection: 'chrono' })).toMatch(/group: 'soldiers', branch: 'army', collection: 'chrono'/);
    expect(line(good)).not.toMatch(/collection:/);
  });

  it('carry variant looks (the chimp, owner 2026-11-26): a labelled base, variants naming it, both reaching the generated look', () => {
    const good = JSON.parse(readFileSync(join(MANIFEST_DIR, 'meshy_pilot.json'), 'utf8'));
    const base = { ...good, variant: 'Aviator' };
    const v = { ...good, id: 'meshy_alien_roman', look: 'core.cat_roman', name: 'Roman Cat', order: 999, variant: 'Roman', variantOf: good.look };
    expect(manifestProblems(base, 'meshy_pilot.json')).toEqual([]);
    expect(manifestProblems(v, 'meshy_alien_roman.json')).toEqual([]);
    expect(manifestProblems({ ...v, variant: undefined }, 'meshy_alien_roman.json').join('\n')).toMatch(/variantOf: the base look/);
    expect(manifestProblems({ ...v, variantOf: 'cat' }, 'meshy_alien_roman.json').join('\n')).toMatch(/variantOf: the base look/);
    expect(manifestProblems({ ...v, variantOf: v.look }, 'meshy_alien_roman.json').join('\n')).toMatch(/variantOf: the base look/);
    expect(manifestProblems({ ...base, variant: '' }, 'meshy_pilot.json').join('\n')).toMatch(/variant: the look's label/);
    const line = (m) => looksSource([m]).split('\n').find((l) => l.includes(`w('${m.look}',`));
    expect(line(v)).toMatch(/variant: 'Roman', variantOf: 'core\.ember'/);
    expect(line(base)).toMatch(/variant: 'Aviator'/);
    expect(line(good)).not.toMatch(/variant/);
    // The shipped chimp: one base and nine variants, each keeping the base's group and size.
    const all = readManifests({ ready: true });
    const chimp = all.filter((m) => m.look === 'core.chimp' || m.variantOf === 'core.chimp');
    expect(chimp).toHaveLength(11);
    expect(new Set(chimp.map((m) => m.variant)).size).toBe(11);
    for (const m of chimp) expect([m.group, m.size], m.id).toEqual(['animals', 'small']);
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
