// Server-side simulation entry point. Kept separate from the main index so the
// browser client does not pull in Recast unless it runs a local match.
export * from './sim/match.ts';
export * from './sim/hostControl.ts';
export * from './bots/brain.ts';
export * from './bots/teamBrain.ts';
export * from './bots/choices.ts';
export * from './bots/sniper.ts';
export * from './bots/playbooks.ts';
export { VantageBoard, computeVantage, vantageFor, type VantageKind, type VantageSpot } from './bots/vantage.ts';
export { leadAbility } from './bots/director.ts';
export * from './bots/botTrace.ts';
export * from './bots/debugView.ts';
export * from './bots/memory.ts';
export * from './bots/hints.ts';
export * from './editor/mapTest.ts';
export * from './nav/index.ts';
export * from './nav/audit.ts';
export * from './nav/corridors.ts';
export * from './sim/mapNav.ts';
export * from './sim/padFlight.ts';
export * from './sim/encounters.ts';
export * from './sim/modes/index.ts';
export * from './sim/profile.ts';
export * from './sim/clump.ts';
// Bot naming and characters, for test hooks that run against the match (e2e: which looks bots wear).
export { castAllows, lookTheme } from './content/botThemes.ts';
export { BOT_THEME_MIN, NAME_THEMES, SOLDIER_RANKS, SOLDIER_SURNAMES, botNameFor, nameTheme, type NameTheme } from './content/botNames.ts';
// Weapon sets, for test hooks that run against the match (e2e: what a set holds, the random spawn gun of a life).
export { randomGunFor, setHas, setMainGuns } from './sim/weaponSets.ts';
