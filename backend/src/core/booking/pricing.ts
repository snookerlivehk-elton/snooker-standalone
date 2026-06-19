export function parseHHMM(hhmm: string) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return { h: h || 0, m: m || 0 };
}

export function toFiniteNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getSchemeMinHours(rulesJson: any) {
  if (rulesJson == null) return null;
  if (typeof rulesJson === 'string') {
    try {
      const parsed = JSON.parse(rulesJson);
      return getSchemeMinHours(parsed);
    } catch {
      return null;
    }
  }
  if (Array.isArray(rulesJson)) return null;
  if (typeof rulesJson === 'object') {
    const v = (rulesJson as any).minHours ?? (rulesJson as any).minQuantityHours ?? (rulesJson as any).minQtyHours;
    const n = toFiniteNumber(v);
    if (n == null) return null;
    const i = Math.floor(n);
    if (i < 1) return null;
    return i;
  }
  return null;
}

export function normalizeRulesJson(rulesJson: any): any[] | null {
  if (Array.isArray(rulesJson)) return rulesJson;
  if (typeof rulesJson === 'string') {
    try {
      const parsed = JSON.parse(rulesJson);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).rules)) return (parsed as any).rules;
      return null;
    } catch {
      return null;
    }
  }
  if (rulesJson && typeof rulesJson === 'object' && Array.isArray((rulesJson as any).rules)) return (rulesJson as any).rules;
  return null;
}

function hkParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = Number(pick('year'));
  const month = Number(pick('month'));
  const day = Number(pick('day'));
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));
  const weekday = pick('weekday');
  return { year, month, day, hour, minute, weekday };
}

