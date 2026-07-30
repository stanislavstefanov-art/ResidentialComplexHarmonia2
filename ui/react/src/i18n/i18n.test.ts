import i18n, { LANG_STORAGE_KEY, SUPPORTED_LANGS } from './index';

describe('i18n', () => {
  it('supports exactly bg, ru, en', () => {
    expect([...SUPPORTED_LANGS]).toEqual(['bg', 'ru', 'en']);
  });

  it('falls back to Bulgarian', () => {
    expect(i18n.options.fallbackLng).toContain('bg');
  });

  it('translates a known key in each language', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('signIn.button')).toBe('Sign in');
    await i18n.changeLanguage('bg');
    expect(i18n.t('signIn.button')).toBe('Вход');
    await i18n.changeLanguage('ru');
    expect(i18n.t('signIn.button')).toBe('Войти');
    await i18n.changeLanguage('en');
  });

  it('persists language choice to localStorage', async () => {
    await i18n.changeLanguage('ru');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('ru');
    await i18n.changeLanguage('en');
  });
});
