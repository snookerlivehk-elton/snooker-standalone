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
  dimensionLabel: string;
  pointsRuleLabel: string;
  rows: LeagueShareRow[];
};

type DownloadKnockoutBracketShareCardArgs = {
  title: string;
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

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

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

function createCanvasCard() {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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

function hexToRgba(hex: string, alpha: number) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getMonogram(text: string) {
  const cleaned = String(text || '')
    .replace(/[^\w\u4e00-\u9fff]+/g, ' ')
    .trim();
  if (!cleaned) return 'SB';
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
  const first = tokens[0];
  const chars = Array.from(first);
  return chars.slice(0, Math.min(2, chars.length)).join('').toUpperCase();
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 0.24) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  glow.addColorStop(0, hexToRgba(color, alpha));
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawGridOverlay(ctx: CanvasRenderingContext2D, color = 'rgba(255,255,255,0.045)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, palette: SharePalette) {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, palette.topLeft);
  gradient.addColorStop(0.33, palette.topRight);
  gradient.addColorStop(0.72, palette.bottomLeft);
  gradient.addColorStop(1, palette.bottomRight);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawGridOverlay(ctx);
  drawOrb(ctx, 170, 160, 340, palette.accent);
  drawOrb(ctx, 940, 220, 280, palette.accent, 0.18);
  drawOrb(ctx, 760, 1120, 420, palette.accent, 0.12);
}

function drawBrandBadge(ctx: CanvasRenderingContext2D, x: number, y: number, monogram: string, palette: SharePalette) {
  const outer = ctx.createLinearGradient(x - 44, y - 44, x + 44, y + 44);
  outer.addColorStop(0, `${palette.accent}`);
  outer.addColorStop(1, `${palette.accentSoft}`);
  fillRoundedRect(ctx, x - 44, y - 44, 88, 88, 28, outer);
  fillRoundedRect(ctx, x - 38, y - 38, 76, 76, 24, 'rgba(8,12,26,0.72)', 'rgba(255,255,255,0.12)');
  drawText(ctx, monogram, x, y + 10, {
    font: '700 30px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    align: 'center',
  });
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

function drawMetaRow(ctx: CanvasRenderingContext2D, chips: string[], palette: SharePalette, startY: number) {
  let cursorX = 78;
  let cursorY = startY;
  chips.forEach((chip) => {
    const width = drawChip(ctx, cursorX, cursorY, chip, palette);
    cursorX += width + 10;
    if (cursorX > 920) {
      cursorX = 78;
      cursorY += 50;
    }
  });
  return cursorY + 40;
}

function drawTopBanner(
  ctx: CanvasRenderingContext2D,
  {
    title,
    subtitle,
    palette,
    eyebrow,
    chips,
  }: {
    title: string;
    subtitle: string;
    palette: SharePalette;
    eyebrow: string;
    chips: string[];
  },
) {
  fillRoundedRect(ctx, 48, 42, 984, 222, 34, 'rgba(9,12,25,0.30)', 'rgba(255,255,255,0.1)');
  drawText(ctx, eyebrow, 78, 84, {
    font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.accent,
  });
  drawAdaptiveText(ctx, title, 78, 138, {
    maxWidth: 760,
    maxFontSize: 52,
    minFontSize: 34,
    color: palette.textMain,
    weight: 700,
  });
  drawText(ctx, subtitle, 78, 178, {
    font: '400 22px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
    maxWidth: 760,
  });
  drawText(ctx, '更新時間', 834, 96, {
    font: '600 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, formatShareTimestamp(), 834, 126, {
    font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMain,
  });
  drawText(ctx, '官方分享版', 834, 158, {
    font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
  });
  drawBrandBadge(ctx, 950, 170, getMonogram(title), palette);
  return drawMetaRow(ctx, chips, palette, 204);
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

function drawFooter(ctx: CanvasRenderingContext2D, palette: SharePalette, leftLabel: string) {
  drawText(ctx, leftLabel, 78, 1296, {
    font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, formatShareTimestamp(), 1000, 1296, {
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

function renderLeagueStandingsShareCardCanvas({
  title,
  dimensionLabel,
  pointsRuleLabel,
  rows,
}: DownloadLeagueStandingsShareCardArgs) {
  const { canvas, ctx } = createCanvasCard();
  const palette = getLeaguePalette();
  const visibleRows = rows.slice(0, 8);
  const leader = rows[0] || null;
  const bestBreak = [...rows].sort((a, b) => b.maxBreak - a.maxBreak || b.breaks20Plus - a.breaks20Plus)[0] || null;
  const bestForm = [...rows].sort((a, b) => b.matchPoints - a.matchPoints || b.frameDiff - a.frameDiff)[0] || null;
  const podium = rows.slice(0, 3);

  drawBackground(ctx, palette);
  drawTopBanner(ctx, {
    title: title || '聯賽模式積分榜',
    subtitle: '聯賽模式海報版分享圖',
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

  drawFooter(ctx, palette, '聯賽模式海報版分享圖 · CueAim Snooker');
  return canvas;
}

export function buildLeagueStandingsShareCardDataUrl(args: DownloadLeagueStandingsShareCardArgs) {
  return renderLeagueStandingsShareCardCanvas(args).toDataURL('image/png');
}

export function downloadLeagueStandingsShareCard(args: DownloadLeagueStandingsShareCardArgs) {
  const canvas = renderLeagueStandingsShareCardCanvas(args);
  triggerCanvasDownload(canvas, `${safeFilePart(args.title || 'league-standings')}-share-card.png`);
}

function renderKnockoutBracketShareCardCanvas({
  title,
  focusLabel,
  rounds,
  summaryCards = [],
}: DownloadKnockoutBracketShareCardArgs) {
  const { canvas, ctx } = createCanvasCard();
  const palette = getKnockoutPalette();
  const finalRound = rounds[rounds.length - 1] || null;
  const finalMatch = finalRound?.items?.[0] || null;
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
  const preFinalRounds = rounds.slice(0, -1);
  const branchRounds = preFinalRounds.map((round) => ({
    label: round.label,
    total: round.total,
    completedCount: round.completedCount,
    ...splitKnockoutBranchItems(round.items),
  }));
  const centerSummaryCards = summaryCards.slice(0, 3);

  drawBackground(ctx, palette);
  drawTopBanner(ctx, {
    title: title || '淘汰賽模式進級表',
    subtitle: '淘汰賽海報版分享圖',
    eyebrow: 'KNOCKOUT MODE POSTER',
    chips: [focusLabel || '全部輪次', `共 ${rounds.length} 輪`, `完成 ${completedMatches}/${totalMatches} 場`],
    palette,
  });

  fillRoundedRect(ctx, 48, 286, 984, 940, 34, palette.panel, palette.panelStroke);
  drawBracketRibbon(ctx, 392, 314, 296, focusLabel === '全部輪次' ? '淘汰賽模式進級表' : String(focusLabel || '淘汰賽模式進級表'), palette);
  drawText(ctx, '左右分支歸中，中央保留決賽與賽事摘要，讓分享圖更貼近 bracket 海報版式。', 540, 382, {
    font: '400 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
    align: 'center',
  });

  const branchAreaTop = 420;
  const branchAreaHeight = 360;
  const innerGap = 220;
  const branchGap = 18;
  const sideAvailableWidth = Math.floor((984 - innerGap - ((Math.max(1, preFinalRounds.length) - 1) * branchGap * 2)) / 2);
  const branchColumnWidth = Math.max(82, Math.min(132, Math.floor(sideAvailableWidth / Math.max(1, preFinalRounds.length))));
  const leftColumnXs = preFinalRounds.map((_, index) => 78 + (index * (branchColumnWidth + branchGap)));
  const rightBase = 48 + 984 - 30;
  const rightColumnXs = preFinalRounds.map((_, index) => rightBase - branchColumnWidth - (index * (branchColumnWidth + branchGap)));
  const centerCardWidth = 220;
  const centerCardHeight = 92;
  const centerCardX = Math.floor((CARD_WIDTH - centerCardWidth) / 2);
  const centerCardY = 530;

  if (preFinalRounds.length === 0 && !finalMatch) {
    drawText(ctx, '尚未生成可分享的進級表內容。', 540, 640, {
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
        maxFontSize: 15,
        minFontSize: 11,
        color: '#F6B73C',
        weight: 700,
      });
      drawText(ctx, `${round.completedCount}/${round.total}`, leftX + branchColumnWidth, branchAreaTop - 16, {
        font: '500 12px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textMuted,
        align: 'right',
      });
      drawAdaptiveText(ctx, round.label, rightX, branchAreaTop - 16, {
        maxWidth: branchColumnWidth,
        maxFontSize: 15,
        minFontSize: 11,
        color: '#F6B73C',
        weight: 700,
      });
      drawText(ctx, `${round.completedCount}/${round.total}`, rightX + branchColumnWidth, branchAreaTop - 16, {
        font: '500 12px Arial, "Microsoft JhengHei", sans-serif',
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

    fillRoundedRect(ctx, centerCardX, centerCardY, centerCardWidth, centerCardHeight, 24, 'rgba(255,255,255,0.08)', 'rgba(246,183,60,0.24)', 1.5);
    drawText(ctx, finalRound?.label || '決賽', centerCardX + (centerCardWidth / 2), centerCardY + 24, {
      font: '600 15px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
      align: 'center',
    });
    drawText(ctx, finalMatch ? `${finalMatch.playerAFrames} : ${finalMatch.playerBFrames}` : '-', centerCardX + (centerCardWidth / 2), centerCardY + 56, {
      font: '700 30px Arial, "Microsoft JhengHei", sans-serif',
      color: '#F6B73C',
      align: 'center',
    });
    drawAdaptiveText(ctx, finalMatch ? `${finalMatch.playerALabel} vs ${finalMatch.playerBLabel}` : '尚未形成決賽對戰', centerCardX + 20, centerCardY + 80, {
      maxWidth: centerCardWidth - 40,
      maxFontSize: 13,
      minFontSize: 10,
      color: palette.textMuted,
      weight: 500,
      align: 'center',
    });

    if (branchRounds.length > 0) {
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

  fillRoundedRect(ctx, 352, 806, 376, 84, 24, 'rgba(246,183,60,0.10)', 'rgba(246,183,60,0.22)');
  drawText(ctx, '冠軍', 378, 834, {
    font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawAdaptiveText(ctx, championLabel, 378, 866, {
    maxWidth: 142,
    maxFontSize: 22,
    minFontSize: 14,
    color: '#F6B73C',
    weight: 700,
  });
  drawText(ctx, '亞軍', 562, 834, {
    font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawAdaptiveText(ctx, runnerUpLabel, 562, 866, {
    maxWidth: 142,
    maxFontSize: 22,
    minFontSize: 14,
    color: palette.textMain,
    weight: 700,
  });

  fillRoundedRect(ctx, 330, 914, 420, 232, 28, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)');
  drawSectionTitle(ctx, '賽事摘要', '中央空白區改放關鍵指標，補足 bracket 海報的資訊利用率。', 358, 954, palette);
  centerSummaryCards.forEach((card, index) => {
    const y = 994 + (index * 48);
    fillRoundedRect(ctx, 358, y, 364, 40, 16, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');
    drawText(ctx, card.label, 374, y + 25, {
      font: '600 14px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textSoft,
    });
    drawAdaptiveText(ctx, card.value, 476, y + 25, {
      maxWidth: 112,
      maxFontSize: 16,
      minFontSize: 12,
      color: '#F6B73C',
      weight: 700,
    });
    drawAdaptiveText(ctx, card.detail, 610, y + 25, {
      maxWidth: 96,
      maxFontSize: 12,
      minFontSize: 10,
      color: palette.textMuted,
      weight: 500,
      align: 'right',
    });
  });

  drawFooter(ctx, palette, '淘汰賽模式海報版分享圖 · CueAim Snooker');
  return canvas;
}

export function buildKnockoutBracketShareCardDataUrl(args: DownloadKnockoutBracketShareCardArgs) {
  return renderKnockoutBracketShareCardCanvas(args).toDataURL('image/png');
}

export function downloadKnockoutBracketShareCard(args: DownloadKnockoutBracketShareCardArgs) {
  const canvas = renderKnockoutBracketShareCardCanvas(args);
  triggerCanvasDownload(canvas, `${safeFilePart(args.title || 'knockout-bracket')}-share-card.png`);
}
