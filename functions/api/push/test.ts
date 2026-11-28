// Sends one test push notification to the device that asked for it, a few seconds later
// (so the person can close the app and see it arrive). Payload-free push: the service worker
// fetches the latest update text itself, so no message encryption is needed.
// Needs the Cloudflare secret VAPID_PRIVATE_JWK (JSON: {kty,crv,d,x,y}). Never commit it.

interface Env { VAPID_PRIVATE_JWK?: string; VAPID_SUBJECT?: string }
interface Ctx { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void }

const ALLOWED_PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

const b64u = (bytes: ArrayBuffer | Uint8Array): string => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function vapidHeader(endpoint: string, env: Env): Promise<string> {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK!) as JsonWebKey & { x: string; y: string };
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
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
  pub.set(fromB64u(jwk.x), 1);
  pub.set(fromB64u(jwk.y), 33);
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${b64u(pub)}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const onRequestPost = async ({ request, env, waitUntil }: Ctx): Promise<Response> => {
  if (!env.VAPID_PRIVATE_JWK) return json({ ok: false, error: 'not_configured' }, 503);
  let endpoint = '';
  let delay = 6;
  try {
    const body = (await request.json()) as { subscription?: { endpoint?: string }; delay?: number };
    endpoint = String(body.subscription?.endpoint || '');
    delay = Math.max(0, Math.min(20, Number(body.delay ?? 6)));
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  let host = '';
  try { host = new URL(endpoint).hostname; } catch { /* invalid */ }
  if (!endpoint.startsWith('https://') || !ALLOWED_PUSH_HOSTS.some((r) => r.test(host))) return json({ ok: false, error: 'bad_endpoint' }, 400);

  const send = async () => {
    await new Promise((r) => setTimeout(r, delay * 1000));
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: await vapidHeader(endpoint, env), TTL: '3600', Urgency: 'high', 'Content-Length': '0' },
    });
    return res.status;
  };
  // Answer at once, send in the background so the person can close the app first.
  waitUntil(send().catch(() => 0));
  return json({ ok: true, in: delay });
};
