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

export async function updateClubMemberRating(apiUrl: string, memberId: string, clubMemberId: string, rating: number) {
  const res = await fetch(`${apiUrl}/api/club/my-members/${encodeURIComponent(clubMemberId)}/rating`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新評分失敗');
  }
  return res.json();
}

export async function updateClubMemberNickname(apiUrl: string, memberId: string, clubMemberId: string, nickname: string) {
  const res = await fetch(`${apiUrl}/api/club/my-members/${encodeURIComponent(clubMemberId)}/nickname`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新暱稱失敗');
  }
  return res.json();
}

export async function removeClubMember(apiUrl: string, memberId: string, clubMemberId: string) {
  const res = await fetch(`${apiUrl}/api/club/my-members/${encodeURIComponent(clubMemberId)}`, {
    method: 'DELETE',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '移除會員資格失敗');
  }
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

export async function getPublicClubs(apiUrl: string, params?: { q?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/public${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load clubs');
  return res.json();
}

export async function getSiteNotice(apiUrl: string) {
  const res = await fetch(`${apiUrl}/api/site/notice`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load site notice');
  return res.json();
}

export async function getNewsSources(apiUrl: string) {
  const res = await fetch(`${apiUrl}/api/news/sources`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load news sources');
  return res.json() as Promise<{ sources: Array<{ id: string; name: string; siteUrl?: string | null; language?: string | null; region?: string | null; updatedAt?: string }> }>;
}

export async function getNewsItems(apiUrl: string, params?: { limit?: number; sourceId?: string }) {
  const sp = new URLSearchParams();
  if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) sp.set('limit', String(Math.max(1, Math.min(100, Math.floor(params.limit)))));
  if (params?.sourceId) sp.set('sourceId', String(params.sourceId));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/news${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load news');
  return res.json() as Promise<{
    items: Array<{
      id: string;
      title: string;
      url: string;
      publishedAt?: string | null;
      author?: string | null;
      summary?: string | null;
      imageUrl?: string | null;
      tags?: any;
      source: { id: string; name: string; siteUrl?: string | null };
    }>;
  }>;
}

export async function updateSiteNotice(
  apiUrl: string,
  adminToken: string,
  payload: { enabled?: boolean; message?: string; youtubeEmbedUrl?: string | null }
) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/site/notice?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新公告失敗');
  }
  return res.json();
}

export async function getAdminNewsSources(apiUrl: string, adminToken: string) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/news/sources?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, { headers: { 'x-admin-token': adminToken || '' }, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取新聞來源失敗 (${res.status})`);
  }
  return res.json() as Promise<{ sources: Array<any> }>;
}

export async function createAdminNewsSource(apiUrl: string, adminToken: string, payload: any) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/news/sources?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `新增新聞來源失敗 (${res.status})`);
  }
  return res.json();
}

export async function updateAdminNewsSource(apiUrl: string, adminToken: string, id: string, patch: any) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/news/sources/${encodeURIComponent(id)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify(patch || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `更新新聞來源失敗 (${res.status})`);
  }
  return res.json();
}

export async function deleteAdminNewsSource(apiUrl: string, adminToken: string, id: string) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/news/sources/${encodeURIComponent(id)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, { method: 'DELETE', headers: { 'x-admin-token': adminToken || '' } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `刪除新聞來源失敗 (${res.status})`);
  }
  return res.json();
}

export async function adminFetchNewsNow(apiUrl: string, adminToken: string, sourceId?: string) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/news/fetch?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify({ sourceId: sourceId || '' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `手動拉取新聞失敗 (${res.status})`);
  }
  return res.json();
}

export async function getAdminFeatures(apiUrl: string, adminToken: string) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/features?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, { headers: { 'x-admin-token': adminToken || '' }, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取功能清單失敗 (${res.status})`);
  }
  return res.json() as Promise<{ features: Array<{ key: string; label: string; enabled: boolean; defaultEnabled: boolean }> }>;
}

export async function updateAdminFeatures(
  apiUrl: string,
  adminToken: string,
  updates: Array<{ key: string; enabled: boolean }>
) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/features?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `更新功能失敗 (${res.status})`);
  }
  return res.json() as Promise<{ ok: true; features: Record<string, boolean> }>;
}

