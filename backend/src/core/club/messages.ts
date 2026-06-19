export function isSystemClubMessageTitle(title: any): boolean {
  const t = String(title == null ? '' : title).trim();
  if (!t) return false;
  if (t === '新預約待確認') return true;
  if (t.startsWith('直播通告：')) return true;
  if (t.startsWith('比賽報名待確認：')) return true;
  return false;
}
