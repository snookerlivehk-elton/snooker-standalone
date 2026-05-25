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

export async function createClubBreak(
  apiUrl: string,
  memberId: string,
  payload: { memberId: string; points: number; recordedAt?: string; videoUrl?: string; note?: string }
) {
  const res = await fetch(`${apiUrl}/api/club/breaks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to create break');
  }
  return res.json();
}

export async function getClubBreaks(
  apiUrl: string,
  memberId: string,
  params?: { month?: string; memberId?: string }
) {
  const sp = new URLSearchParams();
  if (params?.month) sp.set('month', params.month);
  if (params?.memberId) sp.set('memberId', params.memberId);
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/breaks${qs ? `?${qs}` : ''}`, {
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load breaks');
  }
  return res.json();
}

export async function getClubLeaderboardHighest(apiUrl: string, clubId: string, limit?: number) {
  const sp = new URLSearchParams();
  if (limit) sp.set('limit', String(limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/leaderboard/highest${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load leaderboard');
  }
  return res.json();
}

export async function getClubLeaderboardMonthly(apiUrl: string, clubId: string, month: string, limit?: number) {
  const sp = new URLSearchParams();
  sp.set('month', month);
  if (limit) sp.set('limit', String(limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/leaderboard/monthly?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load leaderboard');
  }
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
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ clubId })
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

export async function getMyBreaks(apiUrl: string, memberId: string, params?: { clubId?: string; month?: string }) {
  const sp = new URLSearchParams();
  if (params?.clubId) sp.set('clubId', params.clubId);
  if (params?.month) sp.set('month', params.month);
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/me/breaks${qs ? `?${qs}` : ''}`, {
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load breaks');
  }
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

export async function getClubMessage(apiUrl: string, memberId: string, messageId: string) {
  const res = await fetch(`${apiUrl}/api/club/messages/${encodeURIComponent(messageId)}`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取訊息失敗 (${res.status})`);
  }
  return res.json();
}

export async function markClubMessageRead(apiUrl: string, memberId: string, messageId: string) {
  const res = await fetch(`${apiUrl}/api/club/messages/${encodeURIComponent(messageId)}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `標記已讀失敗 (${res.status})`);
  }
  return res.json();
}

export async function hideClubMessages(apiUrl: string, memberId: string, ids: string[]) {
  const res = await fetch(`${apiUrl}/api/club/messages/hide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `刪除訊息失敗 (${res.status})`);
  }
  return res.json();
}

// Match Invite APIs
export async function sendMatchInvites(apiUrl: string, roomId: string, operatorId: string | undefined, emails: string[]) {
  if (!operatorId) throw new Error('Missing operatorId');
  const res = await fetch(`${apiUrl}/api/matches/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': operatorId },
    body: JSON.stringify({ room_id: roomId, operator_id: operatorId, emails })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `發送比賽通知失敗 (${res.status})`);
  }
  return res.json() as Promise<{ invited: Array<{ email: string; memberId: string; token: string }>; notFound: string[] }>;
}

export async function getMyInvites(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/matches/invites/my`, {
    headers: { 'x-member-id': memberId }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取邀請失敗 (${res.status})`);
  }
  return res.json() as Promise<{ invites: any[] }>;
}

export async function acceptInvite(apiUrl: string, token: string, memberId?: string) {
  const res = await fetch(`${apiUrl}/api/matches/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(memberId ? { 'x-member-id': memberId } : {}) },
    body: JSON.stringify({ token })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `確認邀請失敗 (${res.status})`);
  }
  return res.json() as Promise<{ ok: true; roomId: string }>;
}

export async function getRoomInvites(apiUrl: string, roomId: string) {
  const res = await fetch(`${apiUrl}/rooms/${encodeURIComponent(roomId)}/invites`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取房間邀請失敗 (${res.status})`);
  }
  return res.json() as Promise<{ invites: Array<{ id: string; memberId: string; status: string; member?: { id: string; name: string; email: string } }> }>;
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
    p2_email?: string;
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

export async function getMyTables(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/tables/my`, { headers: { 'x-member-id': memberId } });
  if (!res.ok) throw new Error('讀取球枱失敗');
  return res.json();
}

export async function createTable(apiUrl: string, memberId: string, data: { name: string; notes?: string; basePrice?: string | number }) {
  const res = await fetch(`${apiUrl}/api/club/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '新增球枱失敗');
  }
  return res.json();
}

export async function updateTable(apiUrl: string, memberId: string, id: string, data: any) {
  const res = await fetch(`${apiUrl}/api/club/tables/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新球枱失敗');
  }
  return res.json();
}

export async function deleteTable(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/tables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '刪除球枱失敗');
  }
  return res.json();
}

export async function getMyPricingSchemes(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/pricing/my`, { headers: { 'x-member-id': memberId } });
  if (!res.ok) throw new Error('讀取收費方案失敗');
  return res.json();
}

export async function createPricingScheme(apiUrl: string, memberId: string, data: { title: string; description?: string; rulesJson: any; price?: string | number | null; active?: boolean; tableId?: string | null }) {
  const res = await fetch(`${apiUrl}/api/club/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '新增收費方案失敗');
  }
  return res.json();
}

