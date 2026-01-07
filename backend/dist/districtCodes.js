export const DISTRICT_CODE_MAP = {
    // Hong Kong Island
    'central and western': 'HCW',
    'eastern': 'HKE',
    'southern': 'HKS',
    'wan chai': 'HWC',
    // Kowloon
    'kowloon city': 'KLC',
    'kwun tong': 'KWT',
    'sham shui po': 'SSP',
    'wong tai sin': 'WTS',
    'yau tsim mong': 'YTM',
    // New Territories
    'islands': 'ISL',
    'kwai tsing': 'KWTG',
    'north': 'NTH',
    'sai kung': 'SKG',
    'sha tin': 'STN',
    'tai po': 'TPO',
    'tsuen wan': 'TSW',
    'tuen mun': 'TMN',
    'yuen long': 'NYL', // 按您示例使用 NYL
};
export function resolveDistrictCode(input) {
    if (!input)
        return null;
    const raw = input.trim();
    if (!raw)
        return null;
    const upper = raw.toUpperCase();
    // If already 3-4 uppercase letters, accept directly
    if (/^[A-Z]{3,4}$/.test(upper))
        return upper;
    // Try name mapping
    const key = raw.toLowerCase();
    const mapped = DISTRICT_CODE_MAP[key];
    return mapped ?? null;
}
//# sourceMappingURL=districtCodes.js.map