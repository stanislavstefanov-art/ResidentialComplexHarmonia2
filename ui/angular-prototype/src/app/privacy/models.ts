export type EraseContactOutcome  = 'erased'   | 'not-found';
export type MarkDepartedOutcome  = 'ok'        | 'not-found';
export interface PurgeExpiredResult { deleted: number; }
