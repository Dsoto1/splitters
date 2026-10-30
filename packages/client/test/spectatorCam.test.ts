import { describe, expect, it } from 'vitest';
import { lookAngles } from '@tiletrigger/shared';
import { KILL_CAM_SECONDS, SpectatorCam, followable, spectateRule, type Watchable } from '../src/game/spectatorCam.ts';

const noWalls = () => null;
const at = (slot: number, x: number, alive = true): Watchable => ({ slot, x, y: 0, z: 0, yaw: 0, alive });

describe('spectating rule', () => {
  it('keeps a dead team player to their teammates and off the free camera online; opens both elsewhere', () => {
    expect(spectateRule({ teamMode: true, pureSpectator: false, offline: false, runsMatch: false })).toEqual({ teamOnly: true, freeCam: false });
    expect(spectateRule({ teamMode: true, pureSpectator: true, offline: false, runsMatch: false })).toEqual({ teamOnly: false, freeCam: true });
    expect(spectateRule({ teamMode: true, pureSpectator: false, offline: true, runsMatch: true })).toEqual({ teamOnly: false, freeCam: true });
    expect(spectateRule({ teamMode: true, pureSpectator: false, offline: false, runsMatch: true })).toEqual({ teamOnly: false, freeCam: true });
    expect(spectateRule({ teamMode: false, pureSpectator: false, offline: false, runsMatch: false })).toEqual({ teamOnly: false, freeCam: true });
  });

  it('follows living players only (never yourself or NPCs), teammates only under the team rule, in slot order', () => {
    const teams: Record<number, string> = { 0: 'red', 1: 'blue', 2: 'red', 3: 'red', 5: 'blue' };
    const poses = [at(3, 0), at(0, 0), at(1, 0), at(2, 0, false), at(5, 0), at(2000, 0)];
    const team = followable(poses, 0, { teamOnly: true, freeCam: false }, (s) => teams[s], 1000);
    expect(team.map((p) => p.slot)).toEqual([3]);
    const all = followable(poses, 0, { teamOnly: false, freeCam: true }, (s) => teams[s], 1000);
    expect(all.map((p) => p.slot)).toEqual([1, 3, 5]);
  });
});

describe('spectator camera', () => {
  it('cycles whom it follows both ways, and keeps someone when the one followed is gone', () => {
    const cam = new SpectatorCam();
    const list = [at(1, 0), at(4, 0), at(7, 0)];
    expect(cam.target(list)!.slot).toBe(1);
    cam.cycle(1, list);
    expect(cam.target(list)!.slot).toBe(4);
    cam.cycle(-1, list);
    cam.cycle(-1, list);
    expect(cam.target(list)!.slot).toBe(7);
    expect(cam.target([at(4, 0)])!.slot).toBe(4);
    expect(cam.target([])).toBeNull();
  });

  it('turns from where you looked to the killer, from behind your body, and ends on time', () => {
    const cam = new SpectatorCam();
    cam.startKillCam({ killer: 3, weapon: 'core.pistol', body: { x: 0, y: 0, z: 0 }, from: null, yaw: Math.PI, pitch: 0, now: 0 });
    const killer = { x: 10, y: 1.3, z: 0 };
    const start = cam.killCamPose(0, killer, noWalls)!;
    expect(start.yaw).toBeCloseTo(Math.PI);
    const settled = cam.killCamPose(1000, killer, noWalls)!;
    // Behind the body (away from the killer) and above it, looking at them.
    expect(settled.pos.x).toBeLessThan(0);
    expect(settled.pos.y).toBeGreaterThan(1.6);
    expect(settled.yaw).toBeCloseTo(lookAngles(settled.pos, killer).yaw);
    // The killer drops out of view: it keeps looking where they were last seen.
    expect(cam.killCamPose(1100, null, noWalls)!.yaw).toBeCloseTo(settled.yaw);
    expect(cam.killCam(1000)).toMatchObject({ killer: 3, weapon: 'core.pistol' });
    expect(cam.killCam(KILL_CAM_SECONDS * 1000 + 1)).toBeNull();
  });

  it('looks where the shot came from when the killer was never in view, and is pulled in by walls', () => {
    const cam = new SpectatorCam();
    const from = { x: 0, y: 1.5, z: 20 };
    cam.startKillCam({ killer: 9, weapon: 'core.rifle', body: { x: 0, y: 0, z: 0 }, from, yaw: 0, pitch: 0, now: 0, seconds: 2 });
    const pose = cam.killCamPose(2000 - 1, null, () => 0.5)!;
    expect(pose.yaw).toBeCloseTo(lookAngles(pose.pos, from).yaw);
    expect(Math.hypot(pose.pos.x, pose.pos.y - 1.6, pose.pos.z)).toBeLessThan(0.5);
    expect(cam.killCam(2000)).toBeNull();
  });

  it('flies the free camera along the view and keeps it inside the bounds', () => {
    const cam = new SpectatorCam();
    cam.setFree(true, { x: 0, y: 5, z: 0 });
    expect(cam.moveFree(1, 0, 0, 0, 0, 0, false, null)).toBe(false);
    cam.moveFree(1, 1, 0, 0, 0, 0, false, null);
    expect(cam.freeAt!.z).toBeCloseTo(9);
    cam.moveFree(10, 1, 0, 1, 0, 0, true, { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 40, z: 50 } });
    expect(cam.freeAt).toEqual({ x: 0, y: 40, z: 50 });
    cam.setFree(false, { x: 0, y: 0, z: 0 });
    expect(cam.freeAt).toBeNull();
  });
});
