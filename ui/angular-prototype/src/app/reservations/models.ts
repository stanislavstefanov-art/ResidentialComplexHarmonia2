export type SlotState = 'free' | 'taken-mine' | 'taken-other';

export interface Slot {
  slotKey: string;
  state: SlotState;
}

export interface DaySlotsResponse {
  day: string;
  slots: Slot[];
}

export interface ClaimResponse {
  outcome: 'confirmed-yours' | 'refused-already-taken' | 'couldnt-confirm';
}
