import React, { useCallback, useEffect, useMemo, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  getClubMembers,
  removeClubMember,
  updateClubMemberNickname,
  updateClubMemberRating,
} from '../../lib/api';

type VenueMembersModuleProps = {
  operatorId: string;
  className?: string;
};

const VenueMembersModule: React.FC<VenueMembersModuleProps> = ({ operatorId, className = '' }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [memberRatingDraft, setMemberRatingDraft] = useState<Record<string, string>>({});
  const [memberNicknameDraft, setMemberNicknameDraft] = useState<Record<string, string>>({});
  const [memberNicknameSavingId, setMemberNicknameSavingId] = useState('');
  const [memberSavingId, setMemberSavingId] = useState('');
  const [memberRemovingId, setMemberRemovingId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const loadRows = useCallback(async () => {
    if (!operatorId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const next = await getClubMembers(API_URL, operatorId).catch(() => []);
      setRows(Array.isArray(next) ? next : []);
    } catch (e: any) {
      showNotice(e?.message || '更新失敗', 3000);
    } finally {
      setLoading(false);
    }
  }, [operatorId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r: any) => {
      const m = r?.member || {};
      const hay = [
        String(m?.member_code || ''),
        String(m?.name || ''),
        String(r?.nickname || ''),
        String(m?.phone || m?.phone_e164 || ''),
        String(m?.email || ''),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, search]);

  return (
    <div className={`glass rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
        <div className="text-xl font-bold">會員管理</div>
        <div className="flex items-center gap-2">
          <HelpGuide
            title="會員管理"
            intro="管理已加入場館的會員：搜尋、調整評分、設定後台暱稱及移除會員。"
            steps={[
              '用搜尋框輸入名稱/暱稱/電話/Email/會員編號縮窄列表。',
              '在「評分」欄輸入數值後按「儲存」更新會員評分。',
              '在「暱稱」欄輸入後按「儲存」可為該會員設定場館內部暱稱（只供後台辨識）。',
              '如要移除會員，使用操作欄的移除按鈕（移除後需重新加入才會出現）。',
              '按「重新整理」可更新會員列表。',
            ]}
            tips={[
              '評分只影響場館內部顯示/排序（如有），不會更改會員的登入資料。',
              '移除會員屬即時操作，建議先確認會員身份。',
            ]}
          />
          <button
            type="button"
            className="px-4 py-2 rounded cue-surface hover:brightness-95 font-semibold"
            onClick={async () => {
              await loadRows();
              showNotice('已更新會員列表');
            }}
          >
            {loading ? '載入中...' : '重新整理'}
          </button>
        </div>
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">搜尋（名稱 / 暱稱 / 電話 / Email / 會員編號）</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="輸入關鍵字..."
          />
        </div>
        <div className="md:col-span-1">
          <div className="text-sm cue-muted mb-1">會員數</div>
          <div className="font-semibold">{Array.isArray(rows) ? rows.length : 0}</div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="cue-muted border-b cue-border">
              <th className="py-2 px-2">會員編號</th>
              <th className="py-2 px-2">名稱</th>
              <th className="py-2 px-2">暱稱</th>
              <th className="py-2 px-2">電話</th>
              <th className="py-2 px-2">Email</th>
              <th className="py-2 px-2">評分</th>
              <th className="py-2 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0, 500).map((row: any) => {
              const id = String(row?.id || '');
              const member = row?.member || {};
              const code = String(member?.member_code || '').trim() || '—';
              const name = String(member?.name || '').trim() || '—';
              const nickname = String(row?.nickname || '').trim();
              const nicknameDraft = memberNicknameDraft[id];
              const nicknameValue = nicknameDraft != null ? nicknameDraft : nickname;
              const phone = String(member?.phone || member?.phone_e164 || '').trim() || '—';
              const email = String(member?.email || '').trim() || '—';
              const rating = Number(row?.rating ?? 0);
              const draft = memberRatingDraft[id];
              const inputValue = draft != null ? draft : String(Number.isFinite(rating) ? rating : 0);
              return (
                <tr key={id} className="border-b cue-border hover:brightness-95">
                  <td className="py-2 px-2 font-semibold whitespace-nowrap">{code}</td>
                  <td className="py-2 px-2">{name}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={nicknameValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMemberNicknameDraft((prev) => ({ ...(prev || {}), [id]: v }));
                        }}
                        className="w-40 px-3 py-1.5 rounded cue-input"
                        placeholder="（後台暱稱）"
                      />
                      <button
                        type="button"
                        disabled={memberNicknameSavingId === id}
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${memberNicknameSavingId === id ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                        onClick={async () => {
                          const raw = (memberNicknameDraft[id] ?? nickname).trim();
                          setMemberNicknameSavingId(id);
                          try {
                            const updated = await updateClubMemberNickname(API_URL, operatorId, id, raw);
                            const nextNick = updated?.nickname ?? null;
                            setRows((prev) =>
                              Array.isArray(prev)
                                ? prev.map((x: any) => (String(x?.id || '') === id ? { ...x, nickname: nextNick } : x))
                                : prev,
                            );
                            setMemberNicknameDraft((prev) => {
                              const next = { ...(prev || {}) };
                              delete next[id];
                              return next;
                            });
                            showNotice('已更新暱稱');
                          } catch (e: any) {
                            showNotice(e?.message || '更新失敗', 3000);
                          } finally {
                            setMemberNicknameSavingId('');
                          }
                        }}
                      >
                        儲存
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2 cue-muted whitespace-nowrap">{phone}</td>
                  <td className="py-2 px-2 cue-muted">{email}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-10 h-9 rounded cue-surface-strong hover:brightness-95 font-extrabold"
                        onClick={() => {
                          const cur = String(memberRatingDraft[id] ?? inputValue ?? '').trim();
                          const next = cur === '' ? '-' : cur === '-' ? '' : cur.startsWith('-') ? cur.slice(1) : `-${cur}`;
                          setMemberRatingDraft((prev) => ({ ...(prev || {}), [id]: next }));
                        }}
                        aria-label="切換正負號"
                      >
                        ±
                      </button>
                      <input
                        value={inputValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMemberRatingDraft((prev) => ({ ...(prev || {}), [id]: v }));
                        }}
                        className="w-24 px-3 py-1.5 rounded cue-input"
                        inputMode="numeric"
                        pattern="-?[0-9]*"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        disabled={memberSavingId === id}
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${memberSavingId === id ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                        onClick={async () => {
                          const raw = (memberRatingDraft[id] ?? String(rating)).trim();
                          const n = Number(raw);
                          if (!Number.isFinite(n)) {
                            showNotice('評分必須為整數（可負數）');
                            return;
                          }
                          const value = Math.trunc(n);
                          setMemberSavingId(id);
                          try {
                            await updateClubMemberRating(API_URL, operatorId, id, value);
                            setRows((prev) =>
                              Array.isArray(prev)
                                ? prev.map((x: any) => (String(x?.id || '') === id ? { ...x, rating: value } : x))
                                : prev,
                            );
                            setMemberRatingDraft((prev) => {
                              const next = { ...(prev || {}) };
                              delete next[id];
                              return next;
                            });
                            showNotice('已更新評分');
                          } catch (e: any) {
                            showNotice(e?.message || '更新失敗', 3000);
                          } finally {
                            setMemberSavingId('');
                          }
                        }}
                      >
                        儲存
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={memberRemovingId === id}
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${memberRemovingId === id ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                        onClick={async () => {
                          if (!confirm('確定要移除該會員在本場館之會員資格？')) return;
                          if (!confirm('再次確認：移除後該會員將不再屬於本場館會員')) return;
                          setMemberRemovingId(id);
                          try {
                            await removeClubMember(API_URL, operatorId, id);
                            setRows((prev) => (Array.isArray(prev) ? prev.filter((x: any) => String(x?.id || '') !== id) : prev));
                            showNotice('已移除會員資格');
                          } catch (e: any) {
                            showNotice(e?.message || '移除失敗', 3000);
                          } finally {
                            setMemberRemovingId('');
                          }
                        }}
                      >
                        移除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRows.length > 500 ? <div className="text-xs cue-muted mt-2">只顯示前 500 筆</div> : null}
      </div>
    </div>
  );
};

export default VenueMembersModule;