export async function getAdminClubFeatureAssignments(apiUrl: string, adminToken: string, featureKey: string) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/club-features/${encodeURIComponent(featureKey)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, { headers: { 'x-admin-token': adminToken || '' }, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `讀取場館功能授權失敗 (${res.status})`);
  }
  return res.json() as Promise<{
    featureKey: string;
    globalEnabled: boolean;
    clubs: Array<{
      clubId: string;
      clubName: string;
      adminMemberId: string;
      adminName: string;
      adminEmail: string;
      adminEnabled: boolean;
      assignedEnabled: boolean;
      effectiveEnabled: boolean;
      source: string;
      explicitEnabled: boolean | null;
      accessExpiresAt?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      assignmentUpdatedAt?: string | null;
    }>;
  }>;
}

export async function updateAdminClubFeatureAssignment(
  apiUrl: string,
  adminToken: string,
  featureKey: string,
  clubId: string,
  enabled: boolean,
) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/club-features/${encodeURIComponent(featureKey)}/${encodeURIComponent(clubId)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `更新場館功能授權失敗 (${res.status})`);
  }
  return res.json();
}

export async function getMyClubFeatureAccess(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/features/access`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取場館功能授權失敗');
  }
  return res.json() as Promise<{
    clubId: string;
    features: Record<string, {
      globalEnabled: boolean;
      assignedEnabled: boolean;
      effectiveEnabled: boolean;
      explicitEnabled: boolean | null;
      source: string;
      updatedAt?: string | null;
    }>;
  }>;
}

export async function getPublicClubFeatureAccess(apiUrl: string, clubId: string) {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/club/${encodeURIComponent(clubId)}/features/public`, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取場館功能授權失敗');
  }
  return res.json() as Promise<{
    clubId: string;
    features: Record<string, {
      globalEnabled: boolean;
      assignedEnabled: boolean;
      effectiveEnabled: boolean;
      explicitEnabled: boolean | null;
      source: string;
      updatedAt?: string | null;
    }>;
  }>;
}

export async function getClubPointsConfig(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/points/config`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取消費積分設定失敗');
  }
  return res.json();
}

export async function updateClubPointsConfig(
  apiUrl: string,
  memberId: string,
  payload: { currencyCode: string; pointsPerCurrency: number; roundingMinutes: number; minBillableMinutes: number }
) {
  const res = await fetch(`${apiUrl}/api/club/points/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新消費積分設定失敗');
  }
  return res.json();
}

export async function getClubPointsBalances(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/points/balances`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取會員消費積分失敗');
  }
  return res.json();
}

export async function searchClubPointsBalances(
  apiUrl: string,
  memberId: string,
  params?: { q?: string; limit?: number }
) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', String(params.q));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/points/balances/search${qs ? `?${qs}` : ''}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '搜尋會員消費積分失敗');
  }
  return res.json();
}

export async function getMyClubPointsBalance(apiUrl: string, memberId: string, clubId: string) {
  const sp = new URLSearchParams();
  sp.set('clubId', clubId);
  const res = await fetch(`${apiUrl}/api/club/points/my-balance?${sp.toString()}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取我的消費積分失敗');
  }
  return res.json();
}

export async function getMyClubPointsBalances(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/points/my-balances`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取我的各場館消費積分失敗');
  }
  return res.json();
}

export async function getClubPointsLedger(
  apiUrl: string,
  memberId: string,
  params?: { limit?: number; memberId?: string; from?: string; to?: string; month?: string; groupBy?: 'month' | ''; includeTotal?: boolean }
) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.memberId) sp.set('memberId', params.memberId);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  if (params?.month) sp.set('month', params.month);
  if (params?.groupBy) sp.set('groupBy', params.groupBy);
  if (params?.includeTotal) sp.set('includeTotal', '1');
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/points/ledger${qs ? `?${qs}` : ''}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取消費積分流水失敗');
  }
  return res.json() as Promise<any>;
}

export async function adjustClubMemberPoints(
  apiUrl: string,
  memberId: string,
  payload: { memberId: string; deltaPoints: number; reason: string }
) {
  const res = await fetch(`${apiUrl}/api/club/points/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '消費積分調整失敗');
  }
  return res.json();
}

