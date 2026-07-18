import { API_BASE } from './config';
import { NotificationRecordDto, AnnouncementRequest } from '../types';

const BASE = API_BASE;

export async function getHistory(): Promise<NotificationRecordDto[]> {
  const res = await fetch(`${BASE}/notifications`);
  if (!res.ok) throw new Error(`getHistory failed: ${res.status}`);
  return res.json();
}

export async function sendAnnouncement(req: AnnouncementRequest): Promise<void> {
  const res = await fetch(`${BASE}/notifications/announce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`sendAnnouncement failed: ${res.status}`);
}