export async function updatePricingScheme(apiUrl: string, memberId: string, id: string, data: any) {
  const res = await fetch(`${apiUrl}/api/club/pricing/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新收費方案失敗');
  }
  return res.json();
}

export async function deletePricingScheme(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/pricing/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '刪除收費方案失敗');
  }
  return res.json();
}

export async function getPendingReservations(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/reservations/pending`, { headers: { 'x-member-id': memberId } });
  if (!res.ok) throw new Error('讀取待確認預約失敗');
  return res.json();
}

export async function getClubReservations(apiUrl: string, memberId: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${apiUrl}/api/club/reservations${q}`, { headers: { 'x-member-id': memberId } });
  if (!res.ok) throw new Error('讀取預約清單失敗');
  return res.json();
}

export async function confirmReservation(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/reservations/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '確認預約失敗');
  }
  return res.json();
}

export async function cancelReservation(apiUrl: string, memberId: string, id: string, reason?: string) {
  const res = await fetch(`${apiUrl}/api/club/reservations/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '取消預約失敗');
  }
  return res.json();
}

export async function getPublicTables(apiUrl: string, clubId: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/tables`);
  if (!res.ok) throw new Error('讀取球枱失敗');
  return res.json();
}

export async function getPublicPricing(
  apiUrl: string,
  clubId: string,
  tableId?: string,
  startAt?: string,
  endAt?: string,
  quantityHours?: number,
) {
  const q = new URLSearchParams({
    ...(tableId ? { tableId } : {}),
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
    ...(quantityHours != null ? { quantityHours: String(quantityHours) } : {}),
  });
  const url = q.toString() ? `${apiUrl}/api/club/${clubId}/pricing?${q}` : `${apiUrl}/api/club/${clubId}/pricing`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('讀取收費失敗');
  return res.json();
}

export async function getAvailability(apiUrl: string, clubId: string, from: string, to: string, tableId?: string) {
  const q = new URLSearchParams({ from, to, ...(tableId ? { tableId } : {}) });
  const res = await fetch(`${apiUrl}/api/club/${clubId}/availability?${q.toString()}`);
  if (!res.ok) throw new Error('讀取可用性失敗');
  return res.json();
}

export async function createReservation(apiUrl: string, clubId: string, memberId: string, data: { tableId: string; startAt: string; endAt?: string; quantityHours?: number; schemeId?: string }) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '預約失敗');
  }
  return res.json();
}

export async function getMyReservations(apiUrl: string, clubId: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/reservations/my`, {
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) throw new Error('讀取我的預約失敗');
  return res.json();
}

export async function cancelMyReservation(apiUrl: string, clubId: string, memberId: string, id: string, reason?: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/reservations/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '取消預約失敗');
  }
  return res.json();
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
  const payload = JSON.stringify({ credential });
  const tryPost = async (url: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    return res;
  };

  const primary = await tryPost(`${apiUrl}/api/auth/google`);
  if (primary.ok) return primary.json();

  if (primary.status === 404) {
    const fallback = await tryPost(`${apiUrl}/auth/google`);
    if (fallback.ok) return fallback.json();
    if (fallback.status === 404) {
      const altBase =
        typeof window !== 'undefined' && window.location.hostname.endsWith('railway.app')
          ? 'https://snooker-backend-production.up.railway.app'
          : '';
      if (altBase) {
        const alt = await tryPost(`${altBase}/api/auth/google`);
        if (alt.ok) return alt.json();
        const err = await alt.json().catch(() => ({}));
        throw new Error(err.error || `登入失敗 (${alt.status})`);
      }
    }
    const err = await fallback.json().catch(() => ({}));
    throw new Error(err.error || `登入失敗 (${fallback.status})`);
  }

  const err = await primary.json().catch(() => ({}));
  throw new Error(err.error || `登入失敗 (${primary.status})`);
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
    headers: { 'Content-Type': 'application/json', 'x-member-id': operatorId },
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
  const res = await fetch(url.toString(), { cache: 'no-store', headers: { 'x-member-id': operatorId } });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `取得活躍房間失敗 (${res.status})`);
  }
  return res.json(); // { rooms: [] }
}

export async function getOperatorMatches(apiUrl: string, operatorId: string) {
  const url = new URL(`${apiUrl}/api/operators/${operatorId}/matches`);
  url.searchParams.set('t', String(Date.now()));
  const res = await fetch(url.toString(), { cache: 'no-store', headers: { 'x-member-id': operatorId } });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `取得操作員歷史失敗 (${res.status})`);
  }
  return res.json(); // { matches: [] }
}

export async function listRooms(apiUrl: string) {
  const url = new URL(`${apiUrl}/api/rooms`);
  url.searchParams.set('t', String(Date.now()));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`讀取房間列表失敗 (${res.status})`);
  return res.json() as Promise<any[]>;
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
  data: {
    name?: string;
    email?: string | null;
    member_code?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    role?: string | null;
    clubName?: string | null;
    is_enabled?: boolean | null;
    accessExpiresAt?: string | null;
  }
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
