import { getMyStatus } from './me';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getMyStatus calls GET /me and returns status ok', async () => {
  mockFetch({ status: 'ok' });
  const result = await getMyStatus();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/me`, expect.any(Object));
  expect(result).toEqual({ status: 'ok' });
});

test('getMyStatus returns status pending', async () => {
  mockFetch({ status: 'pending' });
  const result = await getMyStatus();
  expect(result).toEqual({ status: 'pending' });
});

test('getMyStatus throws with status 403 on forbidden', async () => {
  mockFetch(null, 403);
  await expect(getMyStatus()).rejects.toMatchObject({ status: 403 });
});
