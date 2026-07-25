export interface PendingSignInDto {
  entraObjectId: string;
  email: string;
  displayName: string;
  firstSeenAt: string;
}

export interface ActivateRequest {
  householdRef: string;
}

export interface PurgeExpiredResult {
  deleted: number;
}
