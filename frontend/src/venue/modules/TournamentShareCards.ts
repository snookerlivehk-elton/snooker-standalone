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
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
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

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = '600 20px Arial, "Microsoft JhengHei", sans-serif';
  const label = String(text || '').trim();
  const width = Math.max(120, ctx.measureText(label).width + 34);
  fillRoundedRect(ctx, x, y, width, 42, 21, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.18)');
  drawText(ctx, label, x + 17, y + 27, {
    font: '600 20px Arial, "Microsoft JhengHei", sans-serif',
    color: '#E5EEF9',
  });
  ctx.restore();
  return width;
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  chips: string[],
  palette: { topLeft: string; bottomRight: string; accent: string },
) {
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, palette.topLeft);
  gradient.addColorStop(1, palette.bottomRight);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);

  const glow = ctx.createRadialGradient(180, 120, 40, 180, 120, 480);
  glow.addColorStop(0, `${palette.accent}55`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1350);

  fillRoundedRect(ctx, 48, 48, 984, 180, 28, 'rgba(7,12,26,0.28)', 'rgba(255,255,255,0.1)');
  drawText(ctx, title, 78, 112, {
    font: '700 50px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
  });
  drawText(ctx, subtitle, 78, 154, {
    font: '400 24px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D7E4F3',
  });

  let cursorX = 78;
  const chipY = 174;
  chips.forEach((chip, index) => {
    const chipWidth = drawChip(ctx, cursorX, chipY, chip);
    cursorX += chipWidth + (index === chips.length - 1 ? 0 : 12);
  });
}

function createCanvasCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

