import { API_BASE, apiFetch } from './config';
import { NotificationRecordDto, AnnouncementRequest } from '../types';

const BASE = API_BASE;

export async function getHistory(): Promise<NotificationRecordDto[]> {
  const res = await apiFetch(`${BASE}/notifications`);
  if (!res.ok) throw new Error(`getHistory failed: ${res.status}`);
  return res.json();
}

export async function sendAnnouncement(req: AnnouncementRequest): Promise<void> {
  const res = await apiFetch(`${BASE}/notifications/announce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`sendAnnouncement failed: ${res.status}`);
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}/notifications/vapid-public-key`);
  if (!res.ok) throw new Error('Failed to load VAPID key');
  const data = await res.json();
  return data.publicKey as string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)));
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function subscribeToPush(): Promise<void> {
  const vapidKey = await getVapidPublicKey();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const p256dh = sub.getKey('p256dh');
  const auth   = sub.getKey('auth');
  if (!p256dh || !auth) throw new Error('Push subscription missing keys');
  const res = await apiFetch(`${BASE}/notifications/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint:   sub.endpoint,
      p256dhKey:  arrayBufferToBase64(p256dh),
      authKey:    arrayBufferToBase64(auth),
    }),
  });
  if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  const res = await apiFetch(`${BASE}/notifications/subscribe`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`unsubscribe failed: ${res.status}`);
}
