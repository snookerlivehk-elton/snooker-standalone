export type ModuleCategory =
  | 'operations'
  | 'engagement'
  | 'content'
  | 'membership'
  | 'payment'
  | 'system';

export type ModuleManifest = {
  code: string;
  label: string;
  description: string;
  category: ModuleCategory;
  pluginId: string | null;
  defaultEnabled: boolean;
  featureFlagKey?: string;
  supportsClubAssignment?: boolean;
  supportsPublicRoutes: boolean;
  supportsHomeSection: boolean;
  supportsVenueAdmin: boolean;
  supportsSuperAdmin: boolean;
};

export type FeatureCatalogItem = {
  key: string;
  label: string;
  defaultEnabled: boolean;
  moduleCode: string;
};

export const MODULE_MANIFESTS: readonly ModuleManifest[] = [
  {
    code: 'content',
    label: '內容與新聞',
    description: '管理新聞來源、新聞內容與首頁內容供應。',
    category: 'content',
    pluginId: 'content',
    defaultEnabled: true,
    supportsPublicRoutes: true,
    supportsHomeSection: true,
    supportsVenueAdmin: false,
    supportsSuperAdmin: true,
  },
  {
    code: 'members',
    label: '會員系統',
    description: '處理會員註冊、登入、重設密碼與會員資料流程。',
    category: 'membership',
    pluginId: 'members',
    defaultEnabled: true,
    supportsPublicRoutes: true,
    supportsHomeSection: false,
    supportsVenueAdmin: false,
    supportsSuperAdmin: true,
  },
  {
    code: 'booking',
    label: '會員預約',
    description: '處理球枱、定價方案、預約與封鎖時段。',
    category: 'operations',
    pluginId: 'booking',
    defaultEnabled: true,
    featureFlagKey: 'booking',
    supportsClubAssignment: true,
    supportsPublicRoutes: false,
    supportsHomeSection: false,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'qr_session',
    label: '掃碼起鐘及結算',
    description: '處理掃碼起鐘、落鐘、確認與台鐘流程。',
    category: 'operations',
    pluginId: 'qr-session',
    defaultEnabled: true,
    featureFlagKey: 'qr_session',
    supportsClubAssignment: true,
    supportsPublicRoutes: true,
    supportsHomeSection: false,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'settlement',
    label: '結算協調',
    description: '處理交易狀態、報價、確認與結算協調流程。',
    category: 'payment',
    pluginId: 'settlement',
    defaultEnabled: true,
    supportsPublicRoutes: false,
    supportsHomeSection: false,
    supportsVenueAdmin: false,
    supportsSuperAdmin: true,
  },
  {
    code: 'points',
    label: '消費積分',
    description: '處理積分換算、餘額、流水與扣分規則。',
    category: 'payment',
    pluginId: 'points',
    defaultEnabled: true,
    featureFlagKey: 'points',
    supportsClubAssignment: true,
    supportsPublicRoutes: false,
    supportsHomeSection: false,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'tournaments',
    label: '比賽報名入口',
    description: '處理場館比賽、報名與公開展示。',
    category: 'engagement',
    pluginId: 'tournaments',
    defaultEnabled: true,
    featureFlagKey: 'tournaments',
    supportsClubAssignment: true,
    supportsPublicRoutes: true,
    supportsHomeSection: true,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'highbreak',
    label: '單杆統計及排名',
    description: '處理單杆紀錄、排行榜與公開榜單。',
    category: 'engagement',
    pluginId: 'highbreak',
    defaultEnabled: true,
    featureFlagKey: 'highbreak',
    supportsPublicRoutes: true,
    supportsHomeSection: true,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'live',
    label: '直播',
    description: '處理直播公告與公開直播排程。',
    category: 'content',
    pluginId: 'live',
    defaultEnabled: true,
    featureFlagKey: 'live',
    supportsPublicRoutes: true,
    supportsHomeSection: true,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'club_messages',
    label: '球會訊息',
    description: '處理場館訊息與廣播通知。',
    category: 'content',
    pluginId: 'club-messages',
    defaultEnabled: true,
    featureFlagKey: 'club_messages',
    supportsPublicRoutes: true,
    supportsHomeSection: false,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'club_dashboard',
    label: '球會主頁（管理）',
    description: '控制場館後台入口與管理主介面。',
    category: 'system',
    pluginId: null,
    defaultEnabled: true,
    featureFlagKey: 'club_dashboard',
    supportsPublicRoutes: false,
    supportsHomeSection: false,
    supportsVenueAdmin: true,
    supportsSuperAdmin: true,
  },
  {
    code: 'system_portal',
    label: '系統主頁',
    description: '控制系統首頁與公開 portal 入口。',
    category: 'system',
    pluginId: null,
    defaultEnabled: true,
    featureFlagKey: 'system_portal',
    supportsPublicRoutes: true,
    supportsHomeSection: true,
    supportsVenueAdmin: false,
    supportsSuperAdmin: true,
  },
  {
    code: 'member_portal',
    label: '會員主頁',
    description: '控制會員 portal 與會員專屬入口。',
    category: 'system',
    pluginId: null,
    defaultEnabled: true,
    featureFlagKey: 'member_portal',
    supportsPublicRoutes: false,
    supportsHomeSection: false,
    supportsVenueAdmin: false,
    supportsSuperAdmin: true,
  },
] as const;

export const FEATURE_CATALOG: readonly FeatureCatalogItem[] = MODULE_MANIFESTS
  .filter((module) => !!module.featureFlagKey)
  .map((module) => ({
    key: String(module.featureFlagKey),
    label: module.label,
    defaultEnabled: module.defaultEnabled,
    moduleCode: module.code,
  }));

export const FEATURE_DEFAULTS: Record<string, boolean> = FEATURE_CATALOG.reduce<Record<string, boolean>>((acc, item) => {
  acc[item.key] = item.defaultEnabled;
  return acc;
}, {});

export const MODULE_MANIFEST_MAP: Readonly<Record<string, ModuleManifest>> = MODULE_MANIFESTS.reduce<Record<string, ModuleManifest>>((acc, module) => {
  acc[module.code] = module;
  return acc;
}, {});

export const FEATURE_MODULE_MAP: Readonly<Record<string, ModuleManifest>> = MODULE_MANIFESTS.reduce<Record<string, ModuleManifest>>((acc, module) => {
  if (module.featureFlagKey) acc[module.featureFlagKey] = module;
  return acc;
}, {});

export function getModuleManifest(code: string) {
  return MODULE_MANIFEST_MAP[String(code || '').trim()] || null;
}

export function getModuleManifestByFeatureKey(featureKey: string) {
  return FEATURE_MODULE_MAP[String(featureKey || '').trim()] || null;
}
