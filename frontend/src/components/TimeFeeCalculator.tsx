import React, { useMemo, useState } from 'react';

type Props = {
  defaultHours?: number;
  defaultHourlyRate?: number;
  defaultTotalAmount?: number;
  defaultFrames?: number;
  title?: string;
};

function toFiniteNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(n: number): string {
  const fixed = Math.round((n + Number.EPSILON) * 100) / 100;
  return fixed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function TimeFeeCalculator({
  defaultHours = 2,
  defaultHourlyRate,
  defaultTotalAmount,
  defaultFrames = 5,
  title = '波鐘計算機',
}: Props) {
  const [hoursRaw, setHoursRaw] = useState<string>(String(defaultHours));
  const [hourlyRaw, setHourlyRaw] = useState<string>(defaultHourlyRate == null ? '' : String(defaultHourlyRate));
  const [totalRaw, setTotalRaw] = useState<string>(defaultTotalAmount == null ? '' : String(defaultTotalAmount));
  const [framesRaw, setFramesRaw] = useState<string>(String(defaultFrames));

  const hours = useMemo(() => {
    const n = toFiniteNumber(hoursRaw);
    return n == null ? null : Math.max(0, n);
  }, [hoursRaw]);
  const hourlyRate = useMemo(() => {
    const n = toFiniteNumber(hourlyRaw);
    return n == null ? null : Math.max(0, n);
  }, [hourlyRaw]);
  const totalAmountInput = useMemo(() => {
    const n = toFiniteNumber(totalRaw);
    return n == null ? null : Math.max(0, n);
  }, [totalRaw]);
  const frames = useMemo(() => {
    const n = toFiniteNumber(framesRaw);
    if (n == null) return null;
    return n > 0 ? n : null;
  }, [framesRaw]);

  const computed = useMemo(() => {
    if (hours == null || hours <= 0) return { total: null as number | null, hourly: null as number | null, perFrame: null as number | null };
    const total = totalAmountInput != null ? totalAmountInput : (hourlyRate != null ? hourlyRate * hours : null);
    const hourly = total != null ? (total / hours) : null;
    const perFrame = total != null && frames != null && frames >= 1 ? total / frames : null;
    return { total, hourly, perFrame };
  }, [hours, hourlyRate, totalAmountInput, frames]);

  return (
    <div className="cue-surface rounded-lg p-4">
      <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <div className="text-xs cue-muted">時長（小時）</div>
          <input
            type="number"
            step="0.25"
            min={0}
            value={hoursRaw}
            onChange={(e) => setHoursRaw(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如 2 或 2.5"
          />
        </label>
        <label className="grid gap-1">
          <div className="text-xs cue-muted">總局數</div>
          <input
            type="number"
            step="0.5"
            min={0.1}
            value={framesRaw}
            onChange={(e) => setFramesRaw(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如 5"
          />
        </label>
        <label className="grid gap-1">
          <div className="text-xs cue-muted">每小時費用</div>
          <input
            type="number"
            step="0.01"
            min={0}
            value={hourlyRaw}
            onChange={(e) => setHourlyRaw(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如 180"
          />
        </label>
        <label className="grid gap-1">
          <div className="text-xs cue-muted">或：總金額</div>
          <input
            type="number"
            step="0.01"
            min={0}
            value={totalRaw}
            onChange={(e) => setTotalRaw(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如 360"
          />
        </label>
      </div>

      <div className="mt-3 cue-surface-strong rounded-lg p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="cue-muted">時長總收費</div>
          <div className="font-semibold">{computed.total == null ? '—' : `$${fmtMoney(computed.total)}`}</div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm mt-1">
          <div className="cue-muted">折算每小時</div>
          <div className="font-semibold">{computed.hourly == null ? '—' : `$${fmtMoney(computed.hourly)}`}</div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm mt-1">
          <div className="cue-muted">每局費用</div>
          <div className="font-semibold text-emerald-600">{computed.perFrame == null ? '—' : `$${fmtMoney(computed.perFrame)}`}</div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
          onClick={() => {
            setHoursRaw(String(defaultHours));
            setHourlyRaw(defaultHourlyRate == null ? '' : String(defaultHourlyRate));
            setTotalRaw(defaultTotalAmount == null ? '' : String(defaultTotalAmount));
            setFramesRaw(String(defaultFrames));
          }}
        >
          重置
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded cue-button hover:brightness-95 text-sm text-white"
          onClick={() => setTotalRaw('')}
        >
          清空總金額
        </button>
      </div>
      <div className="text-xs cue-muted mt-2">如已輸入總金額，會優先用總金額計算每小時與每局費用。</div>
    </div>
  );
}
