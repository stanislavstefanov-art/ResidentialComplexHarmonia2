export interface DirectoryEntry {
  householdRef: string;
  displayName: string | null;
}

export interface DirectoryListResponse {
  entries: DirectoryEntry[];
}

export interface DirectoryEntryAdmin {
  householdRef: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isOptedOut: boolean;
  deactivatedAt: string | null;
}

export interface AdminDirectoryListResponse {
  entries: DirectoryEntryAdmin[];
}

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  isOptedOut?: boolean | null;
}

export interface AdminUpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isOptedOut?: boolean | null;
}

export interface MyContact {
  displayName: string;
  phone: string;
  email: string;
  isOptedOut: boolean;
}

export interface AdminContact {
  displayName: string;
  phone: string;
  email: string;
  notes: string;
  isOptedOut: boolean;
}

export type Role = 'resident' | 'admin';
