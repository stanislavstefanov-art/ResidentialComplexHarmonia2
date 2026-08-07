export interface MyContactDto {
  displayName: string | null;
  phone: string | null;
  email: string | null;
  isOptedOut: boolean;
}

export interface UpdateContactRequest {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  optedOut?: boolean | null;
}
