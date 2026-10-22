import {
  PhysicsWorld,
  TICK_DT,
  buildMapGeometry,
  getWeapon,
  initPhysics,
  loadMap,
  type MatchPhase,
  type PlayerInput,
  type ScoreEntry,
  type ServerMessage,
  type ServerStats,
} from '@chronosplit/shared';
import { Hud } from './hud.ts';
import { InputState } from './input.ts';
import { Interpolator } from './interpolation.ts';
import { Connection } from './net.ts';
import { LocalPlayer } from './prediction.ts';
import { Renderer, slotColor } from './renderer.ts';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const menu = document.getElementById('menu')!;
const status = document.getElementById('status')!;
const clickToPlay = document.getElementById('clicktoplay')!;
const nameInput = document.getElementById('name') as HTMLInputElement;
const serverInput = document.getElementById('server') as HTMLInputElement;

const params = new URLSearchParams(location.search);
let started = false;
nameInput.value = params.get('name') ?? safeStorage('cs.name') ?? `Player${Math.floor(Math.random() * 900 + 100)}`;
serverInput.value = params.get('server') ?? `ws://${location.hostname || 'localhost'}:7777`;

document.getElementById('join')!.addEventListener('submit', (e) => {
  e.preventDefault();
  void start(serverInput.value.trim(), nameInput.value.trim());
});
if (params.has('autojoin')) void start(serverInput.value, nameInput.value);

function safeStorage(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}


async function start(url: string, name: string): Promise<void> {
  if (started) return;
  started = true;
  status.textContent = 'Connecting…';
  safeStorage('cs.name', name);
  const [renderer] = await Promise.all([Renderer.create(canvas), initPhysics()]);
  const hud = new Hud();
  const input = new InputState(canvas);
  const interp = new Interpolator();

  let slot = -1;
  let local: LocalPlayer | null = null;
  let phase: MatchPhase = 'playing';
  let timeLeft = 0;
  let scores: ScoreEntry[] = [];
  let serverStats: ServerStats | null = null;
  let winner: string | null = null;
  let showStats = params.has('stats');
  let botStates: string[] = [];
  const outbox: PlayerInput[] = [];

  input.onToggle.set('F3', () => (showStats = !showStats));

  const conn = new Connection(
    url,
    name,
    (msg: ServerMessage) => {
      switch (msg.t) {
        case 'welcome': {
          const loaded = loadMap(msg.map);
          if (!loaded.ok) {
            status.textContent = `Server sent an invalid map: ${loaded.issues[0]?.message}`;
            return;
          }
          slot = msg.slot;
          const geometry = buildMapGeometry(loaded.map);
          renderer.buildMap(geometry);
          local = new LocalPlayer(new PhysicsWorld(geometry), getWeapon(msg.rules.startingWeapon));
          menu.hidden = true;
          hud.show();
          clickToPlay.hidden = input.locked;
          (window as unknown as { __cs: unknown }).__cs = { slot, renderer: renderer.kind, local };
          break;
        }
        case 'reject':
          status.textContent = `Rejected: ${msg.reason}`;
          break;
        case 'roster':
          hud.setRoster(msg.players);
          break;
        case 'snapshot': {
          phase = msg.phase;
          timeLeft = msg.timeLeft;
          scores = msg.score;
          interp.push(msg.tick, msg.players);
          const me = msg.players.find((p) => p.s === slot);
          if (me && local) {
            if (me.alive && !local.alive) {
              input.yaw = me.yaw;
              input.pitch = 0;
            }
            local.reconcile(me, msg.ack);
          }
          botStates = msg.players.filter((p) => p.st).map((p) => `  ${hud.name(p.s).padEnd(14)} ${p.st}`);
          for (const ev of msg.ev) {
            if (ev.e === 'shot') {
              if (ev.s === slot) {
                if (ev.hit !== null) hud.hit();
              } else {
                renderer.addTracer({ x: ev.from[0], y: ev.from[1], z: ev.from[2] }, { x: ev.to[0], y: ev.to[1], z: ev.to[2] }, slotColor(ev.s));
              }
            } else if (ev.e === 'kill') {
              hud.kill(ev.killer, ev.victim, slot);
            } else if (ev.e === 'round_end') {
              winner = ev.winner === null ? null : hud.name(ev.winner);
            }
          }
          break;
        }
        case 'stats':
          serverStats = msg;
          break;
        case 'pong':
          break;
      }
    },
    (reason) => {
      menu.hidden = false;
      status.textContent = `Disconnected: ${reason}`;
      started = false;
    },
  );

  canvas.addEventListener('click', () => void canvas.requestPointerLock());
  clickToPlay.addEventListener('click', () => void canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    clickToPlay.hidden = input.locked || !menu.hidden;
  });

  // Fixed 60 Hz simulation for prediction; rendering runs at display rate.
  let acc = 0;
  let last = performance.now();
  let frames = 0;
  let fps = 0;
  let fpsAt = last;
  let frameMs = 0;
  let lastCorrections = 0;
  let correctionsPerSec = 0;
  let bytesInAt = 0;
  let kibPerSec = 0;

  renderer.engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    frameMs = now - last;
    last = now;

    if (local) {
      acc += dt;
      while (acc >= TICK_DT) {
        acc -= TICK_DT;
        const { input: cmd, shotEnd } = local.tick(input.sample(), input.yaw, input.pitch);
        outbox.push(cmd);
        if (shotEnd) renderer.addTracer(local.eye, shotEnd, '#ffe08a', 60);
      }
      conn.sendInputs(outbox.splice(0));
      renderer.setCamera(local.eye, input.yaw, input.pitch);
      hud.setHealth(local.health, local.alive);
      hud.setStatus(phase, timeLeft, local.alive, winner);
    }
    renderer.updateAvatars(interp.sample(now), slot);
    hud.renderScoreboard(input.held('Tab') || phase === 'intermission', scores, slot);

    frames++;
    if (now - fpsAt >= 1000) {
      const secs = (now - fpsAt) / 1000;
      fps = frames / secs;
      correctionsPerSec = ((local?.corrections ?? 0) - lastCorrections) / secs;
      lastCorrections = local?.corrections ?? 0;
      kibPerSec = (conn.bytesIn - bytesInAt) / 1024 / secs;
      bytesInAt = conn.bytesIn;
      frames = 0;
      fpsAt = now;
    }
    hud.renderPerf(
      showStats,
      {
        renderer: renderer.kind,
        fps: fps.toFixed(0),
        frame: `${frameMs.toFixed(1)} ms`,
        ping: `${conn.rttMs.toFixed(0)} ms`,
        'down (client)': `${kibPerSec.toFixed(1)} KiB/s`,
        corrections: `${correctionsPerSec.toFixed(1)}/s (last ${((local?.lastCorrection ?? 0) * 100).toFixed(1)} cm)`,
        'unacked input': local?.pendingCount ?? 0,
        'active meshes': renderer.scene.getActiveMeshes().length,
        position: local ? `${local.state.pos.x.toFixed(1)}, ${local.state.pos.y.toFixed(1)}, ${local.state.pos.z.toFixed(1)}` : '-',
      },
      serverStats,
      botStates,
    );
    renderer.render();
  });
}
