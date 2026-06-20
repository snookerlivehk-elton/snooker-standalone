import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import VenueDashboard from './VenueDashboard';

type VenueDashboardTab = 'home' | 'booking' | 'qr' | 'points' | 'highbreak' | 'content' | 'members';
type VenueDashboardContentSection = 'live' | 'club_messages' | 'tournaments';

const MODULE_PAGE_META: Record<string, { tab: VenueDashboardTab; section?: VenueDashboardContentSection; title: string; description: string }> = {
  club_dashboard: {
    tab: 'home',
    title: '場館主頁設定',
    description: '獨立管理場館公開資料、首頁曝光與公開頁顯示內容。',
  },
  booking: {
    tab: 'booking',
    title: '預約與球枱管理',
    description: '集中處理球枱、價目、預約、封鎖時段與進行中台鐘。',
  },
  qr_session: {
    tab: 'qr',
    title: '掃碼起鐘管理',
    description: '集中管理球枱 QR、掃碼開台與進行中的台鐘。',
  },
  points: {
    tab: 'points',
    title: '消費積分管理',
    description: '集中查看餘額、交易記錄與會員積分調整。',
  },
  highbreak: {
    tab: 'highbreak',
    title: '單杆管理',
    description: '集中維護單杆紀錄、排行榜與場館榜單。',
  },
  live: {
    tab: 'content',
    section: 'live',
    title: '直播內容管理',
    description: '集中管理直播公告與公開頁直播入口。',
  },
  club_messages: {
    tab: 'content',
    section: 'club_messages',
    title: '場館訊息管理',
    description: '集中發送與管理場館會員訊息。',
  },
  tournaments: {
    tab: 'content',
    section: 'tournaments',
    title: '比賽管理',
    description: '集中管理比賽資料、公開顯示與報名審核。',
  },
  members: {
    tab: 'members',
    title: '場館會員管理',
    description: '集中管理場館會員、暱稱、評分與地區資料。',
  },
};

const VenueModulePage: React.FC = () => {
  const { moduleCode = '' } = useParams();
  const meta = MODULE_PAGE_META[String(moduleCode || '').trim()];
  if (!meta) return <Navigate to="/venue/modules" replace />;
  return (
    <VenueDashboard
      forcedTab={meta.tab}
      forcedSection={meta.section}
      standaloneTitle={meta.title}
      standaloneDescription={meta.description}
    />
  );
};

export default VenueModulePage;
