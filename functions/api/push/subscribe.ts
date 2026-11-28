// Remembers a phone that turned on updates (only the push address is stored).
import { json, okEndpoint, subKey, type Env } from '../../../functions-lib/push';

interface Ctx { request: Request; env: Env }

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.PUSH_SUBS) return json({ ok: false, error: 'storage_not_configured' }, 503);
  let endpoint = '';
  try {
    const body = (await request.json()) as { subscription?: { endpoint?: string } };
    endpoint = String(body.subscription?.endpoint || '');
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }
  if (!okEndpoint(endpoint) || endpoint.length > 1000) return json({ ok: false, error: 'bad_endpoint' }, 400);
  await env.PUSH_SUBS.put(await subKey(endpoint), JSON.stringify({ endpoint, at: Date.now() }));
  return json({ ok: true });
};
