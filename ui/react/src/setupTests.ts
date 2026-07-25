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

// MUI X DataGrid uses TextEncoder which JSDOM doesn't provide; supply from Node's util module.
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder, TextDecoder } = require('node:util');
  globalThis.TextEncoder = TextEncoder;
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
}
