type LeagueShareRow = {
  position: number;
  label: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  matchPoints: number;
  frameDiff: number;
  breaks20Plus: number;
  maxBreak: number;
};

type KnockoutShareMatch = {
  matchNo: number;
  statusLabel: string;
  playerALabel: string;
  playerBLabel: string;
  playerAFrames: number;
  playerBFrames: number;
  winnerSide: 'A' | 'B' | null;
};

type KnockoutShareRound = {
  label: string;
  total: number;
  completedCount: number;
  items: KnockoutShareMatch[];
};

type KnockoutShareSummaryCard = {
  label: string;
  value: string;
  detail: string;
};

type DownloadLeagueStandingsShareCardArgs = {
  title: string;
  venueName?: string;
  venueLogoUrl?: string;
  dimensionLabel: string;
  pointsRuleLabel: string;
  rows: LeagueShareRow[];
};

type DownloadKnockoutBracketShareCardArgs = {
  title: string;
  venueName?: string;
  venueLogoUrl?: string;
  focusLabel: string;
  rounds: KnockoutShareRound[];
  summaryCards?: KnockoutShareSummaryCard[];
};

type SharePalette = {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  accent: string;
  accentSoft: string;
  panel: string;
  panelStroke: string;
  textMain: string;
  textMuted: string;
  textSoft: string;
};

const LEAGUE_CARD_WIDTH = 1080;
const LEAGUE_CARD_HEIGHT = 1350;
const KNOCKOUT_CARD_WIDTH = 1920;
const KNOCKOUT_CARD_HEIGHT = 1080;
const PREVIEW_PIXEL_RATIO = 2;
const DOWNLOAD_PIXEL_RATIO = 3;
const LARGE_KNOCKOUT_FIRST_ROUND_MATCH_THRESHOLD = 32;
const LARGE_KNOCKOUT_GROUP_MATCH_LIMIT = 8;
const LARGE_KNOCKOUT_OVERVIEW_ROUNDS = 4;

type PlannedKnockoutShareCard = {
  fileLabel?: string;
  focusLabel: string;
  rounds: KnockoutShareRound[];
  summaryCards: KnockoutShareSummaryCard[];
};

export type KnockoutShareCardPreviewItem = {
  fileLabel?: string;
  focusLabel: string;
  imageUrl: string;
};

function safeFilePart(raw: any) {
  const s = String(raw || '').trim();
  return s.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'share-card';
}

