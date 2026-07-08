import React from 'react';
import VenueTournamentKnockoutSeedingGuide from './VenueTournamentKnockoutSeedingGuide';

type TournamentSeedMode = 'MANUAL' | 'RANKING' | 'RANDOM';

type VenueTournamentKnockoutParticipantsPanelProps = {
  canEditSeeding: boolean;
  formatFinalRankLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  formatParticipantStatusLabel: (value: any) => string;
  hasSchedule: boolean;
  participantsLoading: boolean;
  participantsRows: any[];
  participantSeedDrafts: Record<string, string>;
  participantSeedSavingId: string;
  seedMode: TournamentSeedMode;
  seedModeSaving: boolean;
  onApplySeedMode: () => void;
  onSeedDraftChange: (rowId: string, value: string) => void;
  onSeedModeChange: (value: TournamentSeedMode) => void;
  onUpdateSeed: (rowId: string, seedDraft: string) => void;
};

const VenueTournamentKnockoutParticipantsPanel: React.FC<VenueTournamentKnockoutParticipantsPanelProps> = ({
  canEditSeeding,
  formatFinalRankLabel,
  formatParticipantLabel,
  formatParticipantStatusLabel,
  hasSchedule,
  participantsLoading,
  participantsRows,
  participantSeedDrafts,
  participantSeedSavingId,
  seedMode,
  seedModeSaving,
  onApplySeedMode,
  onSeedDraftChange,
  onSeedModeChange,
  onUpdateSeed,
}) => (
  <div>
    <div className="flex flex-col gap-3 mb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">正式參賽名單</div>
        <div className="text-xs cue-muted">{participantsLoading ? '讀取中…' : `${participantsRows.length} 人`}</div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs mb-1 cue-muted">目前 seedMode</label>
          <select
            value={seedMode}
            onChange={(e) => onSeedModeChange(String(e.target.value).trim().toUpperCase() as TournamentSeedMode)}
            className="px-3 py-2 rounded cue-input text-sm min-w-40"
            disabled={!canEditSeeding || seedModeSaving}
          >
            <option value="MANUAL">手動種子</option>
            <option value="RANKING">按評分排序</option>
            <option value="RANDOM">隨機抽籤</option>
          </select>
        </div>
        <button
          type="button"
          disabled={seedModeSaving || !canEditSeeding}
          className={`px-3 py-2 rounded text-sm font-semibold ${seedModeSaving || !canEditSeeding ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
          onClick={onApplySeedMode}
        >
          {seedModeSaving ? '套用中...' : '套用 seedMode'}
        </button>
        <div className="text-xs cue-muted">手動改 seed 會自動切回 `MANUAL`；賽程生成後會鎖定。</div>
      </div>
    </div>
    <VenueTournamentKnockoutSeedingGuide
      hasSchedule={hasSchedule}
      participantCount={participantsRows.length}
      seedMode={seedMode}
    />
    {participantsLoading ? (
      <div className="text-sm cue-muted">讀取中…</div>
    ) : participantsRows.length === 0 ? (
      <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
    ) : (
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="cue-muted border-b cue-border">
              <th className="py-2 px-2">Seed</th>
              <th className="py-2 px-2">球手</th>
              <th className="py-2 px-2">狀態</th>
              <th className="py-2 px-2">名次</th>
              <th className="py-2 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {participantsRows.map((row: any, index) => {
              const rowId = String(row?.id || index);
              const seedDraft = participantSeedDrafts[rowId] ?? String(row?.seed ?? index + 1);
              const isSaving = participantSeedSavingId === rowId;
              return (
                <tr key={rowId} className="border-b cue-border hover:brightness-95">
                  <td className="py-2 px-2 w-28">
                    <input
                      type="number"
                      min={1}
                      value={seedDraft}
                      onChange={(e) => onSeedDraftChange(rowId, e.target.value)}
                      className="w-full px-2 py-1 rounded cue-input"
                      disabled={isSaving || !canEditSeeding}
                    />
                  </td>
                  <td className="py-2 px-2 font-semibold">{formatParticipantLabel(row)}</td>
                  <td className="py-2 px-2 cue-muted">{formatParticipantStatusLabel(row?.status)}</td>
                  <td className="py-2 px-2 cue-muted">{formatFinalRankLabel(row?.final_rank)}</td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      disabled={isSaving || !canEditSeeding}
                      className={`px-3 py-1 rounded text-sm font-semibold ${isSaving || !canEditSeeding ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
                      onClick={() => onUpdateSeed(rowId, seedDraft)}
                    >
                      {isSaving ? '儲存中...' : '更新 seed'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default VenueTournamentKnockoutParticipantsPanel;
