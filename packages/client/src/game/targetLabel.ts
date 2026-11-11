/**
 * The name over the health bar of whoever you just hit. In Roulette everyone wears another character each life
 * while their name (and score) stays theirs for the match, so the character worn now is named beside it
 * ("Mildred · The Dapper"): the owner aimed at the old man and could not tell whose row on the scoreboard he was.
 * `wearing`: that character's name (undefined for a look of the player's own making).
 */
export function targetLabel(name: string, wearing: string | undefined, roulette: boolean): string {
  return roulette && wearing && wearing.toLowerCase() !== name.toLowerCase() ? `${name} · ${wearing}` : name;
}
