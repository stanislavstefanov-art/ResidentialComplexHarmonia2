export const isValidEmail = (v: string): boolean =>
  !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
