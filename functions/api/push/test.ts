// Sends one test notification to the phone that asked, a few seconds later.
import { json, okEndpoint, sendPush, type Env } from '../../../functions-lib/push';

interface Ctx { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void }

export const onRequestPost = async ({ request, env, waitUntil }: Ctx): Promise<Response> => {
  if (!env.VAPID_PRIVATE_JWK) return json({ ok: false, error: 'not_configured' }, 503);
  let endpoint = '', delay = 6;
  try {
    const body = (await request.json()) as { subscription?: { endpoint?: string }; delay?: number };
    endpoint = String(body.subscription?.endpoint || '');
    delay = Math.max(0, Math.min(20, Number(body.delay ?? 6)));
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  if (!okEndpoint(endpoint)) return json({ ok: false, error: 'bad_endpoint' }, 400);
  waitUntil(new Promise((r) => setTimeout(r, delay * 1000)).then(() => sendPush(endpoint, env)).catch(() => 0));
  return json({ ok: true, in: delay });
};
