/**
 * Parties: friends who play together. A party is a short random tag. Each browser has its own; following someone's
 * invite link (`?join=CODE&party=TAG`) puts you in theirs, and your own invite links carry it on. Whoever runs the
 * match keeps a party together: in team modes a joining member takes a bot's place on the team most of their party
 * is on (Match.takeOverBot), so a party that travels to the next map (a vote, the rotation, Change map) lands on one
 * side again as its members rejoin. A tag says nothing about anyone: it only groups.
 */
export const PARTY_TAG_RE = /^[A-Za-z0-9]{6,12}$/;

export const isPartyTag = (v: unknown): v is string => typeof v === 'string' && PARTY_TAG_RE.test(v);

/** A fresh tag (8 characters from a CSPRNG where there is one). */
export function newPartyTag(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => abc[b % abc.length]).join('');
}
