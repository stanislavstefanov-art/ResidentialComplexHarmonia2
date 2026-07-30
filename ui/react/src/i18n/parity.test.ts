import en from './locales/en.json';
import bg from './locales/bg.json';
import ru from './locales/ru.json';

type NestedRecord = { [key: string]: string | NestedRecord };

function flatKeys(obj: NestedRecord, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' ? flatKeys(v as NestedRecord, path) : [path];
  });
}

function flatEntries(obj: NestedRecord, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object') {
      Object.assign(acc, flatEntries(v as NestedRecord, path));
    } else {
      acc[path] = v as string;
    }
    return acc;
  }, {});
}

const enKeys = new Set(flatKeys(en as NestedRecord));
const bgKeys = new Set(flatKeys(bg as NestedRecord));
const ruKeys = new Set(flatKeys(ru as NestedRecord));

describe('i18n locale parity', () => {
  it('bg has the same keys as en', () => {
    const missingInBg = Array.from(enKeys).filter(k => !bgKeys.has(k));
    const extraInBg   = Array.from(bgKeys).filter(k => !enKeys.has(k));
    expect(missingInBg).toEqual([]);
    expect(extraInBg).toEqual([]);
  });

  it('ru has the same keys as en', () => {
    const missingInRu = Array.from(enKeys).filter(k => !ruKeys.has(k));
    const extraInRu   = Array.from(ruKeys).filter(k => !enKeys.has(k));
    expect(missingInRu).toEqual([]);
    expect(extraInRu).toEqual([]);
  });

  it('no locale has empty string values', () => {
    const checkEmpty = (entries: Record<string, string>, locale: string) => {
      const empties = Object.entries(entries).filter(([, v]) => v === '');
      if (empties.length) throw new Error(`${locale} has empty values: ${empties.map(([k]) => k).join(', ')}`);
    };
    checkEmpty(flatEntries(en as NestedRecord), 'en');
    checkEmpty(flatEntries(bg as NestedRecord), 'bg');
    checkEmpty(flatEntries(ru as NestedRecord), 'ru');
  });
});
