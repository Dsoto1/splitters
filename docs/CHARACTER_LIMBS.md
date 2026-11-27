# Character limbs: knees, ankles and elbows

Measured (lane A, 2026-11-27; owner's report: in Character Select many characters' knees and ankles bow outward, most
at the ankles, and some elbows bend wrong, Grandpa Chains and Elder Tomo among them). Diagnosis only: no fix here.

## How it is measured

`tools/content/limb-audit.mjs` poses every pickable character as Character Select does (standing, holding the rifle,
the game's own animator and arm IK; client `?mode=grips`, `__grips.limbs()` in `tools/limbProbe.ts`) and scores it
with `tools/content/limbs.mjs` (unit test `tools/content/test/limbs.test.mjs`). All angles in degrees, left / right:

- **knee bow**: in the front view, the knee's angle off the hip-to-ankle line; + bow legs, − knock knees.
- **shin out**: in the front view, the shin's lean off straight down; + the ankle further out than the knee.
- **knee points**: seen from above, the way the bent knee points (0 ahead, + out); – when the leg is nearly straight.
- **foot yaw**: the foot (ankle to ball) off straight ahead, + toes out.
- **sole roll**: the drawn sole's tilt across (its skin's lowest points); + inner edge up, standing on the outer edge.
- **skin bow**: the drawn shin's lean (its skin) minus the bones' shin; + the drawn shin leans further out than its bones.
- **elbow**: round the shoulder-to-hand line, from straight down: 0 down, 90 out, 180 up, − in toward the chest.
  Wrong past 100 (up) or under −10 (in).
- **Legs** score: the worst of |knee bow|, |shin out|, |sole roll|, |skin bow| and |knee points|/3; **Elbows**: degrees past
  the wrong line.

```
pnpm build && pnpm --filter @tiletrigger/client exec vite preview --port 4860
node tools/content/limb-audit.mjs http://localhost:4860 /tmp/limbs          # the table below, /tmp/limbs/limbs.json
PICTURES=1 node tools/content/limb-audit.mjs http://localhost:4860 /tmp/limbs  # and front/side pictures per look
node tools/content/limb-sheet.mjs /tmp/limbs                                  # the contact sheet of the worst 20
```

## Table, worst first

<!-- limb-table -->
<!-- /limb-table -->
