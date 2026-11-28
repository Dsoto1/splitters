/**
 * The combat rules' keys (sim/combatRules.ts, GUNPLAY G5), on their own so Match Setup in the menu's first download
 * can count and copy them without bringing the rest of combatRules.ts along (Rollup places a whole module in one chunk).
 */
export const COMBAT_RULE_KEYS = ['headshots', 'ammo', 'reloads', 'wallPenetration', 'damageScale', 'healthScale'] as const;