export async function rotateClubTableQr(apiUrl: string, memberId: string, tableId: string) {
  const res = await fetch(`${apiUrl}/api/club/tables/${encodeURIComponent(tableId)}/qr/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新 QR 失敗');
  }
  return res.json();
}

export async function getActiveTableSessions(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/sessions/active`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取進行中台鐘失敗');
  }
  return res.json();
}

export async function endTableSessionAsOperator(apiUrl: string, memberId: string, sessionId: string) {
  const res = await fetch(`${apiUrl}/api/club/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '落鐘失敗');
  }
  return res.json();
}

export async function getQrTableInfo(apiUrl: string, memberId: string, token: string) {
  const sp = new URLSearchParams();
  sp.set('token', token);
  const res = await fetch(`${apiUrl}/api/qr/table/info?${sp.toString()}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403 && err?.feature === 'qr_session') {
      throw new Error('此場館未開放掃碼起鐘功能');
    }
    throw new Error(err.error || '讀取球枱資料失敗');
  }
  return res.json();
}

export async function qrTableStartInit(apiUrl: string, memberId: string, token: string) {
  const res = await fetch(`${apiUrl}/api/qr/table/start-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403 && err?.feature === 'qr_session') {
      throw new Error('此場館未開放掃碼起鐘功能');
    }
    throw new Error(err.error || '起鐘失敗');
  }
  return res.json();
}

export async function qrTableStartConfirm(apiUrl: string, memberId: string, confirmId: string) {
  const res = await fetch(`${apiUrl}/api/qr/table/start-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ confirmId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403 && (err?.feature === 'qr_session' || err?.error === 'feature_disabled')) {
      throw new Error('此場館未開放掃碼起鐘功能');
    }
    throw new Error(err.error || '起鐘確認失敗');
  }
  return res.json();
}

