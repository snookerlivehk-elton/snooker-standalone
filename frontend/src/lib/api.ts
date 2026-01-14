// Minimal API helpers for Plan A; future-proofed for B/B+
type Headers = Record<string, string>;

function buildHeaders(writeToken?: string): Headers {
  const headers: Headers = { 'Content-Type': 'application/json' };
  if (writeToken) headers['x-write-token'] = writeToken;
  return headers;
}

export async function createMatch(
  apiUrl: string,
  roomId: string,
  match: any,
  players: any[],
  timestamps: { start: number | null },
  writeToken?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps }),
  });
  if (!res.ok) throw new Error(`建立比賽失敗 (${res.status})`);
  return res.json(); // { matchId }
}

export async function createMatchStrict(
  apiUrl: string,
  roomId: string,
  match: any,
  players: Array<{ name: string; memberId: string }>,
  timestamps: { start: number | null },
  writeToken?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/strict`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps }),
  });
  if (!res.ok) throw new Error(`建立比賽失敗（strict）(${res.status})`);
  return res.json(); // { matchId }
}

export async function createMatchPartial(
  apiUrl: string,
  roomId: string,
  match: any,
  players: Array<{ name: string; memberId: string | null }>,
  timestamps: { start: number | null },
  writeToken?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/partial`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps }),
  });
  if (!res.ok) throw new Error(`建立比賽失敗（partial）(${res.status})`);
  return res.json() as Promise<{ matchId: string; acceptedMemberIds: string[] }>;
}

export async function appendEvents(
  apiUrl: string,
  matchId: string,
  events: any[],
  writeToken?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/${matchId}/events`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`上傳事件失敗 (${res.status})`);
  return res.json(); // { accepted }
}

export async function finalizeMatch(
  apiUrl: string,
  matchId: string,
  payload: {
    foulTotals: any,
    stats: any,
    timestamps: { end: number | null },
    winnerMemberId: string | null,
    playersFinal?: Array<{ name: string; memberId?: string | null; framesWon?: number; score?: number }>,
    match?: any,
  },
  writeToken?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/${matchId}/finalize`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Finalize 失敗 (${res.status})`);
  return res.json();
}

// Members API
export async function registerMember(
  apiUrl: string,
  payload: {
    email: string;
    name: string;
    regionCode?: string;
    districtCode?: string;
    districtName?: string;
    phone?: string;
    birthDate?: string;
  }
) {
  const res = await fetch(`${apiUrl}/api/members/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`會員註冊失敗 (${res.status})`);
  return res.json(); // { id, memberCode }
}

export async function listMemberRegions(
  apiUrl: string,
) {
  const res = await fetch(`${apiUrl}/api/member/regions`);
  if (!res.ok) throw new Error(`取得地方清單失敗 (${res.status})`);
  return res.json();
}

export async function listMemberDistricts(
  apiUrl: string,
  regionCode?: string,
) {
  const qs = regionCode ? `?regionCode=${encodeURIComponent(regionCode)}` : '';
  const res = await fetch(`${apiUrl}/api/member/districts${qs}`);
  if (!res.ok) throw new Error(`取得分區清單失敗 (${res.status})`);
  return res.json();
}

export async function listAdminMemberRegions(
  apiUrl: string,
  adminToken: string,
) {
  try {
    const res = await fetch(`${apiUrl}/api/admin/member/regions`, {
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) return res.json();
  } catch {}
  const res2 = await fetch(`${apiUrl}/api/admin/member/regions?token=${encodeURIComponent(adminToken)}`, {
    method: 'GET',
  });
  if (!res2.ok) throw new Error(`取得地方管理清單失敗 (${res2.status})`);
  return res2.json();
}

export async function upsertAdminMemberRegion(
  apiUrl: string,
  adminToken: string,
  payload: { code3: string; name: string; active?: boolean },
) {
  const code = payload.code3.trim().toUpperCase();
  const createRes = await fetch(`${apiUrl}/api/admin/member/regions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ ...payload, code3: code }),
  });
  if (createRes.ok) return createRes.json();
  if (createRes.status !== 409) {
    throw new Error(`新增或更新地方失敗 (${createRes.status})`);
  }
  const updateRes = await fetch(`${apiUrl}/api/admin/member/regions/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ name: payload.name, active: payload.active }),
  });
  if (!updateRes.ok) throw new Error(`新增或更新地方失敗 (${updateRes.status})`);
  return updateRes.json();
}

