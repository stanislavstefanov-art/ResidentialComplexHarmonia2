import { listPending, activatePending, purgeExpired } from './adminPending';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

// ── listPending ──
test('listPending calls GET /admin/pending and returns array', async () => {
  const entry = { entraObjectId: 'oid-1', email: 'u@t.com', displayName: 'User', firstSeenAt: '2026-01-01T00:00:00Z' };
  mockFetch([entry]);
  const result = await listPending();
  expect(fetch).toHaveBeenCalledWith(`${BASE}/admin/pending`, expect.any(Object));
  expect(result).toEqual([entry]);
});

test('listPending throws with status 403 on forbidden', async () => {
  mockFetch(null, 403);
  await expect(listPending()).rejects.toMatchObject({ status: 403 });
});

test('listPending throws on 500', async () => {
  mockFetch(null, 500);
  await expect(listPending()).rejects.toThrow();
});

// ── activatePending ──
test('activatePending POSTs to /admin/pending/{oid}/activate', async () => {
  mockFetch(null, 200);
  await activatePending('oid-1', 'AP-101', 'Owner');
  expect(fetch).toHaveBeenCalledWith(
    `${BASE}/admin/pending/oid-1/activate`,
    expect.objectContaining({ method: 'POST' }),
  );
});

test('activatePending throws with status 403 on forbidden', async () => {
  mockFetch(null, 403);
  await expect(activatePending('oid-1', 'AP-101', 'Owner')).rejects.toMatchObject({ status: 403 });
});

test('activatePending throws with status 404 on not found', async () => {
  mockFetch(null, 404);
  await expect(activatePending('oid-1', 'AP-101', 'Owner')).rejects.toMatchObject({ status: 404 });
});

test('activatePending throws with status 409 on conflict', async () => {
  mockFetch(null, 409);
  await expect(activatePending('oid-1', 'AP-101', 'Owner')).rejects.toMatchObject({ status: 409 });
});

// ── purgeExpired ──
test('purgeExpired calls DELETE /admin/pending/purge-expired and returns count', async () => {
  mockFetch({ deleted: 3 });
  const result = await purgeExpired();
  expect(fetch).toHaveBeenCalledWith(
    `${BASE}/admin/pending/purge-expired`,
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(result).toEqual({ deleted: 3 });
});

test('purgeExpired throws with status 403 on forbidden', async () => {
  mockFetch(null, 403);
  await expect(purgeExpired()).rejects.toMatchObject({ status: 403 });
});
