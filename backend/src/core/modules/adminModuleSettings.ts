import { getBookingModuleSettings, normalizeMemberRequirementLevel, updateBookingModuleSettings } from './bookingSettings.js';
import { getClubMessagesModuleSettings, updateClubMessagesModuleSettings } from './clubMessagesSettings.js';
import { getLiveModuleSettings, updateLiveModuleSettings } from './liveSettings.js';
import { getMembersModuleSettings, updateMembersModuleSettings } from './membersSettings.js';
import { getPointsModuleSettings, updatePointsModuleSettings } from './pointsSettings.js';
import {
  getTournamentsModuleSettings,
  normalizeMemberRequirementLevel as normalizeTournamentMemberRequirementLevel,
  updateTournamentsModuleSettings,
} from './tournamentsSettings.js';

export type AdminModuleSettingsHandler = {
  moduleCode: string;
  pageLabel: string;
  getSettings: () => Promise<any>;
  updateSettings: (body: Record<string, any>) => Promise<any>;
};

const ADMIN_MODULE_SETTINGS_HANDLERS: Record<string, AdminModuleSettingsHandler> = {
  booking: {
    moduleCode: 'booking',
    pageLabel: 'Booking 設定頁',
    getSettings: () => getBookingModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (body.bookingCreateRequirement !== undefined) {
        patch.bookingCreateRequirement = normalizeMemberRequirementLevel(body.bookingCreateRequirement);
      }
      if (typeof body.reservationCreatedEmailEnabled === 'boolean') {
        patch.reservationCreatedEmailEnabled = body.reservationCreatedEmailEnabled;
      }
      if (typeof body.reservationConfirmedEmailEnabled === 'boolean') {
        patch.reservationConfirmedEmailEnabled = body.reservationConfirmedEmailEnabled;
      }
      if (typeof body.reservationCancelledEmailEnabled === 'boolean') {
        patch.reservationCancelledEmailEnabled = body.reservationCancelledEmailEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updateBookingModuleSettings(patch);
    },
  },
  tournaments: {
    moduleCode: 'tournaments',
    pageLabel: 'Tournaments 設定頁',
    getSettings: () => getTournamentsModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (body.tournamentSignupRequirement !== undefined) {
        patch.tournamentSignupRequirement = normalizeTournamentMemberRequirementLevel(body.tournamentSignupRequirement);
      }
      if (typeof body.signupCreatedEmailEnabled === 'boolean') {
        patch.signupCreatedEmailEnabled = body.signupCreatedEmailEnabled;
      }
      if (typeof body.signupConfirmedEmailEnabled === 'boolean') {
        patch.signupConfirmedEmailEnabled = body.signupConfirmedEmailEnabled;
      }
      if (typeof body.signupCancelledEmailEnabled === 'boolean') {
        patch.signupCancelledEmailEnabled = body.signupCancelledEmailEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updateTournamentsModuleSettings(patch);
    },
  },
  points: {
    moduleCode: 'points',
    pageLabel: 'Points 設定頁',
    getSettings: () => getPointsModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (typeof body.clubPointsConfigEditable === 'boolean') {
        patch.clubPointsConfigEditable = body.clubPointsConfigEditable;
      }
      if (typeof body.manualAdjustmentEnabled === 'boolean') {
        patch.manualAdjustmentEnabled = body.manualAdjustmentEnabled;
      }
      if (typeof body.manualAdjustmentEmailEnabled === 'boolean') {
        patch.manualAdjustmentEmailEnabled = body.manualAdjustmentEmailEnabled;
      }
      if (typeof body.settlementDeductionEmailEnabled === 'boolean') {
        patch.settlementDeductionEmailEnabled = body.settlementDeductionEmailEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updatePointsModuleSettings(patch);
    },
  },
  club_messages: {
    moduleCode: 'club_messages',
    pageLabel: 'Club Messages 設定頁',
    getSettings: () => getClubMessagesModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (typeof body.venuePublishingEnabled === 'boolean') {
        patch.venuePublishingEnabled = body.venuePublishingEnabled;
      }
      if (typeof body.memberInboxEnabled === 'boolean') {
        patch.memberInboxEnabled = body.memberInboxEnabled;
      }
      if (typeof body.messageCreatedEmailEnabled === 'boolean') {
        patch.messageCreatedEmailEnabled = body.messageCreatedEmailEnabled;
      }
      if (typeof body.messageUpdatedEmailEnabled === 'boolean') {
        patch.messageUpdatedEmailEnabled = body.messageUpdatedEmailEnabled;
      }
      if (typeof body.messageDeletedEmailEnabled === 'boolean') {
        patch.messageDeletedEmailEnabled = body.messageDeletedEmailEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updateClubMessagesModuleSettings(patch);
    },
  },
  live: {
    moduleCode: 'live',
    pageLabel: 'Live 設定頁',
    getSettings: () => getLiveModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (typeof body.venuePublishingEnabled === 'boolean') {
        patch.venuePublishingEnabled = body.venuePublishingEnabled;
      }
      if (typeof body.syncToClubMessagesEnabled === 'boolean') {
        patch.syncToClubMessagesEnabled = body.syncToClubMessagesEnabled;
      }
      if (typeof body.announcementCreatedEmailEnabled === 'boolean') {
        patch.announcementCreatedEmailEnabled = body.announcementCreatedEmailEnabled;
      }
      if (typeof body.announcementUpdatedEmailEnabled === 'boolean') {
        patch.announcementUpdatedEmailEnabled = body.announcementUpdatedEmailEnabled;
      }
      if (typeof body.announcementDeletedEmailEnabled === 'boolean') {
        patch.announcementDeletedEmailEnabled = body.announcementDeletedEmailEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updateLiveModuleSettings(patch);
    },
  },
  members: {
    moduleCode: 'members',
    pageLabel: 'Members 設定頁',
    getSettings: () => getMembersModuleSettings(),
    updateSettings: async (body) => {
      const patch: Record<string, any> = {};
      if (typeof body.emailRegistrationEnabled === 'boolean') {
        patch.emailRegistrationEnabled = body.emailRegistrationEnabled;
      }
      if (typeof body.phoneRegistrationEnabled === 'boolean') {
        patch.phoneRegistrationEnabled = body.phoneRegistrationEnabled;
      }
      if (typeof body.googleLoginEnabled === 'boolean') {
        patch.googleLoginEnabled = body.googleLoginEnabled;
      }
      if (typeof body.passwordResetEnabled === 'boolean') {
        patch.passwordResetEnabled = body.passwordResetEnabled;
      }
      if (typeof body.selfProfileEditEnabled === 'boolean') {
        patch.selfProfileEditEnabled = body.selfProfileEditEnabled;
      }
      if (typeof body.selfPasswordChangeEnabled === 'boolean') {
        patch.selfPasswordChangeEnabled = body.selfPasswordChangeEnabled;
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('no_valid_fields');
      }
      return updateMembersModuleSettings(patch);
    },
  },
};

export function getAdminModuleSettingsHandler(moduleCode: string) {
  return ADMIN_MODULE_SETTINGS_HANDLERS[String(moduleCode || '').trim()] || null;
}
