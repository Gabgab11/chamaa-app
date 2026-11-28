// Shared helpers for the progress-portal push notifications.
export interface Env { VAPID_PRIVATE_JWK?: string; VAPID_SUBJECT?: string; PUSH_SUBS?: KV }
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export const ALLOWED_PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export const b64u = (bytes: ArrayBuffer | Uint8Array): string => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const fromB64u = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function okEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && ALLOWED_PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

function jwk(env: Env) {
  return JSON.parse(env.VAPID_PRIVATE_JWK!) as JsonWebKey & { x: string; y: string };
}

export async function vapidHeader(endpoint: string, env: Env): Promise<string> {
  const k = jwk(env);
  const key = await crypto.subtle.importKey('jwk', { ...k, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:info@luminarydigitalgroup.com',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  const pub = new Uint8Array(65);
  pub[0] = 4;
  pub.set(fromB64u(k.x), 1);
  pub.set(fromB64u(k.y), 33);
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${b64u(pub)}`;
}

/** Payload-free push: the service worker fetches the latest update text itself. */
export async function sendPush(endpoint: string, env: Env): Promise<number> {
  return (await sendPushDetailed(endpoint, env)).status;
}

/** Same as sendPush, but keeps the push service's reason (e.g. Apple's "BadJwtToken") for checks. */
export async function sendPushDetailed(endpoint: string, env: Env): Promise<{ status: number; reason: string }> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(endpoint, env), TTL: '86400', Urgency: 'high', 'Content-Length': '0' },
  });
  let reason = '';
  try { reason = (await res.text()).slice(0, 200); } catch { /* none */ }
  return { status: res.status, reason };
}

/**
 * Only the team can broadcast: the request carries a short-lived token signed with the same
 * private key, checked here against the public half. No extra password to store.
 */
export async function verifyTeamToken(token: string, env: Env): Promise<boolean> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  let claims: { act?: string; exp?: number };
  try { claims = JSON.parse(new TextDecoder().decode(fromB64u(payload))); } catch { return false; }
  if (claims.act !== 'broadcast' || !claims.exp || claims.exp < Date.now() / 1000 || claims.exp > Date.now() / 1000 + 600) return false;
  const k = jwk(env);
  const pubKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: k.x, y: k.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, fromB64u(sig), new TextEncoder().encode(payload));
}

export async function subKey(endpoint: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub:' + b64u(h);
}
