// Server-side simulation entry point. Kept separate from the main index so the
// browser client does not pull in Recast unless it runs a local match.
export * from './sim/match.ts';
export * from './bots/brain.ts';
export * from './nav/index.ts';
export * from './sim/encounters.ts';
