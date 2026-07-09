import type React from 'react';

export type EditableFrame = {
  frameNo: number;
  winnerSide: 'A' | 'B';
  playerAScore: string;
  playerBScore: string;
  isPlaceholder?: boolean;
};

export type MatchResultQuickType = 'WALKOVER' | 'FORFEIT';

export type MatchMemberOption = {
  value: string;
  label: string;
};

export type MatchScoreSegment = {
  key: string;
  startFrameNo: number;
  endFrameNo: number;
  sessionNo: number;
  blockNo: number;
  title: string;
  rangeLabel: string;
  boundaryLabel: string;
};

export type SegmentBreakSummary = {
  countLabel: string;
  topLabel: string;
  frameLabel: string;
};

export type TournamentScoringWorkspace = {
  activeFrame: EditableFrame;
  activeFrameIndex: number;
  activeFrameNoValue: number;
  breakFrameNo: string;
  breakMemberId: string;
  breakNote: string;
  breakPoints: string;
  breakRecordedAt: string;
  breakSaving: boolean;
  formatDisplayDateTime: (raw: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatMemberLabel: (member: any) => string;
  getFrameSegmentLabel: (frameNo: number) => string;
  getRecommendedFrameNoForSegment: (frames: EditableFrame[], segment: MatchScoreSegment) => number;
  getSegmentBreakSummary: (rows: any[], segment: MatchScoreSegment | null) => SegmentBreakSummary;
  getSegmentCompletionSummary: (frames: EditableFrame[], segment: MatchScoreSegment) => string;
  getSegmentFramesWonSummary: (frames: EditableFrame[], segment: MatchScoreSegment) => string;
  onSubmitActiveFrameBreak: () => Promise<void>;
  onSubmitQuickResult: () => Promise<void>;
  onSubmitSidebarBreak: () => Promise<void>;
  onSubmitStandardResult: () => Promise<void>;
  pendingResultFrame: EditableFrame | null;
  resultEndedAt: string;
  resultFrames: EditableFrame[];
  resultQuickType: MatchResultQuickType;
  resultQuickWinnerSide: 'A' | 'B';
  resultSaving: boolean;
  resultStartedAt: string;
  selectedMatch: any;
  selectedMatchA20PlusCount: number;
  selectedMatchActiveFrameBreakRows: any[];
  selectedMatchActiveSegment: MatchScoreSegment | null;
  selectedMatchActiveSegmentBreakRows: any[];
  selectedMatchActiveSegmentBreakSummary: SegmentBreakSummary;
  selectedMatchB20PlusCount: number;
  selectedMatchBestOf: number;
  selectedMatchBreadcrumbLabel: string;
  selectedMatchBreakEnabled: boolean;
  selectedMatchBreakFrameOptions: string[];
  selectedMatchBreakRows: any[];
  selectedMatchBreakTotalsLabel: string;
  selectedMatchCompletedFrames: number;
  selectedMatchCurrentBlockNo: number;
  selectedMatchCurrentFrameNo: number;
  selectedMatchCurrentSessionNo: number;
  selectedMatchIsCompleted: boolean;
  selectedMatchIsLongFormat: boolean;
  selectedMatchLatestSavedFrameNo: number;
  selectedMatchMemberOptions: MatchMemberOption[];
  selectedMatchNextCheckpointLabel: string;
  selectedMatchResultEditable: boolean;
  selectedMatchResumeSummary: string;
  selectedMatchSegments: MatchScoreSegment[];
  selectedMatchTargetWins: number;
  selectedMatchTopTwentyLabel: string;
  selectedMatchWinnerLabel: string;
  selectedMatchWinsRemainingA: number;
  selectedMatchWinsRemainingB: number;
  setActiveFrameNo: React.Dispatch<React.SetStateAction<number>>;
  setBreakFrameNo: React.Dispatch<React.SetStateAction<string>>;
  setBreakMemberId: React.Dispatch<React.SetStateAction<string>>;
  setBreakNote: React.Dispatch<React.SetStateAction<string>>;
  setBreakPoints: React.Dispatch<React.SetStateAction<string>>;
  setBreakRecordedAt: React.Dispatch<React.SetStateAction<string>>;
  setResultEndedAt: React.Dispatch<React.SetStateAction<string>>;
  setResultQuickType: React.Dispatch<React.SetStateAction<MatchResultQuickType>>;
  setResultQuickWinnerSide: React.Dispatch<React.SetStateAction<'A' | 'B'>>;
  setResultStartedAt: React.Dispatch<React.SetStateAction<string>>;
  showNotice: (message: string, timeout?: number) => void;
  tournamentFormat: 'KNOCKOUT' | 'LEAGUE';
  updateFrameDraft: (index: number, patch: Partial<EditableFrame>) => void;
};
