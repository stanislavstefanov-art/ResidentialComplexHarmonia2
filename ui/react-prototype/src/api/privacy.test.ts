import { eraseMyContact, eraseContact, markDeparted, purgeExpired } from './privacy';

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
    'http://localhost:5000/directory/H001/contact',
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(result).toBe('erased');
});

test('eraseContact returns not-found for 404', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
  const result = await eraseContact('H999');
  expect(result).toBe('not-found');
});

test('markDeparted calls PUT /directory/{ref}/departed and returns ok', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
  const result = await markDeparted('H001');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:5000/directory/H001/departed',
    expect.objectContaining({ method: 'PUT' }),
  );
  expect(result).toBe('ok');
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
