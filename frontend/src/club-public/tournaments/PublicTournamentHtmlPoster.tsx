import React from 'react';
import type {
  LeagueShareRow,
  KnockoutShareMatch,
  KnockoutShareRound,
  KnockoutShareSummaryCard,
} from '../../venue/modules/TournamentShareCards';
import type { PublicTournamentHtmlPosterItem } from './publicTournamentPosterHelpers';

type PublicTournamentHtmlPosterProps = {
  item: PublicTournamentHtmlPosterItem;
  className?: string;
  onClick?: () => void;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function splitKnockoutBranchItems(items: KnockoutShareMatch[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const midpoint = Math.ceil(safeItems.length / 2);
  return {
    left: safeItems.slice(0, midpoint),
    right: safeItems.slice(midpoint),
  };
}

function HtmlLogo() {
  return (
    <div className="flex h-[72px] w-[72px] shrink-0 flex-col items-center rounded-[16px] border border-white/15 bg-[#FF140A] pt-2 text-white shadow-[0_10px_32px_rgba(0,0,0,0.24)]">
      <div className="text-[8px] font-black leading-none">HONG</div>
      <div className="mt-0.5 text-[8px] font-black leading-none">KONG</div>
      <div className="mt-1 rounded-[2px] bg-white px-1.5 py-0.5 text-[10px] font-black italic leading-none text-[#FF140A]">Snooker</div>
      <div className="mt-1 text-[18px] font-black leading-none">LIVE</div>
    </div>
  );
}

function PosterShell({
  landscape,
  className,
  children,
  onClick,
}: {
  landscape: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative block w-full overflow-hidden rounded-[22px] border border-white/10 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]',
        landscape ? 'aspect-[16/9]' : 'aspect-[1080/1350]',
        onClick ? 'transition hover:border-white/20' : '',
        className,
      )}
      style={{
        backgroundImage: landscape
          ? 'linear-gradient(135deg, #140B24 0%, #47206D 33%, #1A102E 72%, #59284F 100%)'
          : 'linear-gradient(135deg, #08111F 0%, #12345D 33%, #09172B 72%, #183C68 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: landscape ? '48px 48px' : '44px 44px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_16%,rgba(182,136,255,0.22),transparent_24%),radial-gradient(circle_at_88%_22%,rgba(246,183,60,0.16),transparent_20%),radial-gradient(circle_at_72%_82%,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="absolute inset-0 p-3 sm:p-4 md:p-5">{children}</div>
    </Comp>
  );
}

function VenueIdentity({ venueName, venueLogoUrl }: { venueName: string; venueLogoUrl?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
      {venueLogoUrl ? (
        <img
          src={venueLogoUrl}
          alt={venueName}
          className="h-7 w-7 rounded-full border border-white/20 object-cover"
        />
      ) : null}
      <div className="truncate text-[11px] font-semibold text-[#D8E5F4] sm:text-xs">
        {venueName || 'Snookerhk.live'}
      </div>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/90 sm:text-[11px]">
      {label}
    </div>
  );
}

function KnockoutCard({ item }: { item: KnockoutShareMatch }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="flex items-center justify-between text-[8px] text-[#C9B0E9]">
        <span>M{item.matchNo}</span>
        <span>{item.statusLabel}</span>
      </div>
      <div className="mt-1.5 space-y-1">
        <div className={cn('truncate text-[10px] font-bold', item.winnerSide === 'A' ? 'text-[#F6B73C]' : 'text-white')}>
          {item.playerALabel || 'BYE'}
        </div>
        <div className={cn('truncate text-[10px] font-bold', item.winnerSide === 'B' ? 'text-[#F6B73C]' : 'text-white')}>
          {item.playerBLabel || 'BYE'}
        </div>
      </div>
      <div className="mt-1 text-right text-[11px] font-black text-white">
        {item.playerAFrames}:{item.playerBFrames}
      </div>
    </div>
  );
}

