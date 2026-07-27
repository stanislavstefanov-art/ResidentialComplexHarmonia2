import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${API}/me`);
  }
}