function hkDayKey(d: Date) {
  const p = hkParts(d);
  const y = Number.isFinite(p.year) ? p.year : 0;
  const m = Number.isFinite(p.month) ? p.month : 0;
  const dd = Number.isFinite(p.day) ? p.day : 0;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function hkDow(d: Date) {
  const w = hkParts(d).weekday;
  if (w === 'Mon') return 1;
  if (w === 'Tue') return 2;
  if (w === 'Wed') return 3;
  if (w === 'Thu') return 4;
  if (w === 'Fri') return 5;
  if (w === 'Sat') return 6;
  if (w === 'Sun') return 7;
  return 1;
}

function hkMinuteOfDay(d: Date) {
  const p = hkParts(d);
  const h = Number.isFinite(p.hour) ? p.hour : 0;
  const m = Number.isFinite(p.minute) ? p.minute : 0;
  return h * 60 + m;
}

function hkMidnightUtcFromInstant(d: Date) {
  const p = hkParts(d);
  const y = Number.isFinite(p.year) ? p.year : 1970;
  const m = Number.isFinite(p.month) ? p.month : 1;
  const dd = Number.isFinite(p.day) ? p.day : 1;
  const utc = Date.UTC(y, m - 1, dd, 0, 0, 0, 0);
  return new Date(utc - 8 * 60 * 60 * 1000);
}

export function isSchemeApplicable(scheme: any, s: Date, e: Date, tableId?: string | null) {
  if (scheme.active !== true) return false;
  if (scheme.tableId && tableId && scheme.tableId !== tableId) return false;
  try {
    const dayKeyStart = hkDayKey(s);
    const endMinus1 = new Date(e.getTime() - 1);
    const dayKeyEnd = hkDayKey(endMinus1);
    if (dayKeyStart !== dayKeyEnd) return false;
    const rules = normalizeRulesJson(scheme.rulesJson);
    if (rules == null) return false;
    if (rules.length === 0) return { ok: true, pricePerHour: null };
    const dow = hkDow(s);
    const startMin = hkMinuteOfDay(s);
    const endMin = hkMinuteOfDay(e);
    if (!(endMin > startMin)) return false;
    for (const r of rules) {
      const days: number[] = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [];
      if (days.length > 0 && !days.includes(dow)) continue;
      const { h: sh, m: sm } = parseHHMM(r.start || '00:00');
      const { h: eh, m: em } = parseHHMM(r.end || '23:59');
      let winStart = sh * 60 + sm;
      let winEnd = eh * 60 + em;
      if (winEnd <= winStart) winEnd += 24 * 60;
      if (startMin >= winStart && endMin <= winEnd) {
        const pricePerHour = r.pricePerHour != null ? toFiniteNumber(r.pricePerHour) : null;
        return { ok: true, pricePerHour };
      }
    }
  } catch {}
  return false;
}

export function getSchemeUnitPriceForSegment(scheme: any, s: Date, e: Date, tableId?: string | null) {
  const applicable = isSchemeApplicable(scheme, s, e, tableId);
  if (!applicable || !(applicable as any).ok) return null;
  const rulePrice = (applicable as any).pricePerHour != null ? toFiniteNumber((applicable as any).pricePerHour) : null;
  const schemePrice = scheme.price != null ? toFiniteNumber(scheme.price as any) : null;
  return rulePrice ?? schemePrice ?? null;
}

function computeBreakpointsForRange(s: Date, e: Date, schemes: any[]) {
  const pts = new Set<number>();
  pts.add(s.getTime());
  pts.add(e.getTime());
  for (const scheme of schemes) {
    try {
      const rules = normalizeRulesJson((scheme as any).rulesJson);
      if (!rules) continue;
      const dow = hkDow(s);
      const baseMidnightUtc = hkMidnightUtcFromInstant(s).getTime();
      for (const r of rules) {
        const days: number[] = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [];
        if (days.length > 0 && !days.includes(dow)) continue;
        const { h: sh, m: sm } = parseHHMM(r.start || '00:00');
        const { h: eh, m: em } = parseHHMM(r.end || '23:59');
        let winStart = sh * 60 + sm;
        let winEnd = eh * 60 + em;
        if (winEnd <= winStart) winEnd += 24 * 60;
        pts.add(baseMidnightUtc + winStart * 60 * 1000);
        pts.add(baseMidnightUtc + winEnd * 60 * 1000);
      }
    } catch {}
  }
  const sorted = Array.from(pts).sort((a, b) => a - b);
  const within = sorted.filter((t) => t >= s.getTime() && t <= e.getTime());
  if (within.length === 0) return [s.getTime(), e.getTime()];
  if (within[0] !== s.getTime()) within.unshift(s.getTime());
  if (within[within.length - 1] !== e.getTime()) within.push(e.getTime());
  return within;
}

export function computeComboPlans(s: Date, e: Date, schemes: any[], tableId?: string | null) {
  const totalHours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
  if (!(totalHours > 0)) return [];

  const breakpoints = computeBreakpointsForRange(s, e, schemes);
  const segments: Array<{ start: Date; end: Date; hours: number }> = [];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i]!;
    const b = breakpoints[i + 1]!;
    if (!(b > a)) continue;
    const segStart = new Date(a);
    const segEnd = new Date(b);
    const h = (b - a) / (60 * 60 * 1000);
    if (h <= 0) continue;
    if (segStart < s || segEnd > e) continue;
    segments.push({ start: segStart, end: segEnd, hours: h });
  }
  if (segments.length <= 1) return [];
  if (segments.length > 8) return [];

  const schemeById = new Map<string, any>();
  for (const sc of schemes) schemeById.set(String(sc.id), sc);

  const optionsPerSegment = segments.map((seg) => {
    const opts: Array<{ schemeId: string; unitPrice: number }> = [];
    for (const sc of schemes) {
      const unit = getSchemeUnitPriceForSegment(sc, seg.start, seg.end, tableId);
      if (unit == null) continue;
      opts.push({ schemeId: String(sc.id), unitPrice: unit });
    }
    opts.sort((a, b) => a.unitPrice - b.unitPrice);
    return opts.slice(0, 12);
  });
  if (optionsPerSegment.some((opts) => opts.length === 0)) return [];

  const bestByKey = new Map<string, { schemeIds: string[]; total: number }>();

  const rec = (
    idx: number,
    assignment: string[],
    durations: Map<string, number>,
    total: number,
  ) => {
    if (idx >= segments.length) {
      const used = Array.from(new Set(assignment));
      if (used.length < 2) return;
      for (const sid of used) {
        const sc = schemeById.get(sid);
        if (!sc) return;
        const minH = getSchemeMinHours((sc as any).rulesJson);
        const dur = durations.get(sid) || 0;
        const h = dur / (60 * 60 * 1000);
        if (minH != null && h + 1e-9 < minH) return;
      }
      const key = used.slice().sort().join('+');
      const prev = bestByKey.get(key);
      if (!prev || total + 1e-9 < prev.total) {
        bestByKey.set(key, { schemeIds: used.slice().sort(), total });
      }
      return;
    }
    const seg = segments[idx]!;
    const opts = optionsPerSegment[idx] || [];
    for (const opt of opts) {
      const nextAssignment = assignment.concat(opt.schemeId);
      const nextDurations = new Map(durations);
      nextDurations.set(opt.schemeId, (nextDurations.get(opt.schemeId) || 0) + (seg.end.getTime() - seg.start.getTime()));
      rec(idx + 1, nextAssignment, nextDurations, total + opt.unitPrice * seg.hours);
    }
  };
  rec(0, [], new Map(), 0);

  return Array.from(bestByKey.values())
    .sort((a, b) => a.total - b.total)
    .slice(0, 10)
    .map((x) => {
      const title = x.schemeIds.map((sid) => String((schemeById.get(sid) as any)?.title || sid)).join(' + ');
      const avg = x.total / totalHours;
      return {
        id: `combo:${x.schemeIds.join('+')}`,
        title: `組合：${title}`,
        description: '分段計算',
        active: true,
        tableId: tableId || null,
        rulesJson: { combo: true, schemeIds: x.schemeIds },
        minHours: null,
        effectivePricePerHour: Number.isFinite(avg) ? avg : null,
      };
    });
}
