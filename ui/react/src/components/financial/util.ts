export function formatEur(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
