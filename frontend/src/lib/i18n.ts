type Lang = 'zh' | 'en';

const STORAGE_KEY = 'app_lang';

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  const v = (localStorage.getItem(STORAGE_KEY) || 'zh').toLowerCase();
  return (v === 'en' ? 'en' : 'zh');
}

export function setLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
}

const dict: Record<Lang, Record<string, string>> = {
  zh: {
    'common.freeBall': '自由球',
    'common.foul': '犯規',
    'common.miss': '失誤',
    'common.safe': '防守',
    'common.undo': '回退一步',
    'common.switchPlayer': '切換球員',
    'common.concedeFrame': '認輸本局',
    'common.hitting': '擊球',
    'common.respotBlack': '重放黑球',
    'common.redsLeft': '紅球剩餘',
    'common.break': '單桿',
    'common.breakTime': '單桿時間',
    'common.lead': '領先',
    'common.remaining': '剩餘分',
    'overlay.wait': '等待房間資料…（請在計分板操作一次）',
    'score.frameOver': '本局結束',
    'score.matchOver': '比賽結束',
    'score.winMatch': '勝出！',
    'score.winFrame': '贏下本局！',
    'score.endMatchAndView': '結束比賽並查看統計',
    'score.nextFrame': '下一局',
    'score.finalizing': '正在封存比賽資料…',
    'score.uploadingFrame': '正在上傳本局資料…',
    'score.uploadSuccess': '資料上傳成功！',
    'score.uploadSaved': '統計已保存至資料庫。',
    'score.startNextFrame': '開始下一局',
    'score.redirecting': '即將跳轉到統計頁…',
    'score.uploadSkipped': '未上傳資料',
    'score.uploadSkippedReason': '訪客比賽或會員無效，未保存資料。',
    'score.retryUpload': '重試上傳',
    'score.forceStart': '跳過並開始',
    'score.skipExit': '跳過並離開',
    'setup.tagline': '直播計分系統',
    'setup.roomOperator': '場館/球會',
    'setup.create': '建立賽事',
    'setup.matchName': '賽事名稱：',
    'setup.fullName': '姓名：',
    'setup.email': '電郵',
    'setup.sendCode': '發碼',
    'setup.verifyCode': '驗證碼',
    'setup.verifyPlaceholder': '6 位數字',
    'setup.handicap': '讓分',
    'setup.reds': '紅球數量：',
    'setup.frames': '局數：',
    'setup.starting': '先手球員：',
    'setup.startMatch': '開始比賽',
    'live.frameTime': '局用時',
    'live.matchTime': '比賽用時',
    'live.last': '上一桿：',
    'live.stats': '即時數據 — ',
  },
  en: {
    'common.freeBall': 'Free Ball',
    'common.foul': 'Foul',
    'common.miss': 'Miss',
    'common.safe dir': 'Safety',
    'common.safe': 'Safety',
    'common.undo': 'Undo',
    'common.switchPlayer': 'Switch Player',
    'common.concedeFrame': 'Concede Frame',
    'common.hitting': 'Balling',
    'common.respotBlack': 'Re-spot Black',
    'common.redsLeft': 'Reds Left',
    'common.break': 'Break',
    'common.breakTime': 'Break Time',
    'common.lead': 'Lead',
    'common.remaining': 'Remaining',
    'overlay.wait': 'Waiting for room state… (Operate on the scoreboard once)',
    'score.frameOver': 'Frame Over',
    'score.matchOver': 'Match Over',
    'score.winMatch': 'wins the match!',
    'score.winFrame': 'wins the frame!',
    'score.endMatchAndView': 'End Match & View Stats',
    'score.nextFrame': 'Next Frame',
    'score.finalizing': 'Finalizing Match Data…',
    'score.uploadingFrame': 'Uploading Frame Data…',
    'score.uploadSuccess': 'Data Uploaded Successfully!',
    'score.uploadSaved': 'Match stats saved to database.',
    'score.startNextFrame': 'Start Next Frame',
    'score.redirecting': 'Redirecting to stats…',
    'score.uploadSkipped': 'Data Not Uploaded',
    'score.uploadSkippedReason': 'Guest match or invalid members. No data saved.',
    'score.retryUpload': 'Retry Upload',
    'score.forceStart': 'Force Start (Skip)',
    'score.skipExit': 'Skip & Exit',
    'setup.tagline': 'Scoreboard System',
    'setup.roomOperator': 'Room Operator',
    'setup.create': 'Create Match',
    'setup.matchName': 'Match Name:',
    'setup.fullName': 'Full Name:',
    'setup.email': 'Email',
    'setup.sendCode': 'Code',
    'setup.verifyCode': 'Verify Code',
    'setup.verifyPlaceholder': '6-digit',
    'setup.handicap': 'Handicap',
    'setup.reds': 'Number of Reds:',
    'setup.frames': 'Number of Frames:',
    'setup.starting': 'Starting Player:',
    'setup.startMatch': 'Start Match',
    'live.frameTime': 'Frame Time',
    'live.matchTime': 'Match Time',
    'live.last': 'Last: ',
    'live.stats': 'Live Stats — ',
  },
};

export function t(key: string): string {
  const lang = getLang();
  const table = dict[lang] || dict.zh;
  return table[key] ?? key;
}
