import React from 'react';

type ClubPublicTournamentParticipantDirectorySectionProps = {
  openedTournamentParticipants: any[];
  openedTournamentStandings: any[];
  openedTournamentFormat: any;
  openTournamentParticipantPanel: (row: any) => void;
  formatTournamentParticipantLabel: (participant: any) => string;
};

const ClubPublicTournamentParticipantDirectorySection: React.FC<ClubPublicTournamentParticipantDirectorySectionProps> = ({
  openedTournamentParticipants,
  openedTournamentStandings,
  openedTournamentFormat,
  openTournamentParticipantPanel,
  formatTournamentParticipantLabel,
}) => {
  const participantsCard = (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold">正式參賽名單</div>
        <div className="text-xs cue-muted">{openedTournamentParticipants.length} 人</div>
      </div>
      <div className="text-xs cue-muted mb-3">
        點擊球手即可查看該球手在本賽事的個人戰況與戰績摘要。
      </div>
      {openedTournamentParticipants.length === 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {openedTournamentParticipants.map((row: any) => (
                <tr
                  key={String(row?.id || Math.random())}
                  className="border-b cue-border hover:brightness-95 cursor-pointer"
                  onClick={() => openTournamentParticipantPanel(row)}
                >
                  <td className="py-2 px-2">{row?.seed || '-'}</td>
                  <td className="py-2 px-2 font-semibold">
                    <div>{formatTournamentParticipantLabel(row)}</div>
                    <div className="text-xs cue-muted mt-1">查看球手詳情</div>
                  </td>
                  <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                  <td className="py-2 px-2 cue-muted">{row?.final_rank || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const standingsCard = openedTournamentFormat === 'LEAGUE' ? (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold">聯賽模式積分榜</div>
        <div className="text-xs cue-muted">{openedTournamentStandings.length} 人</div>
      </div>
      <div className="text-xs cue-muted mb-3">
        聯賽模式以積分榜為主視圖；點擊球手可查看個人戰況與近期表現。
      </div>
      {openedTournamentStandings.length === 0 ? (
        <div className="text-sm cue-muted">賽程生成後會在這裡顯示積分榜</div>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="cue-muted border-b cue-border">
                <th className="py-2 px-2">名次</th>
                <th className="py-2 px-2">球手</th>
                <th className="py-2 px-2">賽</th>
                <th className="py-2 px-2">勝 / 和 / 負</th>
                <th className="py-2 px-2">局差</th>
                <th className="py-2 px-2">積分</th>
              </tr>
            </thead>
            <tbody>
              {openedTournamentStandings.map((row: any) => (
                <tr
                  key={String(row?.participantId || Math.random())}
                  className="border-b cue-border hover:brightness-95 cursor-pointer"
                  onClick={() => openTournamentParticipantPanel(row?.participant)}
                >
                  <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                  <td className="py-2 px-2 font-semibold">
                    <div>{formatTournamentParticipantLabel(row?.participant)}</div>
                    <div className="text-xs cue-muted mt-1">查看球手詳情</div>
                  </td>
                  <td className="py-2 px-2 cue-muted">{Number(row?.played || 0)}</td>
                  <td className="py-2 px-2 cue-muted">{Number(row?.won || 0)} / {Number(row?.drawn || 0)} / {Number(row?.lost || 0)}</td>
                  <td className="py-2 px-2 cue-muted">{Number(row?.framesFor || 0)} - {Number(row?.framesAgainst || 0)} ({Number(row?.frameDiff || 0)})</td>
                  <td className="py-2 px-2 font-semibold accent-yellow">{Number(row?.matchPoints || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {standingsCard}
      {participantsCard}
    </div>
  );
};

export default ClubPublicTournamentParticipantDirectorySection;
