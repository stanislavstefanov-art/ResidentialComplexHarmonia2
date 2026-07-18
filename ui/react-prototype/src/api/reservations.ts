import { API_BASE } from './config';
import { ClaimResponse, DaySlotsResponse } from '../types';

const BASE = API_BASE;

export async function getSlots(day: string): Promise<DaySlotsResponse> {
  const res = await fetch(`${BASE}/days/${day}/slots`);
  if (!res.ok) throw new Error(`getSlots failed: ${res.status}`);
  return res.json();
}

export async function claimSlot(day: string, slotKey: string): Promise<ClaimResponse> {
  const res = await fetch(`${BASE}/days/${day}/slots/${slotKey}/claim`, { method: 'POST' });
  return res.json();
}
