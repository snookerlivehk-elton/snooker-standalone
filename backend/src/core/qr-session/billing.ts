export function ceilDiv(a: number, b: number) {
  if (b <= 0) return a;
  return Math.floor((a + b - 1) / b);
}

export function calcBilledMinutes(startAt: Date, endAt: Date, cfg: any) {
  const diffMs = endAt.getTime() - startAt.getTime();
  const rawMinutes = Math.max(0, Math.ceil(diffMs / 60000));
  const roundingMinutes = Math.max(1, Math.floor(Number(cfg?.roundingMinutes ?? 15)));
  const minBillableMinutes = Math.max(0, Math.floor(Number(cfg?.minBillableMinutes ?? 0)));
  const rounded = ceilDiv(rawMinutes, roundingMinutes) * roundingMinutes;
  return Math.max(rounded, minBillableMinutes);
}

export function calcChargedAmount(basePrice: any, billedMinutes: number) {
  if (basePrice == null) return null;
  const perHour = Number(String(basePrice));
  if (!Number.isFinite(perHour) || perHour <= 0) return null;
  const amt = perHour * (billedMinutes / 60);
  return Number.isFinite(amt) ? amt : null;
}

export function calcChargedPoints(amount: number | null, cfg: any) {
  if (amount == null) return 0;
  const ppc = Number(String(cfg?.pointsPerCurrency ?? 1));
  if (!Number.isFinite(ppc) || ppc <= 0) return 0;
  const pts = Math.round(amount * ppc);
  return Number.isFinite(pts) && pts > 0 ? pts : 0;
}
