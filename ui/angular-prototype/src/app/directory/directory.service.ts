import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DirectoryEntry, DirectoryListResponse, UpdateContactRequest } from './models';

const API = 'http://localhost:5000';

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly http = inject(HttpClient);

  getDirectory(): Observable<DirectoryEntry[]> {
    return this.http
      .get<DirectoryListResponse>(`${API}/directory`)
      .pipe(map(r => r.entries ?? []));
  }

  updateMyContact(req: UpdateContactRequest): Observable<void> {
    return this.http.put<void>(`${API}/directory/contact`, req);
  }
}
