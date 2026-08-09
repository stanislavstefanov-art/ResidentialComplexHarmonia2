export interface PendingSignInDto {
  entraObjectId: string;
  email: string;
  displayName: string;
  firstSeenAt: string;
}

export interface ActivateRequest {
  householdRef: string;
  role: string;
}

export interface PurgeExpiredResult {
  deleted: number;
}
