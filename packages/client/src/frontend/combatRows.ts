import { AMMO_RULES, AMMO_RULE_LABELS, COMBAT_SCALES, HEADSHOT_LABELS, HEADSHOT_RULES, combatRulesOf, scaleLabel, type CombatRules, type MapDocument } from '@tiletrigger/shared';
import { choice, ruleSwitch, settingRow, type ChoiceOption } from './setupControls.ts';

/**
 * Match Setup → Rules → Combat rules (GUNPLAY G5, shared sim/combatRules.ts), loaded with its own chunk when Match Setup
 * draws (out of the menu's first download: docs/LOADING.md). Each row shows what the match plays (the host's change,
 * else the map's own, lit); picking the map's own clears the change (`set(k, undefined)`). IDs `arcade-headshots`,
 * `arcade-ammo`, `arcade-reloads`, `arcade-walls`, `arcade-damage`, `arcade-health`.
 */
export function combatRows(s: CombatRules, map: MapDocument, set: <K extends keyof CombatRules>(k: K, v: CombatRules[K] | undefined) => void): HTMLElement[] {
  const own = combatRulesOf({}, map);
  const play = combatRulesOf(s, map);
  const pick = <K extends keyof CombatRules>(k: K) => (v: CombatRules[K]) => set(k, v === own[k] ? undefined : v);
  const mapSays = (what: string) => `\n\nThis map: ${what} (its maker's choice).`;
  const onOff = (on: boolean) => (on ? 'on' : 'off');
  const scales = COMBAT_SCALES.map((v): ChoiceOption<string> => [String(v), scaleLabel(v)]);
  return [
    settingRow('Headshots', `Off: a head hit counts as the body. Normal: each weapon's own head multiple. High: double the head bonus.${mapSays(HEADSHOT_LABELS[own.headshots])}`, choice(HEADSHOT_RULES.map((v): ChoiceOption<string> => [v, HEADSHOT_LABELS[v]]), play.headshots, (v) => pick('headshots')(v as CombatRules['headshots']), 'arcade-headshots')),
    settingRow('Ammo', `Unlimited: reserves never run down. Scarce: half the ammo at spawn and from pickups.${mapSays(AMMO_RULE_LABELS[own.ammo])}`, choice(AMMO_RULES.map((v): ChoiceOption<string> => [v, AMMO_RULE_LABELS[v]]), play.ammo, (v) => pick('ammo')(v as CombatRules['ammo']), 'arcade-ammo')),
    settingRow('Reloads', `Off: the magazine feeds straight from the reserve, so nobody reloads.${mapSays(onOff(own.reloads))}`, ruleSwitch('arcade-reloads', 'Reloads', play.reloads, pick('reloads'))),
    settingRow('Bullets through walls', `On: strong rounds pass thin cover, weakened. Off: cover stops every round (glass still breaks).${mapSays(onOff(own.wallPenetration))}`, ruleSwitch('arcade-walls', 'Bullets through walls', play.wallPenetration, pick('wallPenetration'))),
    settingRow('Damage', `Everything players, bots and enemies deal, for every weapon alike (falls and hazards unchanged).${mapSays(scaleLabel(own.damageScale))}`, choice(scales, String(play.damageScale), (v) => pick('damageScale')(Number(v)), 'arcade-damage')),
    settingRow('Health', `Players' and bots' effective health: damage they take is divided by it.${mapSays(scaleLabel(own.healthScale))}`, choice(scales, String(play.healthScale), (v) => pick('healthScale')(Number(v)), 'arcade-health')),
  ];
}
