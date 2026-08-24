// Thin client for Call Rec UI's admin API — a fully separate app (own server, own DB, own auth)
// that Mydashboards drives on behalf of admins so process access can be granted from one place.
// Authenticates as the Call Rec UI admin account and caches the token for its ~8h lifetime.

const API_URL = process.env.CALLREC_API_URL || 'http://localhost:5050/api';
const ADMIN_USERNAME = process.env.CALLREC_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.CALLREC_ADMIN_PASSWORD || '';

export interface CallRecProcess {
  id: number;
  name: string;
  clientId: string;
  parentId: number | null;
  campaigns?: CallRecProcess[];
}

export interface CallRecUser {
  id: number;
  username: string;
  fullName: string | null;
  role: string;
  status: string;
  processes: CallRecProcess[];
}

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Call Rec UI admin login failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { token: string };
  return data.token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;
  cachedToken = await login();
  cachedTokenExpiresAt = Date.now() + 7 * 60 * 60 * 1000; // token lives 8h server-side; refresh a bit early
  return cachedToken;
}

async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const doRequest = async (token: string) => fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let token = await getToken();
  let res = await doRequest(token);
  if (res.status === 401) {
    // token expired/invalid server-side before our local cache thought so — force a fresh login and retry once
    token = await getToken(true);
    res = await doRequest(token);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Call Rec UI API error ${res.status} on ${method} ${path}: ${errBody}`);
  }
  return res.json() as Promise<T>;
}

export async function getCallRecProcessCatalog(): Promise<CallRecProcess[]> {
  return request<CallRecProcess[]>('GET', '/admin/processes');
}

export async function findCallRecUserByUsername(username: string): Promise<CallRecUser | null> {
  const users = await request<CallRecUser[]>('GET', '/admin/users');
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function getCallRecUserProcessIds(username: string): Promise<number[]> {
  const user = await findCallRecUserByUsername(username);
  return user ? user.processes.map((p) => p.id) : [];
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-10) + 'A1!';
}

// Creates the Call Rec UI account on first grant (username = the Mydashboards user's email),
// or updates its process assignments if one already exists.
export async function setCallRecUserProcessIds(username: string, fullName: string, processIds: number[]): Promise<void> {
  const existing = await findCallRecUserByUsername(username);
  if (existing) {
    await request('PUT', `/admin/users/${existing.id}`, { processIds });
  } else {
    await request('POST', '/admin/users', {
      username, password: generateTempPassword(), fullName, processIds,
    });
  }
}
