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

export function downloadLeagueStandingsShareCard({
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
  triggerCanvasDownload(canvas, `${safeFilePart(title || 'league-standings')}-share-card.png`);
}

export function downloadKnockoutBracketShareCard({
  title,
  focusLabel,
  rounds,
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

  drawBackground(ctx, palette);
  drawTopBanner(ctx, {
    title: title || '淘汰賽模式進級表',
    subtitle: '淘汰賽海報版分享圖',
    eyebrow: 'KNOCKOUT MODE POSTER',
    chips: [focusLabel || '全部輪次', `共 ${rounds.length} 輪`, `完成 ${completedMatches}/${totalMatches} 場`],
    palette,
  });

  fillRoundedRect(ctx, 48, 286, 984, 222, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '決賽中心位', '將冠軍、亞軍與決賽比分收斂成分享時最先被看到的主視覺。', 78, 328, palette);

  fillRoundedRect(ctx, 78, 366, 248, 112, 26, 'rgba(246,183,60,0.16)', 'rgba(246,183,60,0.28)');
  drawText(ctx, '冠軍', 100, 398, {
    font: '600 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, championLabel, 100, 438, {
    font: '700 28px Arial, "Microsoft JhengHei", sans-serif',
    color: '#F6B73C',
    maxWidth: 204,
  });
  drawText(ctx, 'Champion', 100, 462, {
    font: '500 14px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
  });

  fillRoundedRect(ctx, 754, 366, 248, 112, 26, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.12)');
  drawText(ctx, '亞軍', 776, 398, {
    font: '600 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
  });
  drawText(ctx, runnerUpLabel, 776, 438, {
    font: '700 28px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMain,
    maxWidth: 204,
  });
  drawText(ctx, 'Runner-up', 776, 462, {
    font: '500 14px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
  });

  fillRoundedRect(ctx, 352, 348, 376, 136, 28, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)', 1.5);
  drawText(ctx, '決賽比分', 540, 382, {
    font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textSoft,
    align: 'center',
  });
  drawText(ctx, finalMatch ? `${finalMatch.playerAFrames} : ${finalMatch.playerBFrames}` : '未有決賽比分', 540, 430, {
    font: '700 46px Arial, "Microsoft JhengHei", sans-serif',
    color: '#F6B73C',
    align: 'center',
  });
  drawText(ctx, finalMatch ? `${finalMatch.playerALabel} vs ${finalMatch.playerBLabel}` : '尚未形成決賽對戰', 540, 458, {
    font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
    color: palette.textMuted,
    align: 'center',
    maxWidth: 320,
  });

  fillRoundedRect(ctx, 48, 532, 984, 130, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '各輪完成度', '讓分享圖即使不閱讀全部對局，也能快速掌握賽事推進狀態。', 78, 570, palette);
  const progressCardWidth = Math.floor((924 - ((Math.max(1, rounds.length) - 1) * 12)) / Math.max(1, rounds.length));
  rounds.forEach((round, index) => {
    const x = 78 + (index * (progressCardWidth + 12));
    const safeWidth = Math.max(138, progressCardWidth);
    drawAdaptiveText(ctx, String(round?.label || '-'), x, 592, {
      maxWidth: safeWidth - 64,
      maxFontSize: 15,
      minFontSize: 11,
      color: palette.textMain,
      weight: 600,
    });
    drawText(ctx, `${Number(round?.completedCount || 0)}/${Number(round?.total || 0)}`, x + safeWidth, 592, {
      font: '500 13px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMuted,
      align: 'right',
    });
    fillRoundedRect(ctx, x, 612, safeWidth, 18, 9, 'rgba(255,255,255,0.08)');
    const progress = Number(round?.total || 0) > 0 ? Number(round?.completedCount || 0) / Number(round.total) : 0;
    fillRoundedRect(ctx, x, 612, Math.max(18, safeWidth * progress), 18, 9, 'rgba(246,183,60,0.72)');
  });

  fillRoundedRect(ctx, 48, 682, 984, 544, 30, palette.panel, palette.panelStroke);
  drawSectionTitle(ctx, '淘汰賽模式進級路徑', '進級表保持為主體，同時把決賽中心位與輪次完成度上收。', 78, 708, palette);

  if (rounds.length === 0) {
    drawText(ctx, '尚未生成可分享的進級表內容。', 78, 780, {
      font: '600 28px Arial, "Microsoft JhengHei", sans-serif',
      color: palette.textMain,
    });
  } else {
    const columnGap = 14;
    const columnWidth = Math.floor((924 - ((rounds.length - 1) * columnGap)) / Math.max(1, rounds.length));
    const columnStartX = 78;
    const columnStartY = 748;
    const availableHeight = 430;

    rounds.forEach((round, roundIndex) => {
      const x = columnStartX + (roundIndex * (columnWidth + columnGap));
      fillRoundedRect(ctx, x, columnStartY, columnWidth, availableHeight, 24, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)');
      drawAdaptiveText(ctx, round.label, x + 16, columnStartY + 32, {
        maxWidth: columnWidth - 32,
        maxFontSize: rounds.length > 4 ? 17 : 19,
        minFontSize: 12,
        color: '#F6B73C',
        weight: 700,
      });
      drawText(ctx, `${round.completedCount}/${round.total} 已完成`, x + 16, columnStartY + 56, {
        font: '500 14px Arial, "Microsoft JhengHei", sans-serif',
        color: palette.textMuted,
      });

      const items = round.items.slice(0, Math.max(1, round.items.length));
      const cardGap = items.length >= 6 ? 6 : 10;
      const cardAreaTop = columnStartY + 74;
      const cardAreaHeight = availableHeight - 92;
      const rawCardHeight = Math.floor((cardAreaHeight - ((items.length - 1) * cardGap)) / Math.max(1, items.length));
      const cardHeight = Math.max(42, Math.min(100, rawCardHeight));
      const labelFontSize = cardHeight >= 80 ? 16 : cardHeight >= 64 ? 14 : 12;
      const scoreFontSize = cardHeight >= 80 ? 18 : cardHeight >= 64 ? 16 : 14;
      const firstLineY = cardHeight <= 50 ? 34 : cardHeight <= 64 ? 38 : 46;
      const secondLineY = cardHeight <= 50 ? 50 : cardHeight <= 64 ? 58 : 72;
      const scoreY = cardHeight <= 50 ? cardHeight - 8 : cardHeight <= 64 ? cardHeight - 10 : cardHeight - 12;

      items.forEach((item, itemIndex) => {
        const y = cardAreaTop + (itemIndex * (cardHeight + cardGap));
        const cardFill = item.winnerSide ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
        const cardStroke = item.statusLabel === '已完成' ? 'rgba(246,183,60,0.24)' : 'rgba(255,255,255,0.08)';
        fillRoundedRect(ctx, x + 10, y, columnWidth - 20, cardHeight, 18, cardFill, cardStroke);
        drawText(ctx, `M${item.matchNo}`, x + 22, y + 22, {
          font: '600 13px Arial, "Microsoft JhengHei", sans-serif',
          color: palette.textSoft,
        });
        drawText(ctx, item.statusLabel, x + columnWidth - 22, y + 22, {
          font: '600 13px Arial, "Microsoft JhengHei", sans-serif',
          color: palette.textSoft,
          align: 'right',
        });

        drawAdaptiveText(ctx, item.playerALabel, x + 22, y + firstLineY, {
          maxWidth: columnWidth - 58,
          maxFontSize: labelFontSize,
          minFontSize: 10,
          color: item.winnerSide === 'A' ? '#F6B73C' : palette.textMain,
          weight: 700,
        });
        drawAdaptiveText(ctx, item.playerBLabel, x + 22, y + secondLineY, {
          maxWidth: columnWidth - 58,
          maxFontSize: labelFontSize,
          minFontSize: 10,
          color: item.winnerSide === 'B' ? '#F6B73C' : palette.textMain,
          weight: 700,
        });

        drawText(ctx, `${item.playerAFrames}:${item.playerBFrames}`, x + columnWidth - 22, y + scoreY, {
          font: `700 ${scoreFontSize}px Arial, "Microsoft JhengHei", sans-serif`,
          color: palette.textMain,
          align: 'right',
        });
      });
    });
  }

  drawFooter(ctx, palette, '淘汰賽模式海報版分享圖 · CueAim Snooker');
  triggerCanvasDownload(canvas, `${safeFilePart(title || 'knockout-bracket')}-share-card.png`);
}
