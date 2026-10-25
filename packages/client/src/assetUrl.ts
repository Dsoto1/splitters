/**
 * Asset URLs carry the build's version (the git commit, see vite.config.ts) so
 * a browser never mixes model, texture or sound files cached from an older
 * version with newer code: after an update every URL is new, and the browser
 * fetches fresh copies instead of reusing stale ones.
 */
// Unit tests run without Vite's define: fall back to a fixed tag.
export const ASSET_VERSION: string = typeof __ASSET_VERSION__ === 'string' ? __ASSET_VERSION__ : 'dev';

export const versioned = (url: string): string => `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;

/** Options for loading a .glb whose URL has the version query (the loader can't tell the format from it). */
export const GLB = { pluginExtension: '.glb' } as const;
