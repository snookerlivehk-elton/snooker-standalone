import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  broadcastClubMessage,
  deleteClubMessageManage,
  getClubMessagesManage,
  updateClubMessageManage,
} from '../../lib/api';

type VenueClubMessagesModuleProps = {
  operatorId: string;
  enabled: boolean;
  className?: string;
};

const VenueClubMessagesModule: React.FC<VenueClubMessagesModuleProps> = ({
  operatorId,
  enabled,
  className = '',
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [editingId, setEditingId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const loadRows = useCallback(async () => {
    if (!operatorId || !enabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const next = await getClubMessagesManage(API_URL, operatorId, 80).catch(() => []);
      setRows(Array.isArray(next) ? next : []);
    } catch (e: any) {
      showNotice(e?.message || '載入場館訊息失敗', 3000);
    } finally {
      setLoading(false);
    }
  }, [enabled, operatorId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  if (!enabled) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">發送場館訊息</div>
        <div className="cue-muted text-sm">此功能未開通</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
        <h2 className="text-xl font-bold">發送場館訊息</h2>
        <HelpGuide
          title="發送場館訊息"
          intro="向已加入場館的會員推送訊息（可新增、編輯、刪除）。"
          steps={[
            '輸入標題及內容後按「發送」。',
            '如需修改已發送訊息，可在下方列表按「編輯」載入，再按「更新」。',
            '如需移除訊息，可在列表按「刪除」。',
          ]}
          tips={[
            '內容支援換行，會員端會以多行顯示。',
            '場館訊息屬會員端通知，唔會自動公開到首頁或場館公開頁。',
            '刪除後不可復原，操作前請確認。',
          ]}
        />
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1 cue-muted">標題</label>
          <input
            value={msgTitle}
            onChange={(e) => setMsgTitle(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="訊息標題"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 cue-muted">內容</label>
          <textarea
            value={msgContent}
            onChange={(e) => setMsgContent(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input h-24"
            placeholder="輸入要發送給所有會員的訊息..."
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!msgContent.trim()) {
              showNotice('請填寫內容');
              return;
            }
            try {
              if (editingId) {
                await updateClubMessageManage(API_URL, operatorId, editingId, {
                  title: msgTitle.trim() || null,
                  content: msgContent,
                });
                showNotice('已更新訊息');
              } else {
                if (!msgTitle.trim()) {
                  showNotice('請填寫標題');
                  return;
                }
                await broadcastClubMessage(API_URL, operatorId, msgTitle, msgContent);
                showNotice('訊息已發送');
              }
              setMsgTitle('');
              setMsgContent('');
              setEditingId('');
              await loadRows();
            } catch (e: any) {
              showNotice(e?.message || '操作失敗', 3000);
            }
          }}
          className="px-4 py-2 rounded brand-button text-black transition-colors"
        >
          {editingId ? '更新訊息' : '發送訊息'}
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm cue-muted">暫無已發送訊息</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">日期時間</th>
                  <th className="py-2 px-2">標題</th>
                  <th className="py-2 px-2">內容</th>
                  <th className="py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 80).map((m: any) => (
                  <tr key={String(m?.id || '')} className="border-b cue-border hover:brightness-95">
                    <td className="py-2 px-2 cue-muted whitespace-nowrap">{m?.createdAt ? new Date(m.createdAt).toLocaleString() : '-'}</td>
                    <td className="py-2 px-2 font-semibold">{String(m?.title || '-')}</td>
                    <td className="py-2 px-2 cue-muted">
                      <div className="max-w-[420px] truncate">{String(m?.content || '')}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                          onClick={() => {
                            setEditingId(String(m?.id || ''));
                            setMsgTitle(String(m?.title || ''));
                            setMsgContent(String(m?.content || ''));
                          }}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                          onClick={async () => {
                            if (!confirm('確定要刪除此訊息？')) return;
                            try {
                              await deleteClubMessageManage(API_URL, operatorId, String(m?.id || ''));
                              if (editingId && String(m?.id || '') === editingId) {
                                setEditingId('');
                                setMsgTitle('');
                                setMsgContent('');
                              }
                              await loadRows();
                              showNotice('已刪除');
                            } catch (e: any) {
                              showNotice(e?.message || '刪除失敗', 3000);
                            }
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 80 ? <div className="text-xs cue-muted mt-2">只顯示最近 80 筆</div> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueClubMessagesModule;
