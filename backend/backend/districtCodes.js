export const DISTRICT_CODE_MAP = {
  '元朗區': 'NYL',
  '北區': 'NKT',
  '沙田區': 'NST',
  '觀塘區': 'EKT',
  '荃灣區': 'NTW'
};
export function resolveDistrictCode(input) {
  const s = String(input || '').trim().toUpperCase();
  if (!s) return null;
  for (const [name, code] of Object.entries(DISTRICT_CODE_MAP)) {
    if (code.toUpperCase() === s || name.replace(/\s+/g,'').toUpperCase() === s) return code;
  }
  return null;
}