function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle: string | CanvasGradient,
  strokeStyle?: string,
  lineWidth = 1,
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    font: string;
    color: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    maxWidth?: number;
  },
) {
  ctx.save();
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align || 'left';
  ctx.textBaseline = options.baseline || 'alphabetic';
  if (options.maxWidth) ctx.fillText(text, x, y, options.maxWidth);
  else ctx.fillText(text, x, y);
  ctx.restore();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const raw = String(text || '').trim() || '-';
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let out = raw;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function resolveFittedFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  {
    maxFontSize,
    minFontSize,
    weight,
  }: {
    maxFontSize: number;
    minFontSize: number;
    weight: number | string;
  },
) {
  const safeText = String(text || '').trim() || '-';
  let size = maxFontSize;
  while (size > minFontSize) {
    ctx.font = `${weight} ${size}px Arial, "Microsoft JhengHei", sans-serif`;
    if (ctx.measureText(safeText).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawAdaptiveText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    maxWidth: number;
    maxFontSize: number;
    minFontSize: number;
    weight?: number | string;
    color: string;
    align?: CanvasTextAlign;
  },
) {
  const weight = options.weight || 700;
  const size = resolveFittedFontSize(ctx, text, options.maxWidth, {
    maxFontSize: options.maxFontSize,
    minFontSize: options.minFontSize,
    weight,
  });
  ctx.save();
  ctx.font = `${weight} ${size}px Arial, "Microsoft JhengHei", sans-serif`;
  const fitted = ellipsize(ctx, text, options.maxWidth);
  drawText(ctx, fitted, x, y, {
    font: `${weight} ${size}px Arial, "Microsoft JhengHei", sans-serif`,
    color: options.color,
    align: options.align,
    maxWidth: options.maxWidth,
  });
  ctx.restore();
  return size;
}

function createCanvasCard(pixelRatio = 1, width = LEAGUE_CARD_WIDTH, height = LEAGUE_CARD_HEIGHT) {
  const canvas = document.createElement('canvas');
  const safePixelRatio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  canvas.width = Math.round(width * safePixelRatio);
  canvas.height = Math.round(height * safePixelRatio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(safePixelRatio, safePixelRatio);
  return { canvas, ctx };
}

function formatShareTimestamp() {
  return new Date().toLocaleString('zh-HK', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function loadCanvasImage(src: string | undefined | null): Promise<HTMLImageElement | null> {
  const url = String(src || '').trim();
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 0.24) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  glow.addColorStop(0, hexToRgba(color, alpha));
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  color = 'rgba(255,255,255,0.045)',
  width = LEAGUE_CARD_WIDTH,
  height = LEAGUE_CARD_HEIGHT,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  palette: SharePalette,
  width = LEAGUE_CARD_WIDTH,
  height = LEAGUE_CARD_HEIGHT,
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.topLeft);
  gradient.addColorStop(0.33, palette.topRight);
  gradient.addColorStop(0.72, palette.bottomLeft);
  gradient.addColorStop(1, palette.bottomRight);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGridOverlay(ctx, 'rgba(255,255,255,0.045)', width, height);
  drawOrb(ctx, 170, 160, 340, palette.accent);
  drawOrb(ctx, width - 140, 220, 280, palette.accent, 0.18);
  drawOrb(ctx, Math.max(420, Math.floor(width * 0.72)), height - 230, 420, palette.accent, 0.12);
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, palette: SharePalette) {
  ctx.save();
  ctx.font = '600 18px Arial, "Microsoft JhengHei", sans-serif';
  const label = String(text || '').trim();
  const width = Math.max(116, ctx.measureText(label).width + 32);
  fillRoundedRect(ctx, x, y, width, 40, 20, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.16)');
  drawText(ctx, label, x + 16, y + 25, {
    font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMain,
  });
  ctx.restore();
  return width;
}

function drawMetaRow(
  ctx: CanvasRenderingContext2D,
  chips: string[],
  palette: SharePalette,
  startY: number,
  {
    startX = 78,
    wrapRight = 920,
  }: {
    startX?: number;
    wrapRight?: number;
  } = {},
) {
  let cursorX = startX;
  let cursorY = startY;
  chips.forEach((chip) => {
    const width = drawChip(ctx, cursorX, cursorY, chip, palette);
    cursorX += width + 10;
    if (cursorX > wrapRight) {
      cursorX = startX;
      cursorY += 50;
    }
  });
  return cursorY + 40;
}

function drawSnookerhkLiveLogo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  fillRoundedRect(ctx, x, y, 146, 146, 28, '#FF140A', 'rgba(255,255,255,0.18)');
  fillRoundedRect(ctx, x + 9, y + 55, 128, 38, 2, '#F3F4F6');

  drawText(ctx, 'HONG', x + 73, y + 31, {
    font: '900 17px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    align: 'center',
  });
  drawText(ctx, 'KONG', x + 73, y + 52, {
    font: '900 17px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    align: 'center',
  });
  drawText(ctx, 'Snooker', x + 73, y + 85, {
    font: '900 italic 22px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FF140A',
    align: 'center',
  });
  drawText(ctx, 'LIVE', x + 73, y + 131, {
    font: '900 42px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    align: 'center',
  });
}

function drawVenueIdentity(
  ctx: CanvasRenderingContext2D,
  venueName: string,
  x: number,
  y: number,
  maxWidth: number,
  venueLogoImage?: HTMLImageElement | null,
) {
  const label = String(venueName || 'Snookerhk.live').trim() || 'Snookerhk.live';
  let textX = x;
  let textWidth = maxWidth;
  const avatarSize = 36;
  const avatarRadius = avatarSize / 2;

  if (venueLogoImage) {
    fillRoundedRect(ctx, x - 4, y - 32, Math.min(maxWidth, 340), 48, 24, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + avatarRadius + 6, y - 8, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(venueLogoImage, x + 6, y - 26, avatarSize, avatarSize);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + avatarRadius + 6, y - 8, avatarRadius + 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    textX = x + 56;
    textWidth = Math.max(80, maxWidth - 56);
  }

  drawText(ctx, label, textX, y, {
    font: '600 23px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8E5F4',
    maxWidth: textWidth,
  });
}

function drawTopBanner(
  ctx: CanvasRenderingContext2D,
  {
    title,
    subtitle,
    venueLogoImage,
    palette,
    eyebrow,
    chips,
    layout,
  }: {
    title: string;
    subtitle: string;
    venueLogoImage?: HTMLImageElement | null;
    palette: SharePalette;
    eyebrow: string;
    chips: string[];
    layout?: {
      panelX?: number;
      panelY?: number;
      panelWidth?: number;
      panelHeight?: number;
      leftX?: number;
      eyebrowY?: number;
      titleY?: number;
      titleMaxWidth?: number;
      venueX?: number;
      subtitleY?: number;
      subtitleMaxWidth?: number;
      logoX?: number;
      logoY?: number;
      metaStartY?: number;
      metaWrapRight?: number;
    };
  },
) {
  const panelX = layout?.panelX ?? 48;
  const panelY = layout?.panelY ?? 42;
  const panelWidth = layout?.panelWidth ?? 984;
  const panelHeight = layout?.panelHeight ?? 222;
  const leftX = layout?.leftX ?? 78;
  const eyebrowY = layout?.eyebrowY ?? 84;
  const titleY = layout?.titleY ?? 138;
  const titleMaxWidth = layout?.titleMaxWidth ?? 706;
  const venueX = layout?.venueX ?? leftX;
  const subtitleY = layout?.subtitleY ?? 178;
  const subtitleMaxWidth = layout?.subtitleMaxWidth ?? titleMaxWidth;
  const logoX = layout?.logoX ?? 866;
  const logoY = layout?.logoY ?? 60;
  const metaStartY = layout?.metaStartY ?? 204;
  const metaWrapRight = layout?.metaWrapRight ?? 920;

  fillRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 34, 'rgba(9,12,25,0.30)', 'rgba(255,255,255,0.1)');
  drawText(ctx, eyebrow, leftX, eyebrowY, {
    font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.accent,
  });
  drawAdaptiveText(ctx, title, leftX, titleY, {
    maxWidth: titleMaxWidth,
    maxFontSize: 52,
    minFontSize: 34,
    color: palette.textMain,
    weight: 700,
  });
  drawVenueIdentity(ctx, subtitle, venueX, subtitleY, subtitleMaxWidth, venueLogoImage);
  drawSnookerhkLiveLogo(ctx, logoX, logoY);
  return drawMetaRow(ctx, chips, palette, metaStartY, {
    startX: leftX,
    wrapRight: metaWrapRight,
  });
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, subtitle: string, x: number, y: number, palette: SharePalette) {
  drawText(ctx, title, x, y, {
    font: '700 28px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMain,
  });
  drawText(ctx, subtitle, x, y + 28, {
    font: '400 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  palette: SharePalette,
  leftLabel: string,
  {
    width = LEAGUE_CARD_WIDTH,
    height = LEAGUE_CARD_HEIGHT,
    leftX = 78,
    bottomY = height - 54,
  }: {
    width?: number;
    height?: number;
    leftX?: number;
    bottomY?: number;
  } = {},
) {
  drawText(ctx, leftLabel, leftX, bottomY, {
    font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, formatShareTimestamp(), width - 80, bottomY, {
    font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
    align: 'right',
  });
}

function getLeaguePalette(): SharePalette {
  return {
    topLeft: '#08111F',
    topRight: '#12345D',
    bottomLeft: '#09172B',
    bottomRight: '#183C68',
    accent: '#F4C95D',
    accentSoft: '#75D8C4',
    panel: 'rgba(9,14,30,0.46)',
    panelStroke: 'rgba(255,255,255,0.10)',
    textMain: '#FFFFFF',
    textMuted: '#D8E5F4',
    textSoft: '#AFC3DD',
  };
}

function getKnockoutPalette(): SharePalette {
  return {
    topLeft: '#140B24',
    topRight: '#47206D',
    bottomLeft: '#1A102E',
    bottomRight: '#59284F',
    accent: '#F6B73C',
    accentSoft: '#B688FF',
    panel: 'rgba(17,10,28,0.50)',
    panelStroke: 'rgba(255,255,255,0.10)',
    textMain: '#FFFFFF',
    textMuted: '#E7D8F8',
    textSoft: '#C9B0E9',
  };
}

function splitKnockoutBranchItems(items: KnockoutShareMatch[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const midpoint = Math.ceil(safeItems.length / 2);
  return {
    left: safeItems.slice(0, midpoint),
    right: safeItems.slice(midpoint),
  };
}

function buildKnockoutRoundSubset(round: KnockoutShareRound, items: KnockoutShareMatch[]): KnockoutShareRound {
  return {
    label: String(round?.label || '-'),
    total: items.length,
    completedCount: items.filter((item) => String(item?.statusLabel || '').includes('完成')).length,
    items,
  };
}

function getKnockoutLargestRoundTotal(rounds: KnockoutShareRound[]) {
  return rounds.reduce((best, round) => Math.max(best, Number(round?.total || round?.items?.length || 0)), 0);
}

function isLargeKnockoutShareCard(rounds: KnockoutShareRound[]) {
  return getKnockoutLargestRoundTotal(rounds) >= LARGE_KNOCKOUT_FIRST_ROUND_MATCH_THRESHOLD;
}

function getKnockoutGroupLabel(groupIndex: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return alphabet[groupIndex] || `${groupIndex + 1}`;
}

function isAllRoundsFocusLabel(label: string) {
  const normalized = String(label || '').trim();
  return normalized === '全部輪次' || normalized === '金銀杯雙線進級表';
}

function isGroupedKnockoutFocusLabel(label: string) {
  return String(label || '').trim().startsWith('初期分組 ');
}

function isOverviewKnockoutFocusLabel(label: string) {
  return String(label || '').trim() === '後段總覽';
}

function isGoldSilverCupPodiumSummaryCards(cards: KnockoutShareSummaryCard[]) {
  const labels = cards.map((card) => String(card?.label || '').trim());
  return labels.some((label) => label.startsWith('金杯')) && labels.some((label) => label.startsWith('銀杯'));
}

function isGoldCupRoundLabel(label: string) {
  return String(label || '').trim().startsWith('金杯');
}

function isSilverCupRoundLabel(label: string) {
  return String(label || '').trim().startsWith('銀杯');
}

function buildKnockoutShareCardPlan({
  focusLabel,
  rounds,
  summaryCards = [],
}: DownloadKnockoutBracketShareCardArgs): PlannedKnockoutShareCard[] {
  const safeRounds = (Array.isArray(rounds) ? rounds : [])
    .map((round) => ({
      label: String(round?.label || '-'),
      total: Number(round?.total || round?.items?.length || 0),
      completedCount: Number(round?.completedCount || 0),
      items: Array.isArray(round?.items) ? round.items : [],
    }))
    .filter((round) => round.items.length > 0);
  if (safeRounds.length <= 0) return [];

  const normalizedFocusLabel = String(focusLabel || '全部輪次').trim() || '全部輪次';
  const safeSummaryCards = Array.isArray(summaryCards) ? summaryCards.slice(0, 6) : [];

  if (!isAllRoundsFocusLabel(normalizedFocusLabel)) {
    const focusedRounds = safeRounds.filter((round) => round.label === normalizedFocusLabel);
    return [{
      fileLabel: 'focus',
      focusLabel: normalizedFocusLabel,
      rounds: focusedRounds.length > 0 ? focusedRounds : safeRounds,
      summaryCards: safeSummaryCards,
    }];
  }

  if (!isLargeKnockoutShareCard(safeRounds)) {
    return [{
      fileLabel: 'full',
      focusLabel: '全部輪次',
      rounds: safeRounds,
      summaryCards: safeSummaryCards,
    }];
  }

  const overviewRoundCount = Math.min(LARGE_KNOCKOUT_OVERVIEW_ROUNDS, safeRounds.length);
  const overviewRounds = safeRounds.slice(-overviewRoundCount);
  const earlyRounds = safeRounds.slice(0, Math.max(0, safeRounds.length - overviewRoundCount));
  const firstEarlyRoundTotal = Number(earlyRounds[0]?.total || earlyRounds[0]?.items?.length || 0);
  const groupCount = Math.max(2, Math.ceil(firstEarlyRoundTotal / LARGE_KNOCKOUT_GROUP_MATCH_LIMIT));

  const groupedVariants = Array.from({ length: groupCount }, (_, groupIndex) => {
    const groupedRounds = earlyRounds
      .map((round) => {
        const safeItems = Array.isArray(round?.items) ? round.items : [];
        const start = Math.floor((groupIndex * safeItems.length) / groupCount);
        const end = Math.floor(((groupIndex + 1) * safeItems.length) / groupCount);
        return buildKnockoutRoundSubset(round, safeItems.slice(start, end));
      })
      .filter((round) => round.items.length > 0);
    if (groupedRounds.length <= 0) return null;
    const groupLabel = getKnockoutGroupLabel(groupIndex);
    return {
      fileLabel: `group-${groupIndex + 1}`,
      focusLabel: `初期分組 ${groupLabel}`,
      rounds: groupedRounds,
      summaryCards: safeSummaryCards,
    };
  }).filter(Boolean) as PlannedKnockoutShareCard[];

  return [
    ...groupedVariants,
    {
      fileLabel: 'overview',
      focusLabel: '後段總覽',
      rounds: overviewRounds.length > 0 ? overviewRounds : safeRounds,
      summaryCards: safeSummaryCards,
    },
  ];
}

function computeBranchLayout(itemCount: number, areaTop: number, areaHeight: number) {
  if (itemCount <= 0) return { cardHeight: 56, gap: 10, positions: [] as number[] };
  const gap = itemCount >= 6 ? 6 : itemCount >= 4 ? 8 : 12;
  const rawHeight = Math.floor((areaHeight - ((itemCount - 1) * gap)) / itemCount);
  const cardHeight = Math.max(48, Math.min(72, rawHeight));
  const contentHeight = (itemCount * cardHeight) + ((itemCount - 1) * gap);
  const startY = areaTop + Math.max(0, Math.floor((areaHeight - contentHeight) / 2));
  const positions = Array.from({ length: itemCount }, (_, index) => startY + (index * (cardHeight + gap)));
  return { cardHeight, gap, positions };
}

function drawBracketRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, text: string, palette: SharePalette) {
  const gradient = ctx.createLinearGradient(x, y, x + w, y);
  gradient.addColorStop(0, palette.accent);
  gradient.addColorStop(1, palette.accentSoft);
  fillRoundedRect(ctx, x, y, w, 52, 16, gradient);
  drawText(ctx, text, x + (w / 2), y + 33, {
    font: '700 22px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    align: 'center',
  });
}

function drawKnockoutCompactCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  item: KnockoutShareMatch,
  palette: SharePalette,
) {
  const fill = item.winnerSide ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
  const stroke = item.statusLabel === '已完成' ? 'rgba(246,183,60,0.24)' : 'rgba(255,255,255,0.10)';
  const labelFont = height >= 64 ? 14 : 12;
  const scoreFont = height >= 64 ? 16 : 14;
  fillRoundedRect(ctx, x, y, width, height, 16, fill, stroke);
  drawText(ctx, `M${item.matchNo}`, x + 10, y + 16, {
    font: '600 11px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, item.statusLabel, x + width - 10, y + 16, {
    font: '600 10px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
    align: 'right',
  });
  const dividerY = y + Math.floor(height / 2);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, dividerY);
  ctx.lineTo(x + width - 56, dividerY);
  ctx.stroke();
  ctx.restore();
  drawAdaptiveText(ctx, item.playerALabel, x + 10, y + Math.max(30, Math.floor(height * 0.42)), {
    maxWidth: width - 64,
    maxFontSize: labelFont,
    minFontSize: 10,
    color: item.winnerSide === 'A' ? '#F6B73C' : palette.textMain,
    weight: 700,
  });
  drawAdaptiveText(ctx, item.playerBLabel, x + 10, y + Math.max(48, Math.floor(height * 0.78)), {
    maxWidth: width - 64,
    maxFontSize: labelFont,
    minFontSize: 10,
    color: item.winnerSide === 'B' ? '#F6B73C' : palette.textMain,
    weight: 700,
  });
  drawText(ctx, `${item.playerAFrames}:${item.playerBFrames}`, x + width - 10, y + Math.floor(height / 2) + 6, {
    font: `700 ${scoreFont}px Arial, "Microsoft JhengHei", sans-serif`,
    color: palette.textMain,
    align: 'right',
  });
}

function drawBranchConnectors(
  ctx: CanvasRenderingContext2D,
  sourceXs: number[],
  sourceYs: number[],
  sourceCardWidth: number,
  sourceCardHeight: number,
  targetXs: number[],
  targetYs: number[],
  targetCardWidth: number,
  targetCardHeight: number,
  side: 'left' | 'right',
) {
  if (sourceXs.length === 0 || targetXs.length === 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  targetYs.forEach((targetY, targetIndex) => {
    const groupStart = Math.floor((targetIndex * sourceYs.length) / targetYs.length);
    const groupEnd = Math.max(groupStart + 1, Math.floor(((targetIndex + 1) * sourceYs.length) / targetYs.length));
    const group = sourceYs.slice(groupStart, groupEnd);
    if (group.length <= 0) return;
    const targetCenterY = targetY + (targetCardHeight / 2);
    const targetX = side === 'left' ? targetXs[targetIndex] : targetXs[targetIndex] + targetCardWidth;
    const sourceEdgeX = side === 'left' ? sourceXs[groupStart] + sourceCardWidth : sourceXs[groupStart];
    const midX = side === 'left'
      ? sourceEdgeX + Math.max(12, Math.floor((targetX - sourceEdgeX) / 2))
      : sourceEdgeX - Math.max(12, Math.floor((sourceEdgeX - targetX) / 2));
    group.forEach((rowY) => {
      const sourceCenterY = rowY + (sourceCardHeight / 2);
      ctx.beginPath();
      ctx.moveTo(sourceEdgeX, sourceCenterY);
      ctx.lineTo(midX, sourceCenterY);
      ctx.lineTo(midX, targetCenterY);
      ctx.lineTo(targetX, targetCenterY);
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawMirroredKnockoutSection(
  ctx: CanvasRenderingContext2D,
  {
    rounds,
    top,
    height,
    title,
    subtitle,
    palette,
  }: {
    rounds: KnockoutShareRound[];
    top: number;
    height: number;
    title: string;
    subtitle: string;
    palette: SharePalette;
  },
) {
  if (!Array.isArray(rounds) || rounds.length <= 0) return;

  fillRoundedRect(ctx, 84, top, 1752, height, 24, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.08)');
  drawText(ctx, title, 112, top + 26, {
    font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#F6B73C',
  });
  drawText(ctx, subtitle, 112, top + 50, {
    font: '400 12px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
  });

  const branchRounds = rounds.map((round) => ({
    label: round.label,
    total: round.total,
    completedCount: round.completedCount,
    ...splitKnockoutBranchItems(round.items),
  }));
  const branchAreaTop = top + 78;
  const branchAreaHeight = height - 98;
  const innerGap = rounds.length >= 4 ? 220 : 280;
  const branchGap = 18;
  const sideAvailableWidth = Math.floor((1752 - innerGap - ((Math.max(1, rounds.length) - 1) * branchGap * 2)) / 2);
  const branchColumnWidth = Math.max(108, Math.min(164, Math.floor(sideAvailableWidth / Math.max(1, rounds.length))));
  const leftColumnXs = rounds.map((_, index) => 112 + (index * (branchColumnWidth + branchGap)));
  const rightBase = 84 + 1752 - 28;
  const rightColumnXs = rounds.map((_, index) => rightBase - branchColumnWidth - (index * (branchColumnWidth + branchGap)));
  const leftLayouts = branchRounds.map((round) => computeBranchLayout(round.left.length, branchAreaTop, branchAreaHeight));
  const rightLayouts = branchRounds.map((round) => computeBranchLayout(round.right.length, branchAreaTop, branchAreaHeight));

  branchRounds.forEach((round, roundIndex) => {
    const leftX = leftColumnXs[roundIndex];
    const rightX = rightColumnXs[roundIndex];
    const leftLayout = leftLayouts[roundIndex];
    const rightLayout = rightLayouts[roundIndex];

    drawAdaptiveText(ctx, round.label, leftX, top + 68, {
      maxWidth: branchColumnWidth,
      maxFontSize: 15,
      minFontSize: 10,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, `${round.completedCount}/${round.total}`, leftX + branchColumnWidth, top + 68, {
      font: '500 11px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
      align: 'right',
    });
    drawAdaptiveText(ctx, round.label, rightX, top + 68, {
      maxWidth: branchColumnWidth,
      maxFontSize: 15,
      minFontSize: 10,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, `${round.completedCount}/${round.total}`, rightX + branchColumnWidth, top + 68, {
      font: '500 11px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
      align: 'right',
    });

    round.left.forEach((item, itemIndex) => {
      drawKnockoutCompactCard(ctx, leftX, leftLayout.positions[itemIndex] || branchAreaTop, branchColumnWidth, leftLayout.cardHeight, item, palette);
    });
    round.right.forEach((item, itemIndex) => {
      drawKnockoutCompactCard(ctx, rightX, rightLayout.positions[itemIndex] || branchAreaTop, branchColumnWidth, rightLayout.cardHeight, item, palette);
    });

    if (roundIndex < branchRounds.length - 1) {
      drawBranchConnectors(
        ctx,
        Array.from({ length: round.left.length }, () => leftX),
        leftLayout.positions,
        branchColumnWidth,
        leftLayout.cardHeight,
        Array.from({ length: branchRounds[roundIndex + 1].left.length }, () => leftColumnXs[roundIndex + 1]),
        leftLayouts[roundIndex + 1].positions,
        branchColumnWidth,
        leftLayouts[roundIndex + 1].cardHeight,
        'left',
      );
      drawBranchConnectors(
        ctx,
        Array.from({ length: round.right.length }, () => rightX),
        rightLayout.positions,
        branchColumnWidth,
        rightLayout.cardHeight,
        Array.from({ length: branchRounds[roundIndex + 1].right.length }, () => rightColumnXs[roundIndex + 1]),
        rightLayouts[roundIndex + 1].positions,
        branchColumnWidth,
        rightLayouts[roundIndex + 1].cardHeight,
        'right',
      );
    }
  });
}

 async function renderLeagueStandingsShareCardCanvas({
  title,
  venueName,
  venueLogoUrl,
  dimensionLabel,
  pointsRuleLabel,
  rows,
}: DownloadLeagueStandingsShareCardArgs, pixelRatio = 1) {
  const { canvas, ctx } = createCanvasCard(pixelRatio, LEAGUE_CARD_WIDTH, LEAGUE_CARD_HEIGHT);
  const venueLogoImage = await loadCanvasImage(venueLogoUrl);
  const palette = getLeaguePalette();
  const visibleRows = rows.slice(0, 8);
  const leader = rows[0] || null;
  const bestBreak = [...rows].sort((a, b) => b.maxBreak - a.maxBreak || b.breaks20Plus - a.breaks20Plus)[0] || null;
  const bestForm = [...rows].sort((a, b) => b.matchPoints - a.matchPoints || b.frameDiff - a.frameDiff)[0] || null;
  const podium = rows.slice(0, 3);

  drawBackground(ctx, palette, LEAGUE_CARD_WIDTH, LEAGUE_CARD_HEIGHT);
  drawTopBanner(ctx, {
    title: title || '聯賽模式積分榜',
    subtitle: String(venueName || 'Snookerhk.live'),
    venueLogoImage,
    eyebrow: 'LEAGUE MODE POSTER',
    chips: [dimensionLabel || '整個聯賽', `參賽 ${rows.length} 人`, pointsRuleLabel || '勝和負積分規則'],
    palette,
  });

  fillRoundedRect(ctx, 48, 286, 984, 174, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '主視覺摘要', '將榜首、前三與單杆亮點濃縮為可直接對外分享的海報資訊。', 78, 328, palette);

  const heroValue = leader?.label || '-';
  fillRoundedRect(ctx, 78, 362, 330, 72, 24, 'rgba(244,201,93,0.14)', 'rgba(244,201,93,0.28)');
  drawText(ctx, '目前榜首', 100, 390, {
    font: '600 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawAdaptiveText(ctx, heroValue, 100, 422, {
    maxWidth: 286,
    maxFontSize: 30,
    minFontSize: 21,
    color: palette.textMain,
    weight: 700,
  });

  const rightSummaryCards = [
    { title: '榜首積分', value: `${Number(leader?.matchPoints || 0)} 分`, detail: `${Number(leader?.won || 0)} 勝 ${Number(leader?.drawn || 0)} 和 ${Number(leader?.lost || 0)} 負` },
    { title: '最佳局勢', value: bestForm?.label || '-', detail: `局差 ${Number(bestForm?.frameDiff || 0) > 0 ? '+' : ''}${Number(bestForm?.frameDiff || 0)}` },
    { title: '最高 20+', value: bestBreak?.label || '-', detail: `${Number(bestBreak?.maxBreak || 0)} / 20+ ${Number(bestBreak?.breaks20Plus || 0)}` },
  ];
  rightSummaryCards.forEach((card, index) => {
    const x = 432 + (index * 186);
    fillRoundedRect(ctx, x, 360, 170, 76, 22, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)');
    drawText(ctx, card.title, x + 16, 388, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawText(ctx, card.value, x + 16, 414, {
      font: '700 22px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
      maxWidth: 138,
    });
    drawText(ctx, card.detail, x + 16, 435, {
      font: '500 13px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
      maxWidth: 138,
    });
  });

  fillRoundedRect(ctx, 48, 484, 984, 156, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '前三摘要', '讓分享圖首屏先看到 podium 結構，而不是只剩純表格。', 78, 526, palette);
  podium.forEach((row, index) => {
    const x = 78 + (index * 312);
    const heights = [90, 72, 64];
    const y = 626 - heights[index];
    const accent = index === 0 ? 'rgba(244,201,93,0.16)' : index === 1 ? 'rgba(117,216,196,0.16)' : 'rgba(255,255,255,0.08)';
    const stroke = index === 0 ? 'rgba(244,201,93,0.32)' : index === 1 ? 'rgba(117,216,196,0.28)' : 'rgba(255,255,255,0.12)';
    fillRoundedRect(ctx, x, y, 280, heights[index], 22, accent, stroke);
    drawText(ctx, `#${row?.position || index + 1}`, x + 18, y + 26, {
      font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
      color: index === 0 ? '#F4C95D' : palette.textMain,
    });
    drawAdaptiveText(ctx, row?.label || '-', x + 18, y + 54, {
      maxWidth: 220,
      maxFontSize: 24,
      minFontSize: 17,
      color: palette.textMain,
      weight: 700,
    });
    drawText(ctx, `${Number(row?.matchPoints || 0)} 分 · 局差 ${Number(row?.frameDiff || 0) > 0 ? '+' : ''}${Number(row?.frameDiff || 0)}`, x + 18, y + heights[index] - 14, {
      font: '500 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
    });
  });

  fillRoundedRect(ctx, 48, 666, 984, 560, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '聯賽模式積分榜', '以榜單為中心，保留足夠數據密度，同時維持海報感。', 78, 708, palette);

  fillRoundedRect(ctx, 68, 748, 944, 54, 18, 'rgba(255,255,255,0.08)');
  const columns = [
    { label: '名次', x: 84 },
    { label: '球手', x: 180 },
    { label: '勝和負', x: 474 },
    { label: '局差', x: 668 },
    { label: '積分', x: 782 },
    { label: '20+', x: 878 },
    { label: '最高 20+', x: 948 },
  ];
  columns.forEach((column) => {
    drawText(ctx, column.label, column.x, 782, {
      font: '600 17px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
    });
  });

  visibleRows.forEach((row, index) => {
    const y = 816 + (index * 48);
    const fill = index === 0
      ? 'rgba(244,201,93,0.15)'
      : index < 3
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.04)';
    const stroke = index === 0 ? 'rgba(244,201,93,0.30)' : 'rgba(255,255,255,0.08)';
    fillRoundedRect(ctx, 68, y, 944, 40, 16, fill, stroke);
    drawText(ctx, `#${row.position}`, 84, y + 26, {
      font: '700 19px Arial, "Microsoft JhengHei", sans-serif',
      color: index === 0 ? '#F4C95D' : palette.textMain,
    });
    drawAdaptiveText(ctx, row.label, 180, y + 26, {
      maxWidth: 256,
      maxFontSize: 19,
      minFontSize: 14,
      color: palette.textMain,
      weight: 700,
    });
    drawText(ctx, `${row.won}/${row.drawn}/${row.lost}`, 474, y + 26, {
      font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
    });
    drawText(ctx, `${row.frameDiff > 0 ? '+' : ''}${row.frameDiff}`, 668, y + 26, {
      font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
      color: row.frameDiff >= 0 ? '#75D8C4' : '#F6A5B2',
    });
    drawText(ctx, String(row.matchPoints), 782, y + 26, {
      font: '700 19px Arial, "Microsoft JhengHei", sans-serif',
      color: '#F4C95D',
    });
    drawText(ctx, String(row.breaks20Plus), 882, y + 26, {
      font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
    });
    drawText(ctx, String(row.maxBreak), 958, y + 26, {
      font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
    });
  });

  drawFooter(ctx, palette, '聯賽模式海報版分享圖 · Snookerhk.live');
  return canvas;
}

export function buildLeagueStandingsShareCardDataUrl(args: DownloadLeagueStandingsShareCardArgs) {
  return renderLeagueStandingsShareCardCanvas(args, PREVIEW_PIXEL_RATIO).then((canvas) => canvas.toDataURL('image/png'));
}

export function downloadLeagueStandingsShareCard(args: DownloadLeagueStandingsShareCardArgs) {
  return renderLeagueStandingsShareCardCanvas(args, DOWNLOAD_PIXEL_RATIO)
    .then((canvas) => triggerCanvasDownload(canvas, `${safeFilePart(args.title || 'league-standings')}-share-card.png`));
}

async function renderKnockoutBracketShareCardCanvas({
  title,
  venueName,
  venueLogoUrl,
  focusLabel,
  rounds,
  summaryCards = [],
}: DownloadKnockoutBracketShareCardArgs, pixelRatio = 1) {
  const { canvas, ctx } = createCanvasCard(pixelRatio, KNOCKOUT_CARD_WIDTH, KNOCKOUT_CARD_HEIGHT);
  const venueLogoImage = await loadCanvasImage(venueLogoUrl);
  const palette = getKnockoutPalette();
  const finalRound = rounds[rounds.length - 1] || null;
  const finalMatch = finalRound?.items?.[0] || null;
  const isChampionshipView = Number(finalRound?.total || finalRound?.items?.length || 0) <= 1 || String(finalRound?.label || '').includes('決賽');
  const shouldRenderSingleRoundAsBranches = rounds.length === 1 && Number(finalRound?.total || finalRound?.items?.length || 0) > 1;
  const championLabel = finalMatch
    ? finalMatch.winnerSide === 'A'
      ? finalMatch.playerALabel
      : finalMatch.winnerSide === 'B'
        ? finalMatch.playerBLabel
        : '-'
    : '-';
  const runnerUpLabel = finalMatch
    ? finalMatch.winnerSide === 'A'
      ? finalMatch.playerBLabel
      : finalMatch.winnerSide === 'B'
        ? finalMatch.playerALabel
        : '-'
    : '-';
  const totalMatches = rounds.reduce((sum, round) => sum + Number(round?.total || 0), 0);
  const completedMatches = rounds.reduce((sum, round) => sum + Number(round?.completedCount || 0), 0);
  const preFinalRounds = shouldRenderSingleRoundAsBranches ? rounds : rounds.slice(0, -1);
  const branchRounds = preFinalRounds.map((round) => ({
    label: round.label,
    total: round.total,
    completedCount: round.completedCount,
    ...splitKnockoutBranchItems(round.items),
  }));
  const centerSummaryCards = summaryCards.slice(0, 6);
  const isGroupedPoster = isGroupedKnockoutFocusLabel(focusLabel);
  const isOverviewPoster = isOverviewKnockoutFocusLabel(focusLabel);
  const isGoldSilverCupOverviewPoster = isOverviewPoster && isGoldSilverCupPodiumSummaryCards(centerSummaryCards);
  const goldCupRounds = rounds.filter((round) => isGoldCupRoundLabel(round.label));
  const silverCupRounds = rounds.filter((round) => isSilverCupRoundLabel(round.label));
  const shouldRenderDualCupSections = (isGroupedPoster || isOverviewPoster) && goldCupRounds.length > 0 && silverCupRounds.length > 0;
  const shouldRenderCenterStageCard = !isGroupedPoster;

  drawBackground(ctx, palette, KNOCKOUT_CARD_WIDTH, KNOCKOUT_CARD_HEIGHT);
  drawTopBanner(ctx, {
    title: title || '淘汰賽模式進級表',
    subtitle: String(venueName || 'Snookerhk.live'),
    venueLogoImage,
    eyebrow: 'KNOCKOUT MODE POSTER',
    chips: [focusLabel || '全部輪次', `共 ${rounds.length} 輪`, `完成 ${completedMatches}/${totalMatches} 場`],
    palette,
    layout: {
      panelX: 48,
      panelY: 36,
      panelWidth: 1824,
      panelHeight: 196,
      leftX: 84,
      eyebrowY: 76,
      titleY: 126,
      titleMaxWidth: 620,
      venueX: 760,
      subtitleY: 126,
      subtitleMaxWidth: 720,
      logoX: 1690,
      logoY: 48,
      metaStartY: 174,
      metaWrapRight: 1570,
    },
  });

  fillRoundedRect(ctx, 48, 252, 1824, 744, 34, palette.panel, palette.panelStroke);
  drawBracketRibbon(ctx, 760, 284, 400, focusLabel === '全部輪次' ? '淘汰賽模式進級表' : String(focusLabel || '淘汰賽模式進級表'), palette);
  drawText(ctx, '改用橫版版心，保留 bracket 橫向展開空間，讓 16 人以上淘汰賽更接近真實賽會海報閱讀方式。', 960, 356, {
    font: '400 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
    align: 'center',
  });

  const branchAreaTop = 404;
  const branchAreaHeight = 278;
  const innerGap = 360;
  const branchGap = 24;
  const sideAvailableWidth = Math.floor((1824 - innerGap - ((Math.max(1, preFinalRounds.length) - 1) * branchGap * 2)) / 2);
  const branchColumnWidth = Math.max(118, Math.min(188, Math.floor(sideAvailableWidth / Math.max(1, preFinalRounds.length))));
  const leftColumnXs = preFinalRounds.map((_, index) => 88 + (index * (branchColumnWidth + branchGap)));
  const rightBase = 48 + 1824 - 88;
  const rightColumnXs = preFinalRounds.map((_, index) => rightBase - branchColumnWidth - (index * (branchColumnWidth + branchGap)));
  const centerCardWidth = 300;
  const centerCardHeight = 110;
  const centerCardX = Math.floor((KNOCKOUT_CARD_WIDTH - centerCardWidth) / 2);
  const centerCardY = 482;

  if (shouldRenderDualCupSections) {
    drawMirroredKnockoutSection(ctx, {
      rounds: goldCupRounds,
      top: 388,
      height: 182,
      title: isGroupedPoster ? '金杯分組路線' : '金杯後段總覽',
      subtitle: isGroupedPoster ? '金杯主線按分組拆開顯示，避免 64+ 場次重疊。' : '後段總覽集中顯示金杯主線、季軍戰與決賽相關輪次。',
      palette,
    });
    drawMirroredKnockoutSection(ctx, {
      rounds: silverCupRounds,
      top: 584,
      height: 182,
      title: isGroupedPoster ? '銀杯分組路線' : '銀杯後段總覽',
      subtitle: isGroupedPoster ? '銀杯獨立成區塊展示，不再與金杯共用同一條中心軸。' : '銀杯後段與 podium 分開整理，方便清楚閱讀雙盃結果。',
      palette,
    });
  } else if (preFinalRounds.length === 0 && !finalMatch) {
    drawText(ctx, '尚未生成可分享的進級表內容。', 960, 600, {
      font: '600 28px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
      align: 'center',
    });
  } else {
    const leftLayouts = branchRounds.map((round) => computeBranchLayout(round.left.length, branchAreaTop, branchAreaHeight));
    const rightLayouts = branchRounds.map((round) => computeBranchLayout(round.right.length, branchAreaTop, branchAreaHeight));

    branchRounds.forEach((round, roundIndex) => {
      const leftX = leftColumnXs[roundIndex];
      const rightX = rightColumnXs[roundIndex];
      const leftLayout = leftLayouts[roundIndex];
      const rightLayout = rightLayouts[roundIndex];

      drawAdaptiveText(ctx, round.label, leftX, branchAreaTop - 16, {
        maxWidth: branchColumnWidth,
        maxFontSize: 17,
        minFontSize: 11,
        color: '#F6B73C',
        weight: 700,
      });
      drawText(ctx, `${round.completedCount}/${round.total}`, leftX + branchColumnWidth, branchAreaTop - 16, {
        font: '500 13px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textMuted,
        align: 'right',
      });
      drawAdaptiveText(ctx, round.label, rightX, branchAreaTop - 16, {
        maxWidth: branchColumnWidth,
        maxFontSize: 17,
        minFontSize: 11,
        color: '#F6B73C',
        weight: 700,
      });
      drawText(ctx, `${round.completedCount}/${round.total}`, rightX + branchColumnWidth, branchAreaTop - 16, {
        font: '500 13px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textMuted,
        align: 'right',
      });

      round.left.forEach((item, itemIndex) => {
        drawKnockoutCompactCard(ctx, leftX, leftLayout.positions[itemIndex] || branchAreaTop, branchColumnWidth, leftLayout.cardHeight, item, palette);
      });
      round.right.forEach((item, itemIndex) => {
        drawKnockoutCompactCard(ctx, rightX, rightLayout.positions[itemIndex] || branchAreaTop, branchColumnWidth, rightLayout.cardHeight, item, palette);
      });

      if (roundIndex < branchRounds.length - 1) {
        drawBranchConnectors(
          ctx,
          Array.from({ length: round.left.length }, () => leftX),
          leftLayout.positions,
          branchColumnWidth,
          leftLayout.cardHeight,
          Array.from({ length: branchRounds[roundIndex + 1].left.length }, () => leftColumnXs[roundIndex + 1]),
          leftLayouts[roundIndex + 1].positions,
          branchColumnWidth,
          leftLayouts[roundIndex + 1].cardHeight,
          'left',
        );
        drawBranchConnectors(
          ctx,
          Array.from({ length: round.right.length }, () => rightX),
          rightLayout.positions,
          branchColumnWidth,
          rightLayout.cardHeight,
          Array.from({ length: branchRounds[roundIndex + 1].right.length }, () => rightColumnXs[roundIndex + 1]),
          rightLayouts[roundIndex + 1].positions,
          branchColumnWidth,
          rightLayouts[roundIndex + 1].cardHeight,
          'right',
        );
      }
    });

    if (shouldRenderCenterStageCard) {
      fillRoundedRect(ctx, centerCardX, centerCardY, centerCardWidth, centerCardHeight, 24, 'rgba(255,255,255,0.08)', 'rgba(246,183,60,0.24)', 1.5);
      drawText(ctx, finalRound?.label || (shouldRenderSingleRoundAsBranches ? '焦點輪次' : '決賽'), centerCardX + (centerCardWidth / 2), centerCardY + 24, {
        font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textSoft,
        align: 'center',
      });
      if (isChampionshipView && !shouldRenderSingleRoundAsBranches) {
        drawText(ctx, finalMatch ? `${finalMatch.playerAFrames} : ${finalMatch.playerBFrames}` : '-', centerCardX + (centerCardWidth / 2), centerCardY + 56, {
          font: '700 38px Arial, "Microsoft JhengHei", sans-serif',
          color: '#F6B73C',
          align: 'center',
        });
        drawAdaptiveText(ctx, finalMatch ? `${finalMatch.playerALabel} vs ${finalMatch.playerBLabel}` : '尚未形成決賽對戰', centerCardX + 20, centerCardY + 96, {
          maxWidth: centerCardWidth - 40,
          maxFontSize: 14,
          minFontSize: 10,
          color: palette.textMuted,
          weight: 500,
          align: 'center',
        });
      } else {
        drawText(ctx, `${completedMatches}/${Math.max(1, totalMatches)}`, centerCardX + (centerCardWidth / 2), centerCardY + 56, {
          font: '700 34px Arial, "Microsoft JhengHei", sans-serif',
          color: '#F6B73C',
          align: 'center',
        });
        drawAdaptiveText(ctx, shouldRenderSingleRoundAsBranches ? '本張海報聚焦單一輪次對局' : '初期分組與後段總覽會分開輸出', centerCardX + 20, centerCardY + 96, {
          maxWidth: centerCardWidth - 40,
          maxFontSize: 13,
          minFontSize: 10,
          color: palette.textMuted,
          weight: 500,
          align: 'center',
        });
      }
    }

    if (branchRounds.length > 0 && shouldRenderCenterStageCard) {
      const lastLeftLayout = leftLayouts[leftLayouts.length - 1];
      const lastRightLayout = rightLayouts[rightLayouts.length - 1];
      const lastLeftX = leftColumnXs[leftColumnXs.length - 1];
      const lastRightX = rightColumnXs[rightColumnXs.length - 1];
      drawBranchConnectors(
        ctx,
        Array.from({ length: branchRounds[branchRounds.length - 1].left.length }, () => lastLeftX),
        lastLeftLayout.positions,
        branchColumnWidth,
        lastLeftLayout.cardHeight,
        [centerCardX],
        [centerCardY],
        centerCardWidth,
        centerCardHeight,
        'left',
      );
      drawBranchConnectors(
        ctx,
        Array.from({ length: branchRounds[branchRounds.length - 1].right.length }, () => lastRightX),
        lastRightLayout.positions,
        branchColumnWidth,
        lastRightLayout.cardHeight,
        [centerCardX],
        [centerCardY],
        centerCardWidth,
        centerCardHeight,
        'right',
      );
    }
  }

  if (shouldRenderDualCupSections && centerSummaryCards.length > 3) {
    fillRoundedRect(ctx, 520, 782, 880, 96, 24, 'rgba(246,183,60,0.10)', 'rgba(246,183,60,0.22)');
    drawText(ctx, '金杯三甲', 560, 816, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, centerSummaryCards.slice(0, 3).map((card) => `${card.detail} ${card.value}`).join('  ·  '), 560, 852, {
      maxWidth: 360,
      maxFontSize: 18,
      minFontSize: 10,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, '銀杯三甲', 1010, 816, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, centerSummaryCards.slice(3, 6).map((card) => `${card.detail} ${card.value}`).join('  ·  '), 1010, 852, {
      maxWidth: 340,
      maxFontSize: 18,
      minFontSize: 10,
      color: palette.textMain,
      weight: 700,
    });
  } else if (isGoldSilverCupOverviewPoster) {
    fillRoundedRect(ctx, 520, 714, 880, 96, 24, 'rgba(246,183,60,0.10)', 'rgba(246,183,60,0.22)');
    drawText(ctx, '金杯三甲', 560, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, centerSummaryCards.slice(0, 3).map((card) => `${card.detail} ${card.value}`).join('  ·  '), 560, 784, {
      maxWidth: 360,
      maxFontSize: 18,
      minFontSize: 10,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, '銀杯三甲', 1010, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, centerSummaryCards.slice(3, 6).map((card) => `${card.detail} ${card.value}`).join('  ·  '), 1010, 784, {
      maxWidth: 340,
      maxFontSize: 18,
      minFontSize: 10,
      color: palette.textMain,
      weight: 700,
    });
  } else {
    fillRoundedRect(ctx, 650, 714, 620, 92, 24, 'rgba(246,183,60,0.10)', 'rgba(246,183,60,0.22)');
  }
  if (!isGoldSilverCupOverviewPoster && isChampionshipView && !shouldRenderSingleRoundAsBranches) {
    drawText(ctx, '冠軍', 690, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, championLabel, 690, 784, {
      maxWidth: 240,
      maxFontSize: 26,
      minFontSize: 14,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, '亞軍', 1010, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, runnerUpLabel, 1010, 784, {
      maxWidth: 220,
      maxFontSize: 26,
      minFontSize: 14,
      color: palette.textMain,
      weight: 700,
    });
  } else if (!isGoldSilverCupOverviewPoster) {
    drawText(ctx, '焦點輪次', 690, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, finalRound?.label || focusLabel || '全部輪次', 690, 784, {
      maxWidth: 240,
      maxFontSize: 24,
      minFontSize: 13,
      color: '#F6B73C',
      weight: 700,
    });
    drawText(ctx, '尚餘對局', 1010, 748, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, `${Math.max(0, totalMatches - completedMatches)} 場`, 1010, 784, {
      maxWidth: 200,
      maxFontSize: 26,
      minFontSize: 14,
      color: palette.textMain,
      weight: 700,
    });
  }

  const summarySectionY = shouldRenderDualCupSections ? 888 : (isGoldSilverCupOverviewPoster ? 826 : 832);
  const summarySectionHeight = centerSummaryCards.length > 3 ? 154 : 126;
  fillRoundedRect(ctx, 458, summarySectionY, 1004, summarySectionHeight, 28, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)');
  drawSectionTitle(ctx, '賽事摘要', centerSummaryCards.length > 3 ? '後段總覽補上金杯與銀杯 podium，避免只見主線而看不到雙盃名次。' : '底部改為橫向摘要列，讓橫版海報同時保留 bracket 與關鍵數據。', 490, summarySectionY + 40, palette);
  if (centerSummaryCards.length > 3) {
    centerSummaryCards.slice(0, 6).forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 490 + (col * 320);
      const y = summarySectionY + 66 + (row * 48);
      fillRoundedRect(ctx, x, y, 292, 38, 16, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');
      drawText(ctx, card.label, x + 16, y + 24, {
        font: '600 13px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textSoft,
      });
      drawAdaptiveText(ctx, card.value, x + 276, y + 24, {
        maxWidth: 170,
        maxFontSize: 13,
        minFontSize: 10,
        color: row === 0 ? '#F6B73C' : palette.textMain,
        weight: 700,
        align: 'right',
      });
    });
  } else {
    centerSummaryCards.forEach((card, index) => {
      const x = 490 + (index * 320);
      const y = summarySectionY + 66;
      fillRoundedRect(ctx, x, y, 292, 42, 16, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');
      drawText(ctx, card.label, x + 16, y + 26, {
        font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textSoft,
      });
      drawAdaptiveText(ctx, card.value, x + 110, y + 26, {
        maxWidth: 84,
        maxFontSize: 16,
        minFontSize: 12,
        color: '#F6B73C',
        weight: 700,
      });
      drawAdaptiveText(ctx, card.detail, x + 276, y + 26, {
        maxWidth: 118,
        maxFontSize: 12,
        minFontSize: 10,
        color: palette.textMuted,
        weight: 500,
        align: 'right',
      });
    });
  }

  drawFooter(ctx, palette, '淘汰賽模式海報版分享圖 · Snookerhk.live', {
    width: KNOCKOUT_CARD_WIDTH,
    height: KNOCKOUT_CARD_HEIGHT,
    leftX: 84,
    bottomY: 1038,
  });
  return canvas;
}

export function buildKnockoutBracketShareCardDataUrl(args: DownloadKnockoutBracketShareCardArgs) {
  return buildKnockoutBracketShareCardPreviewItems(args).then((items) => items[items.length - 1]?.imageUrl || '');
}

export function buildKnockoutBracketShareCardPreviewItems(args: DownloadKnockoutBracketShareCardArgs): Promise<KnockoutShareCardPreviewItem[]> {
  const variants = buildKnockoutShareCardPlan(args);
  if (variants.length <= 0) return Promise.resolve([]);
  return Promise.all(variants.map((variant) => (
    renderKnockoutBracketShareCardCanvas({
      ...args,
      focusLabel: variant.focusLabel,
      rounds: variant.rounds,
      summaryCards: variant.summaryCards,
    }, PREVIEW_PIXEL_RATIO).then((canvas) => ({
      fileLabel: variant.fileLabel,
      focusLabel: variant.focusLabel,
      imageUrl: canvas.toDataURL('image/png'),
    }))
  )));
}

export function downloadKnockoutBracketShareCard(args: DownloadKnockoutBracketShareCardArgs) {
  const variants = buildKnockoutShareCardPlan(args);
  if (variants.length <= 0) return Promise.resolve();
  return variants.reduce((promise, variant, index) => promise.then(() => (
    renderKnockoutBracketShareCardCanvas({
      ...args,
      focusLabel: variant.focusLabel,
      rounds: variant.rounds,
      summaryCards: variant.summaryCards,
    }, DOWNLOAD_PIXEL_RATIO).then((canvas) => {
      const suffix = variants.length > 1 ? `-${variant.fileLabel || `part-${index + 1}`}` : '';
      triggerCanvasDownload(canvas, `${safeFilePart(args.title || 'knockout-bracket')}${suffix}-share-card.png`);
    })
  )), Promise.resolve());
}
