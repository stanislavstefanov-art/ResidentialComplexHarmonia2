import { eraseMyContact, eraseContact, markDeparted, removeResident, purgeExpired } from './privacy';

beforeEach(() => { (global.fetch as jest.Mock) = jest.fn(); });

test('eraseMyContact calls DELETE /directory/contact', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });
  await eraseMyContact();
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/contact',
    expect.objectContaining({ method: 'DELETE' }),
  );
});

test('eraseContact returns erased for 204', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });
  const result = await eraseContact('H001');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/board/contact?householdRef=H001',
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(result).toBe('erased');
});

test('eraseContact returns not-found for 404', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  const result = await eraseContact('H999');
  expect(result).toBe('not-found');
});

test('markDeparted calls DELETE /directory/board/departed and returns ok', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
  const result = await markDeparted('H001');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/board/departed?householdRef=H001',
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(result).toBe('ok');
});

test('markDeparted returns not-found for 404', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  const result = await markDeparted('H999');
  expect(result).toBe('not-found');
});

test('removeResident puts ref and role in the query string', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });
  await removeResident('X3 АП1', 'Owner');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/board/resident?householdRef=X3%20%D0%90%D0%9F1&role=Owner',
    expect.objectContaining({ method: 'DELETE' }),
  );
});

test('removeResident encodes a multi-apartment ref (contains "/") in the query', async () => {
  // Regression: refs like "X3 АП1/2" must be %2F-encoded in the query, never in a
  // path segment — ASP.NET Core leaves %2F undecoded in path segments so the DELETE
  // matched 0 rows and the resident silently reappeared.
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });
  await removeResident('X3 АП1/2', 'Owner');
  const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
  expect(url).toBe(
    'http://localhost:5000/directory/board/resident?householdRef=' +
      encodeURIComponent('X3 АП1/2') + '&role=Owner',
  );
  expect(url).toContain('%2F');            // the slash is encoded…
  expect(url).not.toMatch(/АП1\/2/);       // …and never appears raw in the path
});

test('purgeExpired calls DELETE /directory/purge-expired and returns count', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ deleted: 3 }) });
  const result = await purgeExpired();
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/purge-expired',
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(result).toEqual({ deleted: 3 });
});
