// Returns the visitor's country from Cloudflare's edge (used to pick the display currency).
interface Ctx { request: Request & { cf?: { country?: string } } }

export const onRequestGet = ({ request }: Ctx): Response => {
  const country = (request.headers.get('cf-ipcountry') || request.cf?.country || '').toUpperCase();
  return new Response(JSON.stringify({ country: /^[A-Z]{2}$/.test(country) ? country : '' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
};
