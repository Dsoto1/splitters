import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANIFEST_DIR, QUEUE_FILE, armsOf, buildSpec, looksProblems, looksSource, manifestProblems, readManifests, stubFromQueue } from '../character-manifests.mjs';

describe('character manifests', () => {
  const list = readManifests();

  it('are all valid, and the generated looks match them', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(looksProblems(list)).toEqual([]);
  });

  it('turn into what the prepare tool builds', () => {
    const goblin = buildSpec(list.find((m) => m.id === 'meshy_goblin'));
    expect(goblin.pack).toBe('meshy-owned');
    expect(goblin.file.test('Meshy_AI_Goblin_1026113732_texture.fbx')).toBe(true);
    expect(goblin.joints.LeftHandTip).toEqual([0.258, 0.317, 0.2]);
    expect(goblin.joints.head_end).toEqual([0, 0.95, 0.14]);
    const knight = buildSpec(list.find((m) => m.id === 'meshy_knight'));
    expect(knight.meshy.rig).toBe('01a173c0-4d21-712b-97ba-7f08daf670c7');
    expect(knight.triangles).toBeUndefined();
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
});