export async function listAdminMemberDistricts(
  apiUrl: string,
  adminToken: string,
  regionCode?: string,
) {
  const qs = regionCode ? `?regionCode=${encodeURIComponent(regionCode)}` : '';
  try {
    const res = await fetch(`${apiUrl}/api/admin/member/districts${qs}`, {
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) return res.json();
  } catch {}
  const url = `${apiUrl}/api/admin/member/districts${qs || ''}${qs ? '&' : '?'}token=${encodeURIComponent(adminToken)}`;
  const res2 = await fetch(url, {
    method: 'GET',
  });
  if (!res2.ok) throw new Error(`取得分區管理清單失敗 (${res2.status})`);
  return res2.json();
}

export async function upsertAdminMemberDistrict(
  apiUrl: string,
  adminToken: string,
  payload: { regionCode: string; code3: string; name: string; active?: boolean },
) {
  const region = payload.regionCode.trim().toUpperCase();
  const code = payload.code3.trim().toUpperCase();
  const createRes = await fetch(`${apiUrl}/api/admin/member/districts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ ...payload, regionCode: region, code3: code }),
  });
  if (createRes.ok) return createRes.json();
  if (createRes.status !== 409) {
    throw new Error(`新增或更新分區失敗 (${createRes.status})`);
  }
  const updateRes = await fetch(`${apiUrl}/api/admin/member/districts/${encodeURIComponent(region)}/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ name: payload.name, active: payload.active }),
  });
  if (!updateRes.ok) throw new Error(`新增或更新分區失敗 (${updateRes.status})`);
  return updateRes.json();
}

export async function getMember(
  apiUrl: string,
  id: string,
) {
  const res = await fetch(`${apiUrl}/api/members/${id}`);
  if (!res.ok) throw new Error(`取得會員失敗 (${res.status})`);
  return res.json(); // { member }
}

export async function renewMembership(
  apiUrl: string,
  id: string,
  years?: number,
) {
  const res = await fetch(`${apiUrl}/api/members/${id}/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(years ? { years } : {}),
  });
  if (!res.ok) throw new Error(`續期申請失敗 (${res.status})`);
  return res.json() as Promise<{ member: any }>;
}

export async function listMembers(
  apiUrl: string,
  adminToken: string,
) {
  // Prefer header-based auth; fallback to query param to avoid CORS preflight on some setups
  try {
    const res = await fetch(`${apiUrl}/api/admin/members`, {
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) return res.json();
  } catch {}
  const res2 = await fetch(`${apiUrl}/api/admin/members?token=${encodeURIComponent(adminToken)}`, {
    method: 'GET',
  });
  if (!res2.ok) throw new Error(`取得會員列表失敗 (${res2.status})`);
  return res2.json();
}

export async function updateMember(
  apiUrl: string,
  adminToken: string,
  id: string | number,
  payload: {
    name?: string;
    email?: string;
    district_code?: string;
    phone?: string;
    birthDate?: string;
    member_code?: string;
    role?: string;
  },
) {
  const res = await fetch(`${apiUrl}/api/admin/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`更新會員失敗 (${res.status})`);
  return res.json(); // { member }
}

export async function deleteMember(
  apiUrl: string,
  adminToken: string,
  id: string | number,
) {
  const res = await fetch(`${apiUrl}/api/admin/members/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`刪除會員失敗 (${res.status})`);
  return res.json(); // { ok: true }
}

export async function regenerateMemberCode(
  apiUrl: string,
  adminToken: string,
  id: string | number,
  districtCode: string,
) {
  const res = await fetch(`${apiUrl}/api/admin/members/${id}/regenerate-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ districtCode }),
  });
  if (!res.ok) throw new Error(`重生會員編碼失敗 (${res.status})`);
  return res.json(); // { member_code }
}

export async function validateMembers(
  apiUrl: string,
  ids: string[],
) {
  const qs = encodeURIComponent(ids.join(','));
  const res = await fetch(`${apiUrl}/api/members/validate?ids=${qs}`);
  if (!res.ok) throw new Error(`驗證會員 ID 失敗 (${res.status})`);
  return res.json() as Promise<{ exists: Record<string, boolean> }>;
}

export async function resendVerificationEmail(
  apiUrl: string,
  email: string,
) {
  const res = await fetch(`${apiUrl}/api/members/resend-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`重寄驗證信失敗 (${res.status})`);
  return res.json(); // { ok: true }
}

export async function listAdminMatches(
  apiUrl: string,
  adminToken: string,
  opts?: {
    memberId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const params = new URLSearchParams();
  if (opts?.memberId) params.set('memberId', opts.memberId);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  const qs = params.toString();
  const base = `${apiUrl}/api/admin/matches${qs ? `?${qs}` : ''}`;
  try {
    const res = await fetch(base, {
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) return res.json();
  } catch {}
  const url = `${base}${qs ? '&' : '?'}token=${encodeURIComponent(adminToken)}`;
  const res2 = await fetch(url, { method: 'GET' });
  if (!res2.ok) throw new Error(`取得比賽列表失敗 (${res2.status})`);
  return res2.json();
}
