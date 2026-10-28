/**
 * Optional sign-in with a ToshiroPlay account (the owner's Cognito user pool,
 * managed login at login.toshiroplay.com, Google as the identity provider).
 * Playing never needs it.
 *
 * Authorization code flow with PKCE for a public client (no secret): "Sign
 * in" sends the browser to the managed login with a code challenge; it comes
 * back to /auth/callback with a code, which this page exchanges for tokens
 * at the pool's token endpoint. Tokens live in sessionStorage (this tab, gone
 * when it closes); no refresh token is kept, so a session lasts the tokens'
 * hour. The hub checks them when it needs to know who you are (GET /api/v1/me).
 *
 * Config (build time): VITE_COGNITO_CLIENT_ID ("off" to disable),
 * VITE_COGNITO_DOMAIN, VITE_COGNITO_ORIGINS (space-separated origins
 * registered as callback URLs; sign-in is offered only on those).
 */
const env = import.meta.env as Record<string, string | undefined>;
export const COGNITO = {
  clientId: env.VITE_COGNITO_CLIENT_ID ?? '2lrej6nsacfag8a7taeu3u6sc2',
  domain: env.VITE_COGNITO_DOMAIN ?? 'login.toshiroplay.com',
  region: 'us-east-1',
  userPoolId: 'us-east-1_VdMsuDJ59',
  origins: (env.VITE_COGNITO_ORIGINS ?? 'https://trigger.toshiroplay.com http://localhost:5173').split(/\s+/).filter(Boolean),
  scopes: 'openid email profile',
} as const;

export const CALLBACK_PATH = '/auth/callback';
const TOKENS_KEY = 'tiletrigger.auth';
const PENDING_KEY = 'tiletrigger.auth.pending';

/** Whether sign-in is available here (configured, and this origin is a registered callback). */
export function signInAvailable(): boolean {
  return !!COGNITO.clientId && COGNITO.clientId !== 'off' && COGNITO.origins.includes(location.origin) && !!globalThis.crypto?.subtle;
}

interface Tokens {
  idToken: string;
  accessToken: string;
  /** ms since epoch */
  expiresAt: number;
}

/** What the page shows about the signed-in player (from the ID token; the hub verifies tokens itself). */
export interface Account {
  sub: string;
  name: string;
  email?: string;
}

const session = {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Storage blocked: sign-in lasts for this page only.
    }
  },
};

let memory: Tokens | null = null;

function tokens(): Tokens | null {
  if (!memory) {
    try {
      memory = JSON.parse(session.get(TOKENS_KEY) ?? 'null') as Tokens | null;
    } catch {
      memory = null;
    }
  }
  if (memory && memory.expiresAt <= Date.now() + 30_000) {
    memory = null;
    session.set(TOKENS_KEY, null);
  }
  return memory;
}

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n: number): string => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** The claims of a JWT (not verified: display only). */
export function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part)))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function currentAccount(): Account | null {
  const t = tokens();
  const c = t ? jwtClaims(t.idToken) : null;
  if (!c || typeof c.sub !== 'string') return null;
  const name = typeof c.name === 'string' ? c.name : typeof c.given_name === 'string' ? c.given_name : typeof c.email === 'string' ? c.email.split('@')[0]! : 'Player';
  return { sub: c.sub, name: name.slice(0, 40), ...(typeof c.email === 'string' ? { email: c.email } : {}) };
}

/** The access token for calls to the hub (Authorization: Bearer …), or null when signed out. */
export function accessToken(): string | null {
  return tokens()?.accessToken ?? null;
}

const redirectUri = () => `${location.origin}${CALLBACK_PATH}`;

/** Off to the managed login page (comes back to /auth/callback). */
export async function signIn(): Promise<void> {
  if (!signInAvailable()) return;
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  // Where to return to afterwards (the menu, or a join link).
  session.set(PENDING_KEY, JSON.stringify({ verifier, state, back: `${location.pathname === CALLBACK_PATH ? '/' : location.pathname}${location.search}` }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO.clientId,
    redirect_uri: redirectUri(),
    scope: COGNITO.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  location.assign(`https://${COGNITO.domain}/oauth2/authorize?${q}`);
}

/**
 * On /auth/callback: check the state, exchange the code for tokens, and put
 * the address back to where sign-in started. Resolves with a message for the
 * menu (null when this isn't the callback page).
 */
export async function handleAuthCallback(): Promise<string | null> {
  if (location.pathname !== CALLBACK_PATH) return null;
  const q = new URLSearchParams(location.search);
  let pending: { verifier: string; state: string; back: string } | null = null;
  try {
    pending = JSON.parse(session.get(PENDING_KEY) ?? 'null');
  } catch {
    pending = null;
  }
  session.set(PENDING_KEY, null);
  history.replaceState(null, '', pending?.back && pending.back.startsWith('/') && !pending.back.startsWith('//') ? pending.back : '/');
  if (q.get('error')) return `Sign-in cancelled (${q.get('error_description') ?? q.get('error')})`;
  const code = q.get('code');
  if (!code || !pending || q.get('state') !== pending.state) return 'Sign-in failed: please try again';
  try {
    const res = await fetch(`https://${COGNITO.domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: COGNITO.clientId, code, redirect_uri: redirectUri(), code_verifier: pending.verifier }),
    });
    if (!res.ok) return `Sign-in failed (${res.status})`;
    const body = (await res.json()) as { id_token?: string; access_token?: string; expires_in?: number };
    if (!body.id_token || !body.access_token) return 'Sign-in failed: no tokens';
    memory = { idToken: body.id_token, accessToken: body.access_token, expiresAt: Date.now() + Math.min(body.expires_in ?? 3600, 86_400) * 1000 };
    session.set(TOKENS_KEY, JSON.stringify(memory));
    // Never the account's own name (that comes from Google): players see their username (Profile).
    return 'Signed in';
  } catch {
    return "Sign-in failed: couldn't reach the login service";
  }
}

/** Forget the tokens here and end the managed-login session too. */
export function signOut(): void {
  memory = null;
  session.set(TOKENS_KEY, null);
  if (!signInAvailable()) return;
  const q = new URLSearchParams({ client_id: COGNITO.clientId, logout_uri: `${location.origin}/` });
  location.assign(`https://${COGNITO.domain}/logout?${q}`);
}
