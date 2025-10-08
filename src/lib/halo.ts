export type HaloToken = { access_token: string; token_type: string; expires_in: number; scope?: string };

async function getToken(): Promise<HaloToken> {
  const authBase = process.env.HALO_AUTH_BASE || process.env.HALO_API_BASE?.replace(/\/api$/, '/auth');
  const clientId = process.env.HALO_CLIENT_ID;
  const clientSecret = process.env.HALO_CLIENT_SECRET;
  const scope = process.env.HALO_SCOPE || 'all';
  if (!authBase || !clientId || !clientSecret) {
    throw new Error('Missing HALO_AUTH_BASE / HALO_CLIENT_ID / HALO_CLIENT_SECRET');
  }
  const url = `${authBase.replace(/\/$/, '')}/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Halo token failed (${res.status}): ${t}`);
  }
  return (await res.json()) as HaloToken;
}

export async function haloFetch(path: string, init?: RequestInit & { query?: Record<string, string | number | boolean | undefined> }) {
  const apiBase = process.env.HALO_API_BASE;
  if (!apiBase) throw new Error('Missing HALO_API_BASE');
  const token = await getToken();
  const q = new URLSearchParams();
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
  }
  const url = `${apiBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}${q.toString() ? `?${q.toString()}` : ''}`;
  const headers: Record<string, string> = {
    Authorization: `${token.token_type || 'Bearer'} ${token.access_token}`,
    Accept: 'application/json',
  };
  // Some tenants require an explicit tenant header
  if (process.env.HALO_TENANT) headers['X-Halo-Tenant'] = process.env.HALO_TENANT;
  const res = await fetch(url, { ...(init || {}), headers: { ...headers, ...(init?.headers as any) }, cache: 'no-store' });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Halo fetch ${path} failed (${res.status}): ${t}`);
  }
  return res.json();
}

export function fiscalMonthIndex(dateISO: string) {
  const dt = new Date(dateISO + (dateISO.length === 10 ? 'T00:00:00Z' : ''));
  const m = dt.getUTCMonth();
  return ((m + 12) - 8) % 12; // Sep=0 .. Aug=11
}
