// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// MSAL 5.x requires the Web Crypto API; provide it from Node's built-in in jest/JSDOM.
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Object.defineProperty(globalThis, 'crypto', {
    value: require('node:crypto').webcrypto,
    configurable: true,
  });
}

// Some deps use TextEncoder/TextDecoder which JSDOM doesn't provide; supply from Node's util module.
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder, TextDecoder } = require('node:util');
  globalThis.TextEncoder = TextEncoder;
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
}

// i18n: run the suite in English so existing English-text assertions hold.
// Real users default to Bulgarian (see src/i18n/index.ts).
import i18n from './i18n';
beforeAll(async () => {
  await i18n.changeLanguage('en');
});
