export interface Counterparty {
  id: string;
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyInput {
  name: string;
  category: string;
  parentCategory: string;
  vatNumber: string | null;
  phone: string | null;
  email: string | null;
}