export function downloadLeagueStandingsShareCard({
  title,
  dimensionLabel,
  pointsRuleLabel,
  rows,
}: DownloadLeagueStandingsShareCardArgs) {
  const { canvas, ctx } = createCanvasCard();
  const visibleRows = rows.slice(0, 8);
  const leader = rows[0] || null;
  const bestBreak = [...rows].sort((a, b) => b.maxBreak - a.maxBreak || b.breaks20Plus - a.breaks20Plus)[0] || null;
  const bestForm = [...rows].sort((a, b) => b.matchPoints - a.matchPoints || b.frameDiff - a.frameDiff)[0] || null;

  drawHeader(
    ctx,
    title || '聯賽模式積分榜',
    '聯賽模式積分榜分享圖',
    [dimensionLabel || '整個聯賽', `共 ${rows.length} 人`, pointsRuleLabel || '勝和負積分規則'],
    {
      topLeft: '#0B1530',
      bottomRight: '#132E59',
      accent: '#F4C95D',
    },
  );

  const summaryY = 260;
  const summaryWidth = 304;
  const summaryGap = 18;
  const summaryCards = [
    {
      title: '榜首',
      value: leader?.label || '-',
      detail: `${Number(leader?.matchPoints || 0)} 分`,
    },
    {
      title: '最佳局勢',
      value: bestForm?.label || '-',
      detail: `局差 ${Number(bestForm?.frameDiff || 0) > 0 ? '+' : ''}${Number(bestForm?.frameDiff || 0)}`,
    },
    {
      title: '最高 20+',
      value: bestBreak?.label || '-',
      detail: `${Number(bestBreak?.maxBreak || 0)} / 20+ ${Number(bestBreak?.breaks20Plus || 0)}`,
    },
  ];
  summaryCards.forEach((card, index) => {
    const x = 48 + (index * (summaryWidth + summaryGap));
    fillRoundedRect(ctx, x, summaryY, summaryWidth, 110, 24, 'rgba(7,12,26,0.26)', 'rgba(255,255,255,0.1)');
    drawText(ctx, card.title, x + 24, summaryY + 34, {
      font: '600 20px Arial, "Microsoft JhengHei", sans-serif',
      color: '#AFC3DD',
    });
    ctx.save();
    ctx.font = '700 28px Arial, "Microsoft JhengHei", sans-serif';
    drawText(ctx, ellipsize(ctx, card.value, summaryWidth - 48), x + 24, summaryY + 72, {
      font: '700 28px Arial, "Microsoft JhengHei", sans-serif',
      color: '#FFFFFF',
    });
    ctx.restore();
    drawText(ctx, card.detail, x + 24, summaryY + 95, {
      font: '500 18px Arial, "Microsoft JhengHei", sans-serif',
      color: '#D8E4F2',
    });
  });

  fillRoundedRect(ctx, 48, 392, 984, 856, 28, 'rgba(7,12,26,0.32)', 'rgba(255,255,255,0.1)');
  drawText(ctx, '積分榜', 78, 438, {
    font: '700 30px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
  });
  drawText(ctx, '第一版分享圖聚焦前 8 名與核心指標', 78, 470, {
    font: '400 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#C7D6E8',
  });

  const columns = [
    { label: '名次', x: 78, width: 88 },
    { label: '球手', x: 178, width: 302 },
    { label: '勝和負', x: 492, width: 170 },
    { label: '局差', x: 674, width: 102 },
    { label: '積分', x: 788, width: 90 },
    { label: '20+', x: 890, width: 64 },
    { label: '最高 20+', x: 966, width: 86 },
  ];

  fillRoundedRect(ctx, 68, 496, 944, 54, 18, 'rgba(255,255,255,0.08)');
  columns.forEach((column) => {
    drawText(ctx, column.label, column.x, 530, {
      font: '600 18px Arial, "Microsoft JhengHei", sans-serif',
      color: '#C6D6E8',
    });
  });

  visibleRows.forEach((row, index) => {
    const y = 566 + (index * 80);
    const rowFill = index < 3 ? 'rgba(244,201,93,0.1)' : 'rgba(255,255,255,0.05)';
    const rowStroke = index < 3 ? 'rgba(244,201,93,0.22)' : 'rgba(255,255,255,0.07)';
    fillRoundedRect(ctx, 68, y, 944, 64, 18, rowFill, rowStroke);
    drawText(ctx, `#${row.position}`, 78, y + 40, {
      font: '700 24px Arial, "Microsoft JhengHei", sans-serif',
      color: index < 3 ? '#F4C95D' : '#FFFFFF',
    });
    ctx.save();
    ctx.font = '700 24px Arial, "Microsoft JhengHei", sans-serif';
    drawText(ctx, ellipsize(ctx, row.label, 288), 178, y + 40, {
      font: '700 24px Arial, "Microsoft JhengHei", sans-serif',
      color: '#FFFFFF',
    });
    ctx.restore();
    drawText(ctx, `${row.won}/${row.drawn}/${row.lost}`, 492, y + 40, {
      font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
      color: '#DFE9F5',
    });
    drawText(ctx, `${row.frameDiff > 0 ? '+' : ''}${row.frameDiff}`, 674, y + 40, {
      font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
      color: row.frameDiff >= 0 ? '#8FE2C4' : '#F7A0A0',
    });
    drawText(ctx, String(row.matchPoints), 788, y + 40, {
      font: '700 24px Arial, "Microsoft JhengHei", sans-serif',
      color: '#F4C95D',
    });
    drawText(ctx, String(row.breaks20Plus), 890, y + 40, {
      font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
      color: '#E8F0F8',
    });
    drawText(ctx, String(row.maxBreak), 972, y + 40, {
      font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
      color: '#E8F0F8',
    });
  });

  drawText(ctx, 'Snooker Tournament Share Card', 78, 1292, {
    font: '500 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#AFC3DD',
  });
  drawText(ctx, new Date().toLocaleString('zh-HK'), 1002, 1292, {
    font: '500 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#AFC3DD',
    align: 'right',
  });

  triggerCanvasDownload(canvas, `${safeFilePart(title || 'league-standings')}-share-card.png`);
}

