export type MemberCapability = 'booking.create' | 'tournament.signup';

export type MemberEligibilityRecord = {
  id: string;
  email?: string | null;
  email_verified_at?: Date | null;
  member_tier?: 'BASIC' | 'VERIFIED' | null;
};

export function resolveMemberTier(member: MemberEligibilityRecord | null | undefined): 'BASIC' | 'VERIFIED' {
  if (member?.member_tier === 'VERIFIED') return 'VERIFIED';
  if (member?.email_verified_at) return 'VERIFIED';
  return 'BASIC';
}

export function isVerifiedMember(member: MemberEligibilityRecord | null | undefined): boolean {
  return resolveMemberTier(member) === 'VERIFIED';
}

export function getCapabilityEligibilityError(capability: MemberCapability) {
  switch (capability) {
    case 'booking.create':
      return {
        status: 403,
        error: '此功能只限認證會員使用，請先完成 Email 驗證',
        code: 'member_not_verified',
      };
    case 'tournament.signup':
      return {
        status: 403,
        error: '比賽報名只限認證會員使用，請先完成 Email 驗證',
        code: 'member_not_verified',
      };
    default:
      return {
        status: 403,
        error: '此功能只限認證會員使用',
        code: 'member_not_verified',
      };
  }
}

export function ensureMemberCapability(member: MemberEligibilityRecord | null | undefined, capability: MemberCapability) {
  if (isVerifiedMember(member)) {
    return { ok: true as const };
  }
  return { ok: false as const, ...getCapabilityEligibilityError(capability) };
}
