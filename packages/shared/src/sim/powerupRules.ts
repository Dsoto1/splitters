import type { PowerupKind } from './items.ts';

/**
 * The host's switch for each power-up (sim/serverRules.ts, the browser host's Match setup): its console word and
 * label (the help is serverRules.ts's, out of the menu's first JS). On by default; off, that power-up's pickups don't lie on the map (MatchRules.powerupsOff).
 */
export const POWERUP_RULES: readonly { kind: PowerupKind; key: string; label: string }[] = [
  { kind: 'speed', key: 'speedboost', label: 'Speed Boost' },
  { kind: 'damage', key: 'doubledamage', label: 'Double Damage' },
  { kind: 'overdrive', key: 'overdrive', label: 'Overdrive' },
  { kind: 'regen', key: 'regen', label: 'Regen' },
  { kind: 'rapid', key: 'rapidfire', label: 'Rapid Fire' },
  { kind: 'phantom', key: 'phantom', label: 'Phantom' },
  { kind: 'moon', key: 'moonboots', label: 'Moon Boots' },
  { kind: 'vampire', key: 'vampire', label: 'Vampire' },
  { kind: 'bottomless', key: 'bottomless', label: 'Bottomless Mag' },
];
