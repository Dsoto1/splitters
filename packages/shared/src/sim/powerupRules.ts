import type { PowerupKind } from './items.ts';

/**
 * The host's switch for each power-up (sim/serverRules.ts, the browser host's Match setup): its console word, label
 * and help. On by default; off, that power-up's pickups don't lie on the map (MatchRules.powerupsOff).
 */
export const POWERUP_RULES: readonly { kind: PowerupKind; key: string; label: string; help: string }[] = [
  { kind: 'speed', key: 'speedboost', label: 'Speed Boost', help: 'Speed Boost pickups: run faster for a while.' },
  { kind: 'damage', key: 'doubledamage', label: 'Double Damage', help: 'Double Damage pickups: your hits do twice the damage for a while.' },
  { kind: 'overdrive', key: 'overdrive', label: 'Overdrive', help: 'Overdrive pickups (rare): a few seconds nothing hurts you, and running into an enemy knocks them flying.' },
  { kind: 'regen', key: 'regen', label: 'Regen', help: 'Regen pickups: health comes back by itself for a while.' },
  { kind: 'rapid', key: 'rapidfire', label: 'Rapid Fire', help: 'Rapid Fire pickups: fire and reload faster for a while.' },
  { kind: 'phantom', key: 'phantom', label: 'Phantom', help: 'Phantom pickups: nearly invisible for a while; firing shows you briefly.' },
  { kind: 'moon', key: 'moonboots', label: 'Moon Boots', help: 'Moon Boots pickups: low gravity, higher jumps and no fall damage for a while.' },
  { kind: 'vampire', key: 'vampire', label: 'Vampire', help: 'Vampire pickups: your hits heal you a little for a while.' },
  { kind: 'bottomless', key: 'bottomless', label: 'Bottomless Mag', help: 'Bottomless Mag pickups: no ammo used and no reloads for a while.' },
];
