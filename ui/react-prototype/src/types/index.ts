export interface DirectoryEntry {
  householdRef: string;
  displayName: string | null;
}

export interface DirectoryListResponse {
  entries: DirectoryEntry[];
}

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  isOptedOut?: boolean | null;
}

export interface MyContact {
  displayName: string;
  phone: string;
  email: string;
  isOptedOut: boolean;
}
