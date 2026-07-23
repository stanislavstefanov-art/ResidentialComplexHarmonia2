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
}
