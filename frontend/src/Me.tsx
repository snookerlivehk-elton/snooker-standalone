import React, { useEffect, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import { getMember, getMemberMatches } from './lib/api';

const Me: React.FC = () => {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  })() as { id?: string; email?: string };
  const memberId = session?.id;
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!memberId) return;
      setLoading(true);
      try {
        const m = await getMember(API_URL, memberId);
        setProfile(m);
        const list = await getMemberMatches(API_URL, memberId);
        setMatches(list.matches || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId]);

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="個人" />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {!memberId && (
            <div className="cue-card p-4">
              <div className="cue-zh-title mb-1">尚未登入</div>
              <div className="cue-en-sub">Please login or register</div>
              <div className="mt-3 flex gap-2">
                <a href="/members/login" className="cue-button px-4 py-2 rounded">登入</a>
                <a href="/members/register" className="px-4 py-2 rounded bg-gray-700 text-white">註冊</a>
              </div>
            </div>
          )}

          {!!memberId && (
            <>
              <div className="cue-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="cue-zh-title">{profile?.name || 'Member'}</div>
                    <div className="cue-en-sub">{profile?.email || session?.email}</div>
                  </div>
                  <a href={`/member/${memberId}`} className="cue-button px-4 py-2 rounded">查看詳情</a>
                </div>
              </div>
              <div className="cue-card p-4">
                <div className="cue-zh-title mb-2">最近比賽</div>
                {loading && <div className="text-sm text-gray-300">讀取中…</div>}
                {!loading && matches.length === 0 && <div className="text-sm text-gray-300">暫無資料</div>}
                {!loading && matches.length > 0 && (
                  <div className="space-y-2">
                    {matches.slice(0, 5).map((m, idx) => (
                      <div key={m.id || idx} className="flex items-center justify-between text-sm">
                        <div className="font-medium">{m.opponentName || '對手'}</div>
                        <div className="text-gray-300">{m.score || '-'}</div>
                        <div className="text-gray-400">{m.duration || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Me;
