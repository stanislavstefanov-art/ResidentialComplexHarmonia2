import { getDirectory, getAdminDirectory } from './directory';

jest.mock('./config', () => ({
  API_BASE: '',
  apiFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiFetch } = require('./config') as { apiFetch: jest.Mock };

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

afterEach(() => jest.clearAllMocks());

describe('getDirectory', () => {
  // The API returns a BARE array. Regression guard for the crash where
  // `body.entries` resolved to Array.prototype.entries (a function) and was
  // handed to setState, producing `Object.entries(undefined)` at render.
  it('returns the array when the API responds with a bare array', async () => {
    apiFetch.mockResolvedValue(jsonResponse([{ householdRef: 'A-101', displayName: 'Alice' }]));
    const result = await getDirectory();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].householdRef).toBe('A-101');
  });

  it('returns an empty array for a bare empty array (never Array.prototype.entries)', async () => {
    apiFetch.mockResolvedValue(jsonResponse([]));
    const result = await getDirectory();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(typeof (result as unknown)).not.toBe('function');
  });

  it('tolerates a wrapped { entries } shape', async () => {
    apiFetch.mockResolvedValue(jsonResponse({ entries: [{ householdRef: 'B-202', displayName: 'Bob' }] }));
    const result = await getDirectory();
    expect(result).toHaveLength(1);
    expect(result[0].householdRef).toBe('B-202');
  });
});

describe('getAdminDirectory', () => {
  it('returns the array when the API responds with a bare array', async () => {
    apiFetch.mockResolvedValue(jsonResponse([
      { householdRef: 'A-101', displayName: 'Alice', isOptedOut: false },
    ]));
    const result = await getAdminDirectory();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('returns an empty array for a bare empty array', async () => {
    apiFetch.mockResolvedValue(jsonResponse([]));
    const result = await getAdminDirectory();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});
