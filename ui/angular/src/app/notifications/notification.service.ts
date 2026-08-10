import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationRecordDto, AnnouncementRequest } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getHistory(): Observable<NotificationRecordDto[]> {
    return this.http.get<NotificationRecordDto[]>(`${this.base}/notifications`);
  }

  sendAnnouncement(body: AnnouncementRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/announce`, body);
  }

  getVapidPublicKey(): Observable<{ publicKey: string }> {
    return this.http.get<{ publicKey: string }>(`${this.base}/notifications/vapid-public-key`);
  }

  saveSubscription(endpoint: string, p256dhKey: string, authKey: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/subscribe`, { endpoint, p256dhKey, authKey });
  }

  removeSubscription(): Observable<void> {
    return this.http.delete<void>(`${this.base}/notifications/subscribe`);
  }
}
