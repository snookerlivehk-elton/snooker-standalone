import React from 'react';
import ClubPublicTournamentParticipantDetailSection from './ClubPublicTournamentParticipantDetailSection';
import ClubPublicTournamentParticipantDirectorySection from './ClubPublicTournamentParticipantDirectorySection';
import ClubPublicTournamentParticipantLookup from './ClubPublicTournamentParticipantLookup';

type ClubPublicTournamentParticipantPanelProps = {
  openedTournament: any;
  openedTournamentParticipants: any[];
  openedTournamentStandings: any[];
  openedTournamentFormat: any;
  tournamentParticipantSearchQuery: string;
  filteredOpenedTournamentParticipantSearchRows: any[];
  openedTournamentParticipantSearchRows: any[];
  tournamentParticipantOpen: any;
  tournamentParticipantDetailLoading: boolean;
  tournamentParticipantDetailError: string;
  tournamentParticipantDetail: any;
  selectedTournamentParticipantFormat: any;
  filteredTournamentParticipantRecentForm: any[];
  filteredTournamentParticipantOpponentStats: any[];
  tournamentParticipantMonthFilter: string;
  tournamentParticipantRoundFilter: string;
  tournamentParticipantFilterOptions: any;
  filteredTournamentParticipantMatches: any[];
  filteredTournamentParticipantBreaks: any[];
  filteredTournamentParticipantChartData: any;
  setTournamentParticipantSearchQuery: (value: string) => void;
  openTournamentParticipantPanel: (row: any) => void;
  setTournamentParticipantOpen: (value: any) => void;
  setTournamentParticipantMonthFilter: (value: string) => void;
  setTournamentParticipantRoundFilter: (value: string) => void;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatMonthFilterLabel: (month: string) => string;
  panelRef?: React.Ref<HTMLDivElement>;
};

const ClubPublicTournamentParticipantPanel: React.FC<ClubPublicTournamentParticipantPanelProps> = ({
  openedTournament,
  openedTournamentParticipants,
  openedTournamentStandings,
  openedTournamentFormat,
  tournamentParticipantSearchQuery,
  filteredOpenedTournamentParticipantSearchRows,
  openedTournamentParticipantSearchRows,
  tournamentParticipantOpen,
  tournamentParticipantDetailLoading,
  tournamentParticipantDetailError,
  tournamentParticipantDetail,
  selectedTournamentParticipantFormat,
  filteredTournamentParticipantRecentForm,
  filteredTournamentParticipantOpponentStats,
  tournamentParticipantMonthFilter,
  tournamentParticipantRoundFilter,
  tournamentParticipantFilterOptions,
  filteredTournamentParticipantMatches,
  filteredTournamentParticipantBreaks,
  filteredTournamentParticipantChartData,
  setTournamentParticipantSearchQuery,
  openTournamentParticipantPanel,
  setTournamentParticipantOpen,
  setTournamentParticipantMonthFilter,
  setTournamentParticipantRoundFilter,
  formatTournamentParticipantLabel,
  formatMonthFilterLabel,
  panelRef,
}) => {
  return (
    <>
      <div ref={panelRef} className="cue-surface-strong rounded-lg p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="font-semibold">球手搜尋與個人戰況</div>
            <div className="text-xs cue-muted mt-1">
              可直接搜尋球手，或從下方正式參賽名單 / 積分榜點選，於同一個 tournament 詳情 modal 內查看個人戰況。
            </div>
          </div>
          <div className="text-xs cue-muted">參賽者 {openedTournamentParticipants.length} 人</div>
        </div>
        <ClubPublicTournamentParticipantLookup
          openedTournamentParticipants={openedTournamentParticipants}
          tournamentParticipantSearchQuery={tournamentParticipantSearchQuery}
          filteredOpenedTournamentParticipantSearchRows={filteredOpenedTournamentParticipantSearchRows}
          openedTournamentParticipantSearchRows={openedTournamentParticipantSearchRows}
          tournamentParticipantOpen={tournamentParticipantOpen}
          setTournamentParticipantSearchQuery={setTournamentParticipantSearchQuery}
          openTournamentParticipantPanel={openTournamentParticipantPanel}
        />

        <ClubPublicTournamentParticipantDetailSection
          openedTournament={openedTournament}
          openedTournamentParticipants={openedTournamentParticipants}
          tournamentParticipantOpen={tournamentParticipantOpen}
          tournamentParticipantDetailLoading={tournamentParticipantDetailLoading}
          tournamentParticipantDetailError={tournamentParticipantDetailError}
          tournamentParticipantDetail={tournamentParticipantDetail}
          selectedTournamentParticipantFormat={selectedTournamentParticipantFormat}
          filteredTournamentParticipantRecentForm={filteredTournamentParticipantRecentForm}
          filteredTournamentParticipantOpponentStats={filteredTournamentParticipantOpponentStats}
          tournamentParticipantMonthFilter={tournamentParticipantMonthFilter}
          tournamentParticipantRoundFilter={tournamentParticipantRoundFilter}
          tournamentParticipantFilterOptions={tournamentParticipantFilterOptions}
          filteredTournamentParticipantMatches={filteredTournamentParticipantMatches}
          filteredTournamentParticipantBreaks={filteredTournamentParticipantBreaks}
          filteredTournamentParticipantChartData={filteredTournamentParticipantChartData}
          setTournamentParticipantOpen={setTournamentParticipantOpen}
          setTournamentParticipantMonthFilter={setTournamentParticipantMonthFilter}
          setTournamentParticipantRoundFilter={setTournamentParticipantRoundFilter}
          formatTournamentParticipantLabel={formatTournamentParticipantLabel}
          formatMonthFilterLabel={formatMonthFilterLabel}
        />
      </div>

      <ClubPublicTournamentParticipantDirectorySection
        openedTournamentParticipants={openedTournamentParticipants}
        openedTournamentStandings={openedTournamentStandings}
        openedTournamentFormat={openedTournamentFormat}
        openTournamentParticipantPanel={openTournamentParticipantPanel}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
      />
    </>
  );
};

export default ClubPublicTournamentParticipantPanel;