function KnockoutRoundColumn({ round, items }: { round: KnockoutShareRound; items: KnockoutShareMatch[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-bold text-[#F6B73C]">{round.label}</div>
        <div className="text-[9px] text-[#C9B0E9]">{round.completedCount}/{round.total}</div>
      </div>
      <div className="space-y-1.5">
        {items.map((match) => <KnockoutCard key={`${round.label}-${match.matchNo}`} item={match} />)}
      </div>
    </div>
  );
}

function LeaguePoster({ item, className }: { item: PublicTournamentHtmlPosterItem; className?: string }) {
  const rows = item.rows || [];
  return (
    <PosterShell landscape={false} className={className}>
      <div className="relative flex h-full flex-col">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-wide text-[#F4C95D] sm:text-xs">{item.modeLabel}</div>
              <div className="mt-2 truncate text-2xl font-bold sm:text-3xl">{item.title}</div>
              <div className="mt-3">
                <VenueIdentity venueName={item.venueName} venueLogoUrl={item.venueLogoUrl} />
              </div>
            </div>
            <HtmlLogo />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.chips.map((chip) => <MetaChip key={chip} label={chip} />)}
          </div>
        </div>

        <div className="mt-4 flex-1 rounded-[24px] border border-white/10 bg-[rgba(9,14,30,0.38)] p-4">
          <div className="mx-auto mb-4 max-w-[280px] rounded-2xl bg-[linear-gradient(90deg,#F4C95D,#75D8C4)] px-4 py-2 text-center text-sm font-bold">
            聯賽模式積分榜
          </div>
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-black/20">
            <div className="grid grid-cols-[54px,1.8fr,repeat(7,minmax(0,0.7fr))] bg-white/8 px-3 py-2 text-[10px] font-bold text-[#AFC3DD]">
              {['#', '球手', '賽', '勝', '和', '負', '分', '+20', '最高'].map((label) => <div key={label}>{label}</div>)}
            </div>
            <div className="divide-y divide-white/8">
              {rows.slice(0, 8).map((row) => (
                <div key={`${row.position}-${row.label}`} className="grid grid-cols-[54px,1.8fr,repeat(7,minmax(0,0.7fr))] px-3 py-2 text-[10px] text-white sm:text-[11px]">
                  <div className="font-bold text-[#F4C95D]">{row.position}</div>
                  <div className="truncate font-semibold">{row.label}</div>
                  <div>{row.played}</div>
                  <div>{row.won}</div>
                  <div>{row.drawn}</div>
                  <div>{row.lost}</div>
                  <div className="font-bold text-[#F4C95D]">{row.matchPoints}</div>
                  <div>{row.breaks20Plus}</div>
                  <div>{row.maxBreak}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-[#AFC3DD]">
          <div>聯賽模式海報版分享圖 · Snookerhk.live</div>
          <div>{new Date().toLocaleString('zh-HK', { hour12: false })}</div>
        </div>
      </div>
    </PosterShell>
  );
}

function KnockoutPoster({ item, className, onClick }: { item: PublicTournamentHtmlPosterItem; className?: string; onClick?: () => void }) {
  const rounds = item.rounds || [];
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.items?.[0];
  const preFinalRounds = rounds.length === 1 && Number(finalRound?.total || finalRound?.items?.length || 0) > 1 ? rounds : rounds.slice(0, -1);
  const branchRounds = preFinalRounds.map((round) => ({ round, ...splitKnockoutBranchItems(round.items) }));
  const rightRounds = branchRounds.slice().reverse();
  const totalMatches = rounds.reduce((sum, round) => sum + Number(round?.total || round?.items?.length || 0), 0);
  const completedMatches = rounds.reduce((sum, round) => sum + Number(round?.completedCount || 0), 0);
  const isGrouped = String(item.focusLabel || '').startsWith('初期分組');
  const isFinalView = !isGrouped && (Number(finalRound?.total || finalRound?.items?.length || 0) <= 1 || String(finalRound?.label || '').includes('決賽'));
  const summaryCards = item.summaryCards || [];

  return (
    <PosterShell landscape className={cn(onClick ? 'cursor-pointer' : '', className)} onClick={onClick}>
      <div className="relative flex h-full flex-col">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-wide text-[#F6B73C] sm:text-xs">{item.modeLabel}</div>
              <div className="mt-2 truncate text-2xl font-bold sm:text-3xl">{item.title.replace(/ · .+$/, '')}</div>
            </div>
            <div className="flex items-start gap-4">
              <VenueIdentity venueName={item.venueName} venueLogoUrl={item.venueLogoUrl} />
              <HtmlLogo />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.chips.map((chip) => <MetaChip key={chip} label={chip} />)}
          </div>
        </div>

        <div className="mt-4 flex-1 rounded-[24px] border border-white/10 bg-[rgba(17,10,28,0.46)] px-4 py-3">
          <div className="mx-auto mb-3 max-w-[300px] rounded-2xl bg-[linear-gradient(90deg,#F6B73C,#B688FF)] px-4 py-2 text-center text-sm font-bold">
            {item.focusLabel === '全部輪次' ? '淘汰賽模式進級表' : item.focusLabel}
          </div>
          <div className="mb-4 text-center text-[10px] text-[#E7D8F8]">
            改用橫版版心，保留 bracket 橫向展開空間，讓 16 人以上淘汰賽更接近真實賽會海報閱讀方式。
          </div>

          <div className="grid flex-1 grid-cols-[minmax(0,1fr),260px,minmax(0,1fr)] gap-4">
            <div className="flex min-w-0 gap-2">
              {branchRounds.map(({ round, left }) => (
                <KnockoutRoundColumn key={`left-${round.label}`} round={round} items={left} />
              ))}
            </div>

            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
              <div className="w-full rounded-[22px] border border-[#F6B73C]/25 bg-white/6 px-4 py-4 text-center">
                <div className="text-xs font-semibold text-[#C9B0E9]">{finalRound?.label || item.focusLabel}</div>
                <div className="mt-2 text-4xl font-black text-[#F6B73C]">
                  {isFinalView && finalMatch ? `${finalMatch.playerAFrames}:${finalMatch.playerBFrames}` : `${completedMatches}/${Math.max(1, totalMatches)}`}
                </div>
                <div className="mt-2 text-[11px] text-[#E7D8F8]">
                  {isFinalView && finalMatch
                    ? `${finalMatch.playerALabel} VS ${finalMatch.playerBLabel}`
                    : isGrouped
                      ? '初期分組與後段總覽會分開輸出'
                      : '本張海報聚焦目前輪次與摘要'}
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 rounded-[22px] border border-[#F6B73C]/20 bg-[#F6B73C]/10 px-4 py-3">
                <div>
                  <div className="text-[10px] text-[#C9B0E9]">{isFinalView ? '冠軍' : '焦點輪次'}</div>
                  <div className="mt-1 truncate text-base font-bold text-[#F6B73C]">
                    {isFinalView && finalMatch
                      ? (finalMatch.winnerSide === 'A' ? finalMatch.playerALabel : finalMatch.winnerSide === 'B' ? finalMatch.playerBLabel : '-')
                      : (finalRound?.label || item.focusLabel)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#C9B0E9]">{isFinalView ? '亞軍' : '尚餘對局'}</div>
                  <div className="mt-1 truncate text-base font-bold text-white">
                    {isFinalView && finalMatch
                      ? (finalMatch.winnerSide === 'A' ? finalMatch.playerBLabel : finalMatch.winnerSide === 'B' ? finalMatch.playerALabel : '-')
                      : `${Math.max(0, totalMatches - completedMatches)} 場`}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 gap-2">
              {rightRounds.map(({ round, right }) => (
                <KnockoutRoundColumn key={`right-${round.label}`} round={round} items={right} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
          <div className="text-lg font-bold">賽事摘要</div>
          <div className="mb-3 text-[10px] text-[#E7D8F8]">
            {summaryCards.length > 3 ? '後段總覽補上金杯與銀杯 podium，避免只見主線而看不到雙盃名次。' : '底部改為橫向摘要列，讓橫版海報同時保留 bracket 與關鍵數據。'}
          </div>
          <div className={cn('grid gap-2', summaryCards.length > 3 ? 'grid-cols-3' : 'grid-cols-3')}>
            {summaryCards.slice(0, 6).map((card: KnockoutShareSummaryCard) => (
              <div key={`${card.label}-${card.value}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] text-[#C9B0E9]">{card.label}</div>
                <div className="mt-1 truncate text-sm font-bold text-[#F6B73C]">{card.value || '-'}</div>
                <div className="mt-1 truncate text-[10px] text-[#E7D8F8]">{card.detail || '-'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-[#C9B0E9]">
          <div>淘汰賽模式海報版分享圖 · Snookerhk.live</div>
          <div>{new Date().toLocaleString('zh-HK', { hour12: false })}</div>
        </div>
      </div>
    </PosterShell>
  );
}

const PublicTournamentHtmlPoster: React.FC<PublicTournamentHtmlPosterProps> = ({
  item,
  className,
  onClick,
}) => {
  if (item.kind === 'league') {
    return <LeaguePoster item={item} className={className} />;
  }
  return <KnockoutPoster item={item} className={className} onClick={onClick} />;
};

export default PublicTournamentHtmlPoster;
