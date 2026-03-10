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
  operatorId?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps, operatorId }),
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
  operatorId?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/strict`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps, operatorId }),
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
  operatorId?: string,
) {
  const res = await fetch(`${apiUrl}/api/matches/partial`, {
    method: 'POST',
    headers: buildHeaders(writeToken),
    body: JSON.stringify({ roomId, match, players, timestamps, operatorId }),
  });
  if (!res.ok) throw new Error(`建立比賽失敗（partial）(${res.status})`);
  return res.json() as Promise<{ matchId: string; acceptedMemberIds: string[] }>;
}

export async function sendMatchVerificationCode(apiUrl: string, email: string) {
  const res = await fetch(`${apiUrl}/api/match-verification-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `發送驗證碼失敗 (${res.status})`);
  }
  return res.json();
}

// Club API
export async function getClubProfile(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/my-profile`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) throw new Error('Failed to load club profile');
  return res.json();
}

export async function updateClubProfile(apiUrl: string, memberId: string, data: any) {
  const res = await fetch(`${apiUrl}/api/club/my-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update club profile');
  return res.json();
}

export async function getClubMembers(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/my-members`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) throw new Error('Failed to load members');
  return res.json();
}

export async function getPublicClubProfile(apiUrl: string, clubId: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/public`);
  if (!res.ok) throw new Error('Failed to load club public profile');
  return res.json();
}

export async function joinClub(apiUrl: string, memberId: string, clubId: string) {
  const res = await fetch(`${apiUrl}/api/club/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, clubId })
  });
  if (!res.ok) {
     const err = await res.json().catch(() => ({}));
     throw new Error(err.message || err.error || 'Failed to join club');
  }
  return res.json();
}

export async function getMyJoinedClubs(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/joined`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) throw new Error('Failed to load joined clubs');
  return res.json();
}

export async function broadcastClubMessage(apiUrl: string, memberId: string, title: string, content: string) {
  const res = await fetch(`${apiUrl}/api/club/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ title, content })
  });
  if (!res.ok) throw new Error('Failed to broadcast message');
  return res.json();
}

export async function getMyClubMessages(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/messages`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function deleteOperatorRoom(apiUrl: string, roomId: string) {
  const res = await fetch(`${apiUrl}/api/rooms/${roomId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `刪除房間失敗 (${res.status})`);
  }
  return true;
}

export async function startMatchV2(
  apiUrl: string,
  payload: {
    p1_email?: string;
    p1_code?: string;
    p2_email?: string;
    p2_code?: string;
    room_id: string;
    operator_id?: string;
    frames_required: number;
    red_balls: number;
    handicap0: number;
    handicap1: number;
  }
) {
  const res = await fetch(`${apiUrl}/api/matches/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `建立比賽失敗 (${res.status})`);
  }
  return res.json() as Promise<{ 
    mode: 'ranked' | 'guest'; 
    matchId: string;
    p1MemberId: string | null;
    p2MemberId: string | null;
  }>;
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
  data: {
    name: string;
    email: string;
    password: string;
    regionCode: string;
    districtCode: string;
    phone?: string;
    clubName?: string;
    birthDate?: string;
  },
) {
  const res = await fetch(`${apiUrl}/api/members/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `註冊失敗 (${res.status})`);
  }
  return res.json(); // { id, memberCode }
}

export async function loginMember(
  apiUrl: string,
  creds: { email: string; password: string },
) {
  const res = await fetch(`${apiUrl}/api/members/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `登入失敗 (${res.status})`);
  }
  return res.json(); // { ok, id, member: {...} }
}

