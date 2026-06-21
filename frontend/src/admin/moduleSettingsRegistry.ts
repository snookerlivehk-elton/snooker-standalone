export type ModuleRequirementSectionConfig = {
  type: 'requirement';
  field: string;
  title: string;
  description: string;
  basicLabel: string;
  basicDescription: string;
  verifiedLabel: string;
  verifiedDescription: string;
};

export type ModuleToggleItemConfig = {
  field: string;
  label: string;
  description?: string;
};

export type ModuleToggleSectionConfig = {
  type: 'toggles';
  title: string;
  description: string;
  toggles: ModuleToggleItemConfig[];
};

export type ModuleSettingsPageConfig = {
  moduleCode: string;
  title: string;
  description: string;
  overviewTab: 'system' | 'venue' | 'member' | 'competition';
  loadErrorMessage: string;
  saveSuccessMessage: string;
  sections: Array<ModuleRequirementSectionConfig | ModuleToggleSectionConfig>;
  defaultSettings: Record<string, any>;
};

const MODULE_SETTINGS_PAGE_REGISTRY: Record<string, ModuleSettingsPageConfig> = {
  booking: {
    moduleCode: 'booking',
    title: 'Booking 模組設定（Super Admin）',
    description: '集中管理預約建立的會員資格要求，以及 booking 事件的 email 通知策略。',
    overviewTab: 'venue',
    loadErrorMessage: '讀取 booking 模組設定失敗',
    saveSuccessMessage: '已儲存 booking 模組設定',
    sections: [
      {
        type: 'requirement',
        field: 'bookingCreateRequirement',
        title: '會員資格要求',
        description: '控制會員建立預約時，最少需要甚麼等級的會員身份。',
        basicLabel: '普通會員',
        basicDescription: '只要已登入會員即可建立預約，不要求 email 驗證。',
        verifiedLabel: '認證會員',
        verifiedDescription: '會員必須完成 email 驗證，才可建立預約。',
      },
      {
        type: 'toggles',
        title: 'Email 通知設定',
        description: '控制新預約先通知場館確認，並在場館確認後通知預約會員本人。',
        toggles: [
          { field: 'reservationCreatedEmailEnabled', label: '新預約申請後通知場館' },
          { field: 'reservationConfirmedEmailEnabled', label: '場館確認後通知預約會員' },
          { field: 'reservationCancelledEmailEnabled', label: '預約取消後通知預約會員' },
        ],
      },
    ],
    defaultSettings: {
      bookingCreateRequirement: 'VERIFIED_MEMBER',
      reservationCreatedEmailEnabled: false,
      reservationConfirmedEmailEnabled: false,
      reservationCancelledEmailEnabled: false,
    },
  },
  tournaments: {
    moduleCode: 'tournaments',
    title: 'Tournaments 模組設定（Super Admin）',
    description: '集中管理比賽報名的會員資格要求，以及比賽報名通知的預設策略。',
    overviewTab: 'competition',
    loadErrorMessage: '讀取 tournaments 模組設定失敗',
    saveSuccessMessage: '已儲存 tournaments 模組設定',
    sections: [
      {
        type: 'requirement',
        field: 'tournamentSignupRequirement',
        title: '會員資格要求',
        description: '控制會員報名比賽時，最少需要甚麼等級的會員身份。',
        basicLabel: '普通會員',
        basicDescription: '只要已登入會員即可報名比賽，不要求 email 驗證。',
        verifiedLabel: '認證會員',
        verifiedDescription: '會員必須完成 email 驗證，才可報名比賽。',
      },
      {
        type: 'toggles',
        title: 'Email 通知設定',
        description: '先保存比賽報名通知策略，下一輪可直接接上實際 email delivery。',
        toggles: [
          { field: 'signupCreatedEmailEnabled', label: '會員報名後通知場館' },
          { field: 'signupConfirmedEmailEnabled', label: '場館確認後通知會員' },
          { field: 'signupCancelledEmailEnabled', label: '報名取消後通知會員' },
        ],
      },
    ],
    defaultSettings: {
      tournamentSignupRequirement: 'VERIFIED_MEMBER',
      signupCreatedEmailEnabled: false,
      signupConfirmedEmailEnabled: false,
      signupCancelledEmailEnabled: false,
    },
  },
  points: {
    moduleCode: 'points',
    title: 'Points 模組設定（Super Admin）',
    description: '集中管理消費積分模組的場館營運權限，以及後續通知策略預設。',
    overviewTab: 'venue',
    loadErrorMessage: '讀取 points 模組設定失敗',
    saveSuccessMessage: '已儲存 points 模組設定',
    sections: [
      {
        type: 'toggles',
        title: '營運控制',
        description: '控制場館後台可否修改積分規則，以及可否手動加減會員積分。',
        toggles: [
          {
            field: 'clubPointsConfigEditable',
            label: '允許場館修改積分規則',
            description: '關閉後，場館後台不可再修改兌換率、進位分鐘與最低計費分鐘。',
          },
          {
            field: 'manualAdjustmentEnabled',
            label: '允許場館手動調整積分',
            description: '關閉後，場館後台不可再手動為會員加分或扣分。',
          },
        ],
      },
      {
        type: 'toggles',
        title: 'Email 通知設定',
        description: '先保存 points 相關通知策略，之後你可再逐項微調實際 email 行為。',
        toggles: [
          { field: 'manualAdjustmentEmailEnabled', label: '手動調整積分後通知會員' },
          { field: 'settlementDeductionEmailEnabled', label: '結算扣分後通知會員' },
        ],
      },
    ],
    defaultSettings: {
      clubPointsConfigEditable: true,
      manualAdjustmentEnabled: true,
      manualAdjustmentEmailEnabled: false,
      settlementDeductionEmailEnabled: false,
    },
  },
  club_messages: {
    moduleCode: 'club_messages',
    title: 'Club Messages 模組設定（Super Admin）',
    description: '集中管理場館公告發佈權限、會員訊息箱可用性，以及公告通知策略。',
    overviewTab: 'member',
    loadErrorMessage: '讀取 club_messages 模組設定失敗',
    saveSuccessMessage: '已儲存 club_messages 模組設定',
    sections: [
      {
        type: 'toggles',
        title: '營運控制',
        description: '控制場館可否自行發佈公告，以及會員端是否可使用場館訊息箱。',
        toggles: [
          {
            field: 'venuePublishingEnabled',
            label: '允許場館發佈、編輯及刪除公告',
            description: '關閉後，場館後台仍可查看既有公告，但不可再新增、修改或刪除。',
          },
          {
            field: 'memberInboxEnabled',
            label: '啟用會員場館訊息箱',
            description: '關閉後，會員端不再載入場館訊息列表，已讀與隱藏操作亦會停用。',
          },
        ],
      },
      {
        type: 'toggles',
        title: 'Email 通知設定',
        description: '先保存場館公告通知策略，之後你可再逐項微調真正寄信規則。',
        toggles: [
          { field: 'messageCreatedEmailEnabled', label: '新公告發佈後通知會員' },
          { field: 'messageUpdatedEmailEnabled', label: '公告更新後通知會員' },
          { field: 'messageDeletedEmailEnabled', label: '公告刪除後通知會員' },
        ],
      },
    ],
    defaultSettings: {
      venuePublishingEnabled: true,
      memberInboxEnabled: true,
      messageCreatedEmailEnabled: false,
      messageUpdatedEmailEnabled: false,
      messageDeletedEmailEnabled: false,
    },
  },
  live: {
    moduleCode: 'live',
    title: 'Live 模組設定（Super Admin）',
    description: '集中管理直播通告發佈權限、是否同步到 club messages，以及直播通知策略。',
    overviewTab: 'member',
    loadErrorMessage: '讀取 live 模組設定失敗',
    saveSuccessMessage: '已儲存 live 模組設定',
    sections: [
      {
        type: 'toggles',
        title: '營運控制',
        description: '控制場館可否發佈直播通告，以及新直播通告是否同步成為會員場館訊息。',
        toggles: [
          {
            field: 'venuePublishingEnabled',
            label: '允許場館發佈、編輯及刪除直播通告',
            description: '關閉後，場館後台不可再新增、修改或刪除直播通告。',
          },
          {
            field: 'syncToClubMessagesEnabled',
            label: '新直播通告同步到 club messages',
            description: '關閉後，建立直播通告時不再自動寫入會員端場館訊息。',
          },
        ],
      },
      {
        type: 'toggles',
        title: 'Email 通知設定',
        description: '先保存直播通知策略，之後你可再逐項微調真正寄信規則。',
        toggles: [
          { field: 'announcementCreatedEmailEnabled', label: '新直播通告發佈後通知會員' },
          { field: 'announcementUpdatedEmailEnabled', label: '直播通告更新後通知會員' },
          { field: 'announcementDeletedEmailEnabled', label: '直播通告刪除後通知會員' },
        ],
      },
    ],
    defaultSettings: {
      venuePublishingEnabled: true,
      syncToClubMessagesEnabled: true,
      announcementCreatedEmailEnabled: false,
      announcementUpdatedEmailEnabled: false,
      announcementDeletedEmailEnabled: false,
    },
  },
  members: {
    moduleCode: 'members',
    title: 'Members 模組設定（Super Admin）',
    description: '集中管理會員系統的自助註冊、登入入口與會員自行修改資料能力。',
    overviewTab: 'member',
    loadErrorMessage: '讀取 members 模組設定失敗',
    saveSuccessMessage: '已儲存 members 模組設定',
    sections: [
      {
        type: 'toggles',
        title: '註冊與登入入口',
        description: '控制會員可否使用不同註冊方式與 Google 登入。',
        toggles: [
          {
            field: 'emailRegistrationEnabled',
            label: '允許 Email 註冊',
            description: '關閉後，Email 註冊與 Email 驗證碼註冊流程會停用。',
          },
          {
            field: 'phoneRegistrationEnabled',
            label: '允許手機註冊',
            description: '關閉後，純手機號碼註冊流程會停用。',
          },
          {
            field: 'googleLoginEnabled',
            label: '允許 Google 登入',
            description: '關閉後，會員不可再透過 Google 帳戶登入或建立帳號。',
          },
        ],
      },
      {
        type: 'toggles',
        title: '會員自助功能',
        description: '控制忘記密碼、會員自行改資料，以及會員自行改密碼功能。',
        toggles: [
          {
            field: 'passwordResetEnabled',
            label: '允許忘記密碼 / 驗證碼重設密碼',
            description: '關閉後，會員端不可再申請重設密碼驗證碼或使用驗證碼更新密碼。',
          },
          {
            field: 'selfProfileEditEnabled',
            label: '允許會員自行修改資料',
            description: '關閉後，會員中心不可再更新電話、出生日期、地方分區及公開單杆設定。',
          },
          {
            field: 'selfPasswordChangeEnabled',
            label: '允許會員自行更改密碼',
            description: '關閉後，會員中心不可再直接修改登入密碼。',
          },
        ],
      },
    ],
    defaultSettings: {
      emailRegistrationEnabled: true,
      phoneRegistrationEnabled: true,
      googleLoginEnabled: true,
      passwordResetEnabled: true,
      selfProfileEditEnabled: true,
      selfPasswordChangeEnabled: true,
    },
  },
};

export function getModuleSettingsPageConfig(moduleCode: string) {
  return MODULE_SETTINGS_PAGE_REGISTRY[String(moduleCode || '').trim()] || null;
}

export function getModuleSettingsOverviewTab(moduleCode: string) {
  return getModuleSettingsPageConfig(moduleCode)?.overviewTab || 'system';
}
