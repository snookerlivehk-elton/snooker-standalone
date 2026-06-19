import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from './config';
import { confirmSettlement, getQrTableInfo, qrTableEndConfirm, qrTableEndInit, qrTableStartConfirm, qrTableStartInit } from './lib/api';

const TableQrPage: React.FC = () => {
  const navigate = useNavigate();
  const { token = '' } = useParams();

  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);
  const memberId = session?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);

  const [startConfirm, setStartConfirm] = useState<any>(null);
  const [endConfirm, setEndConfirm] = useState<any>(null);
  const [settlementConfirm, setSettlementConfirm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = String(token || '').trim();
    if (!t) {
      navigate('/', { replace: true });
      return;
    }
    if (!memberId) {
      navigate(`/members/login?next=${encodeURIComponent(`/qr/table/${t}`)}`, { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    getQrTableInfo(API_URL, memberId, t)
      .then((r) => setInfo(r))
      .catch((e: any) => setError(e?.message || '載入失敗'))
      .finally(() => setLoading(false));
  }, [token, memberId, navigate]);

  const refresh = async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getQrTableInfo(API_URL, memberId, String(token || '').trim());
      setInfo(r);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const activeSession = info?.session;
  const club = info?.club;
  const table = info?.table;
  const settlementQuote = settlementConfirm?.quotePayload || {};

  return (
    <div className="brand-page p-4 sm:p-6 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md glass rounded-xl p-6 grid gap-4">
        <div className="text-center">
          <div className="text-xl font-bold accent-yellow uppercase tracking-wider">Cue Aim System</div>
          <h2 className="text-2xl font-bold mt-1">掃碼起鐘 / 落鐘</h2>
        </div>

        {toast && (
          <div className="bg-emerald-600 text-white px-4 py-2 rounded shadow">
            {toast}
          </div>
        )}

        {error && (
          <div className="cue-surface p-3 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="cue-muted text-center py-6">載入中...</div>
        ) : (
          <div className="grid gap-3">
            <div className="cue-surface rounded-lg p-3">
              <div className="text-sm cue-muted">場館</div>
              <div className="font-semibold">{club?.name || '-'}</div>
              <div className="text-sm cue-muted mt-2">球枱</div>
              <div className="font-semibold">{table?.name || '-'}</div>
            </div>

            {activeSession ? (
              <div className="cue-surface rounded-lg p-3">
                <div className="text-sm cue-muted">狀態</div>
                <div className="font-semibold">進行中</div>
                <div className="text-sm cue-muted mt-2">開始時間</div>
                <div className="text-sm">{new Date(activeSession.startAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="cue-surface rounded-lg p-3">
                <div className="text-sm cue-muted">狀態</div>
                <div className="font-semibold">未開始</div>
              </div>
            )}

            {settlementConfirm ? (
              <div className="cue-surface rounded-lg p-3 grid gap-3">
                <div className="font-semibold">確認扣除消費積分？</div>
                <div className="text-sm cue-muted">
                  已落鐘，請確認本次交易。
                </div>
                <div className="grid gap-2 text-sm">
                  <div>計費分鐘：{settlementConfirm?.billableMinutes ?? '-'}</div>
                  <div>金額：{settlementConfirm?.chargedAmount ?? settlementConfirm?.baseAmount ?? '-'} {settlementConfirm?.chargedCurrency || ''}</div>
                  <div>所需積分：{settlementQuote?.requiredPoints ?? settlementQuote?.chargedPoints ?? '-'}</div>
                  <div>目前餘額：{settlementQuote?.availablePoints ?? '-'}</div>
                </div>
                {settlementQuote?.canAfford === false && (
                  <div className="text-sm text-red-600">積分不足，未能完成扣分。</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95"
                    disabled={busy}
                    onClick={() => setSettlementConfirm(null)}
                  >
                    稍後處理
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-button hover:brightness-95 font-bold"
                    disabled={busy || settlementQuote?.canAfford === false}
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        const out = await confirmSettlement(API_URL, memberId, String(settlementConfirm.id));
                        const requiredPoints = out?.quotePayload?.requiredPoints;
                        setToast(requiredPoints ? `已完成扣分 ${requiredPoints}` : '已完成交易');
                        setTimeout(() => setToast(null), 3000);
                        setSettlementConfirm(null);
                        await refresh();
                      } catch (e: any) {
                        setToast(e?.message || '確認扣分失敗');
                        setTimeout(() => setToast(null), 3000);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    確認扣分
                  </button>
                </div>
              </div>
            ) : activeSession ? (
              <>
                {!endConfirm ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="px-4 py-3 rounded cue-button disabled:opacity-50 font-bold"
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        const r = await qrTableEndInit(API_URL, memberId, String(token || '').trim());
                        setEndConfirm(r);
                      } catch (e: any) {
                        setToast(e?.message || '落鐘失敗');
                        setTimeout(() => setToast(null), 3000);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    落鐘
                  </button>
                ) : (
                  <div className="cue-surface rounded-lg p-3 grid gap-3">
                    <div className="font-semibold">確認落鐘？</div>
                    <div className="text-sm cue-muted">
                      預計計費：{endConfirm?.preview?.billedMinutes ?? '-'} 分鐘
                      {endConfirm?.preview?.chargedPoints != null ? `，扣分：${endConfirm.preview.chargedPoints}` : ''}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded cue-surface-strong hover:brightness-95"
                        disabled={busy}
                        onClick={() => setEndConfirm(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded cue-button hover:brightness-95 font-bold"
                        disabled={busy}
                        onClick={async () => {
                          if (busy) return;
                          setBusy(true);
                          try {
                            const out = await qrTableEndConfirm(API_URL, memberId, String(endConfirm.confirmId));
                            if (out?.requiresSettlementConfirmation && out?.settlement) {
                              setSettlementConfirm(out.settlement);
                              setInfo((prev: any) => prev ? { ...prev, session: null } : prev);
                              setToast('已落鐘，請確認扣分');
                            } else {
                              setToast(out?.chargedPoints ? `已落鐘，扣分 ${out.chargedPoints}` : '已落鐘');
                              await refresh();
                            }
                            setTimeout(() => setToast(null), 3000);
                            setEndConfirm(null);
                          } catch (e: any) {
                            setToast(e?.message || '確認落鐘失敗');
                            setTimeout(() => setToast(null), 3000);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        確認
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {!startConfirm ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="px-4 py-3 rounded cue-button disabled:opacity-50 font-bold"
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        const r = await qrTableStartInit(API_URL, memberId, String(token || '').trim());
                        setStartConfirm(r);
                      } catch (e: any) {
                        setToast(e?.message || '起鐘失敗');
                        setTimeout(() => setToast(null), 3000);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    起鐘
                  </button>
                ) : (
                  <div className="cue-surface rounded-lg p-3 grid gap-3">
                    <div className="font-semibold">確認起鐘？</div>
                    <div className="text-sm cue-muted">為符合要求，掃碼後需再按一次確認。</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded cue-surface-strong hover:brightness-95"
                        disabled={busy}
                        onClick={() => setStartConfirm(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded cue-button hover:brightness-95 font-bold"
                        disabled={busy}
                        onClick={async () => {
                          if (busy) return;
                          setBusy(true);
                          try {
                            await qrTableStartConfirm(API_URL, memberId, String(startConfirm.confirmId));
                            setToast('已起鐘');
                            setTimeout(() => setToast(null), 3000);
                            setStartConfirm(null);
                            await refresh();
                          } catch (e: any) {
                            setToast(e?.message || '確認起鐘失敗');
                            setTimeout(() => setToast(null), 3000);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        確認
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
              onClick={refresh}
            >
              重新整理
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableQrPage;
