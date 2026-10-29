import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { botSetFromText, parseBotSetPreset, presetBotSet, validateBotSet, type BotSet, type BotSetPreset } from '@tiletrigger/shared';

/**
 * A dedicated server's (and Host Service's) side of bot sets (shared
 * sim/botSet.ts): the built-in presets in maps/botsets/, and a set from a
 * config value.
 */

/** The built-in bot sets (maps/botsets/*.json), by name. */
export function readBotSetPresets(mapsDir: string): BotSetPreset[] {
  const dir = join(mapsDir, 'botsets');
  if (!existsSync(dir)) return [];
  const out: BotSetPreset[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const p = parseBotSetPreset(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      if (p) out.push(p);
    } catch {
      // Not a preset.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A bot set from config (BOTSET): a preset's id ("knights_vs_space" or
 * "preset:knights_vs_space"), the set's text form ("Sir Clank, core.knight,
 * hard; Zorp"), or a set object ({ name, entries, fill }). Returns the set
 * (made valid) and lines about what was changed, or an error.
 */
export function resolveBotSet(raw: unknown, presets: readonly BotSetPreset[]): { set: BotSet | null; notes: string[]; error?: string } {
  if (raw === undefined || raw === null || raw === '') return { set: null, notes: [] };
  if (typeof raw === 'string') {
    const id = raw.trim().replace(/^preset:/, '');
    const p = presets.find((x) => x.id === id);
    if (p) return { set: presetBotSet(p), notes: [] };
    // Not a preset's id: a list in the text form (anything with a comma or ";" in it).
    if (/[,;\n]/.test(raw)) {
      const v = botSetFromText(raw);
      return v.set.entries.length || v.set.fill === 'only' ? { set: v.set, notes: v.fixes } : { set: null, notes: [], error: 'BOTSET names no bots' };
    }
    return { set: null, notes: [], error: `no built-in bot set "${id.slice(0, 40)}" (${presets.map((x) => x.id).join(', ') || 'none'})` };
  }
  const v = validateBotSet(raw);
  if (!v) return { set: null, notes: [], error: 'BOTSET must be a preset name, a list ("Name, look, skill; …") or { name, entries, fill }' };
  return { set: v.set, notes: v.fixes };
}
