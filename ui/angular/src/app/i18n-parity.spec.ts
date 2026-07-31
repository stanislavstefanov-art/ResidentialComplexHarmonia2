import en from '../../public/assets/i18n/en.json';
import bg from '../../public/assets/i18n/bg.json';
import ru from '../../public/assets/i18n/ru.json';

const flatKeys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatKeys(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );

describe('i18n locale parity', () => {
  it('bg contains all keys from en', () => {
    expect(flatKeys(bg)).toEqual(expect.arrayContaining(flatKeys(en)));
    expect(flatKeys(en)).toEqual(expect.arrayContaining(flatKeys(bg)));
  });

  it('ru contains all keys from en', () => {
    expect(flatKeys(ru)).toEqual(expect.arrayContaining(flatKeys(en)));
    expect(flatKeys(en)).toEqual(expect.arrayContaining(flatKeys(ru)));
  });
});
