// Server-side simulation entry point. Kept separate from the main index so the
// browser client does not pull in Recast unless it runs a local match.
export * from './sim/match.ts';
export * from './sim/hostControl.ts';
export * from './bots/brain.ts';
export * from './nav/index.ts';
export * from './sim/encounters.ts';
export * from './sim/modes/index.ts';
export * from './sim/profile.ts';
export * from './sim/clump.ts';
// Bot naming and characters, for test hooks that run against the match (e2e: which looks bots wear).
export { castAllows, lookTheme } from './content/botThemes.ts';
export { BOT_THEME_MIN, NAME_THEMES, SOLDIER_RANKS, SOLDIER_SURNAMES, botNameFor, nameTheme, type NameTheme } from './content/botNames.ts';