export async function loginGoogle(
  apiUrl: string,
  credential: string,
) {
  const res = await fetch(`${apiUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `登入失敗 (${res.status})`);
  }
  return res.json(); // { ok, id, member: {...} }
}

export async function getMember(
  apiUrl: string,
  id: string,
) {
  const res = await fetch(`${apiUrl}/api/members/${id}`);
  if (!res.ok) throw new Error(`取得會員資料失敗 (${res.status})`);
  return res.json(); // { ...member }
}

export async function getMemberMatches(
  apiUrl: string,
  id: string,
) {
  const res = await fetch(`${apiUrl}/api/members/${id}/matches`);
  if (!res.ok) throw new Error(`取得比賽歷史失敗 (${res.status})`);
  return res.json(); // { matches: [] }
}

export async function validateMembers(
  apiUrl: string,
  identifiers: string[],
) {
  const res = await fetch(`${apiUrl}/api/members/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
  });
  if (!res.ok) throw new Error(`驗證會員失敗 (${res.status})`);
  return res.json() as Promise<{ exists: Record<string, boolean>; names: Record<string, string> }>;
}

export async function requestPasswordResetCode(apiUrl: string, email: string) {
  const res = await fetch(`${apiUrl}/api/members/request-password-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `發送驗證碼失敗 (${res.status})`);
  }
  return res.json();
}

export async function resetPasswordWithCode(apiUrl: string, payload: { email: string; code: string; newPassword: string }) {
  const res = await fetch(`${apiUrl}/api/members/reset-password-with-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `重設密碼失敗 (${res.status})`);
  }
  return res.json();
}

// Operator API
export async function createOperatorRoom(apiUrl: string, operatorId: string) {
  const res = await fetch(`${apiUrl}/api/operators/${operatorId}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `建立房間失敗 (${res.status})`);
  }
  return res.json(); // { roomCode }
}

export async function getOperatorActiveRooms(apiUrl: string, operatorId: string) {
  const url = new URL(`${apiUrl}/api/operators/${operatorId}/active-rooms`);
  url.searchParams.set('t', String(Date.now()));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `取得活躍房間失敗 (${res.status})`);
  }
  return res.json(); // { rooms: [] }
}

export async function getOperatorMatches(apiUrl: string, operatorId: string) {
  const url = new URL(`${apiUrl}/api/operators/${operatorId}/matches`);
  url.searchParams.set('t', String(Date.now()));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `取得操作員歷史失敗 (${res.status})`);
  }
  return res.json(); // { matches: [] }
}

// Admin / Lists
export async function listMembers(apiUrl: string, adminToken: string) {
  const res = await fetch(`${apiUrl}/api/admin/members`, {
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`取得會員列表失敗 (${res.status})`);
  return res.json();
}

export async function updateMember(
  apiUrl: string,
  adminToken: string,
  id: string,
  data: { phone?: string; birthDate?: string; role?: string; membershipExpiresAt?: string; clubName?: string }
) {
  const res = await fetch(`${apiUrl}/api/admin/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`更新會員資料失敗 (${res.status})`);
  return res.json();
}

export async function updateMemberSelf(
  apiUrl: string,
  id: string,
  data: { phone?: string; birthDate?: string; clubName?: string; password?: string }
) {
  const res = await fetch(`${apiUrl}/api/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`更新個人資料失敗 (${res.status})`);
  return res.json();
}

export async function deleteMember(apiUrl: string, adminToken: string, id: string | number) {
  const res = await fetch(`${apiUrl}/api/admin/members/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`刪除會員失敗 (${res.status})`);
  return res.json();
}

export async function listMemberRegions(apiUrl: string) {
  const res = await fetch(`${apiUrl}/api/member/regions`);
  if (!res.ok) throw new Error(`取得地方清單失敗 (${res.status})`);
  return res.json();
}

export async function listMemberDistricts(apiUrl: string, regionCode?: string) {
  const qs = regionCode ? `?regionCode=${encodeURIComponent(regionCode)}` : '';
  const res = await fetch(`${apiUrl}/api/member/districts${qs}`);
  if (!res.ok) throw new Error(`取得分區清單失敗 (${res.status})`);
  return res.json();
}

