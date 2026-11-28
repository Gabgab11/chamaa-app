// Team-only: notifies every phone that turned on updates. Removes phones that unsubscribed.
import { json, sendPush, verifyTeamToken, type Env } from '../../../functions-lib/push';

interface Ctx { request: Request; env: Env }

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.VAPID_PRIVATE_JWK || !env.PUSH_SUBS) return json({ ok: false, error: 'not_configured' }, 503);
  const token = (request.headers.get('authorization') || '').replace(/^Team\s+/i, '');
  if (!(await verifyTeamToken(token, env))) return json({ ok: false, error: 'forbidden' }, 403);
  let sent = 0, removed = 0, failed = 0, cursor: string | undefined;
  do {
    const page = await env.PUSH_SUBS.list({ prefix: 'sub:', cursor });
    for (const k of page.keys) {
      const raw = await env.PUSH_SUBS.get(k.name);
      if (!raw) continue;
      const { endpoint } = JSON.parse(raw) as { endpoint: string };
      try {
        const st = await sendPush(endpoint, env);
        if (st === 404 || st === 410) { await env.PUSH_SUBS.delete(k.name); removed++; }
        else if (st >= 200 && st < 300) sent++;
        else failed++;
      } catch { failed++; }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ ok: true, sent, removed, failed });
};