export function downloadKnockoutBracketShareCard({
  title,
  focusLabel,
  rounds,
}: DownloadKnockoutBracketShareCardArgs) {
  const { canvas, ctx } = createCanvasCard();
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

  drawHeader(
    ctx,
    title || '淘汰賽模式進級表',
    '淘汰賽模式進級表分享圖',
    [focusLabel || '全部輪次', `共 ${rounds.length} 輪`, `對局 ${rounds.reduce((sum, round) => sum + round.total, 0)} 場`],
    {
      topLeft: '#24113D',
      bottomRight: '#4B1D6B',
      accent: '#F59E0B',
    },
  );

  fillRoundedRect(ctx, 48, 260, 984, 150, 28, 'rgba(16,8,28,0.32)', 'rgba(255,255,255,0.1)');
  drawText(ctx, '冠軍', 80, 304, {
    font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
  });
  drawText(ctx, championLabel, 80, 348, {
    font: '700 34px Arial, "Microsoft JhengHei", sans-serif',
    color: '#F5D36C',
    maxWidth: 340,
  });
  drawText(ctx, '亞軍', 430, 304, {
    font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
  });
  drawText(ctx, runnerUpLabel, 430, 348, {
    font: '700 34px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
    maxWidth: 340,
  });
  drawText(ctx, finalMatch ? `${finalMatch.playerAFrames} : ${finalMatch.playerBFrames}` : '未有決賽比分', 796, 348, {
    font: '700 42px Arial, "Microsoft JhengHei", sans-serif',
    color: '#F5D36C',
  });
  drawText(ctx, '決賽比分', 796, 304, {
    font: '600 22px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
  });

  fillRoundedRect(ctx, 48, 438, 984, 810, 28, 'rgba(16,8,28,0.34)', 'rgba(255,255,255,0.1)');
  drawText(ctx, '進級表', 78, 484, {
    font: '700 30px Arial, "Microsoft JhengHei", sans-serif',
    color: '#FFFFFF',
  });
  drawText(ctx, '第一版分享圖以固定欄位顯示各輪晉級路徑', 78, 516, {
    font: '400 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
  });

  if (rounds.length === 0) {
    drawText(ctx, '尚未生成可分享的進級表內容。', 78, 620, {
      font: '600 28px Arial, "Microsoft JhengHei", sans-serif',
      color: '#FFFFFF',
    });
  } else {
    const columnGap = 16;
    const columnWidth = Math.floor((924 - ((rounds.length - 1) * columnGap)) / Math.max(1, rounds.length));
    const columnStartX = 78;
    const columnStartY = 548;
    const availableHeight = 652;

    rounds.forEach((round, roundIndex) => {
      const x = columnStartX + (roundIndex * (columnWidth + columnGap));
      fillRoundedRect(ctx, x, columnStartY, columnWidth, availableHeight, 22, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.1)');
      drawText(ctx, round.label, x + 16, columnStartY + 34, {
        font: `700 ${rounds.length > 4 ? 18 : 20}px Arial, "Microsoft JhengHei", sans-serif`,
        color: '#F5D36C',
        maxWidth: columnWidth - 32,
      });
      drawText(ctx, `${round.completedCount}/${round.total} 已完成`, x + 16, columnStartY + 60, {
        font: '500 16px Arial, "Microsoft JhengHei", sans-serif',
        color: '#D8C7F6',
      });

      const items = round.items.slice(0, Math.max(1, round.items.length));
      const cardGap = 12;
      const cardAreaTop = columnStartY + 84;
      const cardAreaHeight = availableHeight - 102;
      const cardHeight = Math.max(86, Math.min(120, Math.floor((cardAreaHeight - ((items.length - 1) * cardGap)) / Math.max(1, items.length))));

      items.forEach((item, itemIndex) => {
        const y = cardAreaTop + (itemIndex * (cardHeight + cardGap));
        fillRoundedRect(ctx, x + 12, y, columnWidth - 24, cardHeight, 18, 'rgba(8,5,18,0.48)', 'rgba(255,255,255,0.08)');
        drawText(ctx, `M${item.matchNo}`, x + 24, y + 24, {
          font: '600 15px Arial, "Microsoft JhengHei", sans-serif',
          color: '#BFAEDB',
        });
        drawText(ctx, item.statusLabel, x + columnWidth - 24, y + 24, {
          font: '600 15px Arial, "Microsoft JhengHei", sans-serif',
          color: '#BFAEDB',
          align: 'right',
        });

        ctx.save();
        ctx.font = '700 18px Arial, "Microsoft JhengHei", sans-serif';
        drawText(ctx, ellipsize(ctx, item.playerALabel, columnWidth - 48), x + 24, y + 50, {
          font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
          color: item.winnerSide === 'A' ? '#F5D36C' : '#FFFFFF',
        });
        drawText(ctx, ellipsize(ctx, item.playerBLabel, columnWidth - 48), x + 24, y + 92, {
          font: '700 18px Arial, "Microsoft JhengHei", sans-serif',
          color: item.winnerSide === 'B' ? '#F5D36C' : '#FFFFFF',
        });
        ctx.restore();

        drawText(ctx, `${item.playerAFrames} : ${item.playerBFrames}`, x + columnWidth - 24, y + 71, {
          font: '700 24px Arial, "Microsoft JhengHei", sans-serif',
          color: '#FFFFFF',
          align: 'right',
        });
      });
    });
  }

  drawText(ctx, 'Snooker Tournament Share Card', 78, 1292, {
    font: '500 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
  });
  drawText(ctx, new Date().toLocaleString('zh-HK'), 1002, 1292, {
    font: '500 18px Arial, "Microsoft JhengHei", sans-serif',
    color: '#D8C7F6',
    align: 'right',
  });

  triggerCanvasDownload(canvas, `${safeFilePart(title || 'knockout-bracket')}-share-card.png`);
}
