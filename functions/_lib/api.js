export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
export async function handleScan() { return json({ status: 'not_configured' }, 501); }