export async function listAdminMemberRegions(apiUrl: string, adminToken: string) {
  const res = await fetch(`${apiUrl}/api/admin/member/regions`, {
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`取得地方管理清單失敗 (${res.status})`);
  return res.json();
}

export async function listAdminMemberDistricts(apiUrl: string, adminToken: string, regionCode?: string) {
  const qs = regionCode ? `?regionCode=${encodeURIComponent(regionCode)}` : '';
  const res = await fetch(`${apiUrl}/api/admin/member/districts${qs}`, {
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`取得分區管理清單失敗 (${res.status})`);
  return res.json();
}

export async function upsertAdminMemberDistrict(
  apiUrl: string,
  adminToken: string,
  payload: { regionCode: string; code3: string; name: string; active?: boolean },
) {
  const res = await fetch(`${apiUrl}/api/admin/member/districts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();
  if (res.status === 409) {
     const res2 = await fetch(`${apiUrl}/api/admin/member/districts/${payload.regionCode}/${payload.code3}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ name: payload.name, active: payload.active }),
     });
     if (!res2.ok) throw new Error(`更新分區失敗 (${res2.status})`);
     return res2.json();
  }
  throw new Error(`新增分區失敗 (${res.status})`);
}

export async function deleteAdminMemberDistrict(
  apiUrl: string,
  adminToken: string,
  regionCode: string,
  code3: string,
) {
  const res = await fetch(`${apiUrl}/api/admin/member/districts/${regionCode}/${code3}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`刪除分區失敗 (${res.status})`);
  return res.json();
}

export interface ValidateMembersResponse {
  exists: Record<string, boolean>;
  names?: Record<string, string | null>;
}

// Admin Matches
export async function listAdminMatches(
  apiUrl: string,
  adminToken: string,
  options?: { memberId?: string; page?: number; pageSize?: number }
) {
  const params = new URLSearchParams();
  if (options?.memberId) params.append('memberId', options.memberId);
  if (options?.page) params.append('page', String(options.page));
  if (options?.pageSize) params.append('pageSize', String(options.pageSize));

  const query = params.toString();
  const url = `${apiUrl}/api/admin/matches${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`取得比賽列表失敗 (${res.status})`);
  return res.json();
}

// Admin Regions
export async function upsertAdminMemberRegion(
  apiUrl: string,
  adminToken: string,
  payload: { code3: string; name: string; active?: boolean },
) {
  const res = await fetch(`${apiUrl}/api/admin/member/regions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();
  if (res.status === 409) {
     // Update
     const res2 = await fetch(`${apiUrl}/api/admin/member/regions/${payload.code3}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ name: payload.name, active: payload.active }),
     });
     if (!res2.ok) throw new Error(`更新地方失敗 (${res2.status})`);
     return res2.json();
  }
  throw new Error(`新增地方失敗 (${res.status})`);
}

// Member Membership
export async function renewMembership(apiUrl: string, adminToken: string, id: string | number, years: number) {
  const res = await fetch(`${apiUrl}/api/members/${id}/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ years }),
  });
  if (!res.ok) throw new Error(`續期失敗 (${res.status})`);
  return res.json();
}

// Member Register Email Code
export async function requestRegisterEmailCode(apiUrl: string, email: string) {
  const res = await fetch(`${apiUrl}/api/members/request-register-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
     const err = await res.json();
     throw new Error(err.error || `發送驗證碼失敗 (${res.status})`);
  }
  return res.json();
}

export async function registerMemberWithCode(
  apiUrl: string,
  data: {
    name: string;
    email: string;
    password: string;
    regionCode: string;
    districtCode: string;
    code: string;
    phone?: string;
    clubName?: string;
    birthDate?: string;
  },
) {
  const res = await fetch(`${apiUrl}/api/members/register-with-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `註冊失敗 (${res.status})`);
  }
  return res.json();
}
