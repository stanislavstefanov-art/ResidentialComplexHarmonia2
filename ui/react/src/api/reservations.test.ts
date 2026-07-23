import { getSlots, claimSlot } from './reservations';

const BASE = 'http://localhost:5000';

const mockFetch = (body: unknown, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response);
};

afterEach(() => jest.restoreAllMocks());

test('getSlots fetches correct URL', async () => {
  mockFetch({ day: '2026-07-16', slots: [] });
  await getSlots('2026-07-16');
  expect(fetch).toHaveBeenCalledWith(`${BASE}/days/2026-07-16/slots`);
});

test('claimSlot POSTs correct URL with no request body fields', async () => {
  mockFetch({ outcome: 'confirmed-yours' });
  await claimSlot('2026-07-16', 'morning');
  expect(fetch).toHaveBeenCalledWith(
    `${BASE}/days/2026-07-16/slots/morning/claim`,
    expect.objectContaining({ method: 'POST' })
  );
});

test('claimSlot returns outcome on 409', async () => {
  mockFetch({ outcome: 'refused-already-taken' }, 409);
  const result = await claimSlot('2026-07-16', 'morning');
  expect(result.outcome).toBe('refused-already-taken');
});