export async function qrTableEndInit(apiUrl: string, memberId: string, token: string) {
  const res = await fetch(`${apiUrl}/api/qr/table/end-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403 && err?.feature === 'qr_session') {
      throw new Error('此場館未開放掃碼起鐘功能');
    }
    throw new Error(err.error || '落鐘失敗');
  }
  return res.json();
}

export async function qrTableEndConfirm(apiUrl: string, memberId: string, confirmId: string) {
  const res = await fetch(`${apiUrl}/api/qr/table/end-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({ confirmId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403 && (err?.feature === 'qr_session' || err?.error === 'feature_disabled')) {
      throw new Error('此場館未開放掃碼起鐘功能');
    }
    throw new Error(err.error || '落鐘確認失敗');
  }
  return res.json();
}

export async function getLeaderboardMembersHighest(apiUrl: string, limit?: number) {
  const sp = new URLSearchParams();
  if (limit != null) sp.set('limit', String(limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/leaderboard/members/highest${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('讀取會員榜失敗');
  return res.json();
}

export async function getLeaderboardMembersMonthly(apiUrl: string, month: string, limit?: number) {
  const sp = new URLSearchParams();
  sp.set('month', month);
  if (limit != null) sp.set('limit', String(limit));
  const res = await fetch(`${apiUrl}/api/leaderboard/members/monthly?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('讀取會員榜失敗');
  return res.json();
}

export async function getLeaderboardClubsHighest(apiUrl: string, limit?: number) {
  const sp = new URLSearchParams();
  if (limit != null) sp.set('limit', String(limit));
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/leaderboard/clubs/highest${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('讀取場館榜失敗');
  return res.json();
}

export async function getLeaderboardClubsMonthly(apiUrl: string, month: string, limit?: number) {
  const sp = new URLSearchParams();
  sp.set('month', month);
  if (limit != null) sp.set('limit', String(limit));
  const res = await fetch(`${apiUrl}/api/leaderboard/clubs/monthly?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('讀取場館榜失敗');
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

export async function getClubMessagesManage(apiUrl: string, memberId: string, limit?: number) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const res = await fetch(`${apiUrl}/api/club/club-messages${q}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取場館訊息失敗');
  }
  return res.json();
}

export async function updateClubMessageManage(
  apiUrl: string,
  memberId: string,
  id: string,
  payload: { title?: string | null; content?: string }
) {
  const res = await fetch(`${apiUrl}/api/club/club-messages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新場館訊息失敗');
  }
  return res.json();
}

export async function deleteClubMessageManage(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/club-messages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '刪除場館訊息失敗');
  }
  return res.json();
}

export async function createLiveAnnouncement(
  apiUrl: string,
  memberId: string,
  payload: { title: string; startsAt: string; liveUrl: string }
) {
  const res = await fetch(`${apiUrl}/api/club/live-announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '建立直播通告失敗');
  }
  return res.json();
}

export async function updateLiveAnnouncement(
  apiUrl: string,
  memberId: string,
  id: string,
  payload: { title?: string; startsAt?: string; liveUrl?: string }
) {
  const res = await fetch(`${apiUrl}/api/club/live-announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新直播通告失敗');
  }
  return res.json();
}

export async function getLiveAnnouncements(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/live-announcements`, {
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取直播通告失敗');
  }
  return res.json();
}

export async function deleteLiveAnnouncement(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/live-announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '刪除直播通告失敗');
  }
  return res.json();
}

export async function getPublicLiveAnnouncements(apiUrl: string, limit?: number) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const res = await fetch(`${apiUrl}/api/club/live-announcements/public${q}`);
  if (!res.ok) throw new Error('讀取直播通告失敗');
  return res.json();
}

export async function getPublicClubLiveAnnouncements(apiUrl: string, clubId: string, limit?: number) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/live-announcements/public${q}`);
  if (!res.ok) throw new Error('讀取直播通告失敗');
  return res.json();
}

export async function getPublicClubMessages(apiUrl: string, clubId: string, limit?: number) {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/messages/public${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('讀取場館訊息失敗');
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

export async function getPublicClubTournaments(apiUrl: string, clubId: string, memberId?: string) {
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/tournaments/public`, {
    headers: memberId ? { 'x-member-id': memberId } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('讀取比賽列表失敗');
  return res.json();
}

export async function getPublicClubTournament(apiUrl: string, clubId: string, tournamentId: string, memberId?: string) {
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/tournaments/${encodeURIComponent(tournamentId)}/public`, {
    headers: memberId ? { 'x-member-id': memberId } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('讀取比賽資料失敗');
  return res.json();
}

export async function signupTournament(apiUrl: string, clubId: string, memberId: string, tournamentId: string) {
  const res = await fetch(`${apiUrl}/api/club/${encodeURIComponent(clubId)}/tournaments/${encodeURIComponent(tournamentId)}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '報名失敗');
  }
  return res.json();
}

export async function getMyClubTournaments(apiUrl: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/tournaments`, { headers: { 'x-member-id': memberId }, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取比賽失敗');
  }
  return res.json();
}

export async function createClubTournament(
  apiUrl: string,
  memberId: string,
  payload: { title: string; description?: string | null; signupGuide?: string | null; capacity?: number; startsAt?: string | null; signupClosesAt?: string | null }
) {
  const res = await fetch(`${apiUrl}/api/club/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '建立比賽失敗');
  }
  return res.json();
}

export async function updateClubTournament(
  apiUrl: string,
  memberId: string,
  id: string,
  payload: { title?: string; description?: string | null; signupGuide?: string | null; capacity?: number; startsAt?: string | null; signupClosesAt?: string | null }
) {
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新比賽失敗');
  }
  return res.json();
}

export async function publishClubTournament(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '上架失敗');
  }
  return res.json();
}

export async function closeClubTournament(apiUrl: string, memberId: string, id: string) {
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '關閉失敗');
  }
  return res.json();
}

export async function getTournamentSignups(apiUrl: string, memberId: string, tournamentId: string, status?: string) {
  const sp = new URLSearchParams();
  if (status) sp.set('status', status);
  const qs = sp.toString();
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(tournamentId)}/signups${qs ? `?${qs}` : ''}`, {
    headers: { 'x-member-id': memberId },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '讀取報名失敗');
  }
  return res.json();
}

export async function confirmTournamentSignup(apiUrl: string, memberId: string, tournamentId: string, signupId: string) {
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(tournamentId)}/signups/${encodeURIComponent(signupId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '確認失敗');
  }
  return res.json();
}

export async function cancelTournamentSignup(apiUrl: string, memberId: string, tournamentId: string, signupId: string) {
  const res = await fetch(`${apiUrl}/api/club/tournaments/${encodeURIComponent(tournamentId)}/signups/${encodeURIComponent(signupId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': memberId },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '取消失敗');
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

export async function createManualReservation(
  apiUrl: string,
  operatorId: string,
  payload: { tableId: string; startAt: string; endAt?: string; quantityHours?: number; mode: 'BLOCK' | 'MEMBER'; memberId?: string }
) {
  const res = await fetch(`${apiUrl}/api/club/reservations/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-member-id': operatorId },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '建立失敗');
  }
  return res.json();
}

export async function getPublicTables(apiUrl: string, clubId: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/tables`);
  if (!res.ok) {
    if (res.status === 403) {
      const err = await res.json().catch(() => ({}));
      if (err?.feature === 'booking') return [];
    }
    throw new Error('讀取球枱失敗');
  }
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
  if (!res.ok) {
    if (res.status === 403) {
      const err = await res.json().catch(() => ({}));
      if (err?.feature === 'booking') return [];
    }
    throw new Error('讀取收費失敗');
  }
  return res.json();
}

export async function getAvailability(apiUrl: string, clubId: string, from: string, to: string, tableId?: string) {
  const q = new URLSearchParams({ from, to, ...(tableId ? { tableId } : {}) });
  const res = await fetch(`${apiUrl}/api/club/${clubId}/availability?${q.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const err = await res.json().catch(() => ({}));
      if (err?.feature === 'booking') return [];
    }
    throw new Error('讀取可用性失敗');
  }
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
    if (res.status === 403 && err?.feature === 'booking') {
      throw new Error('此場館未開放訂台功能');
    }
    throw new Error(err.error || '預約失敗');
  }
  return res.json();
}

export async function getMyReservations(apiUrl: string, clubId: string, memberId: string) {
  const res = await fetch(`${apiUrl}/api/club/${clubId}/reservations/my`, {
    headers: { 'x-member-id': memberId },
  });
  if (!res.ok) {
    if (res.status === 403) {
      const err = await res.json().catch(() => ({}));
      if (err?.feature === 'booking') return [];
    }
    throw new Error('讀取我的預約失敗');
  }
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
    if (res.status === 403 && err?.feature === 'booking') {
      throw new Error('此場館未開放訂台功能');
    }
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
    password: string;
    email?: string;
    phoneCountry?: string;
    phoneNumber?: string;
    phone?: string;
    clubName?: string;
    birthDate?: string;
    regionCode?: string;
    districtCode?: string;
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
  creds: { email?: string; identifier?: string; phoneE164?: string; phoneCountry?: string; phoneNumber?: string; password: string },
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
    region_code?: string | null;
    regionCode?: string | null;
    member_code?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    district_code?: string | null;
    districtCode?: string | null;
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
  data: { phone?: string; birthDate?: string; clubName?: string; password?: string; regionCode?: string | null; districtCode?: string | null }
) {
  const res = await fetch(`${apiUrl}/api/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`更新個人資料失敗 (${res.status})`);
  return res.json();
}

export async function getSiteAds(apiUrl: string, placement?: 'system' | 'venue' | 'member') {
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
  const res = await fetch(`${apiUrl}/api/site-ads${qs}`);
  if (!res.ok) throw new Error(`取得廣告失敗 (${res.status})`);
  return res.json();
}

export async function getAdminSiteAds(apiUrl: string, adminToken: string) {
  const res = await fetch(`${apiUrl}/api/admin/site-ads`, {
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) throw new Error(`取得廣告管理資料失敗 (${res.status})`);
  return res.json();
}

export async function updateAdminSiteAd(
  apiUrl: string,
  adminToken: string,
  placement: 'system' | 'venue' | 'member',
  payload: { enabled?: boolean; imageUrl?: string | null; linkUrl?: string | null; displaySeconds?: number; minIntervalMinutes?: number; maxIntervalMinutes?: number },
) {
  const res = await fetch(`${apiUrl}/api/admin/site-ads/${placement}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`更新廣告失敗 (${res.status})`);
  return res.json();
}

export async function uploadAdminSiteAdImage(
  apiUrl: string,
  adminToken: string,
  placement: 'system' | 'venue' | 'member',
  payload: { filename?: string; contentType?: string; dataUrl: string },
) {
  const res = await fetch(`${apiUrl}/api/admin/site-ads/${placement}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `上載圖片失敗 (${res.status})`);
  }
  return res.json();
}

export async function createAdminSiteAdItem(apiUrl: string, adminToken: string) {
  const res = await fetch(`${apiUrl}/api/admin/site-ad-items`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `新增廣告失敗 (${res.status})`);
  }
  return res.json();
}

export async function updateAdminSiteAdItem(
  apiUrl: string,
  adminToken: string,
  id: string,
  payload: { enabled?: boolean; linkUrl?: string | null },
) {
  const res = await fetch(`${apiUrl}/api/admin/site-ad-items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `更新廣告失敗 (${res.status})`);
  }
  return res.json();
}

export async function deleteAdminSiteAdItem(apiUrl: string, adminToken: string, id: string) {
  const res = await fetch(`${apiUrl}/api/admin/site-ad-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `刪除廣告失敗 (${res.status})`);
  }
  return res.json();
}

export async function uploadAdminSiteAdItemImage(
  apiUrl: string,
  adminToken: string,
  id: string,
  payload: { filename?: string; contentType?: string; dataUrl: string },
) {
  const res = await fetch(`${apiUrl}/api/admin/site-ad-items/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `上載圖片失敗 (${res.status})`);
  }
  return res.json();
}

export async function setAdminSiteAdPlacementItems(
  apiUrl: string,
  adminToken: string,
  placement: 'system' | 'venue' | 'member',
  items: Array<{ itemId: string; enabled?: boolean }>,
) {
  const res = await fetch(`${apiUrl}/api/admin/site-ad-placements/${placement}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `更新投放設定失敗 (${res.status})`);
  }
  return res.json();
}

export async function deleteMember(
  apiUrl: string,
  adminToken: string,
  id: string | number,
  options?: { purge?: boolean }
) {
  const qs = options?.purge ? '?purge=1' : '';
  const res = await fetch(`${apiUrl}/api/admin/members/${id}${qs}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `刪除會員失敗 (${res.status})`);
  }
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

export async function listAdminBreaks(
  apiUrl: string,
  adminToken: string,
  options?: {
    page?: number;
    pageSize?: number;
    memberId?: string;
    clubId?: string;
    month?: string;
    q?: string;
    includeDeleted?: boolean;
  }
) {
  const base = apiUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (adminToken) params.set('token', adminToken);
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.memberId) params.set('memberId', options.memberId);
  if (options?.clubId) params.set('clubId', options.clubId);
  if (options?.month) params.set('month', options.month);
  if (options?.q) params.set('q', options.q);
  if (options?.includeDeleted) params.set('includeDeleted', '1');

  const url = `${base}/api/admin/breaks?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'x-admin-token': adminToken },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`取得單杆列表失敗 (${res.status})`);
  return res.json();
}

export async function patchAdminBreak(
  apiUrl: string,
  adminToken: string,
  id: string,
  payload: { points?: number; recordedAt?: string; videoUrl?: string | null; note?: string | null; restore?: boolean }
) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/breaks/${encodeURIComponent(id)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `更新單杆失敗 (${res.status})`);
  }
  return res.json();
}

export async function deleteAdminBreak(apiUrl: string, adminToken: string, id: string, reason?: string | null) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/admin/breaks/${encodeURIComponent(id)}?token=${encodeURIComponent(adminToken || '')}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ reason: reason || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `刪除單杆失敗 (${res.status})`);
  }
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
    regionCode?: string;
    districtCode?: string;
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
